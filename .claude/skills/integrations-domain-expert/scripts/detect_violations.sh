#!/bin/bash
# Integrations Domain Violation Detector
#
# Scans src/integrations/ for violations of domain best practices.
# Outputs JSON-formatted results for use in PR review comments.
#
# Usage: ./detect_violations.sh [path-to-repo]
#
# Exit codes:
#   0 - No violations found
#   1 - Violations found
#   2 - Script error

set -e

REPO_ROOT="${1:-.}"
INTEGRATIONS_DIR="$REPO_ROOT/src/integrations"
VIOLATIONS_FOUND=0

# Colors for terminal output (disabled in CI)
if [ -t 1 ]; then
  RED='\033[0;31m'
  YELLOW='\033[0;33m'
  GREEN='\033[0;32m'
  NC='\033[0m'
else
  RED=''
  YELLOW=''
  GREEN=''
  NC=''
fi

# JSON output array
declare -a VIOLATIONS=()

add_violation() {
  local severity="$1"
  local rule="$2"
  local file="$3"
  local line="$4"
  local message="$5"
  local suggestion="$6"

  VIOLATIONS+=("{\"severity\":\"$severity\",\"rule\":\"$rule\",\"file\":\"$file\",\"line\":$line,\"message\":\"$message\",\"suggestion\":\"$suggestion\"}")
  VIOLATIONS_FOUND=1
}

echo "=========================================="
echo "Integrations Domain Violation Detector"
echo "=========================================="
echo ""

# Check if integrations directory exists
if [ ! -d "$INTEGRATIONS_DIR" ]; then
  echo "No integrations directory found at $INTEGRATIONS_DIR"
  echo "[]"
  exit 0
fi

echo "Scanning: $INTEGRATIONS_DIR"
echo ""

# =============================================================================
# RULE 1: No module-level client instances
# Severity: CRITICAL
# =============================================================================
echo "Checking: Module-level client instances..."

# Pattern: const/let/var client = new SDK() or createClient() at module level
# Look for variable declarations with SDK instantiation not inside functions
while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Skip if inside a function (heuristic: check if line is not indented)
    if [[ "$content" =~ ^(const|let|var)[[:space:]]+(.*)[[:space:]]*=[[:space:]]*(new[[:space:]]+|create) ]]; then
      # Check if this appears to be at module level (not indented)
      indent=$(echo "$content" | sed 's/[^ ].*//' | wc -c)
      if [ "$indent" -lt 3 ]; then
        add_violation \
          "critical" \
          "no-module-level-instances" \
          "$file" \
          "$line" \
          "Module-level client instance detected. Violates Cloudflare Workers per-request isolation." \
          "Move instantiation inside a factory function that accepts apiKey parameter."
        echo -e "  ${RED}CRITICAL${NC}: $file:$line - Module-level instance"
      fi
    fi
  fi
