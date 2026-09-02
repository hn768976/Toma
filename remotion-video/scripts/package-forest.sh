#!/usr/bin/env bash
#
# Builds the two standalone deliverables, dist/forest-ember.zip and
# dist/forest-frost.zip.
#
# Each zip is a complete, self-contained Remotion project for ONE composition:
# src/ (with the shared library vendored into src/lib), package.json,
# tsconfig.json, remotion.config.ts, public/tree.svg and a README. node_modules,
# out and .git are excluded.
#
# Usage:  bash scripts/package-forest.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
DIST="$ROOT/dist"
mkdir -p "$DIST"
trap 'rm -rf "$STAGE"' EXIT

build_one () {
  local NAME="$1" COMP="$2" VARIANT="$3" TITLE="$4" SUB="$5" PARTICLES="$6" GROUND="$7"
  local D="$STAGE/$NAME"
  mkdir -p "$D/src" "$D/public"

  cp -r "$ROOT/src/forest" "$ROOT/src/lib" "$D/src/"
  cp "$ROOT/public/tree.svg" "$D/public/"

  cat > "$D/src/index.ts" <<'EOF'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
EOF

  cat > "$D/src/Root.tsx" <<EOF
import { Composition } from "remotion";
import { ForestScene, forestSceneSchema } from "./forest/ForestScene";
import { WIDTH, HEIGHT, FPS, DURATION_IN_FRAMES } from "./forest/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="$COMP"
        component={ForestScene}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={forestSceneSchema}
        defaultProps={{ variant: "$VARIANT" as const }}
      />
      {/*
        One frame longer than the loop, while the layers stay driven by the
        240-frame cycle via \`loopFrames\`. That makes frame 240 renderable and
        directly comparable with frame 0, which is how the seamless loop is
        verified:

          npx remotion still ForestLoopCheck out/f0.png   --frame=0
          npx remotion still ForestLoopCheck out/f240.png --frame=240

        The two files are byte-identical.
      */}
      <Composition
        id="ForestLoopCheck"
        component={ForestScene}
        durationInFrames={DURATION_IN_FRAMES + 1}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={forestSceneSchema}
        defaultProps={{ variant: "$VARIANT" as const }}
      />
    </>
  );
};
EOF

  cat > "$D/package.json" <<EOF
{
  "name": "$NAME",
  "version": "1.0.0",
  "description": "$TITLE — a 4K seamless loop built with Remotion",
  "license": "UNLICENSED",
  "private": true,
  "scripts": {
    "dev": "remotion studio",
    "render": "remotion render $COMP out/$NAME.mp4 --codec=h264 --crf=12 --concurrency=8",
    "preview": "remotion render $COMP out/$NAME-preview.mp4 --codec=h264 --crf=18 --scale=0.5",
    "lint": "tsc"
  },
  "dependencies": {
    "@remotion/cli": "4.0.515",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "remotion": "4.0.515",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/react": "19.2.7",
    "@types/web": "0.0.166",
    "typescript": "5.9.3"
  }
}
EOF

  cp "$ROOT/tsconfig.json" "$D/tsconfig.json"

  cat > "$D/remotion.config.ts" <<'EOF'
/**
 * Note: when using the Node.js APIs this file does not apply — pass the same
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// JPEG intermediate frames, which is what the delivered previews were rendered
// with. For a 4K master, `Config.setVideoImageFormat("png")` gives slightly
// cleaner gradients in the sky and fog, at roughly double the render time.
Config.setVideoImageFormat("jpeg");
EOF

  "$ROOT/scripts/forest-readme.sh" "$D/README.md" "$COMP" "$TITLE" "$NAME" "$SUB" "$PARTICLES" "$GROUND"
}

build_one forest-ember ForestEmber ember "Forest Ember" \
  "A burnt forest at night: bare silhouettes in drifting haze, with embers rising from a glowing bed of coals along the ground." \
  "180 embers, rising, flickering on two incommensurate sines, with bloom." \
  "a band of deep red glow along the base with a dense cluster of ~280 small bright embers in it, brightest at the very bottom and spent by ~15% of the frame height."

build_one forest-frost ForestFrost frost "Forest Frost" \
  "A winter forest at night: bare silhouettes in dense cold haze, with snow falling through it onto unevenly settled drifts." \
  "320 flakes, falling, larger and softer than embers, drifting sideways and tumbling, fading slowly in and out rather than flickering." \
  "a pale band of settled snow along the base with an irregular, drifted upper edge."

rm -f "$DIST/forest-ember.zip" "$DIST/forest-frost.zip"
(cd "$STAGE" && zip -rq "$DIST/forest-ember.zip" forest-ember -x "*/node_modules/*" "*/out/*" "*/.git/*")
(cd "$STAGE" && zip -rq "$DIST/forest-frost.zip" forest-frost -x "*/node_modules/*" "*/out/*" "*/.git/*")

echo "Wrote:"
ls -la "$DIST"/forest-*.zip
