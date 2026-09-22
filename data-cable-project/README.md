# Binary Data Cables

Glowing blue conduits carrying streams of binary digits through black, built as
a Remotion + three.js template. **Two rigs, eight compositions.** Every
composition is a 600-frame (20s) seamless loop at 30fps, defined at 3840×2160.

| # | Composition id | Output | Look |
|---|---|---|---|
| 1A | `DataRibbon-Bokeh` | `DataRibbon_Bokeh.mp4` | S-curved ribbons over a bokeh field |
| 1B | `DataRibbon-Minimal` | `DataRibbon_Minimal.mp4` | Three diagonals, mostly black |
| 1C | `DataRibbon-Crossing` | `DataRibbon_Crossing.mp4` | Arcs crossing in an X |
| 1D | `DataRibbon-CrossingGreen` | `DataRibbon_CrossingGreen.mp4` | 1C in green |
| 2A | `CableBundle-Diagonal` | `CableBundle_Diagonal.mp4` | Packed diagonal cables, reflective ground |
| 2B | `CableBundle-Rack` | `CableBundle_Rack.mp4` | Wide rack receding to a vanishing point |
| 2C | `CableBundle-Macro` | `CableBundle_Macro.mp4` | Close macro, collars prominent |
| 2D | `CableBundle-RackAmber` | `CableBundle_RackAmber.mp4` | 2B in amber-orange |

---

## Quick start

```bash
npm install
npx remotion studio
```

## Render commands

**4K, per composition** (replace the id and name from the table above):

```bash
npx remotion render CableBundle-Rack out/CableBundle_Rack.mp4 --scale=1 --crf=16
```

**1080p preview** (what ships in `out/previews/`):

```bash
npx remotion render CableBundle-Rack out/CableBundle_Rack.mp4 \
  --scale=0.5 --crf=16 --concurrency=4 --muted
```

**Stills.** 6000×3375 is `--scale=1.5625` on a 3840×2160 composition:

```bash
npx remotion still CableBundle-Rack out/CableBundle_Rack_f275.png \
  --frame=275 --scale=1.5625
```

`./render-all.sh` does all eight previews, one 1080p still each, and the
three-per-composition stills harvest.

### Chromium

Software WebGL2 through ANGLE. `remotion.config.ts` sets:

```ts
Config.setChromiumOpenGlRenderer("angle");
```

`swiftshader` also works without a GPU but is slower. If the render machine
cannot reach Remotion's Chromium download host, point it at a local Chromium:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-linux/headless_shell
```

---

## Measured on the build machine

Ubuntu 24.04 container, 4 vCPU, **no GPU** — Chromium falls back to software
WebGL (SwiftShader through ANGLE). Numbers from a real render, not an estimate.

| Metric | Value |
|---|---|
| **Max anisotropy reported by the renderer** | **16** |
| WebGL | 2.0 (OpenGL ES 3.0 Chromium) |
| Max texture size | 8192 |
| Digit texture | 8192×2048, 96×16 character grid, 118px glyphs |
| **Per-frame at 1080p — ribbons (look 1)** | **~2.6 s** (concurrency 4) |
| **Per-frame at 1080p — cables (look 2)** | **~3.3 s** (concurrency 4) |
| Per composition at 1080p | ~26 min (look 1) / ~30-38 min (look 2) |
| **4K estimate** | **~10.5 s/frame (look 1), ~13.2 s/frame (look 2)** |
| 4K per composition | ~1.8 h (look 1) / ~2.2 h (look 2) |

Measured over the full 600-frame renders, not extrapolated from a sample.
Look 2 is only modestly dearer than look 1 once the ribbons carry five wide
bands and, on 1A, a 150-disc bokeh layer; the 8192x2048 digit texture costs
about the same in both. The 4K figures scale by pixel count and assume the
same software rasteriser -- a real GPU changes them by more than an order of
magnitude.

Anisotropy 16 is the useful maximum. This is the single most important value
in the project: these surfaces are seen at extreme glancing angles, and had it
come back as **1**, anisotropic filtering would have been unavailable and the
digits on every receding cable would smear to grey no matter how large the
texture is. It did not — the receding end of the 2B rack stays legible.

On a machine with a real GPU expect both figures to drop by more than an order
of magnitude; these are software-rasteriser numbers.

### A note on render resolution

Remotion's `--scale` sets Chrome's device scale factor but does **not** resize
the WebGL drawing buffer, so by default a 1080p preview still renders the scene
at the full 3840×2160 — four times the fill rate, thrown away. `DataCable.tsx`
ties the canvas `dpr` to `window.devicePixelRatio`, which makes the buffer match
the output at any scale. That change alone took this project from 11.8 s/frame
to 3.5 s/frame.

---

## The binary field

The whole subject is the digits, and the failure mode is that they turn to mush.

- Built **once, at module level** (`digitField.ts` → `digitTexture.ts`) as an
  8192×2048 canvas: a 96×16 grid of `0`/`1` in JetBrains Mono at 118px.
- `ROWS` is the important one: it is how many rows of digits wrap around a
  cylinder's circumference, so it sets glyph size. `COLS` is the tiling period
  along a strand, kept high (and the texture correspondingly wide) so the field
  does not visibly repeat along a cable.
- Glyph choice and per-character brightness come from a `mulberry32` seeded at
  module scope and drawn once — never per frame. Brightness is deliberately
  uneven (10% near-dark, 72% mid, 18% hot) with ~1.4% solid bright squares,
  which is what stops the field reading as a printed pattern.
- Runs of a repeated digit are capped at 9 so no accidental string forms. A
  `0`/`1` field carries no language, trademark or market lock-in.
- `RepeatWrapping` on both axes; `anisotropy` set to the renderer's maximum.

**Scrolling** is `uvOffset = N · (frame / durationInFrames)` with **N an
integer** number of texture repeats, wrapped into `[0,1)`. The texture tiles, so
an integer scroll returns exactly to the start — that is the loop. N varies per
strand (1, 2 or 3) so cables flow at visibly different speeds.

`repeatV` is an **integer on every cylinder**: the tube is closed, and a
fractional repeat seams visibly round the back. Ribbons are open strips, so
they take fractional values freely.

**Collar spacing** is chosen as an exact integer divisor of the cable's UV
repeat, and the glow mask runs at one period per collar gap. Anything else and
the collars drift against the digits and the loop stops closing.

## Font

**JetBrains Mono**, Regular — `public/fonts/JetBrainsMono-Regular.woff2`.
Licensed under the **SIL Open Font License 1.1**; the full licence ships at
`public/fonts/JetBrainsMono-OFL.txt`. The font is loaded from the project, not
from the system, so it is present on any render machine.

---

## Overlay usability

**Pure `#000000` away from the strands — safe as screen-blend overlays:**

