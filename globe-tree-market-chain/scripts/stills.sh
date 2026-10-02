#!/usr/bin/env bash
# Two 6000x3375 PNG stills per composition (scale 6000/3840 = 1.5625).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
shoot() { npx remotion still "$1" "out/stills/$1_f$2.png" --frame="$2" --scale=1.5625 --image-format=png --timeout=300000 --log=error; }
shoot KeywordGlobe-TechBlue 60;      shoot KeywordGlobe-TechBlue 360
shoot KeywordGlobe-BusinessGold 60;  shoot KeywordGlobe-BusinessGold 360
shoot CircuitTree-Blue 120;          shoot CircuitTree-Blue 450      # mid-growth, full tree
shoot CircuitTree-EcoGreen 120;      shoot CircuitTree-EcoGreen 450
shoot MarketDashboard 90;            shoot MarketDashboard 400
shoot BlockchainPanels-IceBlue 60;   shoot BlockchainPanels-IceBlue 380
shoot BlockchainBuild-Teal 100;      shoot BlockchainBuild-Teal 440  # assembling, full chain
