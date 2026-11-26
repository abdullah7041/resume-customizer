# Shared only by the isolated model runner and its credential-free qualification.
network="watheq-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
gateway="$network-gateway"
trap 'docker rm -f "$gateway" >/dev/null 2>&1 || true; docker network rm "$network" >/dev/null 2>&1 || true' EXIT
docker network create --internal "$network" >/dev/null
gateway_opts=(--user 101:101 --cap-drop ALL --security-opt no-new-privileges --read-only
              --tmpfs /etc/nginx/conf.d:mode=1777 --tmpfs /var/cache/nginx:mode=1777 --tmpfs /var/run:mode=1777
              -v "$GITHUB_WORKSPACE/scripts/autofix/gateway.conf.template:/etc/nginx/templates/default.conf.template:ro")
docker run -d --name "$gateway" "${gateway_opts[@]}" -e OPENROUTER_API_KEY nginx:stable-alpine >/dev/null
docker network connect --alias model-gateway "$network" "$gateway"
