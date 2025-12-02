#!/usr/bin/env bash
#
# generate-trend-report.sh
#
# Generates a trend report from the failure log for analysis.
# Helps identify patterns, struggling agents, and documentation gaps.
#
# Usage:
#   generate-trend-report.sh [OPTIONS]
#
# Options:
#   --format md|json     Output format (default: md)
#   --period 7|30|all    Time period to analyze (default: 30)
#   --top N              Show top N violations (default: 10)
#   --log-path PATH      Custom path to failure-log.json
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/../review-data/failure-log.json"
FORMAT="md"
PERIOD="30"
TOP_N=10

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Generate trend report from failure log.

Options:
  --format md|json     Output format (default: md)
  --period 7|30|all    Time period in days (default: 30)
  --top N              Show top N violations (default: 10)
  --log-path PATH      Custom path to failure-log.json
  --help               Show this help
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            usage
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --period)
            PERIOD="$2"
            shift 2
            ;;
        --top)
            TOP_N="$2"
            shift 2
            ;;
        --log-path)
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

if [[ ! -f "$LOG_FILE" ]]; then
    echo "Error: Failure log not found at $LOG_FILE" >&2
    exit 1
fi

# Generate the report
generate_markdown_report() {
    local period_field
    case "$PERIOD" in
        7) period_field="last_7_days" ;;
        30) period_field="last_30_days" ;;
        *) period_field="total_occurrences" ;;
    esac
    
    # Get metadata
    local total_reviews total_violations last_updated
    total_reviews=$(jq -r '.metadata.total_reviews' "$LOG_FILE")
    total_violations=$(jq -r '.metadata.total_violations' "$LOG_FILE")
    last_updated=$(jq -r '.metadata.last_updated' "$LOG_FILE")
    
    cat << EOF
# Failure Trend Report

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Period:** Last ${PERIOD} days
**Log Updated:** ${last_updated}

---

## Summary

| Metric | Value |
|--------|-------|
| Total Reviews | ${total_reviews} |
| Total Violations | ${total_violations} |

---

## Top ${TOP_N} Most Common Violations

EOF

    # Get top violations sorted by period occurrences
    jq -r --arg field "$period_field" --argjson n "$TOP_N" '
        [.rule_statistics | to_entries[] | {
            rule_id: .key,
            name: .value.rule_name,
            domain: .value.domain,
            severity: .value.severity,
            count: .value[$field],
            total: .value.total_occurrences,
            trend: .value.trend,
            doc: .value.documentation_reference
        }] | sort_by(-.count) | .[:$n] | .[] |
        "| \(.rule_id) | \(.name // "Unknown") | \(.domain) | \(.count) | \(.total) | \(.trend // "stable") |"
    ' "$LOG_FILE" | {
        echo "| Rule | Name | Domain | Period | Total | Trend |"
        echo "|------|------|--------|--------|-------|-------|"
        cat
    }

    cat << EOF

---

## Domain Breakdown

EOF

    # Domain statistics
    jq -r '
        [.domain_statistics | to_entries[] | {
            domain: .key,
            total: .value.total_violations,
            errors: .value.total_errors,
            warnings: .value.total_warnings,
            recent: .value.last_30_days,
            trend: .value.trend
        }] | sort_by(-.total) | .[] |
        "| \(.domain) | \(.total) | \(.errors) | \(.warnings) | \(.recent) | \(.trend // "stable") |"
    ' "$LOG_FILE" | {
        echo "| Domain | Total | Errors | Warnings | Last 30d | Trend |"
        echo "|--------|-------|--------|----------|----------|-------|"
        cat
    }

    cat << EOF

---

## Rules Requiring Attention

These rules have high occurrence rates and may indicate documentation or prompt gaps:

EOF

    # Find rules with high occurrence that might need attention
    jq -r --arg field "$period_field" '
        [.rule_statistics | to_entries[] | 
         select(.value[$field] >= 5) | {
            rule_id: .key,
            name: .value.rule_name,
            count: .value[$field],
            doc: .value.documentation_reference,
            notes: .value.improvement_notes
        }] | sort_by(-.count) | .[:5] | .[] |
        "### \(.rule_id): \(.name // "Unknown")\n- Occurrences: \(.count)\n- Documentation: \(.doc // "Not linked")\n- Improvement Notes: \(.notes // "None recorded")\n"
    ' "$LOG_FILE"

    cat << EOF

---

## Recommendations

Based on the data above:

1. **High-frequency rules** should be emphasized in pre-work context loading
2. **Domains with many errors** may need documentation improvements
3. **Rising trends** indicate areas needing immediate attention
4. **Stable patterns** suggest the current approach is working

### Action Items

EOF

    # Generate action items based on data
    jq -r --arg field "$period_field" '
        [.rule_statistics | to_entries[] | 
         select(.value[$field] >= 3 and .value.trend == "increasing") | {
            rule_id: .key,
            name: .value.rule_name,
            domain: .value.domain
        }] | .[] |
        "- [ ] **\(.rule_id)** (\(.domain)): Review documentation and add to pre-work checklist"
    ' "$LOG_FILE"

    # Check for declining rules (good!)
    local declining
    declining=$(jq -r '[.rule_statistics | to_entries[] | select(.value.trend == "decreasing")] | length' "$LOG_FILE")
    if [[ "$declining" -gt 0 ]]; then
        echo ""
        echo "### ✅ Improving Areas"
        echo ""
        jq -r '
            [.rule_statistics | to_entries[] | 
             select(.value.trend == "decreasing") | .key] | 
            "Rules with decreasing violations: " + join(", ")
        ' "$LOG_FILE"
    fi

    cat << EOF

---

## Historical Data

### Recent Reviews

EOF

    # Show last 5 reviews
    jq -r '
        .reviews | .[-5:] | reverse | .[] |
        "- **\(.timestamp // "Unknown")**: \(.outcome // "unknown") - \(.blocking_count // 0) blocking, \(.warning_count // 0) warnings"
    ' "$LOG_FILE" 2>/dev/null || echo "No reviews recorded yet."

    echo ""
}

generate_json_report() {
    local period_field
    case "$PERIOD" in
        7) period_field="last_7_days" ;;
        30) period_field="last_30_days" ;;
        *) period_field="total_occurrences" ;;
    esac

    jq --arg period "$period_field" --argjson top "$TOP_N" '{
        generated_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
        period_days: ($period | if . == "last_7_days" then 7 elif . == "last_30_days" then 30 else "all" end),
        summary: {
            total_reviews: .metadata.total_reviews,
            total_violations: .metadata.total_violations,
            last_updated: .metadata.last_updated
        },
        top_violations: ([.rule_statistics | to_entries[] | {
            rule_id: .key,
            name: .value.rule_name,
            domain: .value.domain,
            count: .value[$period],
            total: .value.total_occurrences,
            trend: .value.trend
        }] | sort_by(-.count) | .[:$top]),
        domain_breakdown: .domain_statistics,
        attention_needed: [.rule_statistics | to_entries[] | 
            select(.value[$period] >= 5) | {
                rule_id: .key,
                count: .value[$period],
                trend: .value.trend
            }] | sort_by(-.count),
        recent_reviews: (.reviews | .[-5:] | reverse)
    }' "$LOG_FILE"
}

# Output based on format
case "$FORMAT" in
    md|markdown)
        generate_markdown_report
        ;;
    json)
        generate_json_report
        ;;
    *)
        echo "Unknown format: $FORMAT" >&2
        exit 1
        ;;
esac