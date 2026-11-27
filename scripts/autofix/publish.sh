#!/usr/bin/env bash
set -euo pipefail
bundle="$RUNNER_TEMP/repair"
branch="codex/autofix-$ISSUE-$RELEASE-$SIGNAL"
if [[ "$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)" != "$BASE_SHA" ]]; then
  echo 'status=stale' >> "$GITHUB_OUTPUT"
  exit 0
fi
git switch -c "$branch" "$BASE_SHA"
git apply --index "$bundle/test.diff" "$bundle/fix.diff"
git config user.name "Watheq Autofix"
git config user.email "autofix@users.noreply.github.com"
git -c core.hooksPath=/dev/null commit -m "Repair $SIGNAL for Sentry issue $ISSUE"
gh auth setup-git
# A retry may find a branch pushed before PR creation failed. Never replace divergent work.
remote=$(git ls-remote --heads origin "refs/heads/$branch" | cut -f1)
if [[ -n "$remote" ]]; then
  git fetch -q origin "$remote"
  git diff --quiet HEAD "$remote" || exit 1
else
  git push origin "HEAD:refs/heads/$branch"
fi
cat > "$RUNNER_TEMP/pr-body" <<EOF
Production Sentry issue $ISSUE reported $SIGNAL ($KIND) on release $RELEASE.

Synthetic regression: $(cat "$bundle/test-path"). An assertion failed on the original code and passed with this patch. The proposed base also passed lint, types, and repository tests.

[Review the verification run](https://github.com/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID). Merge to approve production release.
EOF
url=$(gh pr create --base main --head "$branch" --title "Repair $SIGNAL (Sentry $ISSUE)" --body-file "$RUNNER_TEMP/pr-body")
echo "url=$url" >> "$GITHUB_OUTPUT"
echo 'status=ready' >> "$GITHUB_OUTPUT"
