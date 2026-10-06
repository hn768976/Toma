# AI Agents Board · Market Move · Map Dashboard · AI Network Panel · Security HUD

Five tech motion-graphic looks in **one Remotion project**: **6 compositions**, each
**20 s at 30 fps (600 frames)**, defined at **3840 × 2160 (16:9)**.

| # | Composition id | Output file | Look | 2D / 3D | Engine | GPU | Type |
|---|----------------|-------------|------|---------|--------|-----|------|
| 1 | `AIAgentsBoard-Blue` | `AIAgentsBoard_Blue.mp4` | AI Agents Board | 2D | HTML/SVG + Canvas 2D | none | build-in, then live hold |
| 2A | `MarketMove-CrashRed` | `MarketMove_CrashRed.mp4` | Market Move (crash) | 3D | three.js | WebGL2 | 20 s loop |
| 2B | `MarketMove-RallyGreen` | `MarketMove_RallyGreen.mp4` | Market Move (rally) | 3D | three.js | WebGL2 | 20 s loop |
| 3 | `MapDashboard-Blue` | `MapDashboard_Blue.mp4` | Map Dashboard | 3D (tilted plane) | three.js + Canvas 2D texture | WebGL2 | build-in, then live hold |
| 4 | `AINetworkPanel-BlueWhite` | `AINetworkPanel_BlueWhite.mp4` | AI Network Panel | 3D (tilted panel) | three.js + Canvas 2D textures | WebGL2 | build-in, then live hold |
| 5 | `SecurityHUD-Blue` | `SecurityHUD_Blue.mp4` | Security HUD | 2.5D | three.js + Canvas 2D textures | WebGL2 | 20 s loop |

Remotion composition ids may not contain `_`, so ids use `-` and output files use `_`.

## Setup

```bash
npm install
npx remotion studio      # opens the Studio; every composition is listed
```

Tested with Node 22. All versions in `package.json` are pinned (Remotion 4.0.515,
three 0.180.0, @react-three/fiber 9.3.0, React 19.2.3).

## Chromium / GL

The three.js looks (2–5) need **WebGL2**. In headless Chromium use **ANGLE**:

- `remotion.config.ts` already sets `Config.setChromiumOpenGlRenderer("angle")`;
- on the command line the equivalent flag is **`--gl=angle`**.

WebGPU is not used. On a machine without a GPU, ANGLE falls back to SwiftShader
(software); output is identical, only slower. Look 1 is plain HTML/SVG + Canvas 2D
and needs no GPU.

`remotion.config.ts` also sets PNG frames (no JPEG intermediates), H.264,
`yuv420p`, CRF 16.

## Render at 4K

```bash
npx remotion render AIAgentsBoard-Blue       out/AIAgentsBoard_Blue.mp4       --gl=angle
npx remotion render MarketMove-CrashRed      out/MarketMove_CrashRed.mp4      --gl=angle
npx remotion render MarketMove-RallyGreen    out/MarketMove_RallyGreen.mp4    --gl=angle
npx remotion render MapDashboard-Blue        out/MapDashboard_Blue.mp4        --gl=angle
npx remotion render AINetworkPanel-BlueWhite out/AINetworkPanel_BlueWhite.mp4 --gl=angle
npx remotion render SecurityHUD-Blue         out/SecurityHUD_Blue.mp4         --gl=angle
```

(Codec h264, CRF 16, yuv420p and PNG frames come from `remotion.config.ts`; add
`--crf=16 --pixel-format=yuv420p --image-format=png` if you render through the Node API.)

### 720p previews (as delivered)

```bash
npx remotion render MarketMove-CrashRed out/MarketMove_CrashRed.mp4 --gl=angle --scale=0.3333333333333333
```

`3840 × 0.3333…` is exactly 1280 × 720 (verified with ffprobe). The GL canvas
nudges its pixel ratio so three.js's `floor()` lands on exactly 1280 × 720.

## Stills (6000 × 3375)

```bash
npx remotion still MarketMove-CrashRed out/MarketMove_CrashRed_6K.png --frame=300 --scale=1.5625 --gl=angle
```

`3840 × 1.5625 = 6000`, `2160 × 1.5625 = 3375`. Use any composition id and frame.
All canvases and render targets size themselves from the device pixel ratio, so
stills are rendered natively at 6K, not upscaled. (6K stills were not rendered in
this delivery.)

## Engine per look

