# Rate Board · Light Streaks · Glitch Dot Map

Three looks, five compositions, one Remotion project. All are **20 s seamless loops**, 30 fps,
**600 frames**, defined at **3840×2160**.

| Composition id | Look | Engine | GPU |
|---|---|---|---|
| `RateBoard-Red` | Rate Board, red (as the reference) | three.js plane + Canvas 2D texture, DoF gather, bloom | WebGL2 |
| `RateBoard-Blue` | Rate Board, blue | same scene, other data row | WebGL2 |
| `LightStreaks-BlueMagenta` | Light Streaks (as the reference) | three.js, ~700 instanced screen-width ribbons | WebGL2 |
| `LightStreaks-Gold` | Light Streaks, gold | same scene, other data row | WebGL2 |
| `GlitchDotMap-Mono` | Glitch Dot Map | Canvas 2D, glyph atlas + `drawImage` | none |

Remotion 4.0.515, `@remotion/three` on **WebGL2** (not WebGPU), three 0.186.1, React 19.
Versions are pinned in `package.json`. Fonts are bundled, all SIL OFL: Roboto Mono, Rajdhani,
IBM Plex Sans (`public/fonts/`, licences alongside). Land data is Natural Earth 110m (public
domain), bundled as `src/data/natural-earth-land-110m.topo.json`. Everything else is code.

```
npm install
npx remotion studio          # pick a composition and scrub
```

## Render commands

Headless Chromium needs the **`--gl=angle`** flag for WebGL2 (it is also set in
`remotion.config.ts`; the flag is repeated here so the command is self-contained). On a machine
without a GPU, ANGLE uses SwiftShader (software GL): it works, it is just slow (see timings).
Chromium prints a harmless "automatic fallback to software WebGL has been deprecated" warning there.

4K videos (3840×2160, H.264, yuv420p, CRF 16, no audio; the codec settings, `--muted`, PNG
frames and a grain-tuned x264 encode all come from `remotion.config.ts`):

```
npx remotion render RateBoard-Red            out/RateBoard_Red.mp4            --gl=angle
npx remotion render RateBoard-Blue           out/RateBoard_Blue.mp4           --gl=angle
npx remotion render LightStreaks-BlueMagenta out/LightStreaks_BlueMagenta.mp4 --gl=angle
npx remotion render LightStreaks-Gold        out/LightStreaks_Gold.mp4        --gl=angle
npx remotion render GlitchDotMap-Mono        out/GlitchDotMap_Mono.mp4        --gl=angle
```

6K stills (6000×3375 = 3840×2160 × 1.5625). Not rendered here:

```
npx remotion still RateBoard-Red out/RateBoard_Red_6K.png --frame=200 --scale=1.5625 --gl=angle
```

720p previews (1280×720: `--scale=0.3333333333333333` gives exactly 1280×720):

```
npm run preview          # scripts/render-previews.sh: all five, into deliverables/
npx remotion still RateBoard-Red out/still.png --frame=200 --scale=0.3333333333333333 --gl=angle
```

`--scale` is applied as the page's `devicePixelRatio`, and every canvas in this project sizes its
backing store from it, so a 720p preview really costs 720p.

## Measured render time

Measured here: 4 cores, **no GPU** (SwiftShader software GL), one worker, steady-state per-frame
cost (a short and a longer range were timed and the difference divided, so browser/bundle
start-up is not included). Method: `scripts/time-frames.sh`.

| Composition | 720p, ms / frame | 720p, full 600 frames (3 workers, wall) | **real 4K frame, measured** | 4K estimate, 600 frames |
|---|---|---|---|---|
| `RateBoard-Red` | 976 | 8 min 54 s | **6 050 ms** (Canvas 2D redraw 4096² + upload + DoF + bloom) | ~61 min |
| `RateBoard-Blue` | 1 018 | 8 min 41 s | (same scene) | ~61 min |
| `LightStreaks-BlueMagenta` | 609 | 6 min 01 s | 4 076 ms (also measured) | ~41 min |
| `LightStreaks-Gold` | 583 | 6 min 17 s | (same scene) | ~41 min |
| `GlitchDotMap-Mono` | 47 | 55 s | **661 ms** (a real frame: ~6 700 glyph draws) | ~7 min |

