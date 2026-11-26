#!/usr/bin/env bash
# Exercise the same patch collector, isolated verification, publisher and phone report
# against a throwaway local remote. This run never calls a model, GitHub API or Telegram.
set -euo pipefail
tools_dir="$(pwd)/scripts/autofix"
export RUNNER_TEMP=$(mktemp -d)
export ISSUE=42 KIND=Error SIGNAL=feed_load_failed GITHUB_REPOSITORY=synthetic/watheq GITHUB_RUN_ID=1
export GITHUB_OUTPUT="$RUNNER_TEMP/outputs"
mkdir -p "$RUNNER_TEMP/seed/src/__tests__" "$RUNNER_TEMP/repair" "$RUNNER_TEMP/bin"
cp package.json package-lock.json "$RUNNER_TEMP/seed/"
cd "$RUNNER_TEMP/seed"
git init -q -b main
git config user.name Fixture
git config user.email fixture@example.test
npm pkg set 'scripts.lint=node --check src/feed.js' 'scripts.type:check=tsc --allowJs --checkJs --noEmit --skipLibCheck src/feed.js'
echo 'export function rows(feed) { return feed.postings[0]; }' > src/feed.js
git add .
git commit -qm fixture
export RELEASE=$(git rev-parse HEAD)
export BASE_SHA="$RELEASE"
git clone -q --bare . "$RUNNER_TEMP/origin.git"
git remote add origin "$RUNNER_TEMP/origin.git"
git clone -q --separate-git-dir="$RUNNER_TEMP/metadata" . "$RUNNER_TEMP/source"
unlink "$RUNNER_TEMP/source/.git"
mkdir -p "$RUNNER_TEMP/source/src/__tests__"
cat > "$RUNNER_TEMP/source/src/__tests__/autofix-42.test.ts" <<'TEST'
import { expect, it } from 'vitest';
import { rows } from '../feed.js';
it('shows an empty feed after a successful empty search', () => {
  expect(rows({postings: []})).toEqual([]);
});
TEST
echo 'export function rows(feed) { return feed.postings; }' > "$RUNNER_TEMP/source/src/feed.js"
python3 -B "$tools_dir/patch.py" collect "$RUNNER_TEMP/metadata" "$RUNNER_TEMP/source" "$RUNNER_TEMP/repair"
bash "$tools_dir/verify.sh"
cat > "$RUNNER_TEMP/bin/gh" <<'GH'
#!/usr/bin/env bash
set -eu
case "$1 $2" in
  "api repos/$GITHUB_REPOSITORY/git/ref/heads/main") echo "$BASE_SHA";;
  "auth setup-git") ;;
  "pr create") echo "https://github.com/$GITHUB_REPOSITORY/pull/1";;
  *) exit 1;;
esac
GH
chmod +x "$RUNNER_TEMP/bin/gh"
PATH="$RUNNER_TEMP/bin:$PATH" bash "$tools_dir/publish.sh"
test "$(git --git-dir="$RUNNER_TEMP/origin.git" rev-parse main)" = "$RELEASE"
git --git-dir="$RUNNER_TEMP/origin.git" show-ref --verify "refs/heads/codex/autofix-$ISSUE-$RELEASE-$SIGNAL"
export PR_URL=$(sed -n 's/^url=//p' "$GITHUB_OUTPUT")
PYTHONPATH="$tools_dir" python3 -B - <<'PY'
import incident
from unittest.mock import patch
with patch.object(incident, "send_report") as sent:
    incident.report()
    msg = sent.call_args.args[0]
    assert "https://github.com/synthetic/watheq/pull/1" in msg and "Review and merge" in msg
PY
