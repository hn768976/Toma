# Chart · Circuit · Shards — Remotion + `@remotion/three`

Five 3D looks, 8 compositions, one Remotion project. Everything is built in
code (three.js through `@remotion/three`, WebGL2); there is no text, logo or
chip branding anywhere.

| Composition id (Remotion) | Output file | Look | Frames @30fps | Loop |
|---|---|---|---|---|
| `GrowthChart3D-Up` | `GrowthChart3D_Up.mp4` | 3D Growth Chart, rising, green arrow `#5CE84A` | 360 (12 s) | no |
| `GrowthChart3D-Down` | `GrowthChart3D_Down.mp4` | 3D Growth Chart, falling, red arrow `#E8403A` | 360 (12 s) | no |
| `CircuitFlythrough-Blue` | `CircuitFlythrough_Blue.mp4` | Circuit Flythrough | 600 (20 s) | yes |
| `NeonShards-Blue` | `NeonShards_Blue.mp4` | Neon Shards, blue | 600 (20 s) | yes |
| `NeonShards-Magenta` | `NeonShards_Magenta.mp4` | Neon Shards, magenta | 600 (20 s) | yes |
| `CPUBoard-BlueSilver` | `CPUBoard_BlueSilver.mp4` | CPU Board | 600 (20 s) | yes |
| `LaserPanels-CyanPurple` | `LaserPanels_CyanPurple.mp4` | Laser Panels, cyan lasers / purple trim | 600 (20 s) | yes |
| `LaserPanels-OrangeRed` | `LaserPanels_OrangeRed.mp4` | Laser Panels, orange lasers / red trim | 600 (20 s) | yes |

Remotion composition ids cannot contain `_`, so ids use `-`; the output file
names use `_` as requested.

All compositions are defined at **3840×2160, 30 fps**.

## Setup

```bash
npm install          # exact versions are pinned in package.json / package-lock.json
npx remotion studio  # preview in the browser
```

Node 18+ (tested with Node 22). Studio previews are capped at half
resolution (`dpr ≤ 0.5`) so they stay interactive; renders always use the
full requested resolution.

### Chromium GL flag

WebGL needs ANGLE in headless Chromium. `remotion.config.ts` sets it for every
CLI command (`Config.setChromiumOpenGlRenderer('angle')`); when you call
the CLI from elsewhere, or use the Node APIs, pass it explicitly:

```
--gl=angle
```

## Render commands

### 4K (3840×2160), one per composition

```bash
npx remotion render src/index.ts GrowthChart3D-Up        out/GrowthChart3D_Up.mp4        --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts GrowthChart3D-Down      out/GrowthChart3D_Down.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts CircuitFlythrough-Blue  out/CircuitFlythrough_Blue.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts NeonShards-Blue         out/NeonShards_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts NeonShards-Magenta      out/NeonShards_Magenta.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts CPUBoard-BlueSilver     out/CPUBoard_BlueSilver.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts LaserPanels-CyanPurple  out/LaserPanels_CyanPurple.mp4  --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
npx remotion render src/index.ts LaserPanels-OrangeRed   out/LaserPanels_OrangeRed.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=png
```

(`codec`, `crf`, `pixel-format` and `image-format` are also the defaults in
`remotion.config.ts`; they are spelled out so the commands work on their own.
`--image-format=png` matters: JPEG intermediate frames add banding.)
For ProRes masters add `--codec=prores --prores-profile=4444` instead.

### Stills at 6000×3375

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375:

```bash
npx remotion still src/index.ts GrowthChart3D-Up out/GrowthChart3D_Up_6K.png --frame=300 --scale=1.5625 --gl=angle --image-format=png
```

Swap the composition id and `--frame` for any other look (e.g.
`NeonShards-Magenta --frame=300`).

### 720p previews (what was delivered)

```bash
scripts/render-previews.sh build 4          # all 8; or append file ids to render a subset
```

It bundles once, renders each composition as a lossless PNG sequence with
`--scale=0.3333333333333333` (exactly 1280×720 — the WebGL backing store is
created at that size, the scene is not rendered at 4K and downscaled), then
encodes with ffmpeg: H.264, `yuv420p`, BT.709 tags, 30 fps, CRF 16, no audio.
The PNG frames are kept in `out/frames/<id>/` so the determinism check can
compare frame 150 of the full render with a cold single-frame render.
One-step equivalent per composition:

```bash
npx remotion render src/index.ts NeonShards-Blue out/NeonShards_Blue.mp4 --scale=0.3333333333333333 --gl=angle
```

## Render time

RENDER_TIME_TABLE

## How it is built

`src/lib/` holds the shared pieces; each look is one file under `src/looks/`.

* **`ThreeStage.tsx`** — wraps `<ThreeCanvas>`. Assets (HDRI, Natural Earth
  GeoJSON) load behind `delayRender`/`continueRender`, and the handle is
  released only after the canvas has taken its own handle. The look is built
  once per tab; every frame calls `look.update(frame, …)` and then the post
  pipeline. `useFrame` is used **only as the render hook** (priority 1 =
  we own rendering): its clock and delta are never read — the Remotion frame
  is the only clock.
