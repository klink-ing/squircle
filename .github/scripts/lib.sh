# Shared by the branch bot's scripts: promote.sh, sync-branches.sh and
# wait-for-checks.sh. Source it; don't run it.

# The bot's commits are attributed to github-actions[bot], like the other
# workflows' commits are.
export GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME:-github-actions[bot]}
export GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-github-actions[bot]@users.noreply.github.com}
export GIT_COMMITTER_NAME=${GIT_COMMITTER_NAME:-$GIT_AUTHOR_NAME}
export GIT_COMMITTER_EMAIL=${GIT_COMMITTER_EMAIL:-$GIT_AUTHOR_EMAIL}

# Logs an error and exits. The message is also kept in $RUNNER_TEMP/bot-error,
# which promote.yml quotes on the PR.
fail() {
  echo "::error::$*"
  if [[ -n ${RUNNER_TEMP:-} ]]; then
    echo "$*" >"$RUNNER_TEMP/bot-error"
  fi
  exit 1
}

# land <branch> <commit> <message> <ff|merge>
#
# Brings <commit> into <branch> on origin. With `ff` that's a fast-forward when
# the branch has nothing of its own, and a merge commit titled <message>
# otherwise; with `merge` it's always a merge commit. Never force-pushes. When
# the push is rejected because the branch moved meanwhile, it starts over from
# a fresh fetch.
#
# Returns 0 once the branch contains the commit, 1 if merging conflicts, and 2
# if it couldn't fetch or push.
land() {
  local branch=$1 sha=$2 message=$3 mode=$4 attempt tip new
  git cat-file -e "$sha^{commit}" || return 2
  for attempt in 1 2 3; do
    git fetch --quiet origin "+refs/heads/$branch:refs/remotes/origin/$branch" || return 2
    tip=$(git rev-parse "origin/$branch") || return 2

    if git merge-base --is-ancestor "$sha" "$tip"; then
      echo "$branch already contains it."
      return 0
    fi

    if [[ $mode == ff ]] && git merge-base --is-ancestor "$tip" "$sha"; then
      new=$sha
    else
      git switch --quiet --detach "$tip" || return 2
      if ! git merge --quiet --no-ff --no-edit -m "$message" "$sha"; then
        git merge --abort
        return 1
      fi
      new=$(git rev-parse HEAD)
    fi

    if git push --quiet origin "$new:refs/heads/$branch"; then
      if [[ $new == "$sha" ]]; then
        echo "Fast-forwarded $branch."
      else
        echo "Merged it into $branch."
      fi
      return 0
    fi
    echo "The push to $branch was rejected (attempt $attempt); starting over."
  done
  return 2
}
