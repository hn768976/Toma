#!/usr/bin/env bash
#
# Packs the render-ready project.
#
#   scripts/package-zip.sh           # one zip: country-map-project.zip
#   scripts/package-zip.sh --parts   # plus three smaller zips, for transports
#                                    # with an attachment size limit
#
# Excludes node_modules, .git, the raw source cache and any render output — the
# baked assets in public/ and src/data/ are everything a 4K batch needs.
#
# The --parts split is by directory, not by byte range: each part is a complete,
# independently valid .zip. Unzip all three into the same folder, in any order,
# and you have the same tree the single zip gives you.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=country-map-project
DEST="$(cd .. && pwd)"
EXCLUDES=('node_modules/*' '.git/*' 'out/*' '.cache/*' '*.DS_Store')

rm -f "$DEST/$NAME.zip"
zip -rq "$DEST/$NAME.zip" . -x "${EXCLUDES[@]}"
printf '%-44s %s\n' "$NAME.zip" "$(du -h "$DEST/$NAME.zip" | cut -f1)"

if [[ "${1:-}" == "--parts" ]]; then
  # 1 — everything except the two big raster directories: source, baked vectors,
  #     fonts, config. This is the part that actually changes when you edit.
  # 2 — the pre-warped relief rasters.
  # 3 — the satellite layers.
  rm -f "$DEST/$NAME-1-source.zip" "$DEST/$NAME-2-relief.zip" "$DEST/$NAME-3-satellite.zip"

  zip -rq "$DEST/$NAME-1-source.zip" . \
    -x "${EXCLUDES[@]}" 'public/relief/*' 'public/satellite/*'
  zip -rq "$DEST/$NAME-2-relief.zip" public/relief
  zip -rq "$DEST/$NAME-3-satellite.zip" public/satellite

  for p in 1-source 2-relief 3-satellite; do
    printf '%-44s %s\n' "$NAME-$p.zip" "$(du -h "$DEST/$NAME-$p.zip" | cut -f1)"
  done
  echo
  echo "Unzip all three into the same folder:"
  echo "  unzip -o '$NAME-*.zip' -d $NAME"
fi
