#!/usr/bin/env bash
# Runs on a read-only-token job. The container never receives GitHub or deployment credentials.
set -euo pipefail
source_dir="$RUNNER_TEMP/candidate"
meta="$RUNNER_TEMP/candidate.git"
git clone -q --no-checkout --separate-git-dir="$meta" "$GITHUB_WORKSPACE" "$source_dir"
git -C "$source_dir" checkout -q --detach "$RELEASE"
# The container sees a source export. Its Git object store and remote stay on the host.
unlink "$source_dir/.git"
docker build -q -t watheq-repair scripts/autofix
mkdir -p "$RUNNER_TEMP/model-home/.codex" "$RUNNER_TEMP/repair"
cat > "$RUNNER_TEMP/model-home/.codex/config.toml" <<'TOML'
model = "openai/gpt-6.2-sol"
model_reasoning_effort = "medium"
model_provider = "openrouter"
[model_providers.openrouter]
name = "OpenRouter"
base_url = "http://model-gateway:8080/api/v1"
env_key = "MODEL_GATEWAY"
wire_api = "responses"
TOML
opts=(--rm --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --pids-limit 512 --memory 5g
      -v "$source_dir:/work" -w /work -e HOME=/home/repair -v "$RUNNER_TEMP/model-home:/home/repair")
docker run "${opts[@]}" -e PUPPETEER_SKIP_DOWNLOAD=true watheq-repair npm ci --no-audit --no-fund
source scripts/autofix/gateway.sh
location=$(python3 scripts/autofix/incident.py location)
prompt="Investigate Watheq functional incident $ISSUE: signal $SIGNAL, exception type $KIND, release $RELEASE. Application frame: $location.
Use only this source tree and synthetic local fixtures. Never contact a live application or use customer data.
Read CLAUDE.md. Reproduce the reported functional outcome with a new focused Vitest test named autofix-$ISSUE.test.ts or .tsx under src/__tests__ or netlify/functions/__tests__.
Run the test before the fix. If it fails for the reported reason, correct the product code and run it again.
Leave only the new test and minimal production code in src, netlify/functions or netlify/lib. Do not edit existing tests, manifests or monitoring to suppress the failure.
If there is insufficient incident evidence, an upstream outage, or a security incident requiring investigation, leave the source untouched.
Write a single status to /home/repair/result: candidate, upstream, or unreproduced. No fix is released by this job."
if ! timeout 18m docker run "${opts[@]}" --network "$network" -e MODEL_GATEWAY=isolated-runner watheq-repair \
  codex exec --skip-git-repo-check --ephemeral --dangerously-bypass-approvals-and-sandbox "$prompt" >/dev/null 2>&1; then
  echo 'status=unverified' >> "$GITHUB_OUTPUT"
  exit 0
fi
result="$RUNNER_TEMP/model-home/result"
if [[ ! -f "$result" || -L "$result" || $(stat -c %s "$result") -gt 32 ]]; then
  echo 'status=unreproduced' >> "$GITHUB_OUTPUT"
  exit 0
fi
case "$(cat "$result")" in
  candidate) python3 scripts/autofix/patch.py collect "$meta" "$source_dir" "$RUNNER_TEMP/repair" ;;
  upstream) echo 'status=upstream' >> "$GITHUB_OUTPUT";;
  *) echo 'status=unreproduced' >> "$GITHUB_OUTPUT";;
esac