- `DataRibbon-Minimal` (1B)
- `DataRibbon-Crossing` (1C)
- `DataRibbon-CrossingGreen` (1D)
- `CableBundle-Rack` (2B)

**Not pure black — do not claim overlay usability:**

- `DataRibbon-Bokeh` (1A) — carries a bokeh layer
- `CableBundle-Diagonal` (2A), `CableBundle-Macro` (2C) — carry a ground
  reflection

---

## Adding a camera angle — one data row

Once the rig is built, a new angle is a new saleable clip for the cost of a
data row. The three consecutive iStock ids behind look 2 are the same rig
framed three ways, and that is the cheapest content multiplier there is.

In `src/looks.ts`, append to `LOOKS`:

```ts
{
  id: "CableBundle-LowAngle",
  outName: "CableBundle_LowAngle",
  palette: BLUE,
  strands: buildRack(RACK_BASE),        // same rig, untouched
  camera: { position: [-4, 0.5, 9], lookAt: [7, 0.2, -2], fov: 30 },
  dof: { worldFocusDistance: 10, worldFocusRange: 2, bokehScale: 8 },
  bloom: { threshold: 0.92, smoothing: 0.12, intensity: 0.55, radius: 0.7 },
  shading: CABLE_SHADING,
  bokeh: null,
  ground: null,
  pureBlack: true,
  stillFrames: [50, 260, 480],
},
```

To find an angle without re-rendering the whole thing, override the camera from
the CLI and render a single small still:

```bash
REMOTION_CAM="-4,0.5,9,7,0.2,-2,30" \
  npx remotion still CableBundle-Rack out/try.png --frame=150 --scale=0.3
```

Worth doing before touching any new geometry: a low angle looking along the
cables, an overhead, and a tight two-cable crop are all one row each.

## Adding a colourway — one data row

Effectively every data-cable clip on the market is blue, so a second hue lands
in a different search. Add a palette and reuse the geometry:

```ts
export const VIOLET: Palette = {
  base: "#5a1fb8", glow: "#e8d6ff", rim: "#b06bff", accent: "#8a3fff",
};
```

then copy an existing row and change only `id`, `outName` and `palette` — as
`DataRibbon-CrossingGreen` does to `DataRibbon-Crossing`, and
`CableBundle-RackAmber` to `CableBundle-Rack`.

One caveat learned the hard way: **green and amber need a tinted glow colour.**
A near-white glow that reads as vivid blue desaturates to pale sage under ACES,
because green carries far more luminance for the same magnitude. Tint the
digits toward the hue rather than leaving them near-white.

---

## Determinism

Remotion renders frames out of order across several threads, so every value on
screen is a pure function of `useCurrentFrame()`.

- No `useFrame` clock, no `Date.now()`, no delta accumulation, no `useState`
  driving visuals, no per-frame ref mutation.
- No `Math.random()` at render time — `mulberry32` seeded at module level, every
  value (glyphs, brightness, curve control points, scroll rates, bokeh paths)
  drawn once at build time.
- The digit canvas is generated once per JS context, never per frame.
- Grain is a hash of `(pixel, frame % durationInFrames)` — periodic over the
  loop, identical on every thread.

