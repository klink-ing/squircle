#!/usr/bin/env bash
# Merges a promotion PR with a real merge commit, which the merge button can't
# do here: people may only squash. A squash would copy the source branch's
# changes without its history, so the target couldn't reach its release tags
# and the two branches would drift apart. The deploy key this runs with is the
# only thing allowed to push a merge commit to a protected branch.
#
# Promotions go up a channel: alpha → beta, alpha → main or beta → main. A
# sync/* branch carries a merge resolved by hand back down into alpha or beta,
# after sync-branches.sh found a conflict.
#
# Usage: promote.sh <head branch> <head commit> <base branch> <pr number>
set -euo pipefail

head=$1
head_sha=$2
base=$3
pr=$4

case "$head:$base" in
  alpha:beta | alpha:main | beta:main | sync/*:alpha | sync/*:beta) ;;
  *)
    echo "::error::$head → $base isn't a promotion. Promotions go alpha → beta → main, and sync/* branches go into alpha or beta."
    exit 1
    ;;
esac

git fetch --quiet origin \
  "+refs/heads/$head:refs/remotes/origin/$head" \
  "+refs/heads/$base:refs/remotes/origin/$base"

if [[ $(git rev-parse "origin/$head") != "$head_sha" ]]; then
  echo "::error::$head has moved since the label was added. Add the label again to promote what's there now."
  exit 1
fi

base_tip=$(git rev-parse "origin/$base")
if git merge-base --is-ancestor "$head_sha" "$base_tip"; then
  echo "$base already contains $head."
  exit 0
fi

if [[ $head == sync/* ]] && git merge-base --is-ancestor "$base_tip" "$head_sha"; then
  # The branch is already the merge; take it as it is.
  echo "Fast-forwarding $base to $head."
  new=$head_sha
else
  git switch --quiet --detach "$base_tip"
  if ! git merge --quiet --no-ff --no-edit -m "Merge $head into $base (#$pr)" "$head_sha"; then
    git merge --abort
    echo "::error::Merging $head into $base conflicts."
    exit 1
  fi
  echo "Merging $head into $base."
  new=$(git rev-parse HEAD)
fi

# GitHub marks the PR merged once its head is reachable from the base.
git push --quiet origin "$new:refs/heads/$base"

if [[ $head == sync/* ]]; then
  git push --quiet origin --delete "$head"
fi