* **`post.ts`** — deterministic post chain written directly on three.js:
  HDR half-float scene target (MSAA ×4 + float depth texture) → CoC +
  half-res downsample → near-CoC tile max → 64-tap golden-angle DOF gather
  (separate near/far layers, mip-filtered so large bokeh stays smooth) →
  6-level bloom (Karis prefilter, 13-tap down, tent up) → composite →
  **ACES (Hill fit)** → sRGB → **grain** (PCG hash of pixel position and
  frame, ~2 %) → **TPDF dither ±1/255**, scaled to zero on pure black. All
  radii are fractions of image height, so 720p, 4K and 6K look the same.
  No TAA, no temporal AO, no accumulation; nothing is carried between frames.
* **`pcb.ts`** — seeded PCB router: bundles of parallel tracks with mitred
  45° bends, splits and peel-offs, grown until they would collide on an
  occupancy grid (toroidal for tiling boards), ending in ring pads or vias.
* **`sprites.ts`** — instanced soft light sprites with a minimum on-screen
  size whose energy is conserved, and the trace/pad material.
* **`rng.ts`** — `mulberry32`; every random value comes from a fixed seed
  at module/setup time. `Math.random()` is never used.
* **`tone.ts`** — JS mirror of the tone curve, used to choose linear scene
  values that land on given display colours (sky, floor, arrow).

### Looks

1. **3D Growth Chart** — rounded silver bars (`MeshPhysicalMaterial`, HDRI
   reflections, dark-mauve → bright-silver progression, vertical gradient)
   rise out of / sink into a floor shader that draws the Natural Earth map
   (rasterised once on a canvas, softened), a faint grid network with dots,
   analytic contact shadows from the bars' current heights and horizon haze.
   Bevelled extruded arrow revealed by arc length with the head leading; a
   small coloured light behind the head tints the bars. Camera orbits 40°
   from the left while rising; glint sweeps over the bars from frame 210.
2. **Circuit Flythrough** — 12×12 toroidal tile routed once (central spine
   bundle, periodic trunks, bundles grown to collision, square pad clusters)
   and drawn as tile copies; the camera moves exactly 2 tiles in 600 frames.
3. **Neon Shards** — 80 wireframe triangles / kites / open polylines per
   36-unit depth block, drawn as screen-space ribbons whose width grows with
   defocus while their energy is conserved (soft near lines, thin far ones),
   additive, with soft glows behind hot corners. Camera drifts exactly one
   block; every shard turns 1 or 2 whole turns.
4. **CPU Board** — layered chip (blue substrate steps, dark die, silver top,
   blue corner indicators) on a routed board that fans out from the chip in
   all directions, SMD parts, and ~30k data points streaming along traces.
   Camera: closed ±25° sway orbit with a gentle push in and back.
5. **Laser Panels** — seeded subdivision of a 10×10 tile into framed /
   nested / stacked blocks, glowing trim strips, two families of lasers
   whose streaks slide by whole periods, laser light injected into the panel
   shader, moving hot-spot light, colour grade derived from the laser colour.

### Loops (looks 2–5)

The camera's position inside one tile/block is `(N·L·t) mod L` with
`t = frame/600`; lights, data points, shard rotations and laser streaks move
by whole cycles; the grain/dither hash uses `frame mod 600`. Frame 600 is
therefore pixel-identical to frame 0 (checked, see below), and frames 599
and 1 are its symmetric neighbours.

## Adding a version (one data row)

Versions live in `src/versions.ts`; `src/Root.tsx` registers a composition
for every row. Example — a green Neon Shards:

```ts
export const SHARDS_VERSIONS: ShardsVersion[] = [
  { id: 'NeonShards_Blue', lineA: '#3F8CFF', lineB: '#9FD8FF', glow: '#4F7BFF' },
  { id: 'NeonShards_Magenta', lineA: '#FF4FD8', lineB: '#FFB0F0', glow: '#8A3BFF' },
  { id: 'NeonShards_Green', lineA: '#3FFF8C', lineB: '#B0FFD0', glow: '#3BFFA0' }, // new
];
```

The composition `NeonShards-Green` then appears in the Studio. Growth Chart
rows take `direction: 'up' | 'down'` and the arrow colour; Laser Panels rows
take the laser and trim colours; Circuit and CPU rows take their palettes.

## Verification

`scripts/verify.py` (needs Python 3, numpy, Pillow, scipy, ffmpeg):

| Step | Command |
|---|---|
| 1 ffprobe | `python3 scripts/verify.py probe` |
| 2 loop (frame 0 vs 600 of a 601-frame variant) | `node scripts/stills.mjs <comp> out/loop 0,600 --loopCheck` per looping comp, then `python3 scripts/verify.py loop out/loop` |
| 3 black | `python3 scripts/verify.py black` |
| 4 determinism (cold frame 150 vs full render) | `node scripts/stills.mjs <comp> out/cold 150` per comp, then `python3 scripts/verify.py determinism out/cold` |
| 5 banding | `python3 scripts/verify.py banding` |
| 6 content sheets | `python3 scripts/verify.py sheets` |

`--loopCheck` is an input prop that makes `calculateMetadata` add one frame,
so frame 600 exists; nothing else changes.

### Banding check

VERIFY_RESULTS

## Assets and licences

* **HDRI** — `public/hdri/studio_small_03_1k.hdr`, "Studio Small 03" by
  Sergej Majboroda, from Poly Haven, **CC0** (public domain). Downloaded from
  the pmndrs `drei-assets` mirror of the Poly Haven file because polyhaven.com
  was not reachable from the build machine. See `public/hdri/LICENSE.txt`.
* **Map** — `public/data/ne_110m_land.geojson`, Natural Earth 1:110m land,
  **public domain**. Terms in `public/data/NATURAL_EARTH_LICENSE.md`.

## Completion checklist

CHECKLIST
