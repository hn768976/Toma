#!/bin/bash
# Builds virus-particle-field-project.zip: a standalone Remotion project with
# only the virus work in it, ready to render at 4K elsewhere.
set -e
SRC=/home/user/Toma/remotion-video
STAGE=/tmp/vpf-stage/virus-particle-field-project
rm -rf /tmp/vpf-stage
mkdir -p "$STAGE/src"

cp -r "$SRC/src/virus" "$STAGE/src/virus"
cp "$SRC/src/index.ts" "$STAGE/src/index.ts"
cp "$SRC/tsconfig.json" "$STAGE/tsconfig.json"
cp "$SRC/.prettierrc" "$STAGE/.prettierrc" 2>/dev/null || true
cp "$SRC/eslint.config.mjs" "$STAGE/eslint.config.mjs" 2>/dev/null || true
cp "$SRC/VIRUS_README.md" "$STAGE/README.md"
cp "$SRC/package-lock.json" "$STAGE/package-lock.json"

# A Root that registers only the ten virus compositions.
cat > "$STAGE/src/Root.tsx" <<'TSX'
import { VirusCompositions } from "./virus/Root.virus";

export const RemotionRoot: React.FC = () => <VirusCompositions />;
TSX

# A config of its own. The host project's pulls in Tailwind, which nothing
# here uses, and hardcodes a sandbox-specific browser path.
cat > "$STAGE/remotion.config.ts" <<'CFG'
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// These are large smooth gradients. A JPEG intermediate would add blocking on
// top of the banding the dither is already fighting.
Config.setVideoImageFormat("png");

// Headless Chromium needs an explicit GL backend for WebGL. Passing --gl=angle
// on the command line overrides this.
Config.setChromiumOpenGlRenderer("angle");

// No audio track: these are video-only deliverables.
Config.setMuted(true);

// If your environment cannot download Remotion's managed Chrome Headless
// Shell, point it at an existing Chromium here instead:
// Config.setBrowserExecutable("/path/to/headless_shell");
CFG

cat > "$STAGE/.gitignore" <<'GI'
node_modules
dist
out
.DS_Store
.env
GI

# Pinned versions, and only what this project actually uses.
node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("/home/user/Toma/remotion-video/package.json","utf8"));
const keep = [
  "@remotion/cli","@remotion/three","remotion","react","react-dom",
  "three","@react-three/fiber","@react-three/drei",
  "@react-three/postprocessing","postprocessing",
];
const keepDev = [
  "@remotion/eslint-config-flat","@types/react","@types/three","@types/web",
  "eslint","prettier","typescript",
];
const pick = (src, names) => Object.fromEntries(
  names.filter(n => src[n]).map(n => [n, src[n]])
);
const out = {
  name: "virus-particle-field",
  version: "1.0.0",
  description: "Virus particle field - ten looks, Remotion + three.js",
  license: "UNLICENSED",
  private: true,
  scripts: {
    dev: "remotion studio",
    build: "remotion bundle",
    lint: "eslint src && tsc",
  },
  dependencies: pick(p.dependencies, keep),
  devDependencies: pick(p.devDependencies, keepDev),
  sideEffects: ["*.css"],
};
fs.writeFileSync("/tmp/vpf-stage/virus-particle-field-project/package.json", JSON.stringify(out, null, 2) + "\n");
'

cd /tmp/vpf-stage
rm -f "$SRC/out/virus-particle-field-project.zip"
mkdir -p "$SRC/out"
zip -rq "$SRC/out/virus-particle-field-project.zip" virus-particle-field-project \
  -x '*/node_modules/*' '*/.git/*' '*/out/*'
echo "zip built:"
ls -la "$SRC/out/virus-particle-field-project.zip"
unzip -l "$SRC/out/virus-particle-field-project.zip" | tail -5
