import os, sys

VARIANTS = {
  "gold": dict(
    variant="gold", comp="MeditationGold", out="meditation-gold", zip="meditation-gold.zip",
    title="Meditation Energy Burst — Gold",
    blurb=(
      "Warm, radiating outward. A dense corona of roughly 320 fine filaments springs from a point "
      "directly behind the seated figure's head, densest above the crown and thinning toward the "
      "horizon. The foreground is a grass horizon: low overlapping hills beyond the line and a dense "
      "band of fine, irregularly spaced blades along it."
    ),
  ),
  "cool": dict(
    variant="cool", comp="MeditationCool", out="meditation-cool", zip="meditation-cool.zip",
    title="Meditation Energy Burst — Cool",
    blurb=(
      "Blue-white, sparser, higher horizon. Roughly 170 filaments — fewer, longer and slightly "
      "thicker than the gold variant — concentrate into a narrow fan above the figure, so the burst "
      "reads as a shaft rather than a halo. The foreground is water: a clean horizon line with a "
      "mirrored, heavily blurred, gently rippling reflection of the figure and the core glow beneath it."
    ),
  ),
  "inward": dict(
    variant="inward", comp="MeditationInward", out="meditation-inward", zip="meditation-inward.zip",
    title="Meditation Energy Burst — Inward",
    blurb=(
      "Violet, and reversed. The burst direction is -1: roughly 420 filaments originate at the frame's "
      "edges and travel INWARD, converging on the point behind the figure's head. The taper inverts "
      "with them (thin at the edge, thickest at the origin), brightness pulses travel inward, and the "
      "sparks drift inward, accelerating as they close on the centre. Rather than a steady breath the "
      "core glow BUILDS across the loop — dim at frame 0, peaking around frame 480, easing back by 600 "
      "so the loop still closes. The foreground returns to grass, as in the gold variant."
    ),
  ),
}

TEMPLATE = """# {title}

A 4K Remotion piece: a seated figure in pure silhouette against a radiant field of
fine filaments. Three variants ship in this project; this archive is built around
**`{comp}`**.

{blurb}

## Composition

| | |
|---|---|
| **Composition id** | `{comp}` |
| **Resolution** | **4K — 3840 x 2160** |
| **Duration** | 600 frames |
| **Frame rate** | 30 fps |
| **Length** | 20.0 s |
| **Loops** | Yes — seamlessly. Frame 0 and frame 600 are pixel-identical. |
| **Audio** | None |

The other two variants are registered in the same project and render the same way:
`MeditationGold`, `MeditationCool`, `MeditationInward`.

A fourth composition, `LoopCheck`, exists only to verify the loop. It is the same
component with `durationInFrames` set to 601, so frame 600 can be rendered and
compared against frame 0:

```bash
npx remotion still LoopCheck /tmp/f0.png   --frame=0   --props='{{"variant":"{variant}"}}'
npx remotion still LoopCheck /tmp/f600.png --frame=600 --props='{{"variant":"{variant}"}}'
md5sum /tmp/f0.png /tmp/f600.png   # identical
```

Rendering frame 0 twice also reproduces the same bytes, which is the determinism
check.

### Why it loops

Every periodic quantity in the piece has a period that divides 600 exactly:

* filament undulation uses sines at **integer** cycles-per-loop;
* brightness pulses use periods drawn from `50, 60, 75, 100, 120, 150, 200`;
* spark flicker uses `30, 40, 50, 60, 75, 100, 120` and spark drift `150, 200, 300, 600`,
  with an alpha envelope that reaches zero at both ends of each drift cycle;
* the figure's breath is a 150-frame sine;
* the ambient camera drift is a closed Lissajous path;
* grain is seeded on `frame % 600`.

Nothing reads `Date.now()`, `requestAnimationFrame`, CSS animation or component state:
every frame is a pure function of `useCurrentFrame()`, so renders are deterministic
however Remotion distributes frames across worker processes.

## Render

Install once, then render.

```bash
npm install
npx remotion render {comp} out/{out}.mp4 --codec=h264 --crf=12 --concurrency=8
```

That produces the full 4K master. A faster 1080p preview:

```bash
npx remotion render {comp} out/{out}-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency=8` needs a machine with at least 8 CPU cores; Remotion refuses a
concurrency higher than the core count, so lower it to match on smaller machines.

Open the studio with `npm run dev`.

## Project layout

```
src/
  index.ts                  registerRoot entry
  Root.tsx                  the three <Composition> registrations
  meditation/
    variants.ts             THE variant table: palette, burst direction,
                            filament density, foreground mode. No hex
                            literal lives anywhere else in the project.
    layout.ts               frame geometry, loop length, breath and
                            core-glow envelopes
    filaments.ts            filament generation (once) and per-frame evaluation
    Meditation.tsx          the composition; stacks the layers
    CoreGlow.tsx            the radial glow behind the head
    RadiantBurst.tsx        the filament field, three composited passes
    SparkField.tsx          flickering, drifting points
    Figure.tsx              the silhouette: flatten, hair bun, breath
    HorizonLine.tsx         foreground: "grass" and "water" modes
    Finish.tsx              vignette and grain
    layers.ts               layer blend/stacking style
  lib/                      general-purpose helpers, vendored so this
                            archive is standalone
public/
  lotus.svg                 the figure
```

## The figure asset

`public/lotus.svg` is a seated lotus-position silhouette, front view, supplied as a
vector outline traced from the raster reference that came with the brief. It is drawn
once to an offscreen canvas and blitted thereafter.

The file deliberately keeps the mid-grey patches its source had in the legs and hands.
The renderer flattens them: the raster is filled through `globalCompositeOperation =
"source-in"`, which keeps the alpha channel (so edges stay anti-aliased) and replaces
every colour inside the shape with the single silhouette colour. A small ellipse is then
added at the crown for the hair bun. The figure carries no interior detail, no rim light
and no edge glow — it is a hole in the light.

**Licence:** the outline is derived from the reference image supplied with the brief and
carries whatever licence that image does; its provenance was not independently verified.
Confirm the source's terms before using this asset commercially. Nothing else in the
project bundles third-party artwork.
"""

def write(variant, path):
    v = VARIANTS[variant]
    with open(path, "w") as f:
        f.write(TEMPLATE.format(**v))

if __name__ == "__main__":
    write(sys.argv[1], sys.argv[2])
