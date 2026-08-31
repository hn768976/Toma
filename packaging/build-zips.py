#!/usr/bin/env python3
"""
Builds three standalone, independently runnable Remotion projects from the
shared wave-field source, one per variant.

Each output carries only its own variant: the other two palettes and their hex
constants are removed from variants.ts, VARIANT_NAMES is narrowed to the one
name, and Root.tsx registers that composition alone.
"""

import os
import re
import shutil
import subprocess
import sys

SRC = "/home/user/Toma/remotion-video"
OUT = "/home/user/Toma/dist-projects"

VARIANTS = {
    "blue": {
        "composition": "WaveFieldBlue",
        "project": "wave-field-blue",
        "output": "wavefield-blue",
        "headline": "Warm amber particles over a deep blue ground, with cyan leading edges.",
        "detail": [
            "Four bands running diagonally across the frame at -32 degrees.",
            "~9000 particles at medium density, and a sparse mesh of 14 curves.",
            "Moderate amplitude and medium wavelength: the swell is clearly",
            "visible but not dramatic.",
        ],
    },
    "violet": {
        "composition": "WaveFieldViolet",
        "project": "wave-field-violet",
        "output": "wavefield-violet",
        "headline": "Cool mint particles over a warm violet ground, with magenta leading edges.",
        "detail": [
            "Seven narrower bands at tighter spacing, so the frame reads busier",
            "and more layered. Shorter wavelength and higher frequency give a",
            "much finer texture than a broad swell. ~15000 particles at smaller",
            "scale and lower opacity, and a dense mesh of 28 curves.",
        ],
    },
    "mono": {
        "composition": "WaveFieldMono",
        "project": "wave-field-mono",
        "output": "wavefield-mono",
        "headline": "White through grey on near-black. No colour anywhere.",
        "detail": [
            "Two large bands, each roughly 40% of frame height, with the negative",
            "space between and around them as a major compositional element.",
            "Much higher amplitude and much longer wavelength, so the wave is the",
            "frame's dominant shape. ~4000 larger particles, no mesh layer, and",
            "larger, more widely spaced leading-edge dots carrying a pronounced",
            "travelling brightness pulse.",
        ],
    },
}

WAVE_FIELD_FILES = [
    "BackgroundWash.tsx",
    "LeadingEdge.tsx",
    "MeshLayer.tsx",
    "ParticleLayer.tsx",
    "WaveBand.tsx",
    "WaveField.tsx",
    "buffers.ts",
    "color.ts",
    "constants.ts",
    "field.ts",
    "finish.ts",
    "variants.ts",
]


def drop_object_entry(text, key):
    """Remove `  <key>: { ... },` from the VARIANTS object literal."""
    start = text.index(f"\n  {key}: {{")
    i = text.index("{", start)
    depth = 0
    while True:
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    end = i + 1
    while end < len(text) and text[end] in ",\n":
        end += 1
        if text[end - 1] == "\n":
            break
    return text[:start] + "\n" + text[end:]


def drop_palette_block(text, name):
    """Remove the `// --- vN "name": ...` block of hex constants."""
    pattern = re.compile(
        r"// --- v\d \"" + re.escape(name) + r"\".*?\n(?:const [A-Z0-9_]+ = \"#[0-9A-Fa-f]{6}\";\n)+\n",
        re.DOTALL,
    )
    new, count = pattern.subn("", text)
    assert count == 1, f"palette block for {name} not found"
    return new


def trim_variants(text, keep):
    for name in VARIANTS:
        if name == keep:
            continue
        text = drop_object_entry(text, name)
        text = drop_palette_block(text, name)
    text = text.replace(
        'export const VARIANT_NAMES = ["blue", "violet", "mono"] as const;',
        f'export const VARIANT_NAMES = ["{keep}"] as const;',
    )
    # "v1 of three" means nothing in a project that ships one version.
    text = re.sub(
        r'// --- v\d "' + re.escape(keep) + r'": (.*?) -+\n',
        f'// --- the "{keep}" palette: \\1 ---\n',
        text,
    )
    # Tidy the blank lines the removed entries left behind.
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.replace("\n\n};\n", "\n};\n")
    return text


ROOT_TSX = '''import {{ Composition }} from "remotion";
import {{ WaveField, waveFieldSchema }} from "./wave-field/WaveField";
import {{
  DURATION_IN_FRAMES,
  FPS,
  HEIGHT,
  WIDTH,
}} from "./wave-field/constants";

export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{composition}"
      component={{WaveField}}
      durationInFrames={{DURATION_IN_FRAMES}}
      fps={{FPS}}
      width={{WIDTH}}
      height={{HEIGHT}}
      schema={{waveFieldSchema}}
      defaultProps={{{{ variant: "{variant}" as const }}}}
    />
  );
}};
'''

INDEX_TS = '''import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
'''

REMOTION_CONFIG = '''/**
 * Note: when using the Node.JS APIs the config file does not apply. Pass these
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The piece carries no audio; without this Remotion muxes a silent track.
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there. On a
// normal machine this path does not exist and Remotion falls back to its own
// managed browser, so this is a no-op.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
'''

TSCONFIG = '''{
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
'''

GITIGNORE = """node_modules
dist
out
.DS_Store
.env
"""


