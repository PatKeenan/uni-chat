#!/usr/bin/env bash
#
# Client Domain Violation Detector
#
# Analyzes TypeScript files to detect violations of the Client domain best practices.
# Outputs structured JSON or text for consumption by AI code review agents.
#
# Usage:
#   detect_violations.sh [OPTIONS]
#
# Options:
#   --files FILE1 FILE2 ...   Analyze specific files
#   --all                     Analyze all TypeScript files in src/client/
#   --format json|text|pr     Output format (default: json)
#   --root DIR                Project root (default: current directory)
#   --help                    Show this help
#
# Examples:
#   detect_violations.sh --all --format text
#   detect_violations.sh --files src/client/hooks/use-feature.ts --format pr
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

# C001: Check for useQuery without enabled option when params could be null
check_query_missing_enabled() {
    local file="$1"

    # Only check hook files
    if [[ "$file" != *"/hooks/"* ]]; then
        return
    fi

    # Find useQuery calls without enabled
    grep -n "useQuery({" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)

        # Get the next 10 lines to check for enabled
        local block=$(sed -n "${line_num},$((line_num + 10))p" "$file")

        # Check if enabled is present in the block
        if ! echo "$block" | grep -q "enabled:"; then
            local content=$(echo "$line" | cut -d: -f2-)
            add_violation \
                "C001" \
                "Query missing enabled guard" \
                "warning" \
                "$file" \
                "$line_num" \
                "useQuery should have 'enabled' option to guard against null/undefined params" \
                "Add enabled: !!userId && !!otherParam to guard the query" \
                "$content" \
                "docs/architecture/domains/client.md#32-query-hooks"
        fi
    done || true
}

# C002: Check for query keys missing userId
check_query_key_missing_userid() {
    local file="$1"

    # Only check hook files
    if [[ "$file" != *"/hooks/"* ]]; then
        return
    fi

    # Find queryKey definitions that don't include userId pattern
    grep -n 'queryKey:.*\[' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Skip if it references a key factory (likely includes userId)
        if echo "$content" | grep -qE "Keys\.(all|list|detail|lists|details)"; then
            continue
        fi

        # Check for inline arrays without userId
        # Exception: ["local-messages"] is keyed by chatId, not userId (messages belong to chats)
        if echo "$content" | grep -qE '\["local-messages"\]'; then
            continue
        fi

        if echo "$content" | grep -qE '\["[^"]+"\]' && ! echo "$content" | grep -q "userId"; then
            add_violation \
                "C002" \
                "Query key missing userId" \
                "error" \
                "$file" \
                "$line_num" \
                "Query keys must include userId for user isolation" \
                "Add userId to query key: [\\\"feature\\\", userId, ...]" \
                "$content" \
                "docs/architecture/domains/client.md#31-query-key-factories"
        fi
    done || true
}

# C003: Check for direct PGlite instance creation
check_direct_db_instance() {
    local file="$1"

    # Find new PGlite or PGlite.create
    grep -n "new PGlite\|PGlite\.create" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Skip if it's in the db/index.ts file (that's where singleton is defined)
        if [[ "$file" == *"/db/index.ts" ]]; then
            continue
        fi

        add_violation \
            "C003" \
            "Direct database instance creation" \
            "error" \
            "$file" \
            "$line_num" \
            "Never create PGlite instances directly. Use getClientDb() singleton." \
            "Change to: const db = await getClientDb();" \
            "$content" \
            "docs/architecture/domains/client.md#51-database-access"
    done || true
}

# C004: Check for store destructure without selector
check_store_destructure() {
    local file="$1"

    # Find useXStore() without selector (destructuring pattern)
    grep -n 'const {.*} = use.*Store()' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Check if it's using a selector (has arrow function or function inside)
        if ! echo "$content" | grep -qE "Store\((state|s) =>"; then
            add_violation \
                "C004" \
                "Store destructure without selector" \
                "warning" \
                "$file" \
                "$line_num" \
                "Destructuring from store without selector subscribes to entire store" \
                "Use selectors: const field = useStore((state) => state.field)" \
                "$content" \
                "docs/architecture/domains/client.md#43-store-consumption"
        fi
    done || true
}

# C005: Check for derived state in Zustand stores
check_derived_state_in_store() {
    local file="$1"

    # Only check store files
    if [[ "$file" != *"/stores/"* ]]; then
        return
    fi

    # Look for patterns where state is computed from other state in actions
    # Pattern: const X = extract/compute/derive/calculate...
    grep -n "const .* = \(extract\|compute\|derive\|calculate\)" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Check if followed by set() that includes the computed value
        local next_lines=$(sed -n "${line_num},$((line_num + 3))p" "$file")
        if echo "$next_lines" | grep -q "set({"; then
            add_violation \
                "C005" \
                "Derived state in Zustand store" \
                "error" \
                "$file" \
                "$line_num" \
                "Derived state should be computed in hooks, not stored in Zustand" \
                "Move computation to a custom hook: export function useDerivedValue() { return useStore(s => compute(s.source)); }" \
                "$content" \
                "docs/architecture/domains/client.md#42-derived-state"
        fi
    done || true
}

