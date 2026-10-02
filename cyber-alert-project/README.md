# Cyber Security Alerts: Remotion project

Three 2D cyber-threat alert looks × two versions = **six compositions**.
Every composition is defined at **3840×2160** and **30 fps**, and is a **600-frame (20 s) seamless loop**.

| Composition id | Look | Version | Preview file |
|---|---|---|---|
| `ChipAlert-Red` | Chip Alert | Red-orange triangle, deep-blue circuit | `ChipAlert_Red.mp4` |
| `ChipAlert-Amber` | Chip Alert | Amber triangle, dark-teal circuit | `ChipAlert_Amber.mp4` |
| `GlitchWord-Warning` | Glitch Word | `WARNING` | `GlitchWord_Warning.mp4` |
| `GlitchWord-AccessDenied` | Glitch Word | `ACCESS DENIED` | `GlitchWord_AccessDenied.mp4` |
| `BreachHUD-Blue` | Breach HUD | Blue HUD, red alerts | `BreachHUD_Blue.mp4` |
| `BreachHUD-Green` | Breach HUD | Green terminal HUD, red alerts | `BreachHUD_Green.mp4` |

It is all React, SVG and CSS. There is no WebGL, no three.js and no `@remotion/three`. In Chip Alert, perspective
comes from CSS 3D transforms (`perspective` plus `rotateX` on the circuit plane). In Breach HUD, the same 3D projection
(camera distance, sheet yaw and pitch, layer depth) is computed in `project()` and applied per panel as a 2D transform;
see *Deviations* below for why. Depth of field is a CSS blur on each layer, scaled by that
layer's depth. Glow is stacked SVG filters: three `feGaussianBlur` at 1 : 4 : 12, each fainter, merged under the source.

## Setup

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 18+ is required (tested with Node 22). Versions are pinned in `package.json`.

## Render at 4K

```bash
npx remotion render ChipAlert-Red            out/ChipAlert_Red.mp4            --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render ChipAlert-Amber          out/ChipAlert_Amber.mp4          --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render GlitchWord-Warning       out/GlitchWord_Warning.mp4       --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render GlitchWord-AccessDenied  out/GlitchWord_AccessDenied.mp4  --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render BreachHUD-Blue           out/BreachHUD_Blue.mp4           --codec=h264 --pixel-format=yuv420p --crf=16 --muted
npx remotion render BreachHUD-Green          out/BreachHUD_Green.mp4          --codec=h264 --pixel-format=yuv420p --crf=16 --muted
```

(`remotion.config.ts` already sets h264 / yuv420p / CRF 16 / PNG intermediate frames; the flags are repeated so the
commands also work on their own.) For a 1080p preview add `--scale=0.5`. For ProRes masters use `--codec=prores --prores-profile=4444`.

## Stills

```bash
# 6000×3375 PNG (6000 / 3840 = 1.5625)
npx remotion still ChipAlert-Red out/ChipAlert-Red_f270.png --frame=270 --scale=1.5625 --image-format=png
```

`scripts/render-stills.sh` renders three 6000×3375 stills per composition, plus a 1080p still of each. It uses the
frames listed below. Grain is kept in the stills.

| Composition | Still frames | Why |
|---|---|---|
| ChipAlert-* | 60, 270, 480 | far apart in the loop |
| GlitchWord-* | 5, 240, 500 | word clean (no glitch within ±2 frames) |
| BreachHUD-* | 100, 283, 510 | 7–8 pop-up warnings fully visible, none mid-pop or mid-fade (plus the permanent framed warnings) |

## Render time

Measured in this build environment: a 4-core cloud VM with no GPU, Chrome headless shell, `--concurrency=4`. The
times cover full 600-frame renders at 1080p (`--scale=0.5`), including encoding.

| Composition | 1080p, full 600 frames | per frame |
|---|---|---|
| ChipAlert-Red | 588 s | **0.98 s** |
| ChipAlert-Amber | 564 s | **0.94 s** |
| GlitchWord-Warning | 221 s | **0.37 s** |
| GlitchWord-AccessDenied | 224 s | **0.37 s** |
| BreachHUD-Blue | 416 s | **0.69 s** |
| BreachHUD-Green | 429 s | **0.71 s** |

Measured 4K vs 1080p on the same 30 frames (startup excluded): Chip 3.5 s vs 0.93 s per frame (3.8×),
Glitch 1.28 s vs 0.30 s (4.3×), HUD 2.5 s vs 0.60 s (4.1×).

