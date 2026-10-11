# Grid Pucks · Wind Dashboard · Flowchart · Network Hub · Folder Row

One Remotion project with five looks and eight compositions. Everything is built in code with three.js on WebGL2 through `@remotion/three`. There are no image or model assets; the only bundled file is the Inter font.

| Composition ID | Output name | Length | Type |
|---|---|---|---|
| `GridPucks-Slate` | `GridPucks_Slate.mp4` | 600 frames (20 s) | seamless loop |
| `GridPucks-White` | `GridPucks_White.mp4` | 600 frames (20 s) | seamless loop |
| `WindTurbineDashboard-Story` | `WindTurbineDashboard_Story.mp4` | 450 frames (15 s) | story |
| `FlowchartBuild-BlueWhite` | `FlowchartBuild_BlueWhite.mp4` | 450 frames (15 s) | story |
| `FlowchartBuild-CyanNavy` | `FlowchartBuild_CyanNavy.mp4` | 450 frames (15 s) | story |
| `NetworkHub-DrawOn` | `NetworkHub_DrawOn.mp4` | 450 frames (15 s) | story |
| `NetworkHub-PulseLoop` | `NetworkHub_PulseLoop.mp4` | 600 frames (20 s) | seamless loop |
| `FolderRow-Blue` | `FolderRow_Blue.mp4` | 600 frames (20 s) | seamless loop |

All compositions are defined at **3840×2160, 30 fps**. `Dev-TurbineModelCheck` is a development still of the code-built turbine.

## Setup

```bash
npm install
npx remotion studio        # preview
```

The studio renders at the full 4K canvas size, so scrubbing is slow on machines without a GPU.

## Chromium GL flag

All looks need WebGL2. `remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`. For CLI renders you can also pass it explicitly:

```
--gl=angle
```

ANGLE uses the GPU when there is one and falls back to SwiftShader (software) when there isn't. Don't use `swangle`/`swiftshader` on a GPU machine; it is much slower.

## 4K render commands

```bash
npx remotion render GridPucks-Slate            out/GridPucks_Slate.mp4            --gl=angle
npx remotion render GridPucks-White            out/GridPucks_White.mp4            --gl=angle
npx remotion render WindTurbineDashboard-Story out/WindTurbineDashboard_Story.mp4 --gl=angle
npx remotion render FlowchartBuild-BlueWhite   out/FlowchartBuild_BlueWhite.mp4   --gl=angle
npx remotion render FlowchartBuild-CyanNavy    out/FlowchartBuild_CyanNavy.mp4    --gl=angle
npx remotion render NetworkHub-DrawOn          out/NetworkHub_DrawOn.mp4          --gl=angle
npx remotion render NetworkHub-PulseLoop       out/NetworkHub_PulseLoop.mp4       --gl=angle
npx remotion render FolderRow-Blue             out/FolderRow_Blue.mp4             --gl=angle
```

The config already sets H.264, `yuv420p`, CRF 16 and PNG intermediates (so grain and dither reach the encoder untouched). For a mezzanine master, add `--codec=prores --prores-profile=4444`.

720p previews (exactly 1280×720):

```bash
npx remotion render GridPucks-Slate out/GridPucks_Slate.mp4 --scale=0.3333333333333333
```

## Stills (6000×3375)

The scale is 6000 / 3840 = 1.5625:

```bash
npx remotion still GridPucks-Slate out/GridPucks_Slate_6K.png --frame=300 --scale=1.5625 --gl=angle
```

For stories, take the still from the hold (dashboard frame 380, flowchart 440, network-hub draw-on 400).

## Render times

Measured in a CPU-only container: 4 vCPU, no GPU, so WebGL2 runs on ANGLE → SwiftShader. The figures include PNG intermediates and H.264 encoding. **On any machine with a GPU, expect these to be several times faster.**

### 720p previews (`--scale=1/3`, 4 tabs in parallel)

| Composition | Frames | Total | Wall time per frame | ≈ per frame per tab |
|---|---|---|---|---|
| GridPucks-Slate | 600 | 326 s | 0.54 s | ~2.2 s |
| GridPucks-White | 600 | 325 s | 0.54 s | ~2.2 s |
| WindTurbineDashboard-Story | 450 | 210 s | 0.47 s | ~1.9 s |
| FlowchartBuild-BlueWhite | 450 | 120 s | 0.27 s | ~1.1 s |
| FlowchartBuild-CyanNavy | 450 | 155 s | 0.35 s | ~1.4 s |
| NetworkHub-DrawOn | 450 | 517 s | 1.15 s | ~4.6 s |
| NetworkHub-PulseLoop | 600 | 721 s | 1.20 s | ~4.8 s |
| FolderRow-Blue | 600 | 448 s | 0.75 s | ~3.0 s |

### Two real 4K frames (3840×2160, frame 300, one tab)

