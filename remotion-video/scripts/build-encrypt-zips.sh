#!/usr/bin/env bash
# Builds the two standalone deliverables:
#   dist/encrypt-success.zip
#   dist/encrypt-failure.zip
#
# Each zip is a self-contained Remotion project holding BOTH compositions
# (one VARIANTS object drives both); the README in each names the composition
# that zip is the deliverable for. node_modules/, out/ and .git/ are excluded.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist="$here/dist"
rm -rf "$dist"
mkdir -p "$dist"

stage_project () {
  local stage="$1"
  mkdir -p "$stage/src" "$stage/public/fonts"

  cp -R "$here/src/encrypt" "$stage/src/encrypt"
  cp "$here/public/fonts/RobotoCondensed-Regular.woff2" \
     "$here/public/fonts/RobotoCondensed-Bold.woff2" \
     "$here/public/fonts/RobotoMono-Regular.woff2" \
     "$here/public/fonts/RobotoMono-Medium.woff2" \
     "$stage/public/fonts/"

  cat > "$stage/public/fonts/LICENSE.txt" <<'EOF'
Roboto Condensed and Roboto Mono
Copyright 2015 The Roboto Project Authors (https://github.com/googlefonts/roboto)
Licensed under the Apache License, Version 2.0.
Full licence text: https://www.apache.org/licenses/LICENSE-2.0

These are the latin subsets published by Google Fonts, bundled here so that
rendering requires no network access.
EOF

  cat > "$stage/src/index.ts" <<'EOF'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
EOF

  cat > "$stage/src/Root.tsx" <<'EOF'
import { Composition } from "remotion";
import { EncryptScreen } from "./encrypt/EncryptScreen";
import {
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
} from "./encrypt/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EncryptSuccess"
        component={EncryptScreen}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "success" as const }}
      />
      <Composition
        id="EncryptFailure"
        component={EncryptScreen}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "failure" as const }}
      />
    </>
  );
};
EOF

  cat > "$stage/remotion.config.ts" <<'EOF'