4K has four times the pixels, and blur and rasterisation costs scale with pixel count. On this machine that means
about **35 min (Chip Alert), 13 min (Glitch Word) and 25 min (Breach HUD)** per 600-frame 4K render. A desktop with
8+ fast cores and `--concurrency` raised to match should be 2–3× quicker. Nothing is drawn on a GPU.

The most expensive look is Chip Alert. Its depth of field is made of blurred strips of the board plane, each blurred
once. This replaced an earlier version that blurred five full-board copies, which ran at about 3 s per 1080p frame.

## Changing the alert word

The word is a prop. In `src/Root.tsx`:

```tsx
<Composition id="GlitchWord-Warning" component={GlitchWord} … defaultProps={{ text: "WARNING", palette: GLITCH_RED }} />
```

Change `text`, or add another `<Composition>` with a new id and text. The font size is set from the word length,
so longer words shrink to the same visual weight (`fitFont` in `src/looks/GlitchWord.tsx`). You can also override it
at render time without editing code:

```bash
npx remotion render GlitchWord-Warning out/Breach.mp4 --props='{"text":"BREACH DETECTED","palette":{"bg":"#04050a","word":"#ff1e2d","wordCore":"#ff8a8f","code":["#22c55e","#3b82f6","#ef4444"],"plexus":"#9fb7d9"}}'
```

The other on-screen text is in the scene files. The login value is `USER` in `src/looks/hud-parts.tsx`. HUD labels are
in `src/looks/hud-parts.tsx`. The pseudo-code vocabulary is in `src/lib/code.ts`.

## Changing the palette

All colours are in **`src/looks/palettes.ts`**: `ChipPalette`, `GlitchPalette` and `HudPalette`, with one exported
object per version (`CHIP_RED`, `CHIP_AMBER`, `GLITCH_RED`, `HUD_BLUE`, `HUD_GREEN`). To make a new version, copy one
of those objects, change the hex values, and register a new `<Composition>` in `src/Root.tsx` that passes it as
`palette`. The key fields:

- Chip Alert: `alert` (triangle), `alertCore` (hot core of the neon line), `trace`/`traceBright`/`chipEdge` (circuit), `bgCenter`/`bgEdge`/`board` (ground), `warm` (corner glow, `"r,g,b"`).
- Glitch Word: `word`, `code` (three colours for the code columns), `plexus`, `bg`.
- Breach HUD: `text`, `map`, `line`, `field` (interface colour), `alert` (warnings and flag frames), `bgCenter`/`bgEdge`.

## How the loop and determinism work

- Every value on screen comes from `useCurrentFrame()` wrapped to `frame % 600` (`src/lib/loop.ts`). There is no
  `Math.random()`, `Date.now()`, `requestAnimationFrame` or `useState`, and no CSS `@keyframes` or transitions.
- Anything that repeats completes a whole number of cycles in 600 frames. `osc()` and `saw()` throw if given a
  non-integer cycle count. Code scrolls by whole content lengths, so whole lines. Typing cycles are 120 frames,
  blinks have a period of 10, flag flashes use periods that divide 600, and the camera paths are 1 or 2 sine cycles.
- Random-looking things (circuit layout, code text, plexus points, the glitch schedule, the pop-up schedule) are
  generated once at module level from a seeded `mulberry32` (`src/lib/random.ts`, `src/looks/schedules.ts`). Every
  scheduled event starts in 0–599 and ends by 599, and the build throws if one doesn't.
- Grain is a seeded noise tile (`public/noise/grain.png`, made by `scripts/build-noise.mjs`). Its offset is a hash of
  `frame % 600`, it sits at one noise cell per 1080p pixel, and it is added last, after every glow.
- Sizes are authored in 1080p pixels and multiplied by `u = width / 1920` (`useUnits()`), or drawn in SVG viewBoxes.
  Positions, font sizes and stroke widths therefore keep their share of the frame at any resolution.

## Assets and licences

- **Fonts** (in `public/fonts/`, embedded, no network at render time):
  - **Inter** (Black 900 and Bold 700), © The Inter Project Authors, **SIL Open Font License 1.1** (`public/fonts/OFL-Inter.txt`).
  - **JetBrains Mono** (Regular 400 and Bold 700), © The JetBrains Mono Project Authors, **SIL Open Font License 1.1** (`public/fonts/OFL-JetBrainsMono.txt`).
  - The woff2 files are the Latin subsets as packaged by Fontsource.
