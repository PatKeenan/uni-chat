#!/bin/bash
# Routes Domain Violation Detector
#
# Scans src/routes/ for violations of domain best practices.
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
ROUTES_DIR="$REPO_ROOT/src/routes"
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
echo "Routes Domain Violation Detector"
echo "=========================================="
echo ""

# Check if routes directory exists
if [ ! -d "$ROUTES_DIR" ]; then
  echo "No routes directory found at $ROUTES_DIR"
  echo "[]"
  exit 0
fi

echo "Scanning: $ROUTES_DIR"
echo ""

# =============================================================================
# RULE R001: No secrets/env vars directly in loaders (isomorphic exposure)
# Severity: CRITICAL
# =============================================================================
echo "Checking: Secrets in loaders (R001)..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Check if this is inside a loader block
    # Look for process.env access in route files
    add_violation \
      "critical" \
      "R001" \
      "$file" \
      "$line" \
      "process.env accessed directly in route file. Loaders are isomorphic - secrets will be exposed to client bundle." \
      "Move secret access to a server function (createServerFn) and call it from the loader."
    echo -e "  ${RED}CRITICAL${NC}: $file:$line - Secrets in loader"
  fi
done < <(grep -rn "process\.env\." "$ROUTES_DIR" --include="*.tsx" 2>/dev/null | grep -v "api/" || true)

# =============================================================================
# RULE R002: Auth check in child route when parent layout handles it
# Severity: ERROR
# =============================================================================
echo "Checking: Redundant auth in child routes (R002)..."

# Check dashboard child routes for auth redirects (parent should handle)
if [ -d "$ROUTES_DIR/dashboard" ]; then
  while IFS=: read -r file line content; do
    if [ -n "$file" ]; then
      # Skip the parent layout file itself
      if [[ "$file" != *"/dashboard.tsx" ]]; then
        # Check if this has redirect to login
        context=$(sed -n "$((line-5)),$((line+10))p" "$file" 2>/dev/null || echo "")
        if echo "$context" | grep -qE "(redirect.*login|context\.user\?\.|!context\.user)"; then
          add_violation \
            "error" \
            "R002" \
            "$file" \
            "$line" \
            "Redundant auth check in child route. Parent layout (dashboard.tsx) already handles authentication." \
            "Remove auth check - context.user is guaranteed by parent beforeLoad guard."
          echo -e "  ${RED}ERROR${NC}: $file:$line - Redundant auth in child route"
        fi
      fi
    fi
  done < <(grep -rn "context\.user" "$ROUTES_DIR/dashboard/" --include="*.tsx" 2>/dev/null | grep -v "dashboard.tsx:" || true)
fi

# =============================================================================
# RULE R003: Both beforeLoad AND loader doing auth (redundant)
# Severity: ERROR
# =============================================================================
echo "Checking: Double auth pattern (R003)..."

for file in $(find "$ROUTES_DIR" -name "*.tsx" 2>/dev/null); do
  if [ -f "$file" ]; then
    has_beforeload_auth=false
    has_loader_auth=false

    # Check for beforeLoad with user/getUser
    if grep -q "beforeLoad.*getUser\|beforeLoad" "$file" 2>/dev/null; then
      beforeload_content=$(grep -A 10 "beforeLoad" "$file" 2>/dev/null || echo "")
      if echo "$beforeload_content" | grep -qE "(getUser|user)"; then
        has_beforeload_auth=true
      fi
    fi

    # Check for loader with auth redirect
    if grep -q "loader.*context.*user\|loader" "$file" 2>/dev/null; then
      loader_content=$(grep -A 15 "loader:" "$file" 2>/dev/null || echo "")
      if echo "$loader_content" | grep -qE "(redirect.*login|!context.*user|context\.user\?\.)"; then
        has_loader_auth=true
      fi
    fi

    # If both are present, it's a violation
    if [ "$has_beforeload_auth" = true ] && [ "$has_loader_auth" = true ]; then
      line=$(grep -n "loader:" "$file" | head -1 | cut -d: -f1)
      add_violation \
        "error" \
        "R003" \
        "$file" \
        "${line:-1}" \
        "Both beforeLoad and loader contain auth checks. This is redundant." \
        "Keep auth guard in beforeLoad only. Remove auth check from loader."
      echo -e "  ${RED}ERROR${NC}: $file - Double auth pattern"
    fi
  fi
done

# =============================================================================
# RULE R004: notFound() called in beforeLoad
# Severity: ERROR
# =============================================================================
echo "Checking: notFound in beforeLoad (R004)..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Check if this is inside beforeLoad block
    # Look backwards for beforeLoad
    context=$(sed -n "$((line > 10 ? line-10 : 1)),$((line))p" "$file" 2>/dev/null || echo "")
    if echo "$context" | grep -q "beforeLoad"; then
      add_violation \
        "error" \
        "R004" \
        "$file" \
        "$line" \
        "notFound() called in beforeLoad. This always triggers root notFoundComponent." \
        "Move notFound() check to loader instead of beforeLoad."
      echo -e "  ${RED}ERROR${NC}: $file:$line - notFound in beforeLoad"
    fi
  fi
