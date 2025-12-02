#!/usr/bin/env bash
#
# Server Domain Violation Detector
#
# Analyzes TypeScript files to detect violations of the Server domain best practices.
# Outputs structured JSON or text for consumption by AI code review agents.
#
# Usage:
#   detect_violations.sh [OPTIONS]
#
# Options:
#   --files FILE1 FILE2 ...   Analyze specific files
#   --all                     Analyze all TypeScript files in src/server/
#   --format json|text|pr     Output format (default: json)
#   --root DIR                Project root (default: current directory)
#   --help                    Show this help
#
# Examples:
#   detect_violations.sh --all --format text
#   detect_violations.sh --files src/server/actions/chat.ts --format pr
#

# Don't use set -e because grep returns 1 when no matches found
set -uo pipefail

# Default values
FORMAT="json"
ROOT_DIR="."
FILES=()
ANALYZE_ALL=false

# Temp file for violations
VIOLATIONS_FILE=$(mktemp)
trap "rm -f $VIOLATIONS_FILE" EXIT

# Counter
TOTAL_FILES=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

usage() {
    head -25 "$0" | grep -E "^#" | sed 's/^# \?//'
    exit 0
}

add_violation() {
    local rule_id="$1"
    local rule_name="$2"
    local severity="$3"
    local file_path="$4"
    local line_num="$5"
    local message="$6"
    local suggestion="$7"
    local code_snippet="$8"
    local guide_ref="$9"

    # Escape special characters for JSON
    code_snippet=$(echo "$code_snippet" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\t/  /g' | tr -d '\n')
    message=$(echo "$message" | sed 's/"/\\"/g')
    suggestion=$(echo "$suggestion" | sed 's/"/\\"/g')

    # Append JSON object to temp file
    echo "{\"rule_id\":\"$rule_id\",\"rule_name\":\"$rule_name\",\"severity\":\"$severity\",\"file_path\":\"$file_path\",\"line_number\":$line_num,\"message\":\"$message\",\"suggestion\":\"$suggestion\",\"code_snippet\":\"$code_snippet\",\"guide_reference\":\"$guide_ref\"}" >> "$VIOLATIONS_FILE"
}

# ============================================================================
# DETECTION RULES
# ============================================================================

# S001: Check for module-level database/auth instances
check_module_level_instances() {
    local file="$1"

    # Check for module-level db assignment (not inside a function)
    grep -n "^const db = \|^let db = \|^export const db = " "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S001" \
            "Module-level database instance" \
            "error" \
            "$file" \
            "$line_num" \
            "Module-level database instances break Cloudflare Workers per-request isolation" \
            "Use createDb() inside loadConfig() wrapped in createServerOnlyFn()" \
            "$content" \
            "docs/architecture/domains/server.md#31-per-request-isolation-critical"
    done || true

    # Check for module-level auth assignment
    grep -n "^const auth = \|^let auth = \|^export const auth = " "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S001" \
            "Module-level auth instance" \
            "error" \
            "$file" \
            "$line_num" \
            "Module-level auth instances break Cloudflare Workers per-request isolation" \
            "Use getAuth(db) inside loadConfig() wrapped in createServerOnlyFn()" \
            "$content" \
            "docs/architecture/domains/server.md#31-per-request-isolation-critical"
    done || true
}

# S002: Check for queries without user ownership filter
#
# This check looks for DELETE/UPDATE operations that may be missing user ownership
# verification. It handles several patterns to avoid false positives:
#
# 1. Multi-line and() - checks next 5 lines for and() with userId/user.id
# 2. Prior ownership check - looks for ownership verification before the operation
# 3. userId-keyed tables - recognizes when userId IS the primary filter (e.g., apiKey table)
#
check_missing_user_filter() {
    local file="$1"

    # Only check action files
    if [[ "$file" != *"/actions/"* ]]; then
        return
    fi

    # Helper: Check if a code block (lines) contains user ownership filter
    # Returns 0 (true) if ownership is present, 1 (false) if missing
    has_user_ownership_in_context() {
        local file="$1"
        local start_line="$2"
        local context_lines="${3:-5}"

        # Get the operation and following lines (for multi-line .where(and(...)))
        local end_line=$((start_line + context_lines))
        local context
        context=$(sed -n "${start_line},${end_line}p" "$file")

        # Pattern 1: and() with userId or user.id in the context
        if echo "$context" | grep -qE "and\s*\(" && echo "$context" | grep -qE "userId|user\.id|context\.user\.id"; then
            return 0
        fi

        # Pattern 2: Direct userId filter (for user-keyed tables like apiKey)
        # e.g., .where(eq(apiKey.userId, context.user.id))
        if echo "$context" | grep -qE "\.where\s*\(\s*eq\s*\([^,]+\.userId\s*,\s*context\.user\.id\)"; then
            return 0
        fi

        return 1
    }

    # Helper: Check if there's a prior ownership verification in the same handler
    # Looks for pattern: select + where + userId check + throw on not found
    has_prior_ownership_check() {
        local file="$1"
        local op_line="$2"

        # Find the handler start (look backwards for .handler(async)
        local handler_start
        handler_start=$(head -n "$op_line" "$file" | grep -n "\.handler(async" | tail -1 | cut -d: -f1)

        if [[ -z "$handler_start" ]]; then
            return 1
        fi

        # Get code between handler start and our operation
        local handler_context
        handler_context=$(sed -n "${handler_start},${op_line}p" "$file")

        # Look for ownership check pattern:
        # 1. Select from a parent table (e.g., chat) with userId filter
        # 2. Followed by a throw/error if not found
        if echo "$handler_context" | grep -qE "\.select\s*\(" && \
           echo "$handler_context" | grep -qE "context\.user\.id" && \
           echo "$handler_context" | grep -qE "throw new Error|throw json"; then
            return 0
        fi

        return 1
    }

    # Find delete operations and check for ownership
    grep -n "\.delete(" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Skip if it's a comment
        if echo "$content" | grep -q "^\s*//"; then
            continue
        fi

        # Check for user ownership in context (multi-line patterns)
        if has_user_ownership_in_context "$file" "$line_num" 5; then
            continue
        fi

        # Check for prior ownership verification in the same handler
        if has_prior_ownership_check "$file" "$line_num"; then
            continue
        fi

        add_violation \
            "S002" \
            "Missing user ownership filter" \
            "error" \
            "$file" \
            "$line_num" \
            "DELETE operation may be missing user ownership check" \
            "Use: .where(and(eq(table.id, id), eq(table.userId, context.user.id))) OR verify ownership before the operation" \
            "$content" \
            "docs/architecture/domains/server.md#65-delete-patterns"
    done || true

    # Find update operations and check for ownership
    grep -n "\.update(" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Skip if it's a comment
        if echo "$content" | grep -q "^\s*//"; then
            continue
        fi

        # Check for user ownership in context (multi-line patterns)
        if has_user_ownership_in_context "$file" "$line_num" 5; then
            continue
        fi

        # Check for prior ownership verification in the same handler
        if has_prior_ownership_check "$file" "$line_num"; then
            continue
        fi

        add_violation \
            "S002" \
            "Missing user ownership filter" \
            "warning" \
            "$file" \
            "$line_num" \
            "UPDATE operation may be missing user ownership check" \
            "Use: .where(and(eq(table.id, id), eq(table.userId, context.user.id))) OR verify ownership before the operation" \
            "$content" \
            "docs/architecture/domains/server.md#64-update-patterns"
    done || true
}

# S003: Check for redundant middleware array
check_redundant_middleware() {
    local file="$1"

    # Find middleware arrays with both globalMiddleware and protectedMiddleware
    grep -n "\.middleware(\[.*globalMiddleware.*protectedMiddleware\|\.middleware(\[.*protectedMiddleware.*globalMiddleware" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S003" \
            "Redundant middleware array" \
            "warning" \
            "$file" \
            "$line_num" \
            "protectedMiddleware already extends globalMiddleware - no need to include both" \
            "Use: .middleware([protectedMiddleware])" \
            "$content" \
            "docs/architecture/domains/server.md#44-middleware-selection"
    done || true

    # Check for authMiddleware + protectedMiddleware
    grep -n "\.middleware(\[.*authMiddleware.*protectedMiddleware\|\.middleware(\[.*protectedMiddleware.*authMiddleware" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S003" \
            "Redundant middleware array" \
            "warning" \
            "$file" \
            "$line_num" \
            "protectedMiddleware already extends authMiddleware - no need to include both" \
            "Use: .middleware([protectedMiddleware])" \
            "$content" \
            "docs/architecture/domains/server.md#44-middleware-selection"
    done || true
}

# S004: Check for redundant user checks after protectedMiddleware
check_redundant_user_check() {
    local file="$1"

    # Skip middleware files - they define the check, not use it redundantly
    if [[ "$file" == *"/middleware/"* ]]; then
        return
    fi

    # Only check action files that use protectedMiddleware
    if [[ "$file" != *"/actions/"* ]]; then
        return
    fi

    if ! grep -q "protectedMiddleware" "$file" 2>/dev/null; then
        return
    fi

    # Find if (!context.user patterns
    grep -n "if (!context\.user\|if(!context\.user\|if (context\.user === null\|if (!context\.user?.id" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S004" \
            "Redundant user check" \
            "warning" \
            "$file" \
            "$line_num" \
            "User check is redundant when using protectedMiddleware (it guarantees user exists)" \
            "Remove manual user check - protectedMiddleware already enforces authentication" \
            "$content" \
            "docs/architecture/domains/server.md#44-middleware-selection"
    done || true
}

# S005: Check for inline type validation instead of Zod
check_inline_type_validation() {
    local file="$1"

    # Find inputValidator with inline type assertion pattern
    grep -n "\.inputValidator(\s*(data:" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S005" \
            "Inline type validation" \
            "error" \
            "$file" \
            "$line_num" \
            "Using inline type assertion instead of Zod schema - no runtime validation" \
            "Define Zod schema at module level: const Schema = z.object({...})" \
            "$content" \
            "docs/architecture/domains/server.md#81-zod-schema-definition"
    done || true

    # Also check for arrow function pattern without zod
    grep -n "\.inputValidator(\s*(\s*[a-z]" "$file" 2>/dev/null | grep -v "z\." | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Skip if already caught
        if echo "$content" | grep -q "(data:"; then
            continue
        fi

        add_violation \
            "S005" \
            "Inline type validation" \
            "error" \
            "$file" \
            "$line_num" \
            "Using inline function instead of Zod schema - no runtime validation" \
            "Define Zod schema at module level: const Schema = z.object({...})" \
            "$content" \
            "docs/architecture/domains/server.md#81-zod-schema-definition"
    done || true
}

# S006: Check for missing input validation on mutations
check_missing_validation() {
    local file="$1"

    # Find createServerFn with handler but no inputValidator for POST (default)
    # This is a heuristic - look for .handler( without .inputValidator( before it

    # Get line numbers of .handler( calls
    grep -n "\.handler(async" "$file" 2>/dev/null | while IFS= read -r line; do
        local handler_line=$(echo "$line" | cut -d: -f1)

        # Check if this handler receives data parameter
        local has_data=$(sed -n "${handler_line}p" "$file" | grep -c "{ context, data }\|{context, data}\|{ data,\|{data,")

        if [[ "$has_data" -gt 0 ]]; then
            # Find the createServerFn() that this handler belongs to
            # Look backwards for createServerFn
            local fn_start
            fn_start=$(head -n "$handler_line" "$file" | grep -n "createServerFn(" | tail -1 | cut -d: -f1)

            if [[ -z "$fn_start" ]]; then
                fn_start=1
            fi

            # Check if there's an inputValidator between createServerFn and handler
            local fn_context
            fn_context=$(sed -n "${fn_start},${handler_line}p" "$file")
            local has_validator
            has_validator=$(echo "$fn_context" | grep -c "\.inputValidator(")

            if [[ "$has_validator" -eq 0 ]]; then
                local content=$(echo "$line" | cut -d: -f2-)
                add_violation \
                    "S006" \
                    "Missing input validation" \
                    "warning" \
                    "$file" \
                    "$handler_line" \
                    "Handler receives data but no .inputValidator() found - input is unvalidated" \
                    "Add .inputValidator(schema) with a Zod schema before .handler()" \
                    "$content" \
                    "docs/architecture/domains/server.md#8-input-validation"
            fi
        fi
    done || true
}

# S007: Check for direct db/auth imports instead of context
check_direct_imports() {
    local file="$1"

    # Only check action files
    if [[ "$file" != *"/actions/"* ]]; then
        return
    fi

    # Find imports of db from ../db
    grep -n "import.*from ['\"].*\/db['\"]" "$file" 2>/dev/null | grep -v "schema" | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Check if it's importing createDb (which is OK for typing)
        if echo "$content" | grep -q "createDb"; then
            continue
        fi

        add_violation \
            "S007" \
            "Direct database import" \
            "error" \
            "$file" \
            "$line_num" \
            "Importing db directly instead of accessing via context.config.db" \
            "Remove import and use: const { db } = context.config;" \
            "$content" \
            "docs/architecture/domains/server.md#32-context-threading"
    done || true

    # Find imports of auth from ../auth
    grep -n "import.*from ['\"].*\/auth['\"]" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Check if it's importing getAuth (which is OK for typing)
        if echo "$content" | grep -q "getAuth"; then
            continue
        fi

        add_violation \
            "S007" \
            "Direct auth import" \
            "error" \
            "$file" \
            "$line_num" \
            "Importing auth directly instead of accessing via context.config.auth" \
            "Remove import and use: const { auth } = context.config;" \
            "$content" \
            "docs/architecture/domains/server.md#32-context-threading"
    done || true
}

# S008: Check for multiple inserts without transaction
check_missing_transaction() {
    local file="$1"

    # Only check action files
    if [[ "$file" != *"/actions/"* ]]; then
        return
    fi

    # Count insert statements in handlers
    # This is a simple heuristic - count .insert( occurrences
    local insert_count
    insert_count=$(grep -c "\.insert(" "$file" 2>/dev/null) || insert_count=0

    if [[ "$insert_count" -gt 1 ]]; then
        # Check if file uses transactions
        local has_transaction
        has_transaction=$(grep -c "\.transaction(" "$file" 2>/dev/null) || has_transaction=0

        if [[ "$has_transaction" -eq 0 ]]; then
            # Find first insert for reporting
            grep -n "\.insert(" "$file" 2>/dev/null | head -1 | while IFS= read -r line; do
                local line_num=$(echo "$line" | cut -d: -f1)
                local content=$(echo "$line" | cut -d: -f2-)

                add_violation \
                    "S008" \
                    "Multiple inserts without transaction" \
                    "warning" \
                    "$file" \
                    "$line_num" \
                    "File has $insert_count insert operations but no transaction - data integrity risk" \
                    "Wrap related inserts in db.transaction(async (tx) => { ... })" \
                    "$content" \
                    "docs/architecture/domains/server.md#66-transaction-patterns"
            done || true
        fi
    fi
}

# S009: Check for createServerFn not assigned to variable
check_serverfn_assignment() {
    local file="$1"

    # Find createServerFn that's not assigned (e.g., inside object literal)
    grep -n ":\s*createServerFn(" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "S009" \
            "createServerFn not assigned to variable" \
            "error" \
            "$file" \
            "$line_num" \
            "createServerFn must be assigned to a top-level variable, not used inline" \
            "Assign to variable first: const action = createServerFn()...; then use in object" \
            "$content" \
            "docs/architecture/domains/server.md#41-canonical-pattern"
    done || true
}

# ============================================================================
# MAIN ANALYSIS
# ============================================================================

analyze_file() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        return
    fi

    TOTAL_FILES=$((TOTAL_FILES + 1))

    # Run all checks
    check_module_level_instances "$file"
    check_missing_user_filter "$file"
    check_redundant_middleware "$file"
    check_redundant_user_check "$file"
    check_inline_type_validation "$file"
    check_missing_validation "$file"
    check_direct_imports "$file"
    check_missing_transaction "$file"
    check_serverfn_assignment "$file"
}

