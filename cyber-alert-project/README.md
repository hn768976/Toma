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

It is all React, SVG and CSS. There is no WebGL, no three.js and no `@remotion/three`. Perspective comes from CSS 3D
transforms (`perspective`, `rotateX/Y`, `translateZ`). Depth of field is a CSS blur on each layer, scaled by that
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
| GlitchWord-* | STILL_GW | word clean (no glitch within ±1 frame) |
| BreachHUD-* | STILL_HUD | ≥5 pop-up warnings fully visible, none mid-pop or mid-fade |

## Render time

Measured in this build environment: a 4-core cloud VM with no GPU, Chrome headless shell, `--concurrency=4`. The
times cover full 600-frame renders at 1080p (`--scale=0.5`), including encoding.

TIMING_TABLE

4K has four times the pixels. Blur and rasterisation cost scale roughly with pixel count, so expect about
**3.5–4× the 1080p time per frame** on the same machine. TIMING_4K

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
  `src/data/world.json`, an outline path plus a land-mask dot grid. No other map source is used.
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
src/looks/palettes.ts      all colours
src/lib/                   loop maths, seeded RNG, glow filter, grain, fonts, pseudo-code
scripts/                   asset builders, preview/still renders, verification
data/                      Natural Earth source GeoJSON
public/                    fonts (OFL) and generated noise tiles
```

`npm run build:assets` regenerates `src/data/world.json` and `public/noise/*.png`. The output is deterministic and
already committed.

## Verification

`scripts/verify.py <probe|loop|determinism|scale|banding|frames>`, `scripts/check-schedules.mjs` and
`scripts/audit-text.mjs` run the checks below. Results from this build:

VERIFY_RESULTS

## Banding check

BANDING

## Completion checklist

CHECKLIST
