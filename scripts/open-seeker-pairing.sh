#!/bin/zsh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <pairing-token-or-handoff-url>" >&2
  exit 1
fi

input="$1"

if [[ "$input" == solanaos://* ]]; then
  deep_link_url="$input"
elif [[ "$input" == http*"://"* ]]; then
  if [[ "$input" == *"token="* ]]; then
    token="${input##*token=}"
    token="${token%%&*}"
    deep_link_url="solanaos://pair?token=${token}"
  else
    echo "expected a pairing token in the handoff URL" >&2
    exit 1
  fi
else
  deep_link_url="solanaos://pair?token=${input}"
fi

adb shell am start \
  -a android.intent.action.VIEW \
  -d "$deep_link_url" \
  com.solanaos.solanaos