/**
 * Note: when using the Node.js APIs this file does not apply — pass the
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
EOF

  cat > "$stage/package.json" <<'EOF'
{
  "name": "encryption-progress-screen",
  "version": "1.0.0",
  "description": "4K encryption progress screen — success and failure variants",
  "license": "UNLICENSED",
  "private": true,
  "scripts": {
    "dev": "remotion studio",
    "lint": "tsc",
    "render:success": "remotion render EncryptSuccess out/encrypt-success.mp4 --codec=h264 --crf=14 --concurrency=8",
    "render:failure": "remotion render EncryptFailure out/encrypt-failure.mp4 --codec=h264 --crf=14 --concurrency=8"
  },
  "dependencies": {
    "@remotion/cli": "4.0.515",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "remotion": "4.0.515"
  },
  "devDependencies": {
    "@types/react": "19.2.7",
    "@types/web": "0.0.166",
    "typescript": "5.9.3"
  }
}
EOF

  cat > "$stage/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "Preserve",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "lib": ["es2015"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true
  },
  "exclude": ["remotion.config.ts"]
}
EOF

  cat > "$stage/.gitignore" <<'EOF'
node_modules
out
dist
.DS_Store
.env
EOF
}

write_readme () {
  local stage="$1" comp="$2" outname="$3" title="$4" summary="$5"
  cat > "$stage/README.md" <<EOF
# Encryption progress screen — $title

A 4K, 2D-canvas motion graphic of a generic "data encryption" progress dialog
on a tilted plane of machine output. $summary

## This deliverable

| | |
| --- | --- |
| Composition id | \`$comp\` |
| Resolution | **3840 x 2160 (4K UHD)** |
| Duration | 580 frames |
| Frame rate | 30 fps (≈ 19.3 s) |
| Loops? | **No.** One-shot. Frames 0 and 580 are both black, but the piece opens black, plays once and ends black — it is not designed to loop. |
| Audio | None. |

## Render at 4K

\`\`\`console
npm install
npx remotion render $comp out/$outname.mp4 --codec=h264 --crf=14 --concurrency=8
\`\`\`

A 1080p preview is the same command with \`--scale=0.5\`.

Lower \`--concurrency\` if the machine has fewer than 8 cores — Remotion
rejects a value above the available core count.

## Preview in the studio

\`\`\`console
npm run dev
\`\`\`

Both compositions are registered: \`EncryptSuccess\` and \`EncryptFailure\`.
They are the same component driven by one \`variant\` prop.

## How it is built

- **One config object.** \`src/encrypt/variants.ts\` exports \`VARIANTS\`, keyed
  by \`"success" | "failure"\`. Each entry bundles the palette, the outcome
  mode, the progress curve, the dialog labels and the icon types. No hex
  literal and no user-visible label string lives anywhere else, so switching
  variant switches the whole piece as one coherent mode.
- **Deterministic.** Every value on screen is a pure function of
  \`useCurrentFrame()\`. No \`Date.now()\`, no \`requestAnimationFrame\`, no CSS
  animation, no component state. All randomness goes through Remotion's
  \`random()\` with stable string seeds, never \`Math.random()\`, so
  \`npx remotion render\` is reproducible frame for frame.
- **One canvas.** Everything is drawn into a single \`<canvas>\` with a
  3840x2160 backing store, once per React render.
- **One tilted plane.** A single affine transform (\`ctx.setTransform\`) rotates
  by -9° and shears so the receding side compresses ~7%. The dialog inherits
  the tilt rather than sitting frontally on top of it.
- **Three depth buffers.** Near, mid and far offscreen buffers are each blurred
  exactly once on the way to the visible canvas (0 / 11 / 26 px at 4K, scaled),
  never per element. The two soft buffers run at half resolution, since their
  detail is thrown away by the blur anyway.
- **Cached chrome.** The backdrop text columns, the grid and each side panel's
  static chrome are drawn once into offscreen canvases (\`useMemo\`) and
  afterwards only blitted. Per frame only the progress fill, the hatching
  scroll, the percentage and the status icon are redrawn.
- **Self-hosted fonts.** Roboto Condensed and Roboto Mono are bundled in
  \`public/fonts\` and registered through \`FontFace\`, gated with
  \`delayRender()\` / \`continueRender()\`. Rendering therefore needs no network
  access. The percentage is set in the monospace face so its digits are
  tabular and the value does not jitter as the digits change.

## Timeline

| Frames | |
| --- | --- |
| 0 – 30 | Black. Hold. |
| 30 – 70 | Backdrop fades up, dim. Side panels draw on staggered. |
| 70 – 100 | Dialog scales in from 0.96 on a spring — border draws on first, then the contents. |
| 100 – 380 | Progress phase. |
| 380 – 410 | Transition. |
| 410 – 520 | Outcome state holds. |
| 520 – 580 | Everything fades to black. |

## Content

The backdrop text, the panel readouts and the dialog are entirely invented.
There is no real library source, no real error strings, no copyright headers,
no real operating-system iconography and no watermark.
EOF
}

# --- success ------------------------------------------------------------
stage="$dist/encrypt-success"
stage_project "$stage"
write_readme "$stage" "EncryptSuccess" "encrypt-success" "success" \
"The bar fills unevenly to 100%, a white flash carries the swap, and the dialog
settles on a pulsing checkmark and DATA PROTECTED."
( cd "$dist" && zip -qr encrypt-success.zip encrypt-success )

# --- failure ------------------------------------------------------------
stage="$dist/encrypt-failure"
stage_project "$stage"
write_readme "$stage" "EncryptFailure" "encrypt-failure" "failure" \
"The bar climbs with the same rhythm as the success version, stalls at 73%,
drains back to 41% as the fill shifts green through amber to red, then a red
flash and a glitch land on an opened padlock and DATA EXPOSED."
( cd "$dist" && zip -qr encrypt-failure.zip encrypt-failure )

rm -rf "$dist/encrypt-success" "$dist/encrypt-failure"
ls -la "$dist"
