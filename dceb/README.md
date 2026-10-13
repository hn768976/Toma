# Diamond Relief · Card Rain · Network Earth · Wireframe Bulb · Coin Growth

Five 3D motion-graphic looks, two versions each, in one Remotion project:
**10 compositions** at 3840×2160 and 30 fps. All are built in code with
**three.js on WebGL2** through `@remotion/three`.

| Composition id | Look | Length |
|---|---|---|
| `DiamondRelief-WhiteRight` | white tile relief, lower-right corner | 20 s seamless loop (600 f) |
| `DiamondRelief-GraphiteLeft` | graphite, mirrored, lower-left corner, soft rim | 20 s loop |
| `CardRain-Black` | generic bank cards tumbling, black | 20 s loop |
| `CardRain-GreenScreen` | same on exact `#00FF00`, excluded from all post | 20 s loop |
| `NetworkEarth-BlueRight` | Earth on the right, blue lights, arcs, plexus shell | 20 s loop |
| `NetworkEarth-GoldLeft` | Earth on the left, gold lights, amber arcs | 20 s loop |
| `WireframeBulb-Blue` | wireframe bulb over a network background | 20 s loop |
| `WireframeBulb-Emerald` | same, emerald | 20 s loop |
| `CoinGrowth-BlueSilver` | coin stacks, rising bars, line chart | 10 s story (300 f) |
| `CoinGrowth-GoldGreen` | gold coins, green chart | 10 s story |

## Setup

```bash
npm install
npx remotion studio          # preview; the studio draws at ≤0.5 dpr to stay responsive
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

**Chromium GL flag.** Every render needs WebGL2 from ANGLE:
`--gl=angle`. It is already set in `remotion.config.ts`
(`Config.setChromiumOpenGlRenderer("angle")`), and it is passed explicitly in
the commands below as well. Use a machine with a real GPU for 4K. Without one,
Chromium falls back to SwiftShader (CPU), which is what produced the timings
below.

## 4K render commands (one per composition)

```bash
npx remotion render src/index.ts DiamondRelief-WhiteRight   out/DiamondRelief_WhiteRight.mp4   --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts DiamondRelief-GraphiteLeft out/DiamondRelief_GraphiteLeft.mp4 --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CardRain-Black             out/CardRain_Black.mp4             --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CardRain-GreenScreen       out/CardRain_GreenScreen.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts NetworkEarth-BlueRight     out/NetworkEarth_BlueRight.mp4     --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts NetworkEarth-GoldLeft      out/NetworkEarth_GoldLeft.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts WireframeBulb-Blue         out/WireframeBulb_Blue.mp4         --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts WireframeBulb-Emerald      out/WireframeBulb_Emerald.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CoinGrowth-BlueSilver      out/CoinGrowth_BlueSilver.mp4      --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
npx remotion render src/index.ts CoinGrowth-GoldGreen       out/CoinGrowth_GoldGreen.mp4       --gl=angle --codec=h264 --crf=16 --pixel-format=yuv420p
```

For keying, `CardRain-GreenScreen` is better delivered as ProRes 4444 or
PNG frames (`--codec=prores --prores-profile=4444`, or `--sequence`), because
4:2:0 H.264 averages chroma across 2×2 blocks at every card edge.

## 6K still (6000×3375)

```bash
# 3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375
npx remotion still src/index.ts NetworkEarth-BlueRight out/NetworkEarth_BlueRight_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Use `--frame=150` (or the hold, `--frame=290`) for the Coin Growth compositions.
No 6K stills were rendered here.

## 720p previews (how the deliverables were made)

```bash
npx remotion bundle src/index.ts --out-dir build
scripts/render-all.sh          # PNG sequence at --scale=0.3333333333333333 → ffmpeg H.264 CRF 16 yuv420p
```

`--scale=0.3333333333333333` gives exactly 1280×720; ffprobe confirms this for
all ten. The frames are rendered as a lossless PNG sequence and encoded with
`ffmpeg -c:v libx264 -crf 16 -pix_fmt yuv420p -r 30 -an`. The PNG sequence is
also the "full render" that the determinism check compares against.

## Measured render times

**Environment.** These timings come from the build machine: 4 vCPU, no GPU.
WebGL2 ran on Chromium's software rasteriser (SwiftShader through ANGLE). A
real GPU will be far faster, so read these as worst-case numbers.

### 720p preview renders

Full 720p renders, PNG sequence, `--concurrency=3`. The number is wall time ÷
frames, so it is throughput.