Verified: frame 300 rendered alone from a cold start is byte-identical to frame
300 from a full sequential render.

## Calibrating against the references

Glyph size, band width, black coverage and highlight clipping were not set by
eye. Each was measured on the reference frames — connected-component blob
analysis for glyph height, lit-run scans for strand width, and channel
histograms for clipping and colour — and then measured the same way on the
renders until they matched. Three things that only showed up that way:

- Glyphs were **3-4× too small**. The measured target is roughly 1-2% of frame
  height on the sharp strand, and 32 rows around a cylinder put them at a third
  of that. `ROWS` dropped to 16 and the cables thickened.
- Lit pixels averaged **(80, 113, 192)** against the references' **(7, 97, 218)**
  — far too much red. A near-white glow reads as washed periwinkle, not as the
  electric cyan-blue of the references, so the glow colour is tinted toward cyan
  and bloom is left to carry the cores to white.
- Row counts differ per composition and are data, not a constant: the reference
  clips genuinely differ (1B ≈ 2.3% glyph height, 1C ≈ 1.4%, 1A ≈ 1.2%).

## Known differences from the references

Two gaps survived the verify loop and are stated here rather than left to be
discovered.

**Highlight clipping.** The references blow out 22-37% of their pixels to 250+;
these clip around 1%. Most of that reference clipping comes from *defocused*
strands washing to white, and buying it costs one of two things the brief
treats as non-negotiable. Three attempts are on record: raising exposure far
enough to reach 2.3% dropped 1B's pure black to 29%, under the 50% required of
a screen-blend overlay, and going further flattens the digit-to-gap contrast
that makes the glyphs readable at all. The balance shipped keeps the black
level and the legibility. To trade the other way, raise `digitIntensity` in
`looks.ts` and re-render -- it is one number.

**2B's upper frame.** In the reference the top third is filled with unlit grey
cylinders continuing into the dark; here it is empty black. That is deliberate:
2B is one of the four compositions sold as a pure-black overlay, and filling
the frame would cost it that. The rack still recedes to a vanishing point and
the far cables still go unlit; they simply end against black rather than
against more hardware.

## Post chain

`DepthOfField → Bloom → ACES ToneMapping → GrainDither`, all spatial shaders.
No TAA, no temporal motion blur, no accumulation across frames.

**The composer is driven directly** (`src/Post.tsx`) rather than through
`<EffectComposer>` from `@react-three/postprocessing`. These are the same effect
classes that wrapper mounts — the difference is only scheduling.
`<ThreeCanvas>` runs with `frameloop="never"` and mounts its own frame renderer
*before* its children, so its single `advance()` fires before the React
wrapper has assembled its pass chain and the canvas comes back pure black.
Owning the composer sidesteps that.

Bloom sits at a high threshold (0.92) on purpose. Exposure is tuned against it
so typical digits land below and only the hot ones cross: if the whole cable
blooms, the digits vanish and you get a blue tube, which is the commonest
failure on this subject after the filtering one.

## Banding

Blue glow against black is where banding shows. Dither of ±1/255 and 2% film
grain are applied **after** bloom and tone mapping, in display space, as a
deterministic hash of pixel and frame. Grain also helps the digits survive
H.264 — a perfectly clean dark field makes the encoder spend its bits elsewhere
and smear fine text.

**To verify on the encoded file:**

```bash
ffmpeg -i out/previews/CableBundle_Rack.mp4 -vframes 1 -y /tmp/f.png
python3 verify.py band /tmp/f.png     # samples a scanline out of a bright cable
```

Stepped plateaus in the falloff mean banding.

---

## Completion checklist

- [x] Digits legible at 4K on the in-focus strand; receding ends stay sharp
- [x] Anisotropy set to the renderer's maximum (16, recorded above)
- [x] 600-frame loop closes: frame 600 pixel-identical to frame 0
- [x] Determinism: isolated frame 300 byte-identical to sequential
- [x] 1920×1080, 30/1, 20.0s, h264, yuv420p, **no audio stream**
- [x] 1B / 1C / 1D / 2B are pure `#000000` away from the strands
- [x] Dither + grain applied after bloom; banding checked on the encoded mp4
- [x] Camera fixed in every composition; all motion is in the data flow
- [x] Strands run past the frame edges
- [x] Font shipped with its OFL licence

## Project layout

```
src/
  digitField.ts     glyphs + brightness, drawn once at module level
  digitTexture.ts   rasterises the field to a canvas, once per JS context
  cableMaterial.ts  emissive digits, fresnel rim, scrolling glow mask
  geometry.ts       curve generators + the ribbon cross-section sweep
  rig.ts            geometry/material construction, collar placement
  looks.ts          THE DATA -- palettes, rigs and the eight compositions
  Scene.tsx         strands, collars, bokeh, reflection, camera
  Post.tsx          the effect chain
public/fonts/       JetBrains Mono + OFL licence
```

Everything that varies between compositions lives in `looks.ts`. Curve shape,
cross-section, collar spacing, palette, camera angle and blur strength are all
data.