* The map stress case, every glyph drawn 7 times (~47 000 draws, the brief's "45 000 glyphs"):
  **769 ms** at 4K, so drawing is cheap; PNG capture of a 4K canvas dominates.
* In software GL extra workers did not help (3 workers ≈ 1 worker per frame). The 4K estimates are
  `measured ms × 600` for one worker. They are estimates for this CPU-only box: on a GPU machine
  expect far less, but that was not measured.
* The 720p board texture is 2048², the 4K board texture is 4096² (the shader repeats it).

## Checks that were run (on the encoded mp4s)

| Check | Result |
|---|---|
| ffprobe: 1280×720, 30/1, 20.000 s, h264, yuv420p, no audio stream, 600 frames | pass, all five |
| Loop: frame 600 == frame 0, byte-identical PNG (`scripts/loopcheck.sh`, composition prop `extendForLoopCheck`) | pass, all five |
| Same result every time: frame 300 cold `still` == frame 300 from a 3-worker sequence render (frames 297–303), byte-identical (`scripts/determinism.sh`) | pass, all five. The map was also checked at frame 105 (inside a dissolve) and against a full 600-frame sequence render |
| Banding on the encoded mp4 (`scripts/banding.py`) | pass: longest flat plateau 2–3 px on every glow, haze and sky gradient (a staircase would be 10+ px) |
| Contact sheets (5 frames each) | numbers/pulses/glitches differ between frames, board has moved toward the camera, Gold has **0** blue-dominant pixels |
| Motion | loop seam 599→0 is 0.7–1.2× a normal frame step; map dissolve scatters (f90–106), holds, and re-forms monotonically (f126–148, largest step 0.76 luma/frame) |

**Banding.** Dark purple, maroon and navy gradients band easily, and x264 at CRF 16 erases a faint
±1/255 dither. Three things keep it smooth: the final pass adds triangular ±1/255 dither plus 1.5 %
grain, from a fixed formula of pixel position and `frame % 600` (no `Math.random()`); the grain is
coarse (2 px at 720p, 6 px at 4K) and nearly uniform across tones, because 1 px grain is exactly
what the encoder discards; and the encode uses `-tune grain` with the `slow` preset. The first
encode failed this check (21 px plateaus in the sky); `scripts/banding.py` averages 41 px
perpendicular to a line so the grain cancels and only quantisation plateaus remain.
Run: `python3 scripts/banding.py out/RateBoard_Red.mp4 board 300 out/band`.

## Determinism

Every value on screen is a function of `useCurrentFrame()` only: seeded `mulberry32` at module
level, integer hashes of (index, frame-derived state), loop-periodic noise sampled around a circle
(`src/lib/rand.ts`). No `Math.random()`, `Date.now()`, `useState` driving visuals, carried state,
`useFrame` clock or TAA. Board ticks use `frame % 600`; sparkline samples and sweeps are
whole-cycle; streak pulses make a whole number of laps per 600 frames; camera and sway are whole
sine cycles; glitch events divide 600 frames evenly.

## Decisions where the brief and the reference disagreed

* **Map grid: 150 × 77 cells, not 230 × 130.** Autocorrelation of the reference's land texture
  gives a pitch of ~5.1 × 5.6 px at 768 px wide (25.6 × 28 px at 4K). 230 × 130 is ~1.5× finer
  than the reference. Change `COLS`/`ROWS` in `src/looks/map/landMask.ts` for the other grid; the
  projection corrects for non-square cells.
* **Glitch timing.** "Every 1.2 s, 25 per loop" is 0.8 s; "6 s, exactly 5 per loop" is 4 s. I kept
  the wall-clock intervals and made every cycle divide 600: row shifts use 25 slots of 24 frames,
  each firing with seeded probability 0.68 (18 of 25 fire: one per ~1.1 s); the dissolve repeats
  every 200 frames (6.7 s, 3 per loop). Scatter 20 f, hold 15 f, re-form 25 f as specified.
* **Map glyphs are digits and symbols** as specified (no gender symbols), so the texture is not
  identical to the reference's ♂-style marks. Rings and plus signs flare as asked.
* **Board names are invented Latin codes**; the reference's Chinese labels are not reproduced.
  `node scripts/check-codes.mjs` checks the 30 codes against ISO 4217 and a list of well-known
  tickers. The brief's own examples `ORA`/`TEL` are real tickers, so they are not used.
* **Light Streaks ribbons are wider than 1.5–6 px at 4K** (about 3–7 px, 12–20 px for the thick 12 %):
  the reference lines are clearly heavier than that at 4K scale.
* The reference clips are not in this project (`refs/` is excluded) and nothing traces them.

## How to add a colourway

**Light Streaks** (the scene is identical, only the data row changes):
1. Add a row to `src/looks/streaks/palettes.ts`:
   ```ts
   export const TEAL: StreaksPalette = {
     id: "Teal",
     streaks: [{ hex: "#1AD8B0", weight: 0.5 }, { hex: "#2A9AFF", weight: 0.3 }, { hex: "#E8FFF8", weight: 0.2 }],
     flareCore: "#FFFFFF", flareGlow: "#2AFFC8",
     skyTop: "#020A0A", skyHorizon: "#0A3A32", haze: "#13A88A", glint: "#7AFFE0",
   };
   ```
2. In `src/Root.tsx` add `const StreaksTeal = () => <LightStreaks palette={TEAL} />;` and
   `<Composition id="LightStreaks-Teal" component={StreaksTeal} {...common} />`.

**Rate Board**: add a `BoardPalette` row in `src/looks/board/data.ts` (base, up/down colours,
sparkline gradient, the two glow colours, and `bias`, the share of rising vs falling rows), then
register `RateBoard-<Name>` in `Root.tsx` the same way.

**Glitch Dot Map** is monochrome; there is nothing to recolour.

Add the new id to `scripts/render-previews.sh` and run the checks in `scripts/`.

## Layout

```
src/Root.tsx                 compositions (+ extendForLoopCheck for the 601-frame loop test)
src/lib/                     loop constants, seeded hashing and loop noise, fonts, canvas sizing
src/gfx/                     fullscreen passes, bloom pyramid, dither + grain, ThreeStage (R3F runner)
src/looks/board/             board data, Canvas 2D board texture, rig (plane, DoF, glows)
src/looks/streaks/           palettes and the ribbon rig (sky, flare, glints, composite)
src/looks/map/               land mask (Natural Earth), glyph map renderer
scripts/                     loopcheck, determinism, banding, time-frames, render-previews, contact_sheet, ...
```
