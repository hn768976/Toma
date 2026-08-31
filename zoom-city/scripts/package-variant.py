#!/usr/bin/env python3
"""
Build the three standalone, single-version projects (and their zips) out of
the multi-version project in this directory.

Each output project is the same engine with a one-entry VARIANTS object and a
single registered composition, so it renders exactly one version and nothing
else. node_modules/, out/ and .git/ are never copied in.
"""

import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VERSIONS = {
    "violet": {
        "id": "ZoomCityViolet",
        "zip": "zoom-city-violet",
        "out": "zoomcity-violet",
        "title": "Zoom City — violet",
        "blurb": "Centred vanishing point, a dense field of ~900 streaks and a wet floor: a strong mirrored reflection with a pronounced vertical smear.",
    },
    "amber": {
        "id": "ZoomCityAmber",
        "zip": "zoom-city-amber",
        "out": "zoomcity-amber",
        "title": "Zoom City — amber",
        "blurb": "Vanishing point off-centre at 34% across and higher on the horizon, ~500 wider and brighter streaks, and a dry floor: the reflection is only a soft glow beneath a brighter horizon.",
    },
    "mono": {
        "id": "ZoomCityMono",
        "zip": "zoom-city-mono",
        "out": "zoomcity-mono",
        "title": "Zoom City — mono",
        "blurb": "Monochrome, no floor and no horizon, vanishing point up near the centre of the frame: ~1600 thinner streaks spread almost evenly, reading as a data burst rather than as a road.",
    },
}

COPY = [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "remotion.config.ts",
    ".gitignore",
]


def single_variant_source(source: str, name: str) -> str:
    """Cut VARIANTS down to the one entry this project uses."""
    start = source.index("export const VARIANTS")
    body_start = source.index("{", start)

    # Find the entry by brace matching from its key.
    key = re.search(rf"^  {name}: {{", source[body_start:], re.M)
    if key is None:
        raise SystemExit(f"no variant entry named {name}")
    entry_start = body_start + key.start()
    depth = 0
    i = body_start + key.end() - 1
    while True:
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    entry_end = source.index("\n", i) + 1

    # Keep the comment banner that sits above the entry.
    banner_start = source.rfind("  /* ", body_start, entry_start)
    if banner_start != -1:
        entry_start = banner_start

    entry = source[entry_start:entry_end].rstrip()
    if entry.endswith(","):
        entry = entry[:-1]

    head = source[:start]
    head = head.replace(
        'export type VariantName = "violet" | "amber" | "mono";',
        f'export type VariantName = "{name}";',
    )
    head = head.replace(
        'export const DEFAULT_VARIANT: VariantName = "violet";',
        f'export const DEFAULT_VARIANT: VariantName = "{name}";',
    )
    return head + "export const VARIANTS: Record<VariantName, Variant> = {\n" + entry + ",\n};\n"


def single_composition_root(source: str, name: str, comp_id: str) -> str:
    """Register only this project's composition."""
    block = re.search(
        rf'      <Composition\n        id="{comp_id}".*?      />\n',
        source,
        re.S,
    )
    if block is None:
        raise SystemExit(f"no composition {comp_id}")
    head = source[: source.index("    <>") + len("    <>\n")]
    tail = source[source.index("    </>") :]
    return head + block.group(0) + tail


