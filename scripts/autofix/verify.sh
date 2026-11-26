#!/usr/bin/env bash
set -euo pipefail
bundle="$RUNNER_TEMP/repair"
test_file=$(cat "$bundle/test-path")
red_output=$(mktemp -d)
chmod 777 "$red_output" # Fresh directory shared with a disposable, unprivileged container.
# Each check gets its own writable filesystem from the trusted release image.
# A red test cannot edit the green test's source, dependencies, or evidence.
check() {
  local stage="$1"
  shift
  local volumes=()
  if [[ "$stage" == red ]]; then volumes=(-v "$red_output:/evidence"); fi
  docker run --rm --network none --user node --cap-drop ALL --security-opt no-new-privileges \
    --pids-limit 1024 -v "$bundle:/patch:ro" "${volumes[@]}" watheq-check \
    bash -eu -c 'git apply /patch/test.diff; if [[ "$1" == green ]]; then git apply /patch/fix.diff; fi; shift; exec "$@"' bash "$stage" "$@"
}
verify_revision() {
  local work
  work=$(mktemp -d)
  git archive "$1" | tar -x -C "$work"
  docker build -q -t watheq-check -f - "$work" <<'DOCKER'
FROM node:22-bookworm
WORKDIR /work
RUN chown node:node /work
USER node
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY --chown=node:node . .
RUN npm ci --no-audit --no-fund
DOCKER
  if check red node node_modules/vitest/vitest.mjs run "$test_file" --reporter=json --outputFile=/evidence/red.json; then
    echo "Regression already passes on $1" >&2
    return 1
  fi
  python3 - "$red_output/red.json" "$test_file" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
assert not path.is_symlink() and path.stat().st_size <= 2_000_000
reports = json.loads(path.read_text())["testResults"]
assert any(suite["name"] == "/work/" + sys.argv[2] and
           any(test["status"] == "failed" for test in suite["assertionResults"]) for suite in reports)
path.unlink()
PY
  check green node node_modules/vitest/vitest.mjs run "$test_file"
}
verify_revision "$RELEASE"
if [[ "$RELEASE" != "$BASE_SHA" ]]; then verify_revision "$BASE_SHA"; fi
check green npm run lint
check green npm run type:check
check green npm run test
