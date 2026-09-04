# AI Hologram Platform

A 20-second stock motion graphic built with [Remotion](https://remotion.dev) and
three.js: a circuit-board plane in perspective, a glowing HUD platform at its
centre, a holographic card carrying the **Ai** chip icon rising above it,
orbiting icon nodes and floating UI panels.

Two versions, identical geometry, different palette:

| Composition id | Palette | Output name |
|---|---|---|
| `V1-AIHologramDarkBlue` | deep navy, blue accents | `V1_AIHologramDarkBlue` |
| `V2-AIHologramDarkCyan` | deep teal, cooler and greener | `V2_AIHologramDarkCyan` |

Both are defined at **3840×2160, 30 fps, 600 frames (20 s)**. Not a loop — the
scene builds out of black over the opening seconds and then runs steadily, so
the tail can be cut to any length.

## Getting started

```bash
npm install
npx remotion studio
```

## Rendering at 4K

```bash
npx remotion render V1-AIHologramDarkBlue out/V1_AIHologramDarkBlue.mp4 --scale=1 --crf=16
npx remotion render V2-AIHologramDarkCyan  out/V2_AIHologramDarkCyan.mp4  --scale=1 --crf=16
```

The clips are silent; add `--muted` if you would rather not ship the empty AAC
track Remotion writes by default:

```bash
npx remotion render V1-AIHologramDarkBlue out/V1_AIHologramDarkBlue.mp4 --scale=1 --crf=16 --muted
```

Stills:

```bash
npx remotion still V1-AIHologramDarkBlue out/V1_AIHologramDarkBlue.png --frame=450 --scale=1
npx remotion still V2-AIHologramDarkCyan  out/V2_AIHologramDarkCyan.png  --frame=450 --scale=1
```

A 1080p preview is the same command with `--scale=0.5`. Every size in the scene
is a world-space or `useVideoConfig()`-relative quantity, so the half-scale
preview is the same framing as the 4K master, not an approximation of it.

### Chromium GL flag

`remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")`, which is
what you want on a machine with a GPU. Add `--gl=angle` on the command line to
be explicit. On a headless box with no GPU, ANGLE falls back to SwiftShader
automatically; you can force it with `--gl=swangle`, but expect it to be several
times slower.

`remotion.config.ts` also points Remotion at a Playwright Chromium if one is
installed at the usual path, for sandboxes that block Remotion's own browser
download. On an ordinary machine that path does not exist and Remotion uses its
managed browser as normal.

### Measured render time

Measured on this project at **1920×1080** (`--scale=0.5`), 4-core x86-64 VM with
**no GPU** — Chromium falling back to SwiftShader software rasterisation:

| | |
|---|---|
| Single frame, `--concurrency=1` | **≈ 2.2 s/frame** |
| Full 600-frame pass, `--concurrency=4` | **PLACEHOLDER_WALL** wall clock (**PLACEHOLDER_PER** effective per frame) |

Plan the 4K pass from these numbers. 4K is four times the pixels and this scene
is fill-bound — large additive quads, a full-screen shader-heavy ground plane —
so on the same hardware budget roughly **4× the per-frame time**. On a machine
with a real GPU (`--gl=angle` hitting hardware) it is an order of magnitude
faster; that is the configuration to use for the 4K master.

## How it is put together

```
public/ai-chip.svg          the "Ai" chip icon asset (black on white, 1024²)
scripts/generate-ai-chip.mjs  authors that SVG and the matching pin coordinates
scripts/stills.mjs          bundle once, write several stills (look iteration)
scripts/render-previews.sh  the 1080p preview pass
scripts/package.sh          builds the distributable zip
src/config.ts               composition size, fps, duration, master seed
src/palettes.ts             the two palettes
src/lib/                    seeded RNG, procedural textures, glyph artwork
src/three/                  the scene: camera, plane, rings, card, nodes, panels
```

### Everything is a pure function of the frame

Remotion renders frames out of order across threads, so there is no `useFrame`
clock and no delta accumulation anywhere: camera position, ring rotation, orbit
phase, particle drift and every entrance are computed from `useCurrentFrame()`.
All randomness comes from a seeded `mulberry32` (`SEED` in `src/config.ts`), so
two renders of the same frame are identical.

### Textures are built once, at module scope

The circuit-board texture, the sprite atlas, the card and panel artwork and the
background gradient are all generated with Canvas2D the first time they are
asked for and cached for the life of the page. Nothing is regenerated per frame.

The circuit texture packs three channels of data rather than colour: `R` is the
ink mask, `G` a per-trace pulse-carrier phase, `B` the along-trace parameter for
carriers and a per-element random for everything else. The ground-plane shader
samples the tile twice at two scales and rotations so the repeat never reads as
a repeat, modulates it with a low-frequency noise field so the routing is dense
in places and sparse in others, and drives the build-on as a radial wavefront
with each trace's own offset staggering when it catches light.

### The Ai chip icon

`public/ai-chip.svg` is the supplied asset: black artwork on a white ground.
It is rasterised **once** to 2048² and keyed to alpha with a soft luminance ramp
(`src/lib/aiIcon.ts`), leaving pure white with an alpha channel, which the card
material then tints to the version's accent. 2048² is comfortably more than the
card ever occupies on screen at 4K, and keeps the one-off keying pass — a full
read/write of the pixel buffer — well under a tenth of a second.

The artwork is generated by `scripts/generate-ai-chip.mjs`, which also emits
`src/lib/aiChipPins.ts`: the terminal-dot centres in UV space, so the renderer
can run a signal around the chip's pins without re-parsing the SVG. Re-run that
script if you change the icon. The letters are explicit outlines rather than
text, so the file rasterises identically regardless of installed fonts.

To swap in different artwork, replace `public/ai-chip.svg` and update
`AI_CHIP_PINS` (or drop the pin lights).

### Glyphs are original artwork

Every icon-node glyph and every panel mark is drawn by hand with Canvas2D path
calls in `src/lib/glyphs.ts`. Nothing comes from an icon library: those carry
attribution and licence terms that cannot travel inside a stock clip. The panels
are deliberately illegible — no words, no numbers that imply real data, no
marks — so they read as interface texture rather than content.

### Glow, and why there is no bloom pass

Bloom here is built into the hot elements rather than applied globally. The core
is a stack of additive glow sprites of decreasing size, the innermost driven
well past 1.0 so it clips to white; the HUD rings carry their own soft radial
falloff; the trace pulses and node badges each have a glow layer. All of it is
additive against an opaque background, with `toneMapped: false` throughout.

A global bloom pass bright enough to make the core read would haze the circuit
plane and lose the routing, which is a large part of the detail — and on a
transparent-geometry scene like this it roughly triples render time. Selective
glow gets the same look, keeps the plane crisp, and costs nothing.

For the same reason the canvas is **opaque**, with the background gradient set
as the three.js scene background: additive blending only composites correctly
against a real backdrop. Grain and vignette sit on top as DOM layers.

### Palette calibration

The trace colours are the ones the brief specifies. `#0f7a72` carries about 28%
more luminance than `#1b4fd0` — green dominates the luma weighting — so the cyan
board would otherwise sit brighter than the blue one and eat into the platform's
contrast. `Palette.boardGain` trims the circuit plane's exposure to match. The
hue is untouched; only the level.

### Grain

The dark background gradient is a long, shallow ramp and will band in H.264
without help, so a 2% noise tile is laid over the frame. Judge it on the encoded
file, not on the studio preview.

## Build sequence

| Frames | Beat |
|---|---|
| 0–20 | Black. |
| 15–90 | The circuit plane lights from the centre outward, traces catching progressively. |
| 60–120 | The core ignites; the HUD rings sweep on around their circumference. |
| 100–170 | The card rises out of the platform, the chip icon drawing on radially as it arrives. |
| 140–260 | The orbit path draws around, then the icon nodes land one at a time. |
| 200–330 | The UI panels wipe in at staggered intervals. |
| 330–600 | Steady state: rings turning, nodes orbiting, panels drifting, camera still arcing. |

Every entrance is a draw-on or a rise. Nothing simply fades up.

## Camera

A slow arc of 31° around the platform across the full 20 seconds, at a fixed
elevation of 30°, always looking at the core. Speed ramps from rest over the
first 55 frames and is dead constant thereafter — the ease is only at the very
start. There is a slight vertical drift and a barely perceptible dolly in. The
camera never crosses the plane and never looks up.
