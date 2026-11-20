#!/bin/sh
# Starts the dev server in the background and returns once it answers, so an
# agent never guesses with `sleep`. Restarts a running one: a fresh server
# also clears a stale hot-reloaded module. Logs go to /tmp/dev.log.
pkill -f "react-router dev" 2>/dev/null
nohup npm run dev </dev/null >/tmp/dev.log 2>&1 &
for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:5173/ && echo "Dev server up on http://localhost:5173 (log: /tmp/dev.log)" && exit 0
  sleep 0.5
done
echo "The dev server did not answer within 30 seconds. /tmp/dev.log:"
tail -20 /tmp/dev.log
exit 1
