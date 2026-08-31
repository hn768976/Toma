#!/usr/bin/env python3
"""Builds one self-contained Remotion project per candle-close variant.

Each output directory carries only the files that variant needs: the shared
candle-close sources, a variants.ts trimmed down to that single key, a Root
that registers only that composition, and its own package/tsconfig/config and
README. node_modules, out/ and .git are never copied.
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "candle-close")

VARIANTS = [
    {
        "key": "neonBlue",
        "composition": "CandleCloseBlue",
        "slug": "candle-close-blue",
        "title": "Candle Close — neonBlue",
        "blurb": "Deep navy ground, cyan and hot-pink candles, a volatile "
                 "range-bound series with long wicks.",
    },
    {
        "key": "amberDark",
        "composition": "CandleCloseAmber",
        "slug": "candle-close-amber",
        "title": "Candle Close — amberDark",
        "blurb": "Near-black brown ground, amber and burnt-sienna candles, a "
                 "steady climb with short shallow pullbacks.",
    },
    {
        "key": "monoLight",
        "composition": "CandleCloseLight",
        "slug": "candle-close-light",
        "title": "Candle Close — monoLight",
        "blurb": "Light mode: near-white ground, deep green and red candles, "
                 "a sharp decline with a capitulation two thirds through.",
    },
]

SHARED_FILES = [
    "CandleClose.tsx",
    "color.ts",
    "constants.ts",
    "labels.ts",
    "random.ts",
    "series.ts",
]


def trim_variants(source: str, key: str) -> str:
    """Keeps the VARIANTS entry for `key` and drops the others."""
    source = re.sub(
        r'export const VARIANT_NAMES = \[[^\]]*\] as const;',
        'export const VARIANT_NAMES = ["%s"] as const;' % key,
        source,
    )
    lines = source.split("\n")
    header_end = next(
        i for i, line in enumerate(lines)
        if line.startswith("export const VARIANTS")
    )
    body = lines[header_end + 1:]

    blocks = {}
    i = 0
    while i < len(body):
        match = re.match(r"^  (\w+): \{$", body[i])
        if not match:
            i += 1
            continue
        start = i
        # Pull in the comment block that introduces the entry.
        while start > 0 and body[start - 1].strip().startswith("//"):
            start -= 1
        depth = 0
        end = i
        for j in range(i, len(body)):
            depth += body[j].count("{") - body[j].count("}")
            if depth == 0:
                end = j
                break
        blocks[match.group(1)] = "\n".join(body[start:end + 1])
        i = end + 1

    if key not in blocks:
        raise SystemExit("variant %s not found in variants.ts" % key)
    return "\n".join(lines[:header_end + 1]) + "\n" + blocks[key] + "\n};\n"


def read(path: str) -> str:
    with open(path) as handle:
        return handle.read()


def write(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(content)


def build(variant: dict, out_root: str) -> str:
    target = os.path.join(out_root, variant["slug"])
    if os.path.exists(target):
        shutil.rmtree(target)
    os.makedirs(os.path.join(target, "src", "candle-close"))
    os.makedirs(os.path.join(target, "public"))

    for name in SHARED_FILES:
        shutil.copy(os.path.join(SRC, name),
                    os.path.join(target, "src", "candle-close", name))
    write(os.path.join(target, "src", "candle-close", "variants.ts"),
          trim_variants(read(os.path.join(SRC, "variants.ts")), variant["key"]))

    write(os.path.join(target, "src", "index.ts"), '''import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
''')

    write(os.path.join(target, "src", "Root.tsx"), '''import {{ Composition }} from "remotion";
import {{ CandleClose, candleCloseSchema }} from "./candle-close/CandleClose";
import {{
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES,
  FPS,
}} from "./candle-close/constants";

export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{composition}"
      component={{CandleClose}}
      durationInFrames={{DURATION_IN_FRAMES}}
      fps={{FPS}}
      width={{BASE_WIDTH}}
      height={{BASE_HEIGHT}}
      schema={{candleCloseSchema}}
      defaultProps={{{{ variant: "{key}" as const }}}}
    />
  );
}};
'''.format(composition=variant["composition"], key=variant["key"]))

    package = {
        "name": variant["slug"],
        "version": "1.0.0",
        "description": variant["title"],
        "license": "UNLICENSED",
        "private": True,
        "dependencies": {
            "@remotion/cli": "4.0.515",
            "react": "19.2.3",
            "react-dom": "19.2.3",
            "remotion": "4.0.515",
            "zod": "^4.4.3",
        },
        "devDependencies": {
            "@types/react": "19.2.7",
            "@types/web": "0.0.166",
            "typescript": "5.9.3",
        },
        "scripts": {
            "dev": "remotion studio",
            "build": "remotion bundle",
            "render": "remotion render %s out/%s.mp4 --codec=h264 --crf=12 --concurrency=8"
                      % (variant["composition"], variant["slug"]),
            "typecheck": "tsc",
        },
    }
    write(os.path.join(target, "package.json"), json.dumps(package, indent=2) + "\n")

    write(os.path.join(target, "tsconfig.json"), json.dumps({
        "compilerOptions": {
            "target": "ES2018",
            "module": "Preserve",
            "moduleResolution": "Bundler",
            "jsx": "react-jsx",
            "strict": True,
            "noEmit": True,
            "lib": ["es2015"],
            "esModuleInterop": True,
            "skipLibCheck": True,
            "forceConsistentCasingInFileNames": True,
            "noUnusedLocals": True,
        },
        "exclude": ["remotion.config.ts"],
    }, indent=2) + "\n")

    write(os.path.join(target, "remotion.config.ts"), '''/**
 * Note: When using the Node.JS APIs, the config file doesn't apply.
 * Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there
// instead of downloading; on a normal machine this path won't exist and
// Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
''')

    write(os.path.join(target, ".gitignore"), "node_modules/\nout/\n.DS_Store\n")
    write(os.path.join(target, "public", ".gitkeep"), "")
    write(os.path.join(target, "README.md"), README.format(**variant))
    return target


README = '''# {title}

{blurb}

A tight, frontal candlestick close-up: about 30 large candles scrolling right
to left over a textured backdrop of faint grid lines and dim price quotes
drifting behind them. No order-book ladder, no volume bars, no camera tilt —
candles and background only.

## The composition

| | |
| --- | --- |
| Composition id | `{composition}` |
| Resolution | 4K — 3840 x 2160 |
| Duration | 390 frames |
| Frame rate | 30 fps |
| Length | 13.0 seconds |
| Loops | Yes — frame 390 is pixel-identical to frame 0, so it tiles seamlessly |

The loop is exact rather than approximate. The price series is periodic over
30 candles and the scroll advances by exactly one period (one frame width)
across the 390 frames, so the chart, the grid, the drifting quotes and the
ambient camera drift all return to their starting state together.

## Render at 4K

```
npm install
npx remotion render {composition} out/{slug}.mp4 --codec=h264 --crf=12 --concurrency=8
```

`npm run render` is the same command. For a faster 1080p preview, add
`--scale=0.5`.

## Preview in the studio

```
npm install
npm run dev
```

## Layout of the source

| File | What it holds |
| --- | --- |
| `src/candle-close/variants.ts` | The palette, series character, label config and treatment flags for this variant. Every colour and every number that gives the variant its look lives here. |
| `src/candle-close/series.ts` | The parameterised OHLC generator: trend bias, run length, volatility, wick frequency, pullback depth and shocks. |
| `src/candle-close/labels.ts` | The drifting numeric quotes behind the candles. |
| `src/candle-close/constants.ts` | Timing and geometry, all authored at 4K. |
| `src/candle-close/CandleClose.tsx` | The component: backdrop, labels, glow or shadow, candles, depth of field, vignette. |

Nothing is random at render time — every value comes from a seeded PRNG keyed
on the candle or label index, so frames rendered out of order across workers
always agree.
'''


if __name__ == "__main__":
    out_root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist-standalone")
    os.makedirs(out_root, exist_ok=True)
    for variant in VARIANTS:
        print("built", build(variant, out_root))
