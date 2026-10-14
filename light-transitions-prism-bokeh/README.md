# Light Transitions, Prism Light, Red Bokeh

Five looks as eight compositions, in one Remotion project. Every look is drawn with
**PixiJS 8 on WebGL2**: full-screen fragment shaders for the light, plus Pixi sprites
for the bokeh and sparkles. Each frame is rendered into a **half-float** target, then a
final pass adds blue-noise dither and film grain on the way to 8-bit.

| Composition id | Output file | Look | Length | Type |
|---|---|---|---|---|
| `LightSweep-Violet` | `LightSweep_Violet` | 1A Light Sweep, violet | 8 s / 240 f | transition (black ends) |
| `LightSweep-Gold` | `LightSweep_Gold` | 1B Light Sweep, gold | 8 s / 240 f | transition (black ends) |
| `FlareBurst-VioletGold` | `FlareBurst_VioletGold` | 2A Flare Burst, violet-gold | 6 s / 180 f | transition (black ends) |
| `FlareBurst-Cyan` | `FlareBurst_Cyan` | 2B Flare Burst, cyan | 6 s / 180 f | transition (black ends) |
| `LightLeak-VioletBlue` | `LightLeak_VioletBlue` | 3A Light Leak, violet-blue | 12 s / 360 f | overlay (black ends) |
| `LightLeak-WarmAmber` | `LightLeak_WarmAmber` | 3B Light Leak, warm amber | 12 s / 360 f | overlay (black ends) |
| `PrismLight-Rainbow` | `PrismLight_Rainbow` | 4 Prism Light | 20 s / 600 f | seamless loop |
| `RedBokeh-RedGold` | `RedBokeh_RedGold` | 5 Red Bokeh | 20 s / 600 f | seamless loop |

All compositions are 3840×2160, 30 fps.

> **Looks 1–3 are on exact black (0,0,0). Use the Screen or Add (linear dodge) blend
> mode** to lay them over or between your own shots. Grain and dither are switched off
> wherever the light is below about 3%, so the black really is black.

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio draws at up to 1920×1080 for speed)
```

Node 18+ is required (tested with Node 22). All dependency versions are pinned in `package.json`.

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE. `remotion.config.ts` already sets it
(`Config.setChromiumOpenGlRenderer("angle")`). On the command line, the equivalent is:

```
--gl=angle
```

On a machine with no GPU, ANGLE falls back to SwiftShader (software). That works, and every
number below was measured that way. On a GPU machine it is much faster.

## Rendering

### 4K, per composition

```bash
npx remotion render src/index.ts LightSweep-Violet     out/LightSweep_Violet.mp4     --gl=angle
npx remotion render src/index.ts LightSweep-Gold       out/LightSweep_Gold.mp4       --gl=angle
npx remotion render src/index.ts FlareBurst-VioletGold out/FlareBurst_VioletGold.mp4 --gl=angle
npx remotion render src/index.ts FlareBurst-Cyan       out/FlareBurst_Cyan.mp4       --gl=angle
npx remotion render src/index.ts LightLeak-VioletBlue  out/LightLeak_VioletBlue.mp4  --gl=angle
npx remotion render src/index.ts LightLeak-WarmAmber   out/LightLeak_WarmAmber.mp4   --gl=angle
npx remotion render src/index.ts PrismLight-Rainbow    out/PrismLight_Rainbow.mp4    --gl=angle
npx remotion render src/index.ts RedBokeh-RedGold      out/RedBokeh_RedGold.mp4      --gl=angle
```

`remotion.config.ts` supplies the rest of the output settings:
- H.264, `yuv420p`, CRF 16, no audio track;
- lossless PNG frames into the encoder;
- a keyframe every 30 frames, so the last frame of every composition decodes to exact black;
- a 180 s per-frame timeout, for software WebGL at 4K.

For a mastering-grade overlay, you can also render ProRes 4444 with
`--codec=prores --prores-profile=4444`.

### 720p previews (as delivered)

```bash
npx remotion render src/index.ts <id> out/<file>.mp4 --scale=0.3333333333333333 --gl=angle
# or all of them:
scripts/render.sh LightSweep-Violet LightSweep-Gold FlareBurst-VioletGold FlareBurst-Cyan \
  LightLeak-VioletBlue LightLeak-WarmAmber PrismLight-Rainbow RedBokeh-RedGold
