#!/usr/bin/env bash
# Brings a branch that was just released into the prerelease branches below it
# (main → beta → alpha), so each of them can reach every release tag above it.
# semantic-release only counts tags it can reach from the branch it runs on;
# without this, alpha would go on numbering 0.11.0-alpha.N after 0.11.0 shipped.
#
# A target that conflicts or can't be pushed is left alone and listed in the
# `conflicts` or `failed` step output, for release.yml to open an issue about;
# the other targets are still synced.
#
# Usage: sync-branches.sh <released branch> <released commit>
set -euo pipefail
source "$(dirname "$0")/lib.sh"

from=$1
sha=$2

case "$from" in
  main) targets="beta alpha" ;;
  beta) targets="alpha" ;;
  *)
    echo "Nothing sits below $from."
    exit 0
    ;;
esac

# semantic-release doesn't fail when its branch has moved past the commit it
# was started for; it skips the release, so this commit may have no tag yet.
# The run for the newer commit, queued behind this one, syncs instead.
remote=$(git ls-remote --exit-code origin "refs/heads/$from" | cut -f1)
if [[ $remote != "$sha" ]]; then
  echo "$from has moved on since this commit; the run for the newer one syncs it."
  exit 0
fi

conflicts=""
failed=""
for target in $targets; do
  echo "Syncing $from into $target."
  status=0
  land "$target" "$sha" "Merge $from into $target" ff || status=$?
  case $status in
    0) ;;
    1)
      echo "::error::Merging $from into $target conflicts."
      conflicts="$conflicts $target"
      ;;
    *)
      echo "::error::Couldn't sync $from into $target."
      failed="$failed $target"
      ;;
  esac
done

{
  echo "conflicts=${conflicts# }"
  echo "failed=${failed# }"
} >>"${GITHUB_OUTPUT:-/dev/null}"
[[ -z $conflicts$failed ]]
