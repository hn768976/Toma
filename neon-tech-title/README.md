# Neon Tech Title — Remotion + three.js

Two seamless-loop 3D title cards, rebuilt from scratch to match a pair of
reference clips:

| Version | Word         | Neon      |
|---------|--------------|-----------|
| v1      | `INNOVATION` | ice blue  |
| v2      | `TECHNOLOGY` | coral red |

A dark slate-blue circuit board of tiled plates and scattered blocks, a
multi-layered processor at the centre (concentric silver rings, a glowing
violet-blue core, a chevron band, orbiting milky arcs), thin red and blue
light traces, drifting sparks, and a neon word that types itself in, holds,
erases and restarts.

> The reference material was a pair of **Getty Images watermarked preview
> files**. Nothing from them is reused — all geometry, materials, lighting and
> motion here are original, and the output carries no watermark. The clips were
> used only to measure format, timing, camera and palette.

---

## Specs, measured from the references

Both reference files were parsed at the container level (`moov`/`mvhd`/`stts`)
rather than eyeballed:

| Property   | Value                                              |
|------------|----------------------------------------------------|
| Frames     | 283                                                |
| Frame rate | 30 fps exactly (stts delta 512 @ timescale 15360)  |
| Duration   | 9.4333 s                                           |
| Aspect     | 16:9 (source was 768×432)                          |
| Codec      | H.264 (`avc1`), no audio track                     |
| Camera     | locked off — a text-free corner diffed flat across the clip |

**The loop.** Brightness integration over the text band shows the type-on /
hold / erase cycle repeating **exactly three times** across the 283 frames, so
one cycle is `283 / 3 = 94.333` frames. That is what makes the clip loop, and
it is reproduced here: every rotation, pulse and spark completes a whole
number of periods over the composition, so frame 282 meets frame 0 cleanly.

**Typing.** Frame-stepping the type-on (reference frames 98–113) shows whole
letters appearing discretely — never a partial-glyph wipe — at ~2.45 frames per
character. The caret only ever appears on an empty line (present at reference
frame 190, absent at 141 where the word ends flush at the `N`).

**Font.** Poppins SemiBold (OFL, bundled in `public/fonts/`) — geometric,
near-circular `O`, barred `G`, matching the reference letterforms.

---

## Compositions

| id                   | Resolution | Purpose           |
|----------------------|------------|-------------------|
| `InnovationBlue1080` | 1920×1080  | delivery          |
| `TechnologyRed1080`  | 1920×1080  | delivery          |
| `InnovationBlue4K`   | 3840×2160  | 4K master         |
| `TechnologyRed4K`    | 3840×2160  | 4K master         |

All four are 283 frames @ 30 fps. The 4K comps are a straight 2× of the 1080p
ones — same scene, same camera — with effect radii scaled by `resolutionScale`
so the bloom and depth-of-field match visually rather than doubling in pixels.

---

## Rendering

```bash
npm install

# 1080p delivery
npm run render:1080:innovation
npm run render:1080:technology

# 4K masters
npm run render:4k:innovation
npm run render:4k:technology
```

Output is H.264 / MP4, yuv420p, CRF 16.

Interactive preview:

```bash
npm run studio
```

### Browser

`remotion.config.ts` reads `REMOTION_BROWSER_EXECUTABLE` so you can point
Remotion at a Chrome you already have:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome
```

Leave it unset and Remotion downloads its own Chrome Headless Shell.

### GPU

`Config.setChromiumOpenGlRenderer('swangle')` is set because the machine these
were rendered on has no GPU — that is SwiftShader through ANGLE. **On a GPU
host, change it to `'angle'`** for a large speed-up, especially at 4K.

---

## Graphics backend: WebGPU → WebGL2 → WebGL

`src/three/backend.ts` probes the stack in priority order and the scene mounts
whichever canvas matches:

- **WebGPU** via `ThreeWebGPUCanvas` from `@remotion/three/webgpu`
- **WebGL2** / **WebGL** via `ThreeCanvas`

WebGPU is only claimed when `requestAdapter()` actually hands back an adapter,
not merely when `navigator.gpu` exists. That distinction matters: the headless
Chromium used here *does* expose `navigator.gpu` and *does* return an adapter,
but pipeline creation then fails with `GPUPipelineError: A valid external
Instance reference no longer exists`. The delivered renders therefore pin
`backend: "webgl2"` explicitly so the output is deterministic rather than
dependent on what the host's WebGPU happens to do.

Set the `backend` prop to `"auto" | "webgpu" | "webgl2" | "webgl"` to override.
All scene materials stay within the subset both backends render identically.

---

## Layout

```
src/
  config.ts              frame rate, duration, cycle count
  Root.tsx               the four compositions
  Scene.tsx              backend + font gate, canvas selection
  lib/
    palette.ts           colours sampled from the references
    timing.ts            type-on / hold / erase, loop-safe angle helpers
    rng.ts               seeded PRNG — layout is identical every render
    useNeonFont.ts       loads Poppins before the canvas mounts
  three/
    backend.ts           WebGPU -> WebGL2 -> WebGL probe
    Stage.tsx            camera rig, lighting, fog, bloom + DOF
    Board.tsx            plate tiling + scattered blocks
    Processor.tsx        the hub
    Traces.tsx           red/blue light lines
    Sparks.tsx           drifting points
    NeonText.tsx         the typed neon word
public/fonts/            Poppins-SemiBold.ttf (OFL)
```

### Determinism

Everything is a pure function of `useCurrentFrame()`:

- Board layout, block sizes and spark seeds come from a fixed-seed PRNG, so the
  scene is identical across machines and between the 1080p and 4K comps.
- No `requestAnimationFrame`, no wall-clock time, no per-frame async work.
- The font resolves **outside** the three.js canvas, before it mounts. React
  state that settles inside the canvas subtree does not trigger a redraw on its
  own — the canvas only draws when Remotion advances the frame — so a late font
  would leave an already-drawn canvas with no text on it.

### The neon word

Drawn into a 4096×512 canvas and mapped onto an upright plane yawed onto the
board's `+X` grid axis — the axis that projects down-and-right under this
camera. That is what keeps the letters vertical while the baseline follows the
board. The type-on is a substring redraw, so whole letters appear, and the glow
is built from two `shadowBlur` passes under a crisp fill. The plane and its UVs
are cropped to the measured width of the word so the mesh is not a mostly-empty
slab.
