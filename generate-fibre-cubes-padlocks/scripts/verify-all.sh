#!/usr/bin/env bash
# Runs the loop, determinism and contact-sheet checks for all compositions.
cd "$(dirname "$0")/.."
LOOPS="FibreRibbon-Blue FibreRibbon-Violet CubeNetwork-Blue PadlockField-TopDownOrange PadlockField-FlyOverCyan"
STORIES="GenerateButton-Circuit GenerateButton-Waveform GenerateButton-CircuitWarm"
echo "== loop check"; scripts/loop-check.sh $LOOPS 2>&1 | grep "loop 0 vs"
echo "== determinism"
for id in $STORIES; do scripts/determinism-check.sh $id 45 110 300 2>&1 | grep "cold vs"; done
for id in $LOOPS; do scripts/determinism-check.sh $id 300 2>&1 | grep "cold vs"; done
echo "== contact sheets"
for id in $STORIES; do scripts/contact-sheet.sh $id 450 2>&1 | tail -1; done
for id in $LOOPS; do scripts/contact-sheet.sh $id 600 2>&1 | tail -1; done
echo DONE
