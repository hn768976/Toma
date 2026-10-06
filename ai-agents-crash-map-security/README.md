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
- **Map Dashboard** — three.js: an 8192 × 5120 Canvas 2D texture (mipmaps, 16×
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
frame 300 of the full render for all six compositions (see checklist).

Loop looks are seamless by construction (`frame % 600`, whole turns/cycles) and
verified: the 599→0 seam differs from its neighbours no more than any other
arrow-cycle boundary.

## Measured render time (720p, this machine)

Measured on the build machine: 4 vCPU, no GPU (ANGLE falls back to SwiftShader,
i.e. WebGL2 in software), `--concurrency=4`, `--scale=0.3333333333333333` (1280×720),
PNG frames. "Wall" is the full 600-frame render; per-frame = wall ÷ 600.

| Composition | 600 frames, wall | per frame (wall) | ≈ per frame, one worker | 4K estimate (this machine) |
|---|---|---|---|---|
| AIAgentsBoard-Blue | 251 s | 0.42 s | ~1.7 s | ~1.5 s/frame (~15 min) |
| MarketMove-CrashRed | 367 s | 0.61 s | ~2.4 s | ~5.5 s/frame (~55 min) |
| MarketMove-RallyGreen | 384 s | 0.64 s | ~2.6 s | ~5.5 s/frame (~55 min) |
| MapDashboard-Blue | 268 s | 0.45 s | ~1.8 s | ~4 s/frame (~40 min) |
| AINetworkPanel-BlueWhite | 301 s | 0.50 s | ~2.0 s | ~4.5 s/frame (~45 min) |
| SecurityHUD-Blue | 332 s | 0.55 s | ~2.2 s | ~5 s/frame (~50 min) |

How the 4K estimate was made: a 60-frame batch at 1280×720 vs 1920×1080 (2.25×
the pixels) cost 1.85× (Market) and 2.2× (Map) more per frame, i.e. the GL looks
scale roughly linearly with pixel count on software GL. 3840×2160 is 9× the pixels
of 720p, so ≈ 8–9× the 720p per-frame time. The Board (HTML/SVG + Canvas 2D) rose
only 1.2× for 2.25× pixels, so ≈ 3–4×. On a machine with a real GPU behind ANGLE
the GL looks will be much faster than these software-GL numbers.

## Banding check

Checked on the **encoded mp4** (frame 450 of each, decoded back to PNG with ffmpeg),
not on the preview:

- **Dark-gradient profiles**: median of 32×8 px blocks down dark columns. The values
  change in steps of 0–2 code values per 8 px with no plateaus or jumps (e.g. Board
  left edge, blue channel, top→bottom: 54 52 50 46 46 … 22 21 20 16 13 12 9).
- **Code-value occupancy**: in every look, every 8-bit level inside the dark range
  that is in use (>1000 px) is present in all three channels — **no empty levels**
  (Board B 8–119, Market-Red R 25–119, Market-Green G 23–119, Map B 29–119, Network
  B 1–79, Security B 40–119).
- **Glow falloff**: hub glow of the Network panel inspected at 3× with gamma 1.6 — no
  contour rings.
- Note: the histogram of a decoded frame shows a regular comb every ~6–7 levels.
  That is the limited-range yuv420p → full-range RGB expansion (219 → 255 levels) in
  the decoder, not banding; spatially the gradients stay smooth.

How it is prevented: TPDF dither ±1/255 + grain (≈1.5 %) from an integer hash of
pixel position and frame in the final GL pass; float-computed, dithered backgrounds
and fixed noise tiles indexed by frame in the HTML/Canvas look; half-float render
targets throughout the GL chain; PNG intermediates; CRF 16.

## Completion checklist

| Check | Result |
|---|---|
| 1. ffprobe: 1280×720, 30/1, 20.0 s, h264, yuv420p, no audio | ✅ all 6 |
| 2. Loop: 601-frame render, frame 0 vs frame 600 pixel-identical (`--props='{"loopCheck":true}'`) | ✅ MarketMove ×2, SecurityHUD |
| 3. Determinism: cold single-frame render == frame from full render, byte for byte | ✅ frame 300 all 6; frame 90 for Board, Map, Network |
| 4. Banding on the encoded mp4 | ✅ all 6 (see above) |
| 5. Contact sheets (5 frames each): required content present; text "AI Agents", "AI Generate", "AI" correct; filler invented; no brands/tickers/real data | ✅ all 6 |
| 6. Motion 299/300/301: no jumps, flicker or crawl (also loop seam 599→0) | ✅ all 6 |
| 7. Self comparison against references | ✅ done for each look |
| 8. Independent sub-agent comparison, 3 rounds per look | ✅ done; residual differences listed in the delivery notes |

Re-run step 2 for a loop look:

```bash
npx remotion still MarketMove-CrashRed f0.png   --frame=0   --scale=0.3333333333333333 --props='{"loopCheck":true}'
npx remotion still MarketMove-CrashRed f600.png --frame=600 --scale=0.3333333333333333 --props='{"loopCheck":true}'
```

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