# ============================================================================
# OUTPUT FORMATTING
# ============================================================================

output_json() {
    local violations=""
    local total=0
    local errors=0
    local warnings=0
    local suggestions=0

    if [[ -s "$VIOLATIONS_FILE" ]]; then
        while IFS= read -r v; do
            total=$((total + 1))
            if echo "$v" | grep -q '"severity":"error"'; then
                errors=$((errors + 1))
            elif echo "$v" | grep -q '"severity":"warning"'; then
                warnings=$((warnings + 1))
            else
                suggestions=$((suggestions + 1))
            fi

            if [[ -z "$violations" ]]; then
                violations="$v"
            else
                violations="$violations,$v"
            fi
        done < "$VIOLATIONS_FILE"
    fi

    cat <<EOF
{
  "summary": {
    "total_files_analyzed": $TOTAL_FILES,
    "total_violations": $total,
    "errors": $errors,
    "warnings": $warnings,
    "suggestions": $suggestions
  },
  "violations": [$violations]
}
EOF
}

output_text() {
    local total=0
    local errors=0
    local warnings=0

    if [[ -s "$VIOLATIONS_FILE" ]]; then
        total=$(wc -l < "$VIOLATIONS_FILE" | tr -d ' ')
        errors=$(grep -c '"severity":"error"' "$VIOLATIONS_FILE" 2>/dev/null || echo 0)
        warnings=$(grep -c '"severity":"warning"' "$VIOLATIONS_FILE" 2>/dev/null || echo 0)
    fi

    echo "============================================================"
    echo "SERVER DOMAIN VIOLATION REPORT"
    echo "============================================================"
    echo ""
    echo "Files analyzed: $TOTAL_FILES"
    echo "Total violations: $total"
    echo "  Errors: $errors"
    echo "  Warnings: $warnings"
    echo ""

    if [[ $total -gt 0 ]]; then
        echo "------------------------------------------------------------"
        echo "VIOLATIONS"
        echo "------------------------------------------------------------"
        echo ""

        while IFS= read -r v; do
            local severity=$(echo "$v" | sed 's/.*"severity":"\([^"]*\)".*/\1/' | tr '[:lower:]' '[:upper:]')
            local rule_id=$(echo "$v" | sed 's/.*"rule_id":"\([^"]*\)".*/\1/')
            local file_path=$(echo "$v" | sed 's/.*"file_path":"\([^"]*\)".*/\1/')
            local line_num=$(echo "$v" | sed 's/.*"line_number":\([0-9]*\).*/\1/')
            local message=$(echo "$v" | sed 's/.*"message":"\([^"]*\)".*/\1/')
            local code=$(echo "$v" | sed 's/.*"code_snippet":"\([^"]*\)".*/\1/')
            local suggestion=$(echo "$v" | sed 's/.*"suggestion":"\([^"]*\)".*/\1/')
            local ref=$(echo "$v" | sed 's/.*"guide_reference":"\([^"]*\)".*/\1/')

            echo "$severity: [$rule_id] $file_path:$line_num"
            echo "  $message"
            echo "  Code: $code"
            echo "  Fix: $suggestion"
            echo "  Ref: $ref"
            echo ""
        done < "$VIOLATIONS_FILE"
    else
        echo "No violations found!"
    fi
}

