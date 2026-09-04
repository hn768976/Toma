#!/usr/bin/env bash
# Builds foggy-forest-project.zip: a standalone, 4K-render-ready Remotion
# project containing only what this piece needs. node_modules, .git and any
# render output are excluded by construction -- nothing is copied in.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
STAGE="$(mktemp -d)"
PROJ="$STAGE/foggy-forest-project"

mkdir -p "$PROJ/src/foggy-forest" "$PROJ/public/trees" "$PROJ/tools"

cp "$ROOT"/src/foggy-forest/*.ts "$ROOT"/src/foggy-forest/*.tsx "$PROJ/src/foggy-forest/"
cp "$ROOT"/public/trees/*.png "$ROOT"/public/trees/*.svg \
   "$ROOT"/public/trees/manifest.json "$PROJ/public/trees/"
cp "$ROOT"/tools/tree-gen.html "$ROOT"/tools/render-trees.mjs \
   "$ROOT"/tools/check-neutral.mjs "$ROOT"/tools/check-loop.mjs \
   "$ROOT"/tools/cdp.mjs "$ROOT"/tools/trace-svg.mjs \
   "$ROOT"/tools/render-all.sh "$PROJ/tools/"
cp "$ROOT/tsconfig.json" "$ROOT/.prettierrc" "$PROJ/"
cp "$ROOT/FOGGY-FOREST-README.md" "$PROJ/README.md"
chmod +x "$PROJ/tools/render-all.sh"

cat > "$PROJ/src/index.ts" <<'EOF'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
EOF

cat > "$PROJ/src/Root.tsx" <<'EOF'
import React from "react";
import { Composition } from "remotion";
import {
  FoggyForest,
  foggyForestSchema,
} from "./foggy-forest/FoggyForest";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./foggy-forest/constants";

const VERSIONS = [
  ["V1-FoggyForestTeal", "teal"],
  ["V2-FoggyForestAmber", "amber"],
  ["V3-FoggyForestMono", "mono"],
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map(([id, palette]) => (
      <Composition
        key={id}
        id={id}
        component={FoggyForest}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={foggyForestSchema}
        defaultProps={{ palette }}
      />
    ))}
  </>
);
EOF

cat > "$PROJ/remotion.config.ts" <<'EOF'
/**
 * Note: when using the Node.js APIs this config file does not apply --
 * pass options directly to the APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
EOF

cat > "$PROJ/package.json" <<'EOF'
{
  "name": "foggy-forest",
  "version": "1.0.0",
  "description": "Foggy Forest at Night — a looping 4K Remotion motion background",
  "license": "UNLICENSED",
  "private": true,
  "dependencies": {
    "@remotion/cli": "4.0.515",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "remotion": "4.0.515",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/react": "19.2.7",
    "@types/web": "0.0.166",
    "typescript": "5.9.3"
  },
  "scripts": {
    "dev": "remotion studio",
    "build": "remotion bundle",
    "lint": "tsc"
  }
}
EOF

cat > "$PROJ/.gitignore" <<'EOF'
node_modules
out
dist
.DS_Store
.env
EOF

rm -f "$ROOT/out/foggy-forest-project.zip"
mkdir -p "$ROOT/out"
(cd "$STAGE" && zip -qr "$ROOT/out/foggy-forest-project.zip" foggy-forest-project)
rm -rf "$STAGE"
echo "out/foggy-forest-project.zip"
unzip -l "$ROOT/out/foggy-forest-project.zip" | tail -3