Per-frame time is the 4-frame run minus the 1-frame run, divided by 3, so browser startup is excluded.

| Composition | 1 frame (incl. startup) | 4 frames | **per 4K frame** |
|---|---|---|---|
| GridPucks-Slate (instanced pucks + shadows + DoF) | 18.5 s | 34.5 s | **≈ 5.3 s** |
| FolderRow-Blue (folders + reflection + streams + DoF + bloom) | 18.3 s | 37.8 s | **≈ 6.5 s** |

### 4K estimates (same CPU-only box, 4 tabs)

A 4K frame cost about 2.2–2.5× a 720p frame in a single tab. The fixed per-frame costs (PNG encoding, CPU-side instancing, the Canvas UI) don't scale with pixel count. Applying ×2.4 to the 720p wall times:

| Composition | Estimated 4K render |
|---|---|
| GridPucks-Slate / White | ≈ 13 min each |
| WindTurbineDashboard-Story | ≈ 8–9 min |
| FlowchartBuild-BlueWhite / CyanNavy | ≈ 5 / 6 min |
| NetworkHub-DrawOn / PulseLoop | ≈ 21 / 29 min (glow ribbons and bloom scale with pixels, so this may run longer) |
| FolderRow-Blue | ≈ 18 min |

All eight together: about 2 h on this box. On a desktop GPU with `--gl=angle`, expect well under 30 min.

## How it works

- **`src/lib/LookCanvas.tsx`**: each look is plain three.js behind a `Look` interface, `render(gl, frame)`. It is mounted in `<ThreeCanvas>`. A priority-1 `useFrame` hook draws the frame from `useCurrentFrame()`; R3F's clock is never read. The canvas pixel ratio follows Remotion's `--scale`, so previews render at preview size rather than 4K-then-downscale.
- **`src/lib/post.ts`**: a shared single-frame post pipeline (no TAA, no history):
  - MSAA half-float scene target with depth;
  - gather depth of field (half-res prefilter → 56-tap golden-angle gather with a near/far occlusion rule → fill → composite);
  - mip-chain bloom;
  - final pass: flare/streak, vignette, sRGB encode, grain from a pixel × `frame % period` integer hash, then a ±1/255 triangular dither.
- **`src/lib/random.ts`**: `mulberry32`, always seeded at module level, plus a stateless integer hash for step-schedule flicker.

### Looks

- **Grid Pucks** (`looks/gridPucks.ts`)
  - A procedural anti-aliased grid shader, so thin lines never crawl.
  - An `InstancedMesh` of lathe-built bevelled pucks, with a per-instance contact-shadow decal.
  - Each puck has a seeded **closed lattice walk**: equal ± steps on each axis, slides of 14 frames with ease-in-out, pauses of 10–40 frames, summing to exactly 600 frames.
  - Walks are placed greedily against a time × intersection occupancy table on the 40×40 torus, so pucks never share or swap an intersection. Some movers travel as rigid pairs, as in the reference.
  - Instances are frustum-culled on the CPU each frame.
- **Wind Turbine Dashboard** (`looks/dashboard.ts`, `looks/turbine.ts`)
  - The UI is a Canvas-2D texture redrawn from scratch every frame, at the output resolution.
  - The turbine is built in code: a lathe tower, a rounded-box nacelle, a lathe spinner, and three blades lofted from 8 airfoil sections with taper and twist.
  - It is rendered into the panel rectangles with scissored viewports. The close-up uses a see-through shell with a simple drivetrain and glowing sensor markers.
- **Flowchart Build** (`looks/flowchart.ts`)
  - A seeded lane graph: a spine that splits into 2–4 symmetric lanes and rejoins, plus outer columns with diagonal runs.
  - Shapes are `ExtrudeGeometry` and pop in when a wavefront 2 units ahead of the camera passes them.
  - Connectors are one mesh drawn on in the shader after the parent appears; a child appears when its connector arrives.
  - The camera path is tabulated per frame: an eased start, steady travel, and a near-hold over the last 2 s while the wavefront finishes building the held view.
- **Network Hub** (`looks/networkHub.ts`)
  - Orthographic camera. Every element is a glow ribbon built as one quad per segment; the shader measures true distance to the segment (round caps), so corners never fold.
  - MAX blending stops overlaps from creating hot spots.
  - Draw-on, pulses (whole trips per 600 frames), device flashes and teeth rotation are computed in the shaders from the frame uniform.
  - One wing is generated, then mirrored.
- **Folder Row** (`looks/folderRow.ts`)
  - Folders are `ExtrudeGeometry` with a groove normal map, in an `InstancedMesh` whose 24-slot variation table repeats every row period (14.4 units).
  - The camera travels exactly one period per loop.
  - The floor shader hashes on `x mod period`.
  - About 8,000 stream points tile the period ×2. They drift by whole periods and twinkle with integer rates.
  - The reflection is a mirrored instanced draw faded by depth.

