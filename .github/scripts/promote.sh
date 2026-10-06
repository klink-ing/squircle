#!/usr/bin/env bash
# Merges a promotion PR with a real merge commit, which the merge button can't
# do here: people may only squash. A squash would copy the source branch's
# changes without its history, so the target couldn't reach its release tags
# and the two branches would drift apart. The deploy key this runs with is the
# only thing allowed to push a merge commit to a protected branch.
#
# Promotions go up a channel (alpha → beta, alpha → main, beta → main) and
# always get a merge commit. Syncs go down (main → beta, main → alpha,
# beta → alpha), as do sync/* branches carrying a merge resolved by hand into
# alpha or beta; those fast-forward when they can. The release workflow syncs
# on its own, so a down PR is only needed when that failed.
#
# Usage: promote.sh <head branch> <head commit> <base branch> <pr number>
set -euo pipefail
source "$(dirname "$0")/lib.sh"

head=$1
head_sha=$2
base=$3
pr=$4

case "$head:$base" in
  alpha:beta | alpha:main | beta:main) mode=merge ;;
  main:beta | main:alpha | beta:alpha | sync/*:alpha | sync/*:beta) mode=ff ;;
  *) fail "$head → $base isn't a promotion. Promotions go alpha → beta → main, syncs go back down, and sync/* branches go into alpha or beta." ;;
esac

git fetch --quiet origin "+refs/heads/$head:refs/remotes/origin/$head"
if [[ $(git rev-parse "origin/$head") != "$head_sha" ]]; then
  fail "$head has moved since the label was added. Add it again once the new commits' checks pass."
fi

echo "Merging $head into $base."
status=0
land "$base" "$head_sha" "Merge $head into $base (#$pr)" "$mode" || status=$?
case $status in
  0) ;;
  1)
    if [[ $mode == merge ]]; then
      fail "Merging $head into $base conflicts: $base has changes $head doesn't. Sync them down into $head first (see any open \"by hand\" issue), then add the label again."
    fi
    fail "Merging $head into $base conflicts. Merge it by hand on a sync/ branch, open a PR from that into $base, and add the label there."
    ;;
  *) fail "Couldn't push to $base." ;;
esac