```

3840 × 1/3 = 1280 exactly, so the previews come out at exactly 1280×720 (confirmed with ffprobe).

### 6K stills (6000×3375)

```bash
npx remotion still src/index.ts <id> out/<file>_6K.png --frame=<n> --scale=1.5625 --gl=angle
# e.g. the brightest Light Sweep moment:
npx remotion still src/index.ts LightSweep-Violet out/LightSweep_Violet_6K.png --frame=73 --scale=1.5625 --gl=angle
```

Frames used for the delivered stills:

| Composition | Frame |
|---|---|
| Light Sweep Violet | 73 |
| Light Sweep Gold | 71 |
| Flare Burst (both) | 57 (see note) |
| Light Leak (both) | 250 |
| Prism Light | 300 |
| Red Bokeh | 300 |

The Flare Burst's single brightest frame is the white-out (frames 75–90), which is a nearly
plain warm-white frame. Frame 57 is the brightest moment that still shows the flare: the
bloom and rays spreading into the white-out.

Rendering 6K is resolution-independent: shaders work in frame-height units, and sprite
sizes are given in 720p pixels and scaled to the layout.

## Adding a colourway (one data row)

Every version is one row in `src/data.ts`. To add one:

1. Copy a row.
2. Give it a new `id` (the composition id; letters, digits and `-` only) and a new `file`
   (the output name).
3. Change its colours.

```ts
{ id: "LightSweep-Emerald", file: "LightSweep_Emerald", look: "lightSweep",
  params: { streak: "#8AFFC8", bandDeep: "#001A10", bandMid: "#0A8A4A", bandBright: "#20FF90", bandAccent: "#00C8A0" } },