| Composition | s / frame (720p) | Total |
|---|---|---|
| DiamondRelief-WhiteRight | 0.63 | 381 s / 600 f |
| DiamondRelief-GraphiteLeft | 0.66 | 393 s / 600 f |
| CardRain-Black | 1.26 ¹ (1.04 clean run) | 753 s / 600 f |
| CardRain-GreenScreen | 1.16 ¹ | 697 s / 600 f |
| NetworkEarth-BlueRight | 0.77 ¹ | 464 s / 600 f |
| NetworkEarth-GoldLeft | 0.75 ¹ | 450 s / 600 f |
| WireframeBulb-Blue | 0.73 ¹ | 435 s / 600 f |
| WireframeBulb-Emerald | 0.70 ¹ | 417 s / 600 f |
| CoinGrowth-BlueSilver | 7.68 | 2304 s / 300 f |
| CoinGrowth-GoldGreen | 7.39 | 2216 s / 300 f |

¹ These ran while verification stills shared the CPU, so they are 5–20% slow.
Coin Growth is CPU-vertex-bound: about 550 lathe-built coins, drawn twice
because of the mirrored floor reflection. It is the slowest look by far on
SwiftShader; on a GPU this cost is negligible.

### Two real 4K frames (3840×2160)

Timed with `--scale=1 --concurrency=1`. Per-frame cost = (time for 3 frames −
time for 1 frame) ÷ 2, which removes the browser and asset start-up.

| Composition | 1 frame | 3 frames | **4K s / frame** |
|---|---|---|---|
| CardRain-Black (frame 300) | 44.7 s | 85.8 s | **20.6 s** |
| NetworkEarth-BlueRight (frame 300) | 15.5 s | 27.7 s | **6.1 s** |

### 4K estimates (this CPU machine, one worker)

The scale factor from 720p to 4K was about 20× for the DoF-heavy look (2A)
and about 9× for 3A. These are CPU estimates for the full lengths:

| Composition | 4K s / frame | Full render |
|---|---|---|
| Diamond Relief (×2) | ≈ 6 | ≈ 60 min each |
| Card Rain (×2) | ≈ 21 (measured on 2A) | ≈ 3.5 h each |
| Network Earth (×2) | ≈ 6 (measured on 3A) | ≈ 60 min each |
| Wireframe Bulb (×2) | ≈ 6 | ≈ 60 min each |
| Coin Growth (×2) | ≈ 12–15 | ≈ 60–75 min each |

With 4 workers on a 16-core box, divide by about 3. A GPU machine running
`--gl=angle` on hardware should render 4K in roughly 0.3–2 s per frame.

## Determinism

Every value on screen is a pure function of `useCurrentFrame()`:

- **Randomness.** All randomness comes from `mulberry32` with constant seeds,
  evaluated once when geometry and layouts are built. Nothing calls
  `Math.random()`, `Date.now()` or the r3f clock.
- **Rendering.** The renderer runs from a priority-1 `useFrame`. That hook only
  takes over rendering and never reads its clock.
- **Per-frame state.** Uniforms and matrices are set in `useLayoutEffect`
  from the frame number only. No `useState` drives visuals.
- **Post effects.** No TAA, no accumulation buffers, no `AccumulativeShadows`.
  The SSAO uses a fixed 16-sample kernel rotated by a fixed 4×4 Bayer
  pattern. The DoF gather uses a fixed golden-angle spiral. Grain and dither
  are integer PCG hashes of pixel position and `frame % 600` (`% 300` for
  Coin Growth).
- **Assets.** Fonts, canvas textures and the NASA textures load before the
  `<ThreeCanvas>` mounts, behind `delayRender`. Whichever frame renders first,
  cold, already has everything.
- **Loops.** Every motion uses whole cycles per loop:
  - tile noise uses integer temporal harmonics;
  - card fall periods are 60–300 frames, all dividing 600;
  - card spins are whole turns;
  - the globe sway is a cosine over 600 frames;
  - pulse periods divide 600;
  - background layers drift by whole tiles.

## Verification results

All checks were run on the final renders. Scripts are in `scripts/`
(`verify.py`, `motion.py`, `band_png.py`).

### Step 1: file checks

All 10 previews pass. Each is `h264 1280x720 30/1 yuv420p` with no audio
stream. Durations are 20.000 s for the loops and 10.000 s for Coin Growth.

### Step 2: loops

