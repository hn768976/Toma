#!/usr/bin/env bash
# Packs the "Generate button" piece into a standalone, self-contained Remotion
# project (source only — no node_modules, no renders) and zips it.
#
#   ./scripts/pack-generate-button.sh [output-dir]
#
# The result unzips, `npm install`s, and renders the 1080p and 4K masters with
# nothing else from this repo.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$HERE/out}"
NAME="toma-generate-button"
STAGE="$OUT_DIR/$NAME"

rm -rf "$STAGE" "$OUT_DIR/$NAME.zip"
mkdir -p "$STAGE/src/generate-button" "$STAGE/public/fonts"

cp -r "$HERE/src/generate-button/." "$STAGE/src/generate-button/"
cp "$HERE/public/fonts/LiberationSans-Regular.ttf" "$STAGE/public/fonts/"
cp "$HERE/src/index.css" "$STAGE/src/"
cp "$HERE/remotion.config.ts" "$HERE/tsconfig.json" "$HERE/eslint.config.mjs" \
   "$HERE/.prettierrc" "$HERE/package-lock.json" "$STAGE/"

# The standalone project registers only this piece's compositions.
cat > "$STAGE/src/index.ts" <<'TS'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
TS

cat > "$STAGE/src/Root.tsx" <<'TSX'
import "./index.css";
import { Composition } from "remotion";
import {
  GenerateButtonScene,
  generateButtonSchema,
  generateButtonDefaults,
} from "./generate-button/GenerateButtonScene";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES,
  FPS,
} from "./generate-button/constants";

/**
 * 1080p and 4K render from the same 1920x1080 design space, so the masters
 * are frame-identical apart from resolution.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {(
      [
        ["Dark", "dark"],
        ["Light", "light"],
      ] as const
    ).map(([suffix, themeName]) =>
      (
        [
          ["1080p", 1],
          ["4K", 2],
        ] as const
      ).map(([sizeName, mult]) => (
        <Composition
          key={`${suffix}${sizeName}`}
          id={`GenerateButton${suffix}${sizeName}`}
          component={GenerateButtonScene}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={BASE_WIDTH * mult}
          height={BASE_HEIGHT * mult}
          schema={generateButtonSchema}
          defaultProps={{ ...generateButtonDefaults, theme: themeName }}
        />
      )),
    )}
  </>
);
TSX

# Same dependency set as this repo, so the copied lockfile stays valid.
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
pkg.name = "toma-generate-button";
pkg.description = "Generate button / circuit burst — 30fps, 20s, 1080p + 4K";
pkg.sideEffects = ["*.css", "./src/generate-button/load-font.ts"];
pkg.scripts = {
  dev: "remotion studio",
  lint: "eslint src && tsc",
  "render:dark:1080": "remotion render GenerateButtonDark1080p out/generate-button_dark_1080p.mp4 --codec=h264 --crf=17",
  "render:light:1080": "remotion render GenerateButtonLight1080p out/generate-button_light_1080p.mp4 --codec=h264 --crf=17",
  "render:dark:4k": "remotion render GenerateButtonDark4K out/generate-button_dark_4k.mp4 --codec=h264 --crf=16",
  "render:light:4k": "remotion render GenerateButtonLight4K out/generate-button_light_4k.mp4 --codec=h264 --crf=16",
  "render:all": "npm run render:dark:1080 && npm run render:light:1080 && npm run render:dark:4k && npm run render:light:4k",
};
fs.writeFileSync(process.argv[2], JSON.stringify(pkg, null, 2) + "\n");
' "$HERE/package.json" "$STAGE/package.json"

printf 'node_modules\ndist\nout\n.DS_Store\n.env\n' > "$STAGE/.gitignore"
cp "$HERE/src/generate-button/README.md" "$STAGE/README.md"

( cd "$OUT_DIR" && zip -rq "$NAME.zip" "$NAME" )
echo "packed -> $OUT_DIR/$NAME.zip"
