#!/usr/bin/env bash
# Runs scripts/verify-one.sh for every composition (or the ids given as args).
set -uo pipefail
OUT=${OUT:-../deliverables}
scripts/compositions.sh | while read -r ID NAME; do
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $ID " ]]; then continue; fi
  rm -rf "$OUT/checks/$NAME"
  scripts/verify-one.sh "$ID" "$NAME" "$OUT"
done
