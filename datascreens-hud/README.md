# Data Screens · Vital Monitor · HUD Tunnel · People Network · HUD Frame

One Remotion project, five looks, seven compositions. Every composition is
**3840×2160, 30 fps, 600 frames (20 s)** and loops seamlessly (frame 600 ==
frame 0).

| Composition id (Remotion) | Look | Engine | Output file |
|---|---|---|---|
| `DataScreens-WhiteOverlay` | layered white data panels on black, DoF | three.js (WebGL2) + Canvas 2D textures | `DataScreens_WhiteOverlay.mp4` |
| `VitalMonitor-Teal` | angled patient monitor, ECG / pleth / resp | three.js + Canvas 2D texture | `VitalMonitor_Teal.mp4` |
| `VitalMonitor-Green` | same, classic green / cyan / yellow | three.js + Canvas 2D texture | `VitalMonitor_Green.mp4` |
| `HUDTunnel-Blue` | forward rush through a circuit tunnel, HUD rings | three.js | `HUDTunnel_Blue.mp4` |
| `PeopleNetwork-Navy` | deep field of linked person badges, DoF | three.js | `PeopleNetwork_Navy.mp4` |
| `PeopleNetwork-White` | same, light corporate colourway | three.js | `PeopleNetwork_White.mp4` |
| `HUDFrame-WhiteOverlay` | HUD border on pure black, empty centre | Canvas 2D | `HUDFrame_WhiteOverlay.mp4` |

Remotion composition ids may only contain letters, digits and `-`, so the ids
use a hyphen where the deliverable file names use an underscore.

## Setup

```bash
npm install
npx remotion studio          # preview
```

Node 18+ (tested on Node 22). Versions are pinned in `package.json`.

### Chromium GL flag

The three.js looks need WebGL2. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`, i.e. the CLI flag **`--gl=angle`**.
On a machine without a GPU Chromium falls back to SwiftShader (software); on a
GPU machine ANGLE uses the GPU and renders much faster. WebGPU is not used.

## Render commands (4K)

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG intermediate
frames and no audio track.

```bash
npx remotion render src/index.ts DataScreens-WhiteOverlay out/DataScreens_WhiteOverlay.mp4 --gl=angle
npx remotion render src/index.ts VitalMonitor-Teal        out/VitalMonitor_Teal.mp4        --gl=angle
npx remotion render src/index.ts VitalMonitor-Green       out/VitalMonitor_Green.mp4       --gl=angle
npx remotion render src/index.ts HUDTunnel-Blue           out/HUDTunnel_Blue.mp4           --gl=angle
npx remotion render src/index.ts PeopleNetwork-Navy       out/PeopleNetwork_Navy.mp4       --gl=angle
npx remotion render src/index.ts PeopleNetwork-White      out/PeopleNetwork_White.mp4      --gl=angle
npx remotion render src/index.ts HUDFrame-WhiteOverlay    out/HUDFrame_WhiteOverlay.mp4    --gl=angle
```

Everything is drawn at the physical output resolution (composition size ×
`--scale`), so line widths, text and blur keep their look at any scale.

### Stills (6000×3375)

```bash
npx remotion still src/index.ts <CompositionId> out/<CompositionId>_6K.png --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375.)

### 720p previews

```bash
./scripts/render-previews.sh                     # all 7, or pass ids
# = npx remotion render src/index.ts <id> renders/<file>.mp4 --scale=0.3333333333333333
```

`--scale=1/3` lands exactly on 1280×720 (checked with ffprobe).

## Blend modes

**Data Screens** and **HUD Frame** are white-on-pure-black overlays: background
exactly (0,0,0), no grain, no dither, no vignette. Put them over footage in
**Screen** or **Add** mode and tint them as you like.

## Vital Monitor physiology

Illustrative only — **not a medical device display**.

- **99 bpm**: exactly 33 beats in 20 s. R–R intervals carry a small seeded
  variation (≈0.601–0.611 s) normalised to sum to exactly 20 s.