output_pr_comments() {
    local total=0

    if [[ -s "$VIOLATIONS_FILE" ]]; then
        total=$(wc -l < "$VIOLATIONS_FILE" | tr -d ' ')
    fi

    if [[ $total -eq 0 ]]; then
        echo '{"comments": [], "summary": "No server domain violations found."}'
        return
    fi

    echo '{'
    echo "  \"summary\": \"Found $total server domain violations\","
    echo '  "comments": ['

    local first=true
    while IFS= read -r v; do
        if [[ "$first" != true ]]; then
            echo ','
        fi
        first=false

        local severity=$(echo "$v" | sed 's/.*"severity":"\([^"]*\)".*/\1/')
        local rule_id=$(echo "$v" | sed 's/.*"rule_id":"\([^"]*\)".*/\1/')
        local rule_name=$(echo "$v" | sed 's/.*"rule_name":"\([^"]*\)".*/\1/')
        local file_path=$(echo "$v" | sed 's/.*"file_path":"\([^"]*\)".*/\1/')
        local line_num=$(echo "$v" | sed 's/.*"line_number":\([0-9]*\).*/\1/')
        local message=$(echo "$v" | sed 's/.*"message":"\([^"]*\)".*/\1/')
        local code=$(echo "$v" | sed 's/.*"code_snippet":"\([^"]*\)".*/\1/')
        local suggestion=$(echo "$v" | sed 's/.*"suggestion":"\([^"]*\)".*/\1/')
        local ref=$(echo "$v" | sed 's/.*"guide_reference":"\([^"]*\)".*/\1/')

        # Strip leading path components for cleaner display
        local path="${file_path#*/src/}"
        if [[ "$path" == "$file_path" ]]; then
            path="${file_path#./src/}"
        fi

        printf '    {"path": "%s", "line": %s, "severity": "%s", "body": "**%s: %s** (%s)\\n\\n%s\\n\\n```\\n%s\\n```\\n\\n**Suggestion:** %s\\n\\n See: [%s](%s)"}' \
            "$path" "$line_num" "$severity" "$rule_id" "$rule_name" "$severity" "$message" "$code" "$suggestion" "$ref" "$ref"
    done < "$VIOLATIONS_FILE"

    echo ''
    echo '  ]'
    echo '}'
}

# ============================================================================
# CLI PARSING
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --root)
            ROOT_DIR="$2"
            shift 2
            ;;
        --all)
            ANALYZE_ALL=true
            shift
            ;;
        --files)
            shift
            while [[ $# -gt 0 ]] && [[ "$1" != --* ]]; do
                FILES+=("$1")
                shift
            done
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Determine files to analyze
if [[ "$ANALYZE_ALL" == true ]]; then
    while IFS= read -r -d '' file; do
        FILES+=("$file")
    done < <(find "$ROOT_DIR/src/server" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No files to analyze. Use --all or --files." >&2
    exit 1
fi

# Run analysis
for file in "${FILES[@]}"; do
    analyze_file "$file"
done

# Output results
case "$FORMAT" in
    json)
        output_json
        ;;
    text)
        output_text
        ;;
    pr|pr-comments)
        output_pr_comments
        ;;
    *)
        echo "Unknown format: $FORMAT" >&2
        exit 1
        ;;
esac

# Exit with error if violations found
if [[ -s "$VIOLATIONS_FILE" ]] && grep -q '"severity":"error"' "$VIOLATIONS_FILE"; then
    exit 1
fi
exit 0