# C006: Check for localStorage without SSR guard
check_localstorage_ssr_guard() {
    local file="$1"

    # Only check storage files
    if [[ "$file" != *"/storage/"* ]]; then
        return
    fi

    # Find localStorage access
    grep -n "localStorage\." "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # Check if there's a typeof window check in the same function
        # Look at surrounding lines
        local start=$((line_num - 5))
        if [[ $start -lt 1 ]]; then start=1; fi
        local block=$(sed -n "${start},${line_num}p" "$file")

        if ! echo "$block" | grep -q "typeof window"; then
            add_violation \
                "C006" \
                "localStorage without SSR guard" \
                "error" \
                "$file" \
                "$line_num" \
                "localStorage access must be guarded with typeof window check for SSR" \
                "Add: if (typeof window === \\\"undefined\\\") return null;" \
                "$content" \
                "docs/architecture/domains/client.md#81-ssr-safe-wrappers"
        fi
    done || true
}

# C007: Check for server imports in client domain
# NOTE: Imports from @/server/actions/ are ALLOWED because TanStack Start's
# createServerFn functions are designed to be imported and called from client code.
# The bundler automatically transforms them into RPC proxies on the client.
check_server_import() {
    local file="$1"

    # Find imports from @/server (excluding @/server/actions which is valid for TanStack Start)
    grep -n 'from ["\x27]@/server' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        # ALLOW: imports from @/server/actions/ (createServerFn functions)
        # These are designed to be called from client code in TanStack Start
        if echo "$content" | grep -qE '@/server/actions'; then
            continue
        fi

        # FLAG: imports from other server paths (db, middleware, config, utils, auth)
        add_violation \
            "C007" \
            "Server import in client domain" \
            "error" \
            "$file" \
            "$line_num" \
            "Client domain must not import from @/server/* (except @/server/actions/)" \
            "Remove server import or move logic to appropriate domain. Note: @/server/actions/ imports ARE allowed." \
            "$content" \
            "docs/architecture/domains/client.md#1-domain-overview"
    done || true
}

# C008: Check for default exports
check_default_export() {
    local file="$1"

    grep -n '^export default ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "C008" \
            "Default export in client domain" \
            "warning" \
            "$file" \
            "$line_num" \
            "Use named exports only, no default exports" \
            "Change to named export: export function/const name" \
            "$content" \
            "docs/architecture/domains/client.md#92-export-style"
    done || true
}

# C009: Check for database queries without userId filter
# Note: This check looks for userId in the operation's where clause OR in prior
# ownership verification. Common patterns like "verify chat ownership then delete
# by chatId" are considered safe if there's a userId check earlier in the function.
check_db_query_missing_userid() {
    local file="$1"

    # Only check action files
    if [[ "$file" != *"/actions/"* ]]; then
        return
    fi

    # Find delete operations without userId
    grep -n "\.delete(" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)

        # Get surrounding lines to check for userId in where clause (after operation)
        local block_after=$(sed -n "${line_num},$((line_num + 5))p" "$file")

        # Also check lines BEFORE the operation for ownership verification
        # (common pattern: verify ownership via userId-filtered query, then operate)
        local start_line=$((line_num - 20))
        if [[ $start_line -lt 1 ]]; then start_line=1; fi
        local block_before=$(sed -n "${start_line},${line_num}p" "$file")

        # Skip if userId is in the where clause OR there's prior ownership check
        if echo "$block_after" | grep -q "userId\|user_id"; then
            continue
        fi
        if echo "$block_before" | grep -qE "(userId|user_id|\.userId\s*!==|chat\.userId|getLocalChatById|getLocalChats)"; then
            continue
        fi

        local content=$(echo "$line" | cut -d: -f2-)
        add_violation \
            "C009" \
            "Database operation missing userId filter" \
            "error" \
            "$file" \
            "$line_num" \
            "All database operations must filter by userId for security" \
            "Add userId to where clause: .where(and(eq(table.id, id), eq(table.userId, userId)))" \
            "$content" \
            "docs/architecture/domains/client.md#53-query-patterns"
    done || true

    # Find update operations without userId
    grep -n "\.update(" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)

        # Get surrounding lines to check for userId in where clause (after operation)
        local block_after=$(sed -n "${line_num},$((line_num + 5))p" "$file")

        # Also check lines BEFORE the operation for ownership verification
        local start_line=$((line_num - 20))
        if [[ $start_line -lt 1 ]]; then start_line=1; fi
        local block_before=$(sed -n "${start_line},${line_num}p" "$file")

        # Skip if userId is in the where clause OR there's prior ownership check
        if echo "$block_after" | grep -q "userId\|user_id"; then
            continue
        fi
        if echo "$block_before" | grep -qE "(userId|user_id|\.userId\s*!==|chat\.userId|getLocalChatById|getLocalChats)"; then
            continue
        fi

        local content=$(echo "$line" | cut -d: -f2-)
        add_violation \
            "C009" \
            "Database operation missing userId filter" \
            "error" \
            "$file" \
            "$line_num" \
            "All database operations must filter by userId for security" \
            "Add userId to where clause: .where(and(eq(table.id, id), eq(table.userId, userId)))" \
            "$content" \
            "docs/architecture/domains/client.md#53-query-patterns"
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
    check_query_missing_enabled "$file"
    check_query_key_missing_userid "$file"
    check_direct_db_instance "$file"
    check_store_destructure "$file"
    check_derived_state_in_store "$file"
    check_localstorage_ssr_guard "$file"
    check_server_import "$file"
    check_default_export "$file"
    check_db_query_missing_userid "$file"
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
        # Count violations by severity
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
    echo "CLIENT DOMAIN VIOLATION REPORT"
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
        echo '{"comments": [], "summary": "No client domain violations found."}'
        return
    fi

    echo '{'
    echo "  \"summary\": \"Found $total client domain violations\","
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

        # Strip src/ prefix from path
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
    done < <(find "$ROOT_DIR/src/client" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)
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