The project was bundled with `REMOTION_LOOP_CHECK=1`, which makes the loops
601 frames. Frames 0 and 600 were then rendered as PNG. For all 8 loops they
are **byte-identical** (pixel max diff 0).

### Step 3: determinism

Frame 300 (frame 150 for Coin Growth) was rendered alone from a cold start
with `remotion still`. For all 10 compositions it is **byte-identical** to
the same frame of the full PNG-sequence render.

### Step 4: banding

Luminance profiles were read from frames decoded from the encoded mp4s:
- 1A: the white-to-grey gradient;
- 1B: the copy-space gradient;
- 3A and 3B: the atmosphere glow;
- 4A: the navy background;
- 5A: the dark floor and background.

The metric is the residual of a 9 px smoothed profile against its 31 px
trend:
- encoded mp4s: about 0.7–1.3 code values;
- lossless PNG of the same frames: about 0.7–1.5.

So the residual is the grain texture, not steps from encoding. In 1A the
longest flat run is 16–33 px, where a code value spans about 40 px of the
gradient, so dither and grain break up every plateau.

A contrast-stretched (×8) view found one real artefact in 1A: faint
horizontal stripes caused by SSAO self-occlusion on the far, grazing plane.
It was fixed with a minimum sample elevation and a depth-relative bias, and
1A/1B were re-rendered. The stretched check is now clean.

### Step 4: 2B key test

- **Background.** 20 background samples from the encoded mp4 all read exactly
  **(0,255,0)**, a deviation of 0. In the lossless render every pixel next to
  a card is either exact #00FF00 or the card's own colour, with green excess
  ≤ 0. Coverage is cut at 50% and un-premultiplied, so cards carry no green.
- **The spec's key leaves a fringe.** `chromakey=0x00FF00:0.12:0.05` over a
  grey plate, on frames decoded from the H.264 file, leaves a **1–2 px green
  line** on card edges: about 24k pixels with green excess > 40 per frame.
  This comes from the test pipeline, not the plate:
  - ffmpeg's chromakey averages chroma over a 3×3 neighbourhood;
  - 4:2:0 subsampling mixes chroma across 2×2 blocks.
- **Proof.** A synthetic hard-edged grey square on pure #00FF00, put through
  the same encode and key, gets the same ≈2 px fringe (3,204 px on a 1,604 px
  perimeter).
- **With despill.** Adding `despill=type=green` after the key removes it
  completely: 0 fringe pixels on frames 150, 300 and 450.
- **For production keying,** render 2B as ProRes 4444 or PNG.

### Step 5: contact sheets

Five evenly spaced frames per composition are in
`deliverables/contact-sheets/`. Each shows the required content:
- **Diamond Relief:** tiles rise and sink in one corner, soft shadows, wide
  copy space; 1A is white/right, 1B graphite/left.
- **Card Rain:** dozens of generic cards with the near ones blurred, no
  logos, and the text spelled exactly. The background is black, or exact
  green.
- **Network Earth:** a cropped Earth with city lights, arcs, plexus shell and
  glow; 3A blue/right, 3B gold/left.
- **Wireframe Bulb:** a triangulated wireframe bulb with a coiled filament
  and bright base, over a busy network with people icons; blue or emerald.
- **Coin Growth:** coins first, then the bars rise left to right, the chart
  draws, and it holds.

### Step 6: motion

Frame-to-frame mean |Δ| over frames 270–330 for the loops (and 30–180 for
Coin Growth) never exceeds 1.8× the window's median: no pops. Cards wrap
outside the frame. Four-frame crops of the bulb wireframe and the plexus
shell are stable, with no shimmer: the lines are at least 1 px wide and fade
in alpha below that.

### Steps 7–8: reference comparison

- **Process.**
  - Fresh sub-agents were given only a reference frame, a preview frame and
    the fixed instruction.
  - Round 1 used stills; round 2 used the encoded previews, plus 1A after its
    re-render.
  - Their findings and my actions are in `docs/reference-review.md`.
  - Three fix iterations were made per look.