def package_json(spec):
    return f'''{{
  "name": "{spec["project"]}",
  "version": "1.0.0",
  "description": "4K particle wave field \\u2014 {spec["composition"]}",
  "license": "UNLICENSED",
  "private": true,
  "scripts": {{
    "dev": "remotion studio",
    "build": "remotion bundle",
    "render": "remotion render {spec["composition"]} out/{spec["output"]}.mp4 --codec=h264 --crf=12 --concurrency=8",
    "preview": "remotion render {spec["composition"]} out/{spec["output"]}-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8",
    "lint": "tsc"
  }},
  "dependencies": {{
    "@remotion/cli": "4.0.515",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "remotion": "4.0.515",
    "zod": "^4.4.3"
  }},
  "devDependencies": {{
    "@types/react": "19.2.7",
    "@types/web": "0.0.166",
    "typescript": "5.9.3"
  }}
}}
'''


def readme(name, spec):
    detail = "\n".join(spec["detail"])
    return f'''# {spec["project"]}

{spec["headline"]}

{detail}

## The composition

| | |
| --- | --- |
| Composition id | `{spec["composition"]}` |
| Resolution | 3840 x 2160 (4K UHD) |
| Duration | 450 frames |
| Frame rate | 30 fps |
| Length | 15.0 seconds |
| Loops | Yes, seamlessly |
| Audio | None |

The loop is exact, not a crossfade. Frame 450 is pixel-identical to frame 0:
every spatial harmonic is a whole number of crests along a band, every temporal
frequency is a whole number of cycles per 450 frames, every particle completes a
whole number of traversals of its band, and every pulse and flash period divides
450. Verified by rendering both frames at full 4K and comparing the files.

## Running it

```sh
npm install
```

Render at full 4K:

```sh
npx remotion render {spec["composition"]} out/{spec["output"]}.mp4 --codec=h264 --crf=12 --concurrency=8
```

Lower `--concurrency` if the machine has fewer cores than that; Remotion
rejects a value above the core count.

A faster 1080p preview of the same 4K composition:

```sh
npx remotion render {spec["composition"]} out/{spec["output"]}-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

Open the studio to scrub the timeline:

```sh
npm run dev
```

## How it is built

2D canvas only. No 3D and no Three.js.

Every visible quantity is a pure function of `useCurrentFrame()`. There is no
`Date.now()`, no `requestAnimationFrame`, no CSS animation and no component
state, so a render is deterministic and repeatable. All randomness comes from
Remotion's `random()` with stable string seeds.

- `src/wave-field/variants.ts` holds the one exported `VARIANTS` object: the
  palette, band count, particle density, mesh mode and wave parameters. Every
  hex literal in the project lives there and nowhere else.
- The layers are separate components: `BackgroundWash`, `MeshLayer`,
  `WaveBand`, `ParticleLayer` and `LeadingEdge`. Each draws into an offscreen
  buffer that `WaveField` clears first, so a repeated render redraws
  identically; `WaveField` composites the buffers onto the visible canvas in a
  layout effect once every layer has drawn.
- Depth is three offscreen buffers (far, mid, near) bucketed by band and
  blurred once each, up to 22px on the nearest band. Blurring per particle
  would be unusably slow at 4K. Large radii are applied at reduced resolution,
  which is visually equivalent once the image is that soft.
- The particle set is generated once with `useMemo` and pre-sorted by stroke
  style, so a frame is a few hundred batched canvas paths rather than thousands
  of individual strokes. Per frame only each particle's wave offset and drift
  are recomputed; regenerating the field would make it boil.

## Layout

```
src/
  index.ts               registerRoot
  Root.tsx               the composition
  wave-field/
    variants.ts          VARIANTS: the palette and every tunable parameter
    constants.ts         fixed geometry, depth and finishing constants
    field.ts             seeded generation of bands, particles, dots, mesh
    buffers.ts           offscreen buffers, depth blur and bloom compositing
    color.ts             palette hex to rgba
    finish.ts            vignette and grain
    WaveField.tsx        orchestration and compositing
    BackgroundWash.tsx   the ground
    MeshLayer.tsx        the deeper wireframe surface
    WaveBand.tsx         one band's wave surface
    ParticleLayer.tsx    the surface fill
    LeadingEdge.tsx      the bright sampling dots along each band's crest
```
'''


def build(name):
    spec = VARIANTS[name]
    dest = os.path.join(OUT, spec["project"])
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(os.path.join(dest, "src", "wave-field"))
    os.makedirs(os.path.join(dest, "public"))

    for filename in WAVE_FIELD_FILES:
        text = open(os.path.join(SRC, "src", "wave-field", filename)).read()
        if filename == "variants.ts":
            text = trim_variants(text, name)
        open(os.path.join(dest, "src", "wave-field", filename), "w").write(text)

    open(os.path.join(dest, "src", "Root.tsx"), "w").write(
        ROOT_TSX.format(composition=spec["composition"], variant=name)
    )
    open(os.path.join(dest, "src", "index.ts"), "w").write(INDEX_TS)
    open(os.path.join(dest, "remotion.config.ts"), "w").write(REMOTION_CONFIG)
    open(os.path.join(dest, "tsconfig.json"), "w").write(TSCONFIG)
    open(os.path.join(dest, "package.json"), "w").write(package_json(spec))
    open(os.path.join(dest, "README.md"), "w").write(readme(name, spec))
    open(os.path.join(dest, ".gitignore"), "w").write(GITIGNORE)
    open(os.path.join(dest, "public", ".gitkeep"), "w").write("")
    print(f"built {dest}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name in VARIANTS:
        build(name)