- **World map**: **Natural Earth** 1:110m Admin 0 countries (**public domain**, naturalearthdata.com). The source
  GeoJSON is in `data/`. `scripts/build-map.mjs` projects it (equirectangular, Antarctica cropped) into
  `src/data/world.json`, an outline path plus a land-mask dot grid. `scripts/build-map-texture.sh` renders that into
  `public/map/world-fill.png`, which the HUD draws as a tinted mask. No other map source is used.
- **Everything else was made for this project**: the warning triangles, chip, circuit traces, login fields, frames and
  markers are SVG paths and CSS written here, with no icon library. All code text is placeholder pseudo-code generated by
  `src/lib/code.ts` from a made-up vocabulary. It is not copied from any source, and it contains no product or company
  names. Every IP-like string is from the documentation ranges `192.0.2.x`, `198.51.100.x` and `203.0.113.x`.
- No logos, no real company or product names, no real IP addresses.

## Project layout

```
src/Root.tsx               six compositions (pass --props='{"loopCheck":true}' for 601 frames)
src/looks/ChipAlert.tsx    look 1
src/looks/GlitchWord.tsx   look 2
src/looks/BreachHUD.tsx    look 3 (+ hud-parts.tsx)
src/looks/schedules.ts     glitch + pop-up schedules (seeded, loop-safe)
src/looks/MapTexture.tsx   build-time map texture (Asset-WorldMap composition)
src/looks/palettes.ts      all colours
src/lib/                   loop maths, seeded RNG, glow filter, grain, fonts, pseudo-code
scripts/                   asset builders, preview/still renders, verification
data/                      Natural Earth source GeoJSON
public/                    fonts (OFL) and generated noise tiles
```

`npm run build:assets` regenerates `src/data/world.json`, `public/noise/*.png` and `public/map/world-fill.png`. The
last of these is rendered from the `Asset-WorldMap` composition, a build-time helper and not a deliverable. The
output is deterministic and already committed.

## Verification

`scripts/verify.py <probe|loop|determinism|scale|banding|frames>`, `scripts/check-schedules.mjs` and
`scripts/audit-text.mjs` run the checks below. Results from this build:

| Step | Check | Result |
|---|---|---|
| 1 | ffprobe: 1920×1080, 30/1, 20.000 s, 600 frames, h264, yuv420p, **no audio** | all 6 pass |
| 2 | Text audit (`scripts/audit-text.mjs`, ~22k generated strings and every literal): no brand or product names, only documentation-range IPs, no clipped addresses, no icon library in `package.json`; every symbol is an SVG path in `src/` | pass |
| 3 | Loop: 601-frame build, frame 600 vs frame 0 | all 6 **pixel-identical** (max diff 0) |
| 4 | Determinism: frame 300 cold single still vs the same frame from a multi-threaded sequence render, plus a stress run (both in parallel, repeated) | all 6 **byte-identical**; 1 distinct output per composition under stress |
| 5 | 1080p vs 4K (4K downscaled): mean abs diff 0.7–2.8/255, edge energy ratio 0.97–1.01 | layout identical; thin lines present at both sizes |
| 6 | Banding on frames decoded from the mp4 | pass, see below |
| 7 | Per-look frame checks at 0/150/300/450/599 | pass, see the checklist |
| 8 | Fresh-reviewer comparison against the reference clips | 3 rounds for looks 1 and 3; known gaps listed below |

## Banding check

H.264 at CRF 16 in yuv420p. One frame (300) was decoded from each encoded mp4 to PNG and luma was read along a
line from the brightest glow into dark background.

- **ChipAlert-Red** (the hardest case). The line runs from the triangle apex straight up:
  `221 97 94 66 46 39 28 19 21 28 36 48 63 71 66 …` (every 8 px; the rises are chip rings crossing the line).
  The longest run of identical values is 5 px and the mean run is 1.3 px, so values change every pixel or two with no
  plateaus. Contrast-stretched crops (×2.8 on the glow, ×2.1 on the warm corner) show no contour bands.
- **ChipAlert-Amber**: longest identical run 5 px. **GlitchWord**: 14 px, inside the flat dark backing panel.
  **BreachHUD**: 11–13 px, inside flat translucent red blocks; a ×4 stretch of the background gradient shows no bands.
