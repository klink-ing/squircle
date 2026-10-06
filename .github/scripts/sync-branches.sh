#!/usr/bin/env bash
# Brings a branch that was just released into the prerelease branches below it
# (main → beta → alpha), so each of them can reach every release tag above it.
# semantic-release only counts tags it can reach from the branch it runs on;
# without this, alpha would go on numbering 0.11.0-alpha.N after 0.11.0 shipped.
#
# Fast-forwards a target that has nothing of its own, merges into one that
# does, and never force-pushes. A target that conflicts is left alone and
# listed in the `conflicts` step output, for a person to merge by hand.
#
# Usage: sync-branches.sh <released branch> <released commit>
set -euo pipefail

source=$1
sha=$2

case "$source" in
  main) targets="beta alpha" ;;
  beta) targets="alpha" ;;
  *)
    echo "Nothing sits below $source."
    exit 0
    ;;
esac

conflicts=""
for target in $targets; do
  # Another sync can move the target between the fetch and the push, so a
  # rejected push starts over from a fresh fetch.
  for attempt in 1 2 3; do
    git fetch --quiet origin "+refs/heads/$target:refs/remotes/origin/$target"
    tip=$(git rev-parse "origin/$target")

    if git merge-base --is-ancestor "$sha" "$tip"; then
      echo "$target already contains $source."
      continue 2
    fi

    if git merge-base --is-ancestor "$tip" "$sha"; then
      echo "Fast-forwarding $target to $source."
      new=$sha
    else
      git switch --quiet --detach "$tip"
      if ! git merge --quiet --no-ff --no-edit -m "Merge $source into $target" "$sha"; then
        git merge --abort
        echo "::error::Merging $source into $target conflicts."
        conflicts="$conflicts $target"
        continue 2
      fi
      echo "Merging $source into $target."
      new=$(git rev-parse HEAD)
    fi

    if git push --quiet origin "$new:refs/heads/$target"; then
      continue 2
    fi
    echo "The push to $target was rejected (attempt $attempt)."
  done
  echo "::error::Couldn't push to $target."
  exit 1
done

if [[ -n $conflicts ]]; then
  echo "conflicts=${conflicts# }" >>"${GITHUB_OUTPUT:-/dev/null}"
  exit 1
fi
