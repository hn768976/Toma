#!/usr/bin/env bash
# Steps 2–5 for every composition. Output: out/logs/verify.txt
cd "$(dirname "$0")/.."
ALL=(SoftLight-Blue SoftLight-Violet CloudMap-Story GoldRibbonPodium-RedGold GoldRibbonPodium-EmeraldGold ChromePortal-Silver ChromePortal-Gold DataCube-Blue)
for id in "${ALL[@]}"; do
  name="${id//-/_}"; mid=300; [ "$id" = "CloudMap-Story" ] && mid=150
  echo "== $id"
  if [ "$id" != "CloudMap-Story" ]; then echo -n "loop 0 vs 600: "; scripts/verify.sh loop "$id"; fi
  echo -n "determinism frame $mid: "; scripts/verify.sh determinism "$id"
  python3 scripts/banding.py "$name" $mid
  scripts/verify.sh contact "$id"
done
