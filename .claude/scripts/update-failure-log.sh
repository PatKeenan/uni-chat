#!/usr/bin/env bash
#
# update-failure-log.sh
#
# Updates the failure log after a code review.
# Increments counters, adds review entry, updates statistics.
#
# Usage:
#   update-failure-log.sh --review-file <review.json>
#   update-failure-log.sh --rule <RULE_ID> --file <path> --line <num> [--agent <id>]
#
# Examples:
#   # Add from a complete review JSON file
#   update-failure-log.sh --review-file /tmp/review-result.json
#
#   # Add a single violation (useful for manual additions)
#   update-failure-log.sh --rule C001 --file src/client/hooks/use-feature.ts --line 42
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/../review-data/failure-log.json"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Update the failure log with review results.

Options:
  --review-file FILE    Path to complete review JSON file
  --rule RULE_ID        Single rule violation to add (e.g., C001)
  --file PATH           File path where violation occurred
  --line NUM            Line number of violation
  --agent ID            Agent ID that created the code (optional)
  --severity LEVEL      error|warning|suggestion (default: error)
  --log-path PATH       Custom path to failure-log.json
  --dry-run             Show what would be updated without writing
  --help                Show this help

Examples:
  # Add complete review from file
  $(basename "$0") --review-file review-2025-01-15.json

  # Add single violation
  $(basename "$0") --rule C001 --file src/client/hooks/use-feature.ts --line 42

  # Add violation with agent tracking
  $(basename "$0") --rule S002 --file src/server/actions/chat.ts --line 58 --agent agent-1
EOF
    exit 0
}

# Parse arguments
REVIEW_FILE=""
RULE_ID=""
FILE_PATH=""
LINE_NUM=""
AGENT_ID=""
SEVERITY="error"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            ;;
        --review-file)
            REVIEW_FILE="$2"
            shift 2
            ;;
        --rule)
            RULE_ID="$2"
            shift 2
            ;;
        --file)
            FILE_PATH="$2"
            shift 2
            ;;
        --line)
            LINE_NUM="$2"
            shift 2
            ;;
        --agent)
            AGENT_ID="$2"
            shift 2
            ;;
        --severity)
            SEVERITY="$2"
            shift 2
            ;;
        --log-path)
            LOG_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Validate log file exists
if [[ ! -f "$LOG_FILE" ]]; then
    echo -e "${RED}Error: Failure log not found at $LOG_FILE${NC}" >&2
    exit 1
fi

# Function to increment a rule's counter
increment_rule_counter() {
    local rule_id="$1"
    local log_file="$2"
    
    # Read current value
    local current
    current=$(jq -r ".rule_statistics.\"$rule_id\".total_occurrences // 0" "$log_file")
    local new_value=$((current + 1))
    
    # Also update last_7_days and last_30_days (simplified - just increment)
    local current_7d
    current_7d=$(jq -r ".rule_statistics.\"$rule_id\".last_7_days // 0" "$log_file")
    local current_30d
    current_30d=$(jq -r ".rule_statistics.\"$rule_id\".last_30_days // 0" "$log_file")
    
    # Update the log file
    jq --arg rule "$rule_id" \
       --argjson total "$new_value" \
       --argjson d7 "$((current_7d + 1))" \
       --argjson d30 "$((current_30d + 1))" \
       --arg ts "$TIMESTAMP" \
       '.rule_statistics[$rule].total_occurrences = $total |
        .rule_statistics[$rule].last_7_days = $d7 |
        .rule_statistics[$rule].last_30_days = $d30 |
        .rule_statistics[$rule].last_seen = $ts |
        if .rule_statistics[$rule].first_seen == null then .rule_statistics[$rule].first_seen = $ts else . end' \
       "$log_file" > "${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
    
    echo -e "  ${GREEN}✓${NC} $rule_id: $current → $new_value"
}

# Function to increment domain counter
increment_domain_counter() {
    local domain="$1"
    local severity="$2"
    local log_file="$3"
    
    jq --arg domain "$domain" \
       --arg severity "$severity" \
       '.domain_statistics[$domain].total_violations += 1 |
        .domain_statistics[$domain].last_30_days += 1 |
        if $severity == "error" then .domain_statistics[$domain].total_errors += 1 else . end |
        if $severity == "warning" then .domain_statistics[$domain].total_warnings += 1 else . end' \
       "$log_file" > "${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
}