done < <(grep -rn -E "^(export )?(const|let|var) [a-zA-Z_]+ = (new [A-Z]|create[A-Z])" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 2: No console.log in production code
# Severity: ERROR
# =============================================================================
echo "Checking: Console.log statements..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    add_violation \
      "error" \
      "no-console-log" \
      "$file" \
      "$line" \
      "console.log found in production code." \
      "Remove debug logging before committing."
    echo -e "  ${RED}ERROR${NC}: $file:$line - console.log in production"
  fi
done < <(grep -rn "console\.log" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 3: Tool definitions must have descriptions
# Severity: ERROR
# =============================================================================
echo "Checking: Tool description presence..."

# Find tool() calls and check if they have description
while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Check if this file has a tool() call without description on same/next lines
    if grep -A 5 "tool({" "$file" 2>/dev/null | grep -q "description:"; then
      : # Has description, OK
    else
      add_violation \
        "error" \
        "tool-must-have-description" \
        "$file" \
        "$line" \
        "Tool definition missing description field." \
        "Add a clear, specific description for the LLM to know when to use this tool."
      echo -e "  ${RED}ERROR${NC}: $file:$line - Tool missing description"
    fi
  fi
done < <(grep -rn "tool({" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 4: Zod schema fields should have .describe()
# Severity: WARNING
# =============================================================================
echo "Checking: Zod schema descriptions..."

# Find z.object patterns and check for describe()
while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Get context around the z.string(), z.number(), etc.
    if ! echo "$content" | grep -q "\.describe("; then
      add_violation \
        "warning" \
        "zod-field-needs-describe" \
        "$file" \
        "$line" \
        "Zod schema field missing .describe() - LLM loses context for parameter extraction." \
        "Add .describe('...') to provide context for the LLM."
      echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Schema field missing .describe()"
    fi
  fi
done < <(grep -rn "z\.\(string\|number\|boolean\|array\|enum\)()" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "\.describe(" || true)

# =============================================================================
# RULE 5: Factory function naming convention (create* prefix)
# Severity: WARNING
# =============================================================================
echo "Checking: Factory function naming..."

# Find exported functions that return clients but don't use create* prefix
while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Extract function name
    func_name=$(echo "$content" | grep -oE "(init|make|get|build)[A-Z][a-zA-Z]*" | head -1)
    if [ -n "$func_name" ]; then
      add_violation \
        "warning" \
        "factory-naming-convention" \
        "$file" \
        "$line" \
        "Factory function '$func_name' should use 'create' prefix for consistency." \
        "Rename to 'create${func_name#init}' or similar create* pattern."
      echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Non-standard factory name: $func_name"
    fi
  fi
done < <(grep -rn "export function \(init\|make\|get\|build\)[A-Z]" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 6: No default exports
# Severity: WARNING
# =============================================================================
echo "Checking: Default exports..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    add_violation \
      "warning" \
      "no-default-exports" \
      "$file" \
      "$line" \
      "Default export found. Use named exports only for consistency." \
      "Change to named export: export { functionName } or export function functionName()"
    echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Default export"
  fi
done < <(grep -rn "^export default" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 7: No try-catch that swallows errors
# Severity: WARNING
# =============================================================================
echo "Checking: Error swallowing patterns..."

# Look for catch blocks that return null/undefined/false without re-throwing
while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Check if the catch block returns something falsy without throwing
    context=$(sed -n "${line},$((line+5))p" "$file" 2>/dev/null || echo "")
    if echo "$context" | grep -qE "return (null|undefined|false|\{\}|\[\]|'')"; then
      if ! echo "$context" | grep -q "throw"; then
        add_violation \
          "warning" \
          "no-error-swallowing" \
          "$file" \
          "$line" \
          "Catch block may be swallowing errors. Integrations should let errors bubble up." \
          "Remove try-catch or re-throw the error after logging."
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Possible error swallowing"
      fi
    fi
  fi
done < <(grep -rn "catch.*{" "$INTEGRATIONS_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE 8: Tavily maxResults should be >= 5
# Severity: WARNING (specific to Tavily)
# =============================================================================
echo "Checking: Tavily maxResults configuration..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Extract the maxResults value
    max_results=$(echo "$content" | grep -oE "maxResults:[[:space:]]*[0-9]+" | grep -oE "[0-9]+")
    if [ -n "$max_results" ] && [ "$max_results" -lt 5 ]; then
      add_violation \
        "warning" \
        "tavily-max-results-too-low" \
        "$file" \
        "$line" \
        "Tavily maxResults=$max_results is too low. Recommended minimum is 5 for quality results." \
        "Increase maxResults to at least 5."
      echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Tavily maxResults too low ($max_results)"
    fi
  fi
done < <(grep -rn "maxResults:" "$INTEGRATIONS_DIR/tavily" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# OUTPUT RESULTS
# =============================================================================
echo ""
echo "=========================================="
echo "SCAN COMPLETE"
echo "=========================================="

# Build JSON array
json_output="["
first=true
for v in "${VIOLATIONS[@]}"; do
  if [ "$first" = true ]; then
    first=false
  else
    json_output+=","
  fi
  json_output+="$v"
done
json_output+="]"

# Summary
total=${#VIOLATIONS[@]}
critical=$(echo "$json_output" | grep -o '"severity":"critical"' | wc -l | tr -d ' ')
errors=$(echo "$json_output" | grep -o '"severity":"error"' | wc -l | tr -d ' ')
warnings=$(echo "$json_output" | grep -o '"severity":"warning"' | wc -l | tr -d ' ')

echo ""
echo "Summary:"
echo "  Critical: $critical"
echo "  Errors:   $errors"
echo "  Warnings: $warnings"
echo "  Total:    $total"
echo ""

# Output JSON for programmatic use
echo "JSON Output:"
echo "$json_output"

# Exit with appropriate code
if [ "$VIOLATIONS_FOUND" -eq 1 ]; then
  exit 1
else
  echo -e "${GREEN}No violations found!${NC}"
  exit 0
fi
