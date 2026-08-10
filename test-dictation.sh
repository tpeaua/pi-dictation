#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/dictation-helper/.build/release/dictation-helper"

if [ ! -f "$BIN" ]; then
  cd "$DIR/dictation-helper"
  swift build -c release --disable-sandbox
  cd "$DIR"
fi

"$BIN"