- **ECG (lead II)**: upright P wave, PR ≈ 0.16 s, narrow QRS ≈ 0.08 s with small
  Q and S and a tall R, flat ST segment, broad upright T, flat baseline between
  beats.
- **Pleth**: one rounded peak per beat, upstroke 0.2 s after the R spike,
  dicrotic notch on the downslope.
- **Respiration**: **18 breaths per minute** (exactly 6 per loop).
- **Readouts**: PLS is the rate of the last 4 R–R intervals (98–100); **SpO₂
  97–99** in a few steps per loop; RESP 18.
- Traces are written left to right with an erase gap; one sweep = 5 s, 4 sweeps
  per loop. Every trace is computed from time on every frame, never accumulated.

`npm run check:physio` re-runs the physiology check from the code.

## Adding a colourway

Each version is one data row in `src/compositions.ts`. Copy a row, give it a new
`id` (letters, digits and `-` only) and change the colours, e.g.

```ts
{
  id: "PeopleNetwork-Teal",
  component: PeopleNetwork,
  props: {
    bgTop: "#03262A", bgBottom: "#0A3A40",
    badgeA: "#D8FFF8", badgeB: "#D8FFF8", glyph: "#05343A",
    line: "#5AB8B0", lineAlpha: 0.42,
    pulse: "#E8FFFC", pulseAdditive: true, halo: "#8FFFF0",
    grain: 0.01, farFade: 0.95, badgeAlpha: 0.82, background: "#03262A",
  },
},
```

## How it stays deterministic

- No `Math.random()`, `Date.now()`, R3F clock or `useState`-driven visuals.
  Layouts, strings, R–R intervals, badge positions and links come from
  `mulberry32` seeded at module level; motion is a formula of
  `useCurrentFrame()` (folded into 0–599).
- R3F's `useFrame` is used only as the render hook (priority 1); it reads the
  Remotion frame, not R3F's clock. No TAA, no accumulation.
- Live Canvas textures (changing panel text) are redrawn only when their state
  key changes, and the drawing is a pure function of that key.
- Fonts (OFL, in `public/fonts`) load with `delayRender` before anything is drawn.
- Loops: every periodic motion makes a whole number of cycles in 600 frames
  (panel wraps, camera trucks one period, tunnel moves exactly one pattern
  length L with ring sets L/2 apart in two alternating designs, arcs turn whole
  turns, text cycles divide 600 frames, 33 beats / 6 breaths / 4 sweeps).

## Banding

Half-float render targets for the three.js post chain; ±1/255 triangular
dither in the final pass of 2–6; ~1% grain from a fixed hash of pixel position
and frame (faded below 3% luminance) on 2–5; none on 6. No grain or dither on 1
and 7. H.264 is encoded with x264 `-tune grain` (set in `remotion.config.ts`),
otherwise the encoder smooths the dither and grain away in flat gradients.

## Fonts

JetBrains Mono (code, hex, binary, HUD text) and Inter (readouts, labels), both
SIL Open Font License 1.1. Font files and licence texts are in `public/fonts/`.
All on-screen text is invented; there are no logos, brands, device makers, real
code, names, passwords or addresses. Person icons are generic pictograms.

## Measurements (this build machine: 4 vCPU, no GPU, Chromium SwiftShader)

### 720p previews (`--scale=1/3`, 2 tabs in parallel), wall time

| Composition | 600 frames | per frame (wall) |
|---|---|---|
| DataScreens-WhiteOverlay | 56 s | 0.09 s |
| VitalMonitor-Teal | 598 s | 1.00 s |
| VitalMonitor-Green | 616 s | 1.03 s |
| HUDTunnel-Blue | 433 s | 0.72 s |
| PeopleNetwork-Navy | 226 s | 0.38 s |
| PeopleNetwork-White | 221 s | 0.37 s |
| HUDFrame-WhiteOverlay | 32 s | 0.05 s |