# Function to update metadata
update_metadata() {
    local log_file="$1"
    local violations_added="$2"
    local reviews_added="$3"
    
    jq --arg ts "$TIMESTAMP" \
       --argjson v "$violations_added" \
       --argjson r "$reviews_added" \
       '.metadata.last_updated = $ts |
        .metadata.total_violations += $v |
        .metadata.total_reviews += $r' \
       "$log_file" > "${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
}

# Function to add a review entry
add_review_entry() {
    local review_json="$1"
    local log_file="$2"
    
    jq --argjson review "$review_json" \
       '.reviews += [$review]' \
       "$log_file" > "${log_file}.tmp" && mv "${log_file}.tmp" "$log_file"
}

# Mode 1: Process complete review file
if [[ -n "$REVIEW_FILE" ]]; then
    if [[ ! -f "$REVIEW_FILE" ]]; then
        echo -e "${RED}Error: Review file not found: $REVIEW_FILE${NC}" >&2
        exit 1
    fi
    
    echo -e "${YELLOW}Processing review file: $REVIEW_FILE${NC}"
    
    # Extract violations from review file
    violations=$(jq -r '.violations[]' "$REVIEW_FILE" 2>/dev/null || echo "")
    
    if [[ -z "$violations" ]]; then
        echo -e "${GREEN}No violations in review file${NC}"
        exit 0
    fi
    
    violation_count=0
    
    # Process each violation
    jq -c '.violations[]' "$REVIEW_FILE" | while IFS= read -r violation; do
        rule_id=$(echo "$violation" | jq -r '.rule_id')
        domain=$(echo "$violation" | jq -r '.domain')
        severity=$(echo "$violation" | jq -r '.severity')
        
        if [[ "$DRY_RUN" == true ]]; then
            echo -e "  [DRY RUN] Would increment: $rule_id ($domain, $severity)"
        else
            increment_rule_counter "$rule_id" "$LOG_FILE"
            increment_domain_counter "$domain" "$severity" "$LOG_FILE"
        fi
        
        violation_count=$((violation_count + 1))
    done
    
    # Add the full review entry
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "[DRY RUN] Would add review entry with $violation_count violations"
    else
        # Generate review ID
        review_id="rev_$(date +%s)_$(head -c 4 /dev/urandom | xxd -p)"
        
        # Add review_id and timestamp to the review
        review_entry=$(jq --arg id "$review_id" --arg ts "$TIMESTAMP" \
            '. + {review_id: $id, timestamp: $ts}' "$REVIEW_FILE")
        
        add_review_entry "$review_entry" "$LOG_FILE"
        update_metadata "$LOG_FILE" "$violation_count" 1
        
        echo -e "${GREEN}✓ Added review with $violation_count violations${NC}"
    fi
    
    exit 0
fi

# Mode 2: Add single violation
if [[ -n "$RULE_ID" ]]; then
    if [[ -z "$FILE_PATH" || -z "$LINE_NUM" ]]; then
        echo -e "${RED}Error: --file and --line required with --rule${NC}" >&2
        exit 1
    fi
    
    # Determine domain from rule prefix
    case "${RULE_ID:0:1}" in
        C) domain="client" ;;
        S) domain="server" ;;
        I) domain="integrations" ;;
        R) domain="routes" ;;
        T) domain="types" ;;
        *) 
            if [[ "$RULE_ID" == COMP* ]]; then
                domain="components"
            else
                echo -e "${RED}Error: Unknown rule prefix in $RULE_ID${NC}" >&2
                exit 1
            fi
            ;;
    esac
    
    echo -e "${YELLOW}Adding violation: $RULE_ID in $FILE_PATH:$LINE_NUM${NC}"
    
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "[DRY RUN] Would increment: $RULE_ID ($domain, $SEVERITY)"
    else
        increment_rule_counter "$RULE_ID" "$LOG_FILE"
        increment_domain_counter "$domain" "$SEVERITY" "$LOG_FILE"
        update_metadata "$LOG_FILE" 1 0
        
        echo -e "${GREEN}✓ Violation logged${NC}"
    fi
    
    exit 0
fi

# No valid mode selected
echo -e "${RED}Error: Must specify --review-file or --rule${NC}" >&2
usage