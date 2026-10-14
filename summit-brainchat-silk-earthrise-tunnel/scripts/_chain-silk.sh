#!/usr/bin/env bash
cd "$(dirname "$0")/.."
while pgrep -f "scripts/render-all.sh EarthGridRise" >/dev/null; do sleep 15; done
exec scripts/render-all.sh BlackSilk-Black BlackSilk-Champagne
