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

__TIMINGS__

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

__VERIFY__
