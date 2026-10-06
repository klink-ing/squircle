#!/usr/bin/env bash
# Waits for every pull_request workflow run on a PR's labeled commit to finish,
# and fails unless they all passed.
#
# CI has to be among them. A run that hasn't started yet looks the same as one
# that isn't coming, and the title check, which reports the same required
# `check` context as CI, finishes long before CI starts. The promotion guard is
# left out: it fails on purpose. Both are matched by file, not display name.
#
# Usage: wait-for-checks.sh <pr number> <labeled commit>
set -euo pipefail
source "$(dirname "$0")/lib.sh"

pr=$1
sha=$2
ci=.github/workflows/ci.yml
guard=.github/workflows/promotion-guard.yml
interval=${WAIT_INTERVAL:-20}
deadline=$((SECONDS + ${WAIT_TIMEOUT:-1800}))
errors=0

# Prints the PR's state and head commit, then one line per workflow, with the
# latest run's path, status and conclusion, tab-separated.
poll() {
  gh pr view "$pr" --json state,headRefOid --jq '"\(.state) \(.headRefOid)"' &&
    gh api "repos/$GITHUB_REPOSITORY/actions/runs?event=pull_request&head_sha=$sha&per_page=100" \
      --jq ".workflow_runs
        | map(select(any(.pull_requests[]; .number == $pr)))
        | group_by(.path) | map(max_by(.run_number))[]
        | [.path, .status, .conclusion // \"\"] | @tsv"
}

while :; do
  if ! out=$(poll 2>&1); then
    errors=$((errors + 1))
    if ((errors >= 5)); then
      fail "Couldn't read the PR's checks from GitHub: $out"
    fi
  else
    errors=0
    read -r state current <<<"${out%%$'\n'*}"
    if [[ $state != OPEN ]]; then
      fail "The PR is $(tr "[:upper:]" "[:lower:]" <<<"$state"), so there's nothing to promote."
    fi
    if [[ $current != "$sha" ]]; then
      fail "New commits were pushed after the label was added. Add it again once their checks pass."
    fi

    verdict=$(tail -n +2 <<<"$out" | awk -F '\t' -v ci="$ci" -v guard="$guard" '
      $1 == guard { next }
      $1 == ci { seen = 1 }
      $2 != "completed" { pending = 1; next }
      $3 != "success" && $3 != "skipped" && $3 != "neutral" { failed = failed " " $1 }
      END { print (failed ? ("failed" failed) : (pending || !seen) ? "pending" : "passed") }')
    case $verdict in
      passed)
        echo "All checks passed."
        exit 0
        ;;
      failed*) fail "These checks failed:${verdict#failed}. Fix them, then add the label again." ;;
    esac
  fi

  if ((SECONDS >= deadline)); then
    fail "The checks didn't finish within $((${WAIT_TIMEOUT:-1800} / 60)) minutes."
  fi
  sleep "$interval"
done