- **Items intentionally not matched, because the brief says otherwise:**
  - **Card Rain** has about 70 cards in view (the reference has about 20
    larger ones).
  - **Network Earth** has its plexus shell 6% larger than the globe (the
    reference's shell is about 25% larger).
  - **Wireframe Bulb** is built as a regular jittered-lathe triangulation
    with points at the vertices. The reference is a looser particle-cloud
    hologram.
- **Small deviations from the brief, made to match the reference:**
  - The Diamond Relief camera sits at 30° above the plane (brief: about
    35°).
  - The Network Earth globe centre sits at about 97.5% / 2.5% of the frame
    width (brief: 80% / 20%), so the crop and empty side match the
    reference. The radius stays at 70% of the frame height.
  - Coin faces are plain (the reference has embossed "$" faces, which the
    brief rules out).
- **Remaining differences the reviewers still noted:**
  - the reference's softer, compressed-video look;
  - Card Rain's denser layout;
  - Coin Growth's glass bars, which read brighter than the reference's
    frosted blocks.

### Completion checklist

- [x] 10 compositions at 3840×2160 and 30 fps (8 × 600 f loops, 2 × 300 f stories), one data row per version
- [x] three.js on WebGL2 via `@remotion/three`, `--gl=angle`, no WebGPU, no PixiJS
- [x] Determinism: seeded `mulberry32` at module level, no `Math.random`/`Date.now`/r3f clock, no TAA, no `AccumulativeShadows`; cold frame = full-render frame (byte-identical)
- [x] Loops close: frame 0 = frame 600 (byte-identical) for all 8
- [x] Dither ±1/255 in the final pass (not on 2B's background); grain 1.5% (1% on 1A) from a pixel/frame hash on `frame % 600` (`% 300` for Coin Growth)
- [x] 2B background exactly #00FF00, excluded from all post; key test done (see above)
- [x] OFL fonts only (Inter, JetBrains Mono) with licences; NASA Blue/Black Marble credited
- [x] No brands or logos; card text limited to the five generic strings; plain coins
- [x] 10 previews at 1280×720 (H.264, yuv420p, CRF 16, 30 fps) + 10 stills at 720p
- [x] 720p render time per composition + two timed 4K frames + 4K estimates
- [x] `npm install && npx remotion studio` checked from a clean copy (studio served HTTP 200; all 10 compositions listed; `tsc` clean)
- [ ] 6K stills: command provided, not rendered here (as requested)
- [ ] 4K videos: commands provided, not rendered here (as requested)

## How to add a colourway (one data row)

Open `src/versions.ts`, copy a row in the look's array, and give it a new `id`
and new props. For example, a purple Wireframe Bulb:

```ts
{
  id: "WireframeBulb-Violet",
  props: { line: "#B98CFF", filament: "#EBDDFF", bgDeep: "#12063A", bgBright: "#3A1A8A", network: "#A98CFF", exposure: 0.85, grain: 0.015 },
},
```

`Root.tsx` maps every row to a `<Composition>` automatically. Card colourways
are rows in `CARD_COLOURS_ALL` / `CARD_COLOURS_KEY` (two gradient stops plus an
optional `metal` flag). Keep green and teal out of the key list.

## Project layout

- `src/lib/Post.tsx`: the deterministic post pipeline (HDR target with 4×
  MSAA, SSAO, DoF, bloom, tone map, grain, dither, chroma-key composite).
- `src/lib/Stage.tsx`: asset gating (`delayRender`), dpr, `<ThreeCanvas>`.
- `src/lib/fatLines.ts`: resolution-independent screen-space lines for the
  wireframes and arcs.
- `src/looks/*.tsx`: the five looks. `src/versions.ts`: the 10 data rows.
- `scripts/`: preview render and verification helpers.

## Fonts, textures and credits

- **Inter** (card text) and **JetBrains Mono** (card numbers and data text)
  are both under the SIL Open Font License 1.1. The files and licence texts
  are in `public/fonts/*/`, taken from the Fontsource packages.
- **Earth day texture:** `public/textures/earth-blue-marble-day.jpg`, NASA
  Blue Marble (NASA Earth Observatory / Visible Earth), public domain. This
  4096×2048 copy comes from the `three-globe` example assets.
- **Earth night lights:** `public/textures/earth-black-marble-night.jpg`, NASA
  Black Marble / Earth at Night (NASA Earth Observatory, Suomi NPP VIIRS),
  public domain. This 4096×2048 copy comes from the three.js example
  textures.
- The NASA servers were not reachable from the build environment, so these
  public-domain copies were taken from the projects named above. Image
  credit: **NASA Earth Observatory**.
- **No brands or logos.**
  - The card text is limited to "BANK NAME", "CREDIT CARD", "CARDHOLDER
    NAME", "12/32" and "1234 5678 9012 3456".
  - The chip is a plain gold contact pad.
  - There are no networks, holograms or bank marks.
  - Coins have plain reeded edges and plain faces with one ring.