def readme(name: str, meta: dict) -> str:
    return f"""# {meta['title']}

A 4K, seamlessly looping "zoom-blur city" animation built in Remotion. The
frame is a radial motion blur: every element is drawn as a long tapered streak
running outward from a vanishing point, growing longer, wider and faster as it
goes, then dissolving near the frame edge and recycling to a new angle.

{meta['blurb']}

| | |
| --- | --- |
| Composition id | `{meta['id']}` |
| Resolution | 3840 × 2160 (4K UHD) |
| Duration | 300 frames |
| Frame rate | 30 fps (10.0 seconds) |
| Loops | Yes — frame 300 is pixel-identical to frame 0 |
| Audio | None |

## Run it

```bash
npm install
npm run dev          # Remotion Studio
```

## Render 4K

```bash
npx remotion render {meta['id']} out/{meta['out']}.mp4 --codec=h264 --crf=12 --concurrency=8
```

A 1080p preview, which is much faster, is the same command with `--scale=0.5`.

`--concurrency` must not exceed the number of CPU cores on the machine, so
lower it on a smaller box.

## How it is put together

Every frame is a pure function of `useCurrentFrame()` — no `Date.now()`, no
`requestAnimationFrame`, no CSS animation and no component state, so rendering
is deterministic and frames can be produced out of order across workers. All
randomness comes from Remotion's `random()` with stable string seeds.

- `src/zoom-city/variants.ts` — the one place a colour or a per-version
  parameter is defined. No hex literal exists anywhere else in the project.
- `src/zoom-city/streaks.ts` — the streak model: seeded angle, inner radius,
  length and width; the exponential radius that makes speed proportional to
  radius; and the tapered, gradient-filled quads that make a streak read as
  motion blur rather than as a line.
- `src/zoom-city/angular.ts` — the uneven angular distribution, built as a
  seeded density and inverted through its CDF, so the field has dense fans and
  sparse sectors instead of an even sunburst.
- `src/zoom-city/bursts.ts` — the burst schedule. Gaps are normalised to tile
  the loop exactly and every envelope is evaluated on `frame % 300`, so the
  schedule closes.
- `src/zoom-city/components/` — the stacked canvas layers: `BackgroundWash`,
  `StreakField`, `FloorReflection`, `BloomPass`, `BurstLayer`, `CoreFlare` and
  `FilmFinish`.

The streak field is drawn once per frame into its own canvas, and the floor
reflection and the bloom pass both read that canvas back with `drawImage`
rather than redrawing the field. That is the main optimisation here.

### Verifying the loop

Temporarily raise `durationInFrames` to `LOOP_FRAMES + 1` in `src/Root.tsx`,
render stills at frame 0 and frame 300, and compare them — they hash
identically.
"""


def build(name: str, meta: dict, dest_root: str) -> str:
    dest = os.path.join(dest_root, meta["zip"])
    shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest)

    for item in COPY:
        src = os.path.join(ROOT, item)
        dst = os.path.join(dest, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    variants_path = os.path.join(dest, "src", "zoom-city", "variants.ts")
    with open(variants_path) as fh:
        variants = fh.read()
    with open(variants_path, "w") as fh:
        fh.write(single_variant_source(variants, name))

    root_path = os.path.join(dest, "src", "Root.tsx")
    with open(root_path) as fh:
        root = fh.read()
    with open(root_path, "w") as fh:
        fh.write(single_composition_root(root, name, meta["id"]))

    pkg_path = os.path.join(dest, "package.json")
    with open(pkg_path) as fh:
        pkg = fh.read()
    pkg = pkg.replace('"name": "zoom-city"', f'"name": "{meta["zip"]}"')
    pkg = pkg.replace(
        '"description": "Zoom-blur city — 4K radial motion-blur animation in Remotion"',
        f'"description": "{meta["title"]} — 4K radial motion-blur animation in Remotion"',
    )
    with open(pkg_path, "w") as fh:
        fh.write(pkg)

    with open(os.path.join(dest, "README.md"), "w") as fh:
        fh.write(readme(name, meta))

    return dest


def main() -> None:
    dest_root = os.path.join(ROOT, "zips")
    os.makedirs(dest_root, exist_ok=True)
    for name, meta in VERSIONS.items():
        dest = build(name, meta, dest_root)
        archive = os.path.join(dest_root, meta["zip"] + ".zip")
        if os.path.exists(archive):
            os.remove(archive)
        subprocess.run(
            ["zip", "-r", "-q", archive, meta["zip"],
             "-x", "*/node_modules/*", "*/out/*", "*/.git/*"],
            cwd=dest_root,
            check=True,
        )
        print(f"built {archive} from {dest}")


if __name__ == "__main__":
    sys.exit(main())
