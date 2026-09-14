#!/usr/bin/env bash
# Builds the hand-off zip for the market-arrow videos.
#
# Packs exactly the git-tracked files of this project — so node_modules,
# out/ and any local scratch are excluded by construction rather than by
# an -x list that drifts — plus DELIVERY.md, which is generated here
# because it describes the hand-off rather than the source tree.
#
# Output: dist-delivery/market-arrow-remotion-project.zip (gitignored;
# it is a build artifact, reproducible from the tracked source).
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

out_dir="dist-delivery"
stage="$out_dir/remotion-market-arrow"
zip_path="$out_dir/market-arrow-remotion-project.zip"

rm -rf "$out_dir"
mkdir -p "$stage"

git ls-files -z | tar --null -T - -cf - | tar -xf - -C "$stage"
cp docs/DELIVERY.md "$stage/DELIVERY.md"

(cd "$out_dir" && zip -rq "$(basename "$zip_path")" remotion-market-arrow)

echo "Wrote $project_root/$zip_path"
unzip -l "$zip_path" | tail -1