```

The new composition appears in the Studio and on the CLI straight away. The parameters for
each look are typed in `src/looks/<Look>.ts`.

## How it works

- `src/lib/stage.ts` sets up **one Pixi WebGL2 renderer per tab, with no ticker**. Remotion
  calls `render(frame)` once per frame, synchronously, from `useCurrentFrame()`. Each frame
  goes scene → `rgba16float` render texture → post pass → canvas.
- The **post pass** adds:
  - TPDF blue-noise dither: a fixed 64×64 void-and-cluster tile from
    `scripts/gen_bluenoise.py`, offset per frame by an R2 sequence;
  - about 1.5% monochrome grain from an integer hash of (pixel, frame).

  For the loops, the frame index wraps at 600, so the grain and dither repeat too.
- **Overlays (Looks 1–3):**
  - grain and dither fade in only above about 3% light;
  - glow tails below about 1.5/255 are set to exactly 0;
  - the first and last frames are forced black.
- **Determinism:**
  - no `Math.random()`, `Date.now()` or state drives anything on screen;
  - all layouts (shards, bokeh, sparkles, leak events) come from `mulberry32` with fixed
    seeds, generated once;
  - sprites are baked before the first frame, behind `delayRender`;
  - each frame's state is a pure function of the frame number (monotone-cubic timelines,
    fixed noise).
- **Loops:**
  - Prism Light turns exactly 1/6 turn per loop, and its shard layout has exact 6-fold
    symmetry;
  - Red Bokeh's layers drift by whole layout repeats;
  - all pulsing and twinkling uses whole cycles;
  - the loop phase is computed from `frame % 600`, so frame 600 is bit-identical to frame 0.

## Measured render times

Measured in this sandbox: 4 vCPU, no GPU (ANGLE → SwiftShader), with nothing else running
(`scripts/timing.sh`). Per-frame figures exclude the ~2.5 s of browser startup.

| Composition | 720p per frame, 1 tab | 720p per frame, 4 tabs | Full 720p preview (wall clock incl. startup and encode) |
|---|---|---|---|
| LightSweep-Violet | 0.34 s | 0.25 s | 59 s |
| LightSweep-Gold | 0.32 s | 0.26 s | 59 s |
| FlareBurst-VioletGold | 0.42 s | 0.35 s | 68 s |
| FlareBurst-Cyan | 0.43 s | 0.34 s | 67 s |
| LightLeak-VioletBlue | 0.40 s | 0.38 s | 175 s |
| LightLeak-WarmAmber | 0.43 s | 0.41 s | 172 s |
| PrismLight-Rainbow | 0.37 s | 0.31 s | 188 s |
| RedBokeh-RedGold | 0.27 s | 0.20 s | 134 s |

Four tabs barely beat one, because the 4 vCPUs are shared between SwiftShader, PNG
encoding and x264.

**Timed 4K frames** (one real 3840×2160 frame each, `--scale=1`, same machine):

| Frame | 4K still, total | 720p still of the same frame, total | Net 4K cost |
|---|---|---|---|
| 3A `LightLeak-VioletBlue`, frame 180 | 4.88 s | 2.55 s | ≈ 2.3 s above 720p, ≈ **2.7 s per 4K frame** |
| 5 `RedBokeh-RedGold`, frame 300 | 3.95 s | 2.27 s | ≈ 1.7 s above 720p, ≈ **1.95 s per 4K frame** |

**4K estimates.** On this kind of CPU-only machine, a 4K frame costs about 7× a 720p frame,
roughly 1.9–3.0 s per frame. Full 4K renders would take roughly:

| Composition | Estimated full 4K render |
|---|---|
| Light Sweep | ~11 min each |
| Flare Burst | ~9 min each |
| Light Leak | ~17 min each |
| Prism Light | ~26 min |
| Red Bokeh | ~19 min |

Encoding time comes on top of these. On any machine with a real GPU, expect the shaders to
be one to two orders of magnitude faster, at which point PNG capture and encoding dominate.

## Verification (run before delivery)

Scripts are in `scripts/`. Every check reads the **encoded mp4** wherever pixels are
involved.

| Step | Check | Result |
|---|---|---|
| 1 | ffprobe: 1280×720, 30/1, h264, yuv420p, no audio, exact durations | ✅ all 8 (`verify.py step1`) |
| 2 | Loops: frame 600 vs frame 0 (composition temporarily 601 frames via `--props='{"durationOverride":601}'`) | ✅ Prism and Bokeh: 0 differing pixels, identical PNG bytes (`check_loop.sh`) |
| 2 | Overlays: first and last frame, every pixel | ✅ all 6: max 0 (`verify.py black-ends`) |
| 3 | Middle frame rendered cold vs the same frame from a full out-of-order 4-tab render | ✅ all 8 byte-identical (`check_determinism.sh`) |
| 4 | Black level: 30 samples in black areas (61-px neighbourhood ≤ 2) across 9–12 frames per overlay | ✅ all 6: max channel 0–1 (`verify.py black-samples`) |
| 4 | Banding: strip-averaged profiles across each gradient | ✅ largest 1-px step 0.36–0.66 LSB, no staircase (`banding.py`) |
| 5 | Contact sheets (8 frames per transition, 5 per loop) | ✅ `out/sheets/` |
| 6 | Motion: frame-to-frame differences, isolated single-frame spikes | ✅ none; the flare white-out and the leak fades are eased S-curves over ≥ 10 frames (`motion.py`) |
| 7–8 | Look vs reference: side-by-side check, then a fresh comparison agent per round (≤ 3 rounds) for 1A, 2A, 3A, 4, 5 | see below |

**Banding details (step 4):**
- Red Bokeh: checked with the sprites hidden (`--props='{"debugBackgroundOnly":true}'`).
  The red radial gradient in `yuv420p` has a largest step of 0.62–0.66 LSB along the
  diagonals.
- Light Sweep band: 0.4–0.63 LSB.
- Flare outer glow: 0.46 LSB.
- Leaks: 0.8 LSB on a steep 0.25 LSB/px falloff.
- Prism: 0.96 LSB on a steep falloff.

All of these are smooth: the dither plus grain turns the 8-bit and 4:2:0 quantisation into
noise rather than steps.

### Reference comparison (steps 7–8)

Each round, a fresh agent was given one reference frame, one preview frame and a neutral
"list every difference" instruction. Fixes carried over to the B versions.

- **1A Light Sweep.** Fixed:
  - full-frame saturated `#2A00FF` at the peak;
  - flat lavender stroke with a kink across the band;
  - magenta accent zone (`bandAccent`);
  - 5 large low-contrast rounded "pill" bands.

  Left as is: the reference is hard-edged vector art, but the spec asks for a soft-edged band
  with grain.