- What prevents banding: a 2.2–2.4 % animated grain added last, over every glow; a static ±1/255 noise layer
  over the background gradients (Chip Alert and Breach HUD); PNG (not JPEG) intermediate frames; CRF 16.

## Completion checklist

- [x] 6 compositions, 3840×2160, 30 fps, 600 frames, seamless loops (frame 600 = frame 0)
- [x] 2D only: React, SVG and CSS. No `@remotion/three`, no WebGL, no three.js
- [x] Glow from stacked SVG filters (1 : 4 : 12 blurs), not CSS drop-shadow; only the triangle is blown out in look 1
- [x] Depth of field from per-layer or per-strip blur scaled by depth
- [x] Every size is a fraction of the frame (`u = width / 1920` or SVG viewBoxes)
- [x] No `Math.random`, `Date.now`, rAF, `useState`, CSS `@keyframes` or transitions; seeded `mulberry32` at module level
- [x] Glitch and pop-up schedules fixed and seeded; every event starts in 0–599 and ends by 599 (checked at build)
- [x] Grain 2.2–2.4 % from a seeded tile, driven by `frame % 600`, added after the glow
- [x] Fonts shipped (Inter, JetBrains Mono; OFL) and credited
- [x] Map from Natural Earth only; all code text and symbols made for this project; documentation-range IPs only
- [x] Look 1: triangle brightest in every check frame (luma 221–234 vs ≤183 elsewhere, Red); reflection bars fade
      downward; sharp band through the middle and blur growing toward every edge; pulse varies triangle light by
      ~22 % across the five frames; 1B amber on teal, same layout
- [x] Look 2: word clean in all 5 check frames (glitching on 10 % of frames, in 7 bursts); a burst stepped frame by
      frame shows strips shifting, RGB channels separating and partial dropout; background layers clearly darker;
      `ACCESS DENIED` 71 % of frame width vs `WARNING` 61 %, similar weight
- [x] Look 3: 5 depth layers separable by blur; several warnings in every frame (10 permanent framed ones plus 6–8
      pop-ups), in different positions across frames; typing visible (the same field reads full / full / empty /
      `admin_consol` at frames 0 / 150 / 300 / 450); near panels slide past far ones; 3B green code, maps and fields
      with red warnings
- [x] 1080p previews rendered (H.264, yuv420p, CRF 16, no audio) and a 1080p PNG still of each
- [x] 3 × 6000×3375 PNG stills per composition (`scripts/render-stills.sh`; all 24 stills render in about 5 min)

## Deviations from the brief

- **Breach HUD perspective is computed in JS, not with CSS 3D.** With CSS 3D layers (large `translateZ` plus
  counter-scale plus `rotateY`), blurred panels came out ±1–2 levels different on a few dozen pixels between renders
  under load. Bisected by switching groups off, this broke the byte-for-byte determinism requirement. The same 3D maths
  (perspective distance, sheet yaw and pitch, layer depth, camera drift) now runs in `project()`, and each panel gets a
  2D translate and scale. Parallax and depth scaling are unchanged; text lines are horizontal. Chip Alert keeps real
  CSS 3D (`rotateX` on the plane), which is stable under the same stress test.
- **HUD maps use a pre-rendered texture.** The map is still Natural Earth, rendered once to a PNG by the
  `Asset-WorldMap` composition and used as a tinted mask. Rasterising the very large map paths every frame was one of
  the sources of non-determinism.
- **Glitch Word has no reference comparison.** Its reference clip (2231162287) was not available, so it was built from
  the written description only.

## Known gaps after three reference-review rounds

Fresh reviewers compared one frame per look against the reference clip. After round 3, round-to-round feedback was
contradicting itself (tilt "too strong" then "too weak", red "too pink" then "not pink enough"), so iteration stopped.
These differences were raised consistently and are **not** fixed:

- **Chip Alert:** the reference's blue is a brighter, more saturated electric blue; its chip has more and thinner sharp
  line work (notches, pin rows), where ours is fewer and softer bands; the reference has large round bokeh discs along
  the bottom foreground, which ours lacks.
- **Breach HUD:** the reference code is smaller and denser and reads as texture, where ours is a little larger and more
  readable in the sharp band; the reference has a fine speckle/particle field over the whole frame; its top-right
  glitch streaks are denser, with chromatic fringing.