done < <(grep -rn "throw notFound\|notFound()" "$ROUTES_DIR" --include="*.tsx" 2>/dev/null || true)

# =============================================================================
# RULE R005: Inconsistent component naming (should be RouteComponent)
# Severity: WARNING
# =============================================================================
echo "Checking: Component naming (R005)..."

while IFS=: read -r file line content; do
  if [ -n "$file" ]; then
    # Extract function name
    func_name=$(echo "$content" | grep -oE "function [A-Z][a-zA-Z]+" | sed 's/function //')
    if [ -n "$func_name" ] && [ "$func_name" != "RouteComponent" ]; then
      # Check if this is the component used in createFileRoute
      if grep -q "component: $func_name" "$file" 2>/dev/null; then
        add_violation \
          "warning" \
          "R005" \
          "$file" \
          "$line" \
          "Component named '$func_name' instead of 'RouteComponent'. Use consistent naming." \
          "Rename to 'function RouteComponent()' for consistency across all routes."
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Non-standard component name: $func_name"
      fi
    fi
  fi
done < <(grep -rn "^function [A-Z]" "$ROUTES_DIR" --include="*.tsx" 2>/dev/null | grep -v "RouteComponent" | grep -v "ErrorComponent" | grep -v "NotFoundComponent" || true)

# =============================================================================
# RULE R006: Console.log in API route handlers
# Severity: WARNING
# =============================================================================
echo "Checking: Console.log in API routes (R006)..."

if [ -d "$ROUTES_DIR/api" ]; then
  while IFS=: read -r file line content; do
    if [ -n "$file" ]; then
      add_violation \
        "warning" \
        "R006" \
        "$file" \
        "$line" \
        "console.log found in API route. Remove debug logging from production code." \
        "Remove console.log or use a proper logging utility."
      echo -e "  ${YELLOW}WARNING${NC}: $file:$line - console.log in API route"
    fi
  done < <(grep -rn "console\.log" "$ROUTES_DIR/api" --include="*.ts" --include="*.tsx" 2>/dev/null || true)
fi

# =============================================================================
# RULE R007: Dead code - component never renders (all paths redirect)
# Severity: WARNING
# =============================================================================
echo "Checking: Dead code patterns (R007)..."

for file in $(find "$ROUTES_DIR" -name "*.tsx" 2>/dev/null); do
  if [ -f "$file" ]; then
    # Check if file has beforeLoad that always redirects
    beforeload=$(grep -A 20 "beforeLoad" "$file" 2>/dev/null || echo "")

    # Count redirect calls in beforeLoad
    redirect_count=$(echo "$beforeload" | grep -c "throw redirect\|redirect({" 2>/dev/null || true)
    redirect_count=${redirect_count:-0}

    # If there are 2+ redirects (if/else both redirect) or unconditional redirect
    if [ "$redirect_count" -ge 2 ]; then
      # Check if there's a component defined
      if grep -q "^function.*{$\|component:" "$file" 2>/dev/null; then
        line=$(grep -n "^function [A-Z]" "$file" | head -1 | cut -d: -f1)
        add_violation \
          "warning" \
          "R007" \
          "$file" \
          "${line:-1}" \
          "Component may be dead code - all paths in beforeLoad redirect." \
          "Verify component is reachable. If all paths redirect, remove the component."
        echo -e "  ${YELLOW}WARNING${NC}: $file - Possible dead code"
      fi
    fi
  fi
done

# =============================================================================
# RULE R008: Unused loader data
# Severity: WARNING
# =============================================================================
echo "Checking: Unused loader data (R008)..."

for file in $(find "$ROUTES_DIR" -name "*.tsx" 2>/dev/null); do
  if [ -f "$file" ]; then
    # Check if file has a loader that returns data
    if grep -q "loader:" "$file" 2>/dev/null; then
      # Get what the loader returns
      loader_return=$(grep -A 30 "loader:" "$file" 2>/dev/null | grep -E "return \{" | head -1 || echo "")

      # Check if useLoaderData is called
      if ! grep -q "useLoaderData\|Route\.useLoaderData" "$file" 2>/dev/null; then
        if [ -n "$loader_return" ]; then
          line=$(grep -n "loader:" "$file" | head -1 | cut -d: -f1)
          add_violation \
            "warning" \
            "R008" \
            "$file" \
            "${line:-1}" \
            "Loader returns data but component doesn't call useLoaderData()." \
            "Either use the loader data in component or remove the loader if not needed."
          echo -e "  ${YELLOW}WARNING${NC}: $file - Unused loader data"
        fi
      fi
    fi
  fi
done

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
