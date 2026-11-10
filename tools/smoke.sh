#!/usr/bin/env bash
# Smoke test for the Compose stack (T-PLAT-32). Run after `pnpm stack:up`.
# Ports follow the Compose overrides: API_PORT, WEB_PORT, FAKES_PORT.
# STACK_T0 (epoch seconds, optional) makes the elapsed time include the stack start-up.
set -euo pipefail
API="http://localhost:${API_PORT:-4000}"
WEB="http://localhost:${WEB_PORT:-3000}"
FAKES="http://localhost:${FAKES_PORT:-4100}"
T0="${STACK_T0:-$(date +%s)}"
PHONE="+8801712345678"
CURL=(curl -fsS --retry 10 --retry-delay 2 --retry-all-errors)
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const r=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],v);process.stdout.write(r==null?"":String(r))})' "$1"; }

echo "== ready"; "${CURL[@]}" "$API/ready" >/dev/null
echo "== web"; "${CURL[@]}" -o /dev/null "$WEB"
echo "== fakes"; "${CURL[@]}" "$FAKES/sms/messages" >/dev/null
echo "== flags"; "${CURL[@]}" "$API/v1/flags" >/dev/null

echo "== login + create family"
resp=$("${CURL[@]}" -X POST -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}" "$API/v1/auth/otp/request")
code=$(printf '%s' "$resp" | json devCode)
if [ -z "$code" ]; then
  # No dev code in the response: read it from the fake SMS list.
  code=$("${CURL[@]}" "$FAKES/sms/messages?to=%2B8801712345678" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).messages.at(-1);const c=m&&/\d{6}/.exec(m.text);process.stdout.write(c?c[0]:"")})')
fi
[ -n "$code" ] || { echo "no OTP code found" >&2; exit 1; }
token=$("${CURL[@]}" -X POST -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$code\"}" "$API/v1/auth/otp/verify" | json accessToken)
[ -n "$token" ] || { echo "no access token" >&2; exit 1; }
fam=$("${CURL[@]}" -X POST -H 'content-type: application/json' -H "authorization: Bearer $token" -d '{"name":"Smoke family"}' "$API/v1/families" | json id)
[ -n "$fam" ] || { echo "family not created" >&2; exit 1; }

elapsed=$(($(date +%s) - T0))
echo "smoke ok in ${elapsed}s"
[ "$elapsed" -le 180 ] || { echo "too slow: ${elapsed}s > 180s" >&2; exit 1; }
