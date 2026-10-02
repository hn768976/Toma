#!/usr/bin/env bash
# Re-render the given compositions, re-verify them, then render all stills.
cd "$(dirname "$0")/.."
C="ChipAlert-Red ChipAlert-Amber BreachHUD-Blue BreachHUD-Green"
scripts/render-previews.sh $C
python3 scripts/verify.py probe
python3 scripts/verify.py frames $C
python3 scripts/verify.py banding $C | grep -E "^banding|longest"
python3 scripts/look1-check.py ChipAlert-Red ChipAlert-Amber | grep -E "f0:|f300:|range"
python3 scripts/verify.py loop $C
python3 scripts/verify.py determinism $C
for c in $C; do scripts/stress.sh out/bundle $c 300 2 | tail -1; done
s=$(date +%s); scripts/render-stills.sh; echo "stills total $(( $(date +%s)-s ))s"
ls -la renders/stills