- **2A Flare Burst.** Fixed:
  - warm gold → pink → violet wash;
  - huge soft white bloom;
  - soft halo offset to the left;
  - softer, dimmer rays;
  - blurred ghosts;
  - warm white-out edges.

  Left as is: the reference has no hexagonal ghosts or ring line; the spec asks for both, so
  they stay, softened.
- **3A Light Leak.** Fixed: large round blown-out cores with ragged edges, an icy fringe, a
  magenta band and a broad saturated wash.

  Left as is: the reference also briefly blows out the whole frame and has a streaky pink
  corner flare; mine keeps leaks as distinct blooms with black gaps, as the spec's timeline
  describes.
- **4 Prism Light.** Fixed:
  - saturated indigo field;
  - large faceted shards with rainbow edge fringes;
  - gold, salmon, cyan and magenta accents;
  - edge vignette.

  Left as is: the reference is an asymmetric tunnel with a bright off-centre hotspot. The spec
  requires a darker violet centre and an exact 6-fold layout (needed for the seamless loop), so
  the composition stays radially symmetric.
- **5 Red Bokeh.** Fixed: fewer, larger, softer discs that brighten the red rather than veil
  it; much less dust; two hero stars; a mottled background.

  Left as is: the red is slightly pinker than the reference because the spec fixes
  `#E8202A` → `#8A0A10`.

## Completion checklist

- [x] 5 looks → 8 compositions, one data row per version
- [x] PixiJS 8 on WebGL2 (`preference: "webgl"`, WebGL2 context asserted), no ticker, no 3D
- [x] Half-float scene targets, blue-noise dither, ~1.5% grain from a fixed formula, gated
      off in black for overlays
- [x] Deterministic: seeded at module level, frame-only state, byte-identical cold renders
- [x] Exact loops (Looks 4 and 5); exactly black first and last frames (Looks 1–3)
- [x] 3840×2160 compositions; 720p previews at exactly 1280×720 (H.264, yuv420p, CRF 16, 30 fps)
- [x] 720p PNG stills
- [x] README: render and still commands, GL flag, blend-mode note, timings, checks, colourways
- [x] No text, logos or brands; no MCP servers used in the build

## Project layout

```
remotion.config.ts      GL flag, codec, CRF, PNG frames, keyframes, timeout
src/data.ts             one row per version (colours)
src/Root.tsx            compositions from the rows
src/lib/stage.ts        Pixi renderer, half-float target, post pass (dither/grain/black gate)
src/lib/PixiLook.tsx    React host: delayRender for init, render once per frame
src/lib/gl.ts           full-screen shader mesh + shared GLSL (integer hash, noise)
src/lib/timeline.ts     monotone splines, envelopes, fixed 1D noise
src/lib/random.ts       mulberry32
src/lib/bluenoise.ts    fixed 64×64 blue-noise tile (generated)
src/looks/*.ts          the five looks
scripts/                render, stills, verification and timing helpers
```
