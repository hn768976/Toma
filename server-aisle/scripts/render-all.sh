#!/usr/bin/env bash
# All eight 720p previews (see README for the 4K commands).
set -euo pipefail
cd "$(dirname "$0")/.."
while read -r ID NAME; do
  scripts/render-preview.sh "$ID" "$NAME"
done <<'LIST'
ServerAisle-Steel ServerAisle_Steel
FrameTunnel-WhiteBurst FrameTunnel_WhiteBurst
FrameTunnel-CyanMagenta FrameTunnel_CyanMagenta
StreamCorridor-Blue StreamCorridor_Blue
ScreenCorridor-GreenBlue ScreenCorridor_GreenBlue
ScreenCorridor-AmberTeal ScreenCorridor_AmberTeal
StageBeams-Steel StageBeams_Steel
StageBeams-Amber StageBeams_Amber
LIST