## Determinism

Every value is a function of `useCurrentFrame()`. There is no `Math.random()`, no `Date.now()`, no `useState` driving visuals and no carried state. All seeded data (walks, graph, tree, folder variation, chart data) is built at module level with `mulberry32`. Loops compute from `frame % 600`, so frame 600 equals frame 0 exactly. Inter is loaded with `delayRender` before the dashboard mounts.

## Changing the dashboard

Every label and value lives in the `DASHBOARD` object at the top of `src/looks/dashboard.ts`:

- `title` and `menus` (the four dropdowns);
- `series`: name, colour, and start/end level of each seeded rising walk;
- `status`, `info`, `infoRight`: turbine card text (placeholders stay `XXX`);
- `gauge`: label, target (≈815), max, unit, jitter (±) in the live hold;
- `stats` and `temperatures` (labels and values), `tempMax` (bar scale).

Chart data is reseeded in `SERIES_DATA` and `BAR_DATA`; change the seed constant to get a different walk.

## Adding a colourway

- **Grid Pucks:** add a `GridPucksPalette` next to `SLATE`/`WHITE` in `looks/gridPucks.ts`, then register it in `src/Root.tsx`:
  ```tsx
  const pucksMint = createGridPucks(MINT);
  const GridPucksMint = () => <LookCanvas create={pucksMint} />;
  <Composition id="GridPucks-Mint" component={GridPucksMint} durationInFrames={600} ... />
  ```
- **Flowchart:** add a `FlowPalette` next to `BLUE_WHITE`/`CYAN_NAVY` (background, shape and side colours, connector colour, shadow, glow share, bloom flag) and register it the same way.
- **Network Hub and Folder Row:** the colours are uniforms near the bottom of each file (`cGlow`, `cCore`, `cWire`, `cBead`; `cBase`, `cLine`, `cDot`, background stops, flare colour).

## Font

Inter (SIL Open Font License 1.1). The WOFF2 files and the licence text are in `public/fonts/` (`OFL.txt`).

## Verification

Run on the 720p previews in this container.

- **File checks (ffprobe):** all 8 are 1280×720, 30/1, h264, yuv420p, with no audio stream. Durations are exactly 15.0 s (450 frames) for the stories and 20.0 s (600 frames) for the loops.
- **Loop check:** the loops were rendered with `--props='{"loopCheck":true}'` (601 frames), and frame 0 was compared with frame 600. GridPucks-Slate, GridPucks-White, NetworkHub-PulseLoop and FolderRow-Blue are **pixel-identical**.
- **Determinism:** for each composition, frame 300 rendered alone from a cold start was compared with frame 300 from a 4-tab sequence render (frames 280–320). All 8 are **byte-identical**.
- **Banding (frames taken from the encoded mp4):**
  - Profiles across the slate and white puck surfaces near the vignette change smoothly. The largest 5-px-smoothed step is ≤ 1.8 levels (slate) and ≤ 1.0 level (white).
  - The Folder Row sky and flare, the 3B navy (≤ 0.4 level per step along the top edge) and the hub haze were also inspected under a strong level stretch. They show grain-textured, contour-free gradients.
  - The hub's black is clean: the corner maxes out at 1/255, because grain is faded out below 3% luminance and only the ±1/255 dither remains.
- **Contact sheets** (five evenly spaced frames per composition) show:
  - discs moving along grid lines;
  - the chart drawing, the gauge counting up to ≈815 kW and then flickering ±20, and the temperature bars rising;
  - shapes popping in with connectors drawing on as the camera travels;
  - the ring drawing on, then branches and devices, then a pulsing hold;
  - folders gliding past over the reflective floor, with data streams and the left flare.

  No logos, brands, maker names or real data appear.
- **Motion:** consecutive frames around frame 300 and through the busy story sections step cleanly:
  - puck slides ease in and out and stop cleanly;
  - the procedural grid and connector lines are anti-aliased by coverage, so they don't crawl;
  - blades turn at 2.1° per frame (no strobing);
  - pulses move at constant speed along arc length.

### Completion checklist

- [x] 8 compositions at 3840×2160, 30 fps (450 frames for the stories, 600 for the loops)
- [x] WebGL2 via `@remotion/three` and ANGLE, with no WebGPU and no PixiJS
- [x] Single-frame post (DoF, bloom) with no TAA, dither ±1/255, and grain from pixel × `frame % period`
- [x] No `Math.random()`, `Date.now()` or carried state; everything is seeded at module level
- [x] Inter (OFL) bundled with its licence; generic labels and `XXX` placeholders only
- [x] Turbine model built in code and checked by fresh sub-agents (three rounds)
- [x] 720p previews, PNG stills, loop and determinism checks, banding check
- [x] `npm install && npx remotion studio` verified from a clean copy
