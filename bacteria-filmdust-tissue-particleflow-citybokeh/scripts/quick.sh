#!/bin/bash
# quick.sh <comps> <frames> [outdir]  — rebundle and render stills + sheet
set -e
cd "$(dirname "$0")/.."
B=${BUNDLE:-/tmp/remotion-bundle}
npx remotion bundle --out-dir "$B" >/dev/null 2>&1
node scripts/stills.mjs --bundle "$B" --comps "$1" --frames "$2" --out "${3:-renders/stills}" --sheet 2>&1 | grep -a -v "memory\|Memory\|lower amount" | tail -25