### Timed real 4K frames (3840×2160, one tab, frames 300–304 minus frame 300 alone)

| Composition | per 4K frame |
|---|---|
| DataScreens-WhiteOverlay | 0.64 s |
| PeopleNetwork-Navy | 3.10 s |

### 4K estimates for 600 frames on this machine (software WebGL)

Per-tab 4K cost was 3.4× (Data Screens) and 4.1× (People Network) the per-tab
720p cost; the others are extrapolated with ~4×, then halved for 2 tabs:

| Composition | est. per 4K frame (1 tab) | est. 600 frames, 2 tabs |
|---|---|---|
| DataScreens-WhiteOverlay | 0.64 s (measured) | ~4 min |
| VitalMonitor-Teal / Green | ~8 s | ~40 min each |
| HUDTunnel-Blue | ~6 s | ~30 min |
| PeopleNetwork-Navy / White | 3.1 s (measured, Navy) | ~16 min each |
| HUDFrame-WhiteOverlay | ~0.4 s | ~2 min |

On a machine with a GPU (ANGLE on the GPU instead of SwiftShader) the
three.js looks render many times faster; Canvas 2D (HUD Frame) is CPU-bound
either way.

## Verification results (final build)

Scripts: `python3 scripts/verify.py` (steps 1–4, 6) and `npm run check:physio`
(step 5).

1. **File checks** — all 7: h264, 1280×720, 30/1, yuv420p, no audio stream,
   20.0 s, 600 frames. ✅
2. **Loop** — 601-frame versions (`REMOTION_LOOP_CHECK=1`), frame 0 vs 600:
   identical pixel for pixel on all 7. ✅
3. **Determinism** — frame 300 rendered cold as a still vs frame 300 rendered
   after frames 240–299 in the same tab: byte-identical PNGs on all 7. ✅
4. **Black level / banding (read from the encoded mp4)**
   - Data Screens and HUD Frame: 50 points ≥24 px from any content all read
     0,0,0 (max channel value 0). ✅
   - Gradients: content-free 48×48 tiles (tunnel: radial background profile);
     after a 5×5 mean no neighbour step exceeds 1 code value (99.9th pct
     0.47–0.76; tunnel ring-to-ring max 2.0 on the radial envelope). ✅
     With grain (2–5) equal-value runs average 1.6–2.1 px, i.e. no flat
     bands. PeopleNetwork-White (no grain allowed, ±1/255 dither) keeps
     single-code quantisation contours (runs ~23 px) after 4:2:0 encoding —
     visible only under heavy contrast stretch; that is the 8-bit floor
     within the brief's no-grain rule.
5. **Physiology** — 33 R spikes in 600 frames; R–R sum 20.000000000000 s;
   P→QRS→T on 33/33 beats; PR 0.170 s; QRS 0.080 s; flat baseline between
   beats; pleth upstroke 0.197 s after R with a dicrotic notch on 33/33 beats;
   6 respiration cycles; PLS 98–100 and within 1 bpm of the true 99 bpm on
   every frame; SpO₂ steps through 97, 98, 99. ✅
6. **Contact sheets** — `renders/*_contact.png` (frames 0, 120, 240, 360,
   480, 599). ✅

## Completion checklist

- [x] 7 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] three.js on WebGL2 via `@remotion/three` (1–4), Canvas 2D (5)
- [x] Seeded `mulberry32`, no `Math.random()` / `Date.now()` / clock-driven visuals
- [x] Half-float post chain, dither (2–6), grain (2–5), none on 1, 6 (grain), 7
- [x] OFL fonts only (JetBrains Mono, Inter) with licence texts
- [x] Invented text only; no logos, brands, device makers, faces or real code
- [x] One data row per version in `src/compositions.ts`
- [x] 720p previews + stills, render times measured, two real 4K frames timed
- [x] Verify steps 1–6 pass; step 7/8 visual comparison done in 3 rounds

