#!/bin/bash
# Full mechanical verification of all five previews (steps 1-6 minus the visual agent steps).
cd "$(dirname "$0")/.."
run() { # id name prefix [heavy frames]
  HEAVY="${4:-300 260}" tools/verify.sh "$1" "$2"
  python3 tools/analyze.py "out/previews/$2.mp4" "out/verify/$1" "$3"
}
run GlowGradient-Aurora GlowGradient_Aurora GlowAurora
run GlowGradient-Sunset GlowGradient_Sunset GlowSunset
run GlitchCode-MonoRGB GlitchCode_MonoRGB GlitchCode "300 330 345"
run LightCurtain-MagentaFire LightCurtain_MagentaFire CurtainMagenta
run LightCurtain-BlueTeal LightCurtain_BlueTeal CurtainBlue
