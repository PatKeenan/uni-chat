#!/usr/bin/env bash
#
# Types Domain Violation Detector
#
# Analyzes TypeScript files to detect violations of the Types domain best practices.
# Outputs structured JSON or text for consumption by AI code review agents.
#
# Usage:
#   detect_violations.sh [OPTIONS]
#
# Options:
#   --files FILE1 FILE2 ...   Analyze specific files
#   --all                     Analyze all TypeScript files in src/
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

# Counters (use temp files to work around subshell issues)
TOTAL_FILES=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

usage() {
    head -30 "$0" | grep -E "^#" | sed 's/^# \?//'
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

# T001: Check for type imports not using 'import type'
check_import_type_missing() {
    local file="$1"

    # Find imports from @/types without 'type' keyword
    grep -n "^import {" "$file" 2>/dev/null | grep -v "import type" | grep "@/types" | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local imports=$(echo "$content" | sed 's/.*{\([^}]*\)}.*/\1/')

        add_violation \
            "T001" \
            "Missing import type" \
            "error" \
            "$file" \
            "$line_num" \
            "Type imports from @/types must use 'import type' syntax" \
            "Change to: import type {$imports} from \\\"@/types\\\"" \
            "$content" \
            "docs/architecture/domains/types.md#rule-41-always-use-import-type-for-type-only-imports"
    done || true
}

# T002: Check for direct file imports instead of barrel
check_direct_file_import() {
    local file="$1"

    # Find imports from @/types/specific-file (not just @/types)
    grep -n "from ['\"]@/types/" "$file" 2>/dev/null | grep -v "from ['\"]@/types['\"]" | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local specific_file=$(echo "$content" | sed "s/.*@\/types\/\([^'\"]*\).*/\1/")

        add_violation \
            "T002" \
            "Direct file import instead of barrel" \
            "warning" \
            "$file" \
            "$line_num" \
            "Import from '@/types' barrel instead of '@/types/$specific_file'" \
            "Change '@/types/$specific_file' to '@/types'" \
            "$content" \
            "docs/architecture/domains/types.md#rule-42-import-from-barrel-types-not-direct-files"
    done || true
}

# T003: Check for components importing from schema directly
check_component_schema_import() {
    local file="$1"

    # Only check component files
    if [[ "$file" != *"/components/"* ]]; then
        return
    fi

    # Find imports from @/client/db/schema or @/server/db/schema
    grep -n "from ['\"]@/\(client\|server\)/db/schema['\"]" "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local imports=$(echo "$content" | sed 's/.*{\([^}]*\)}.*/\1/')
        local domain=$(echo "$content" | sed "s/.*@\/\(client\|server\)\/db\/schema.*/\1/")

        add_violation \
            "T003" \
            "Component importing from schema directly" \
            "error" \
            "$file" \
            "$line_num" \
            "Components should import types from '@/types', not '@/$domain/db/schema'" \
            "Change to: import type {$imports} from \\\"@/types\\\"" \
            "$content" \
            "docs/architecture/domains/types.md#violation-pattern-3-component-importing-from-clientserver-schema-directly"
    done || true
}

# T004: Check for DB types without proper prefix
check_db_type_naming() {
    local file="$1"

    # Only check schema files
    if [[ "$file" != *"/db/schema"* ]]; then
        return
    fi

    # Find types using $inferSelect without DB_ prefix
    grep -n 'export type .* = typeof .*\.\$inferSelect' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local type_name=$(echo "$content" | sed 's/export type \([^ ]*\) .*/\1/')

        if [[ "$type_name" != DB_* ]]; then
            add_violation \
                "T004" \
                "Missing DB_ prefix for database type" \
                "error" \
                "$file" \
                "$line_num" \
                "Database select type '$type_name' must have 'DB_' prefix" \
                "Rename to: DB_$type_name" \
                "$content" \
                "docs/architecture/domains/types.md#rule-51-database-type-prefix"
        fi
    done || true

    # Find types using $inferInsert without InsertDB_ prefix
    grep -n 'export type .* = typeof .*\.\$inferInsert' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local type_name=$(echo "$content" | sed 's/export type \([^ ]*\) .*/\1/')

        if [[ "$type_name" != InsertDB_* ]]; then
            add_violation \
                "T004" \
                "Missing InsertDB_ prefix for insert type" \
                "error" \
                "$file" \
                "$line_num" \
                "Database insert type '$type_name' must have 'InsertDB_' prefix" \
                "Rename to: InsertDB_${type_name#Insert}" \
                "$content" \
                "docs/architecture/domains/types.md#rule-51-database-type-prefix"
        fi
    done || true
}

# T005: Check for type exports in route files
check_type_in_route_file() {
    local file="$1"

    # Only check route files
    if [[ "$file" != *"/routes/"* ]]; then
        return
    fi

    # Find export type or export interface
    grep -n '^export \(type\|interface\) ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        local kind=$(echo "$content" | sed 's/export \(type\|interface\) .*/\1/')
        local name=$(echo "$content" | sed 's/export \(type\|interface\) \([^ {=]*\).*/\2/')

        add_violation \
            "T005" \
            "Type exported from route file" \
            "warning" \
            "$file" \
            "$line_num" \
            "Route files should not export types. Move '$name' to appropriate domain." \
            "Move $kind '$name' to src/types/ (if cross-domain) or domain-specific file" \
            "$content" \
            "docs/architecture/domains/types.md#9-cross-domain-violation-detection"
    done || true
}

# T007: Check for runtime code in types domain
check_runtime_code_in_types() {
    local file="$1"

    # Only check types domain (but not index.ts)
    if [[ "$file" != *"/types/"* ]] || [[ "$file" == *"/types/index.ts" ]]; then
        return
    fi

    # Check for const exports
    grep -n '^export const ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "T007" \
            "Runtime code in types domain" \
            "error" \
            "$file" \
            "$line_num" \
            "Types domain should not contain runtime code: const export" \
            "Move const to appropriate domain (server/client)" \
            "$content" \
            "docs/architecture/domains/types.md#1-domain-overview"
    done || true

    # Check for function exports
    grep -n '^export function ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "T007" \
            "Runtime code in types domain" \
            "error" \
            "$file" \
            "$line_num" \
            "Types domain should not contain runtime code: function export" \
            "Move function to appropriate domain (server/client)" \
            "$content" \
            "docs/architecture/domains/types.md#1-domain-overview"
    done || true

    # Check for class exports
    grep -n '^export class ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "T007" \
            "Runtime code in types domain" \
            "error" \
            "$file" \
            "$line_num" \
            "Types domain should not contain runtime code: class export" \
            "Move class to appropriate domain (server/client)" \
            "$content" \
            "docs/architecture/domains/types.md#1-domain-overview"
    done || true
}

# T008: Check for default exports
check_default_export() {
    local file="$1"

    # Only check types domain
    if [[ "$file" != *"/types/"* ]]; then
        return
    fi

    grep -n '^export default ' "$file" 2>/dev/null | while IFS= read -r line; do
        local line_num=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)

        add_violation \
            "T008" \
            "Default export in types domain" \
            "error" \
            "$file" \
            "$line_num" \
            "Use named exports only, no default exports" \
            "Change to named export: export type { TypeName } or export interface Name" \
            "$content" \
            "docs/architecture/domains/types.md#rule-43-use-named-type-exports"
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
    check_import_type_missing "$file"
    check_direct_file_import "$file"
    check_component_schema_import "$file"
    check_db_type_naming "$file"
    check_type_in_route_file "$file"
    check_runtime_code_in_types "$file"
    check_default_export "$file"
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
    echo "TYPES DOMAIN VIOLATION REPORT"
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
        echo "✅ No violations found!"
    fi
}

output_pr_comments() {
    local total=0

    if [[ -s "$VIOLATIONS_FILE" ]]; then
        total=$(wc -l < "$VIOLATIONS_FILE" | tr -d ' ')
    fi

    if [[ $total -eq 0 ]]; then
        echo '{"comments": [], "summary": "No types domain violations found."}'
        return
    fi

    echo '{'
    echo "  \"summary\": \"Found $total types domain violations\","
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

        printf '    {"path": "%s", "line": %s, "severity": "%s", "body": "**%s: %s** (%s)\\n\\n%s\\n\\n```\\n%s\\n```\\n\\n**Suggestion:** %s\\n\\n📖 See: [%s](%s)"}' \
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
    done < <(find "$ROOT_DIR/src" -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 2>/dev/null)
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
