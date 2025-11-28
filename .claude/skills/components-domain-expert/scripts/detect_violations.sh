#!/bin/bash
# Components Domain Violation Detector
#
# Scans src/components/ for violations of domain best practices.
# Outputs JSON-formatted results for use in PR review comments.
#
# Usage: ./detect_violations.sh [repo-root] [file1] [file2] ...
#
# If specific files are provided, only those files are scanned.
# Otherwise, scans all files in src/components/
#
# Exit codes:
#   0 - No violations found
#   1 - Violations found
#   2 - Script error

set -e

REPO_ROOT="${1:-.}"
shift 2>/dev/null || true
SPECIFIC_FILES=("$@")

COMPONENTS_DIR="$REPO_ROOT/src/components"
UI_DIR="$COMPONENTS_DIR/ui"
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

# Helper: Check if file is in ui/ directory
is_ui_file() {
  local file="$1"
  [[ "$file" == *"/ui/"* ]] || [[ "$file" == */components/ui/* ]]
}

# Helper: Get files to scan
get_scan_files() {
  if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
    printf '%s\n' "${SPECIFIC_FILES[@]}"
  else
    find "$COMPONENTS_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null || true
  fi
}

echo "=========================================="
echo "Components Domain Violation Detector"
echo "=========================================="
echo ""

# Check if components directory exists
if [ ! -d "$COMPONENTS_DIR" ]; then
  echo "No components directory found at $COMPONENTS_DIR"
  echo "[]"
  exit 0
fi

if [ ${#SPECIFIC_FILES[@]} -gt 0 ]; then
  echo "Scanning specific files: ${SPECIFIC_FILES[*]}"
else
  echo "Scanning: $COMPONENTS_DIR"
fi
echo ""

# =============================================================================
# RULE C001: Inline styled <button> outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C001: Inline styled <button> outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C001" \
          "$file" \
          "$line" \
          "Inline styled <button> outside ui/ directory" \
          "Use <Button> from @/components/ui/button instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Inline styled <button>"
      fi
    done < <(grep -n '<button[[:space:]].*className=' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C002: Inline styled <input> outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C002: Inline styled <input> outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C002" \
          "$file" \
          "$line" \
          "Inline styled <input> outside ui/ directory" \
          "Use <Input> from @/components/ui/input instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Inline styled <input>"
      fi
    done < <(grep -n '<input[[:space:]].*className=' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C003: Inline styled <textarea> outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C003: Inline styled <textarea> outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C003" \
          "$file" \
          "$line" \
          "Inline styled <textarea> outside ui/ directory" \
          "Use <Textarea> from @/components/ui/textarea instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Inline styled <textarea>"
      fi
    done < <(grep -n '<textarea[[:space:]].*className=' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C004: Inline styled card pattern (rounded-lg border) outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C004: Inline styled card pattern outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C004" \
          "$file" \
          "$line" \
          "Inline styled card pattern (rounded-lg border shadow) outside ui/" \
          "Use <Card> from @/components/ui/card instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Inline styled card pattern"
      fi
    done < <(grep -n 'className=.*rounded-lg.*border.*shadow\|className=.*border.*rounded-lg.*shadow\|className=.*shadow.*rounded-lg.*border' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C005: Inline styled badge pattern (rounded-full px-) outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C005: Inline styled badge pattern outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C005" \
          "$file" \
          "$line" \
          "Inline styled badge pattern (rounded-full with px-) outside ui/" \
          "Use <Badge> from @/components/ui/badge instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Inline styled badge pattern"
      fi
    done < <(grep -n 'className=.*rounded-full.*px-\|className=.*px-.*rounded-full' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C006: Custom modal/dialog (fixed inset-0) outside ui/
# Severity: ERROR
# =============================================================================
echo "Checking C006: Custom modal/dialog pattern outside ui/..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && ! is_ui_file "$file"; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C006" \
          "$file" \
          "$line" \
          "Custom modal/dialog pattern (fixed inset-0) outside ui/" \
          "Use <Dialog> from @/components/ui/dialog instead"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Custom modal/dialog"
      fi
    done < <(grep -n 'className=.*fixed.*inset-0\|className=.*inset-0.*fixed' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C007: style={{}} prop usage
# Severity: WARNING
# =============================================================================
echo "Checking C007: style={{}} prop usage..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "warning" \
          "C007" \
          "$file" \
          "$line" \
          "Inline style={{}} prop usage detected" \
          "Prefer Tailwind classes in className or add CSS custom property to theme"
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - style={{}} prop"
      fi
    done < <(grep -n 'style={{' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C008: Hardcoded hex color (bg-[#, text-[#, border-[#)
# Severity: WARNING
# =============================================================================
echo "Checking C008: Hardcoded hex colors..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "warning" \
          "C008" \
          "$file" \
          "$line" \
          "Hardcoded hex color in Tailwind arbitrary value" \
          "Use semantic color tokens from theme (e.g., bg-primary, text-muted-foreground)"
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Hardcoded hex color"
      fi
    done < <(grep -n '\(bg-\|text-\|border-\)\[#[0-9a-fA-F]' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C009: React.forwardRef usage (deprecated in React 19)
# Severity: WARNING
# =============================================================================
echo "Checking C009: React.forwardRef usage..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "warning" \
          "C009" \
          "$file" \
          "$line" \
          "React.forwardRef usage is deprecated in React 19" \
          "Use function component with ref in props: function Component({ ref, ...props })"
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - React.forwardRef (deprecated)"
      fi
    done < <(grep -n 'forwardRef\|React\.forwardRef' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C010: Missing data-slot in ui/ component
# Severity: WARNING
# =============================================================================
echo "Checking C010: Missing data-slot in ui/ components..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ] && is_ui_file "$file"; then
    # Check if file has a function component but no data-slot
    if grep -q 'function [A-Z]' "$file" 2>/dev/null; then
      if ! grep -q 'data-slot=' "$file" 2>/dev/null; then
        # Get line number of first function component
        line=$(grep -n 'function [A-Z]' "$file" 2>/dev/null | head -1 | cut -d: -f1)
        if [ -n "$line" ]; then
          add_violation \
            "warning" \
            "C010" \
            "$file" \
            "$line" \
            "UI component missing data-slot attribute" \
            "Add data-slot=\"component-name\" to root element for styling hooks"
          echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Missing data-slot"
        fi
      fi
    fi
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C011: displayName assignment (unnecessary with named functions)
# Severity: WARNING
# =============================================================================
echo "Checking C011: displayName assignment..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "warning" \
          "C011" \
          "$file" \
          "$line" \
          "displayName assignment is unnecessary with named function components" \
          "Remove displayName - named functions already provide component names in DevTools"
        echo -e "  ${YELLOW}WARNING${NC}: $file:$line - Unnecessary displayName"
      fi
    done < <(grep -n '\.displayName\s*=' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

# =============================================================================
# RULE C012: Default export
# Severity: ERROR
# =============================================================================
echo "Checking C012: Default exports..."

while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$file" ]; then
    while IFS=: read -r line content; do
      if [ -n "$line" ]; then
        add_violation \
          "error" \
          "C012" \
          "$file" \
          "$line" \
          "Default export found in component file" \
          "Use named exports only: export { ComponentName }"
        echo -e "  ${RED}ERROR${NC}: $file:$line - Default export"
      fi
    done < <(grep -n '^export default' "$file" 2>/dev/null || true)
  fi
done < <(get_scan_files)

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
errors=$(echo "$json_output" | grep -o '"severity":"error"' | wc -l | tr -d ' ')
warnings=$(echo "$json_output" | grep -o '"severity":"warning"' | wc -l | tr -d ' ')

echo ""
echo "Summary:"
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
