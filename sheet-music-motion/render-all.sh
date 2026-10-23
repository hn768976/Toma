#!/usr/bin/env bash
# Renders the four 4K compositions as 1080p H.264 MP4 deliverables (scale 0.5).
# Comp 2 carries heavy animated film grain, so it uses CRF 21 to keep bitrate sane.
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-out}"
mkdir -p "$OUT"
npx remotion render Comp1-V1-ScoreDolly            "$OUT/Comp1_V1_ScoreDolly_1080p.mp4"             --scale=0.5
npx remotion render Comp1-V2-ScoreCraneOrbit       "$OUT/Comp1_V2_ScoreCraneOrbit_1080p.mp4"        --scale=0.5
npx remotion render Comp2-V1-FloatingNotes         "$OUT/Comp2_V1_FloatingNotes_1080p.mp4"          --scale=0.5 --crf=21
npx remotion render Comp2-V2-FloatingNotesCyanotype "$OUT/Comp2_V2_FloatingNotesCyanotype_1080p.mp4" --scale=0.5 --crf=21
