#!/bin/sh
set -eu

node --experimental-strip-types src/server/replica/working-set.ts restore

node server.js &
child=$!

shutdown() {
  kill -TERM "$child" 2>/dev/null || true
  wait "$child" 2>/dev/null || true
  node --experimental-strip-types src/server/replica/working-set.ts backup || true
  exit 0
}

trap shutdown TERM INT

(
  while kill -0 "$child" 2>/dev/null; do
    sleep 30
    if kill -0 "$child" 2>/dev/null; then
      node --experimental-strip-types src/server/replica/working-set.ts backup || true
    fi
  done
) &
ticker=$!

wait "$child" || true
kill "$ticker" 2>/dev/null || true
wait "$ticker" 2>/dev/null || true
node --experimental-strip-types src/server/replica/working-set.ts backup || true