- **AI Agents Board** — HTML/SVG for the UI (chip, ring, tiles, icons, text: sharpest
  text and lines) over a Canvas 2D layer (dithered background, dotted Natural Earth
  map that assembles as glitchy blocks, binary rain, flare). Grain/dither: fixed
  noise tiles indexed by frame, added with `plus-lighter`.
- **Market Move** — three.js: ~400 instanced number quads at 12 depths. Depth of
  field is **baked per label**: an atlas holds every string at six blur levels and
  each label picks (and crossfades) its level from its circle of confusion. Extruded
  bevelled ribbon arrow rebuilt each frame from the draw-on progress. Dotted globe
  from Natural Earth land. Bloom.
- **Map Dashboard** — three.js: an 8192 × 4608 Canvas 2D texture (mipmaps, 16×
  anisotropy) on a plane tilted ~55° to the view. Bars, histograms, donuts and ticking
  digits are instanced quads whose values are computed in the shader from the frame;
  network lines/nodes/pulses are rebuilt each frame. Section-by-section glitch reveal
  in the shader. Screen-space depth of field + bloom.
- **AI Network Panel** — three.js: tilted panel (~50°), diagram from Canvas 2D textures
  (centre, 10 icon nodes, dotted arcs, brackets), spokes rebuilt per frame, instanced
  dark blocks with edge shading, dot-matrix grids redrawn from the frame, orange tags.
  Screen-space depth of field + bloom.
- **Security HUD** — three.js: padlock with a digital fill texture, five ring textures
  rotating whole turns, six icon tiles, five tileable circuit layers at different
  depths with baked blur, drifting a whole number of tiles per loop. Bloom.

Shared GL post chain (`src/lib/gl/post.ts`): MSAA ×4 half-float scene target →
optional depth-of-field (CoC from the depth buffer, 64-tap golden-angle gather at half
resolution, tent filter, CoC-weighted composite) → bloom (13-tap down / tent up, 7
levels) → final pass with soft shoulder, vignette, **grain ≈1.5 %** and **TPDF dither
±1/255**, both from an integer hash of pixel position and frame. No temporal effects.

## Determinism

Everything on screen is a pure function of `useCurrentFrame()`:

- no `Math.random()` — seeded `mulberry32` at module level and a stateless integer
  hash (`src/lib/random.ts`); GLSL uses a PCG integer hash;
- no CSS animations/transitions, no `Date.now()`, no `useState` driving visuals, no
  values carried between frames;
- R3F's `useFrame` is only used as the render hook of `@remotion/three`; its clock and
  delta are never read — the callback reads the Remotion frame;
- canvases are redrawn from the frame (or are static and identical on every frame);
- fonts and map data are behind `delayRender` / `continueRender`;
- loops use `frame % 600`, whole turns and whole cycles only.

Self-check performed: frame 300 rendered alone from a cold start is byte-identical to
frame 300 of the full render (see checklist).

## Measured render time (720p, this machine)

MEASURED_TIMES

## Banding check

BANDING_RESULTS

## Completion checklist

CHECKLIST

## Add a colourway

1. Open `src/versions.ts` and add a row, e.g. a gold rally:

   ```ts
   { look: "market", id: "MarketMove_RallyGold", direction: "up", tint: "#F0B020", dark: "#1A1202", seed: 31 },
   ```

   Each look has its own row type (`BoardRow`, `MarketRow`, `MapRow`, `NetworkRow`,
   `SecurityRow`) listing every colour it uses.
2. The composition appears in the Studio automatically as `MarketMove-RallyGold`.
3. Render it with the commands above. Loop looks stay seamless for any colours.

## Assets and licences

- `public/fonts/` — **Inter** and **JetBrains Mono** (woff2, latin subset), SIL Open
  Font License 1.1: `OFL-Inter.txt`, `OFL-JetBrainsMono.txt`.
- `public/data/land-50m.json`, `land-110m.json` — **Natural Earth** land (public domain),
  as TopoJSON from the `world-atlas` package (ISC): `LICENSE-NaturalEarth.txt`,
  `LICENSE-world-atlas.txt`.
- Icons are self-drawn path data (`src/lib/icons.ts`). No logos, brands, real tickers
  or real data; all numbers and labels are invented.

## Layout

```
src/
  Root.tsx              compositions (one per data row)
  versions.ts           one data row per version
  lib/                  random, anim, fonts, Natural Earth mask, icons, noise tiles
  lib/gl/               Stage (ThreeCanvas wrapper), post chain, texture helpers
  looks/board|market|map|network|security/
```
