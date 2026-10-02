# Security & AI Interfaces — Remotion project

Ten 20-second seamless-loop interface animations, 2D only (React + SVG,
no WebGL, no `@remotion/three`). 30 fps, 600 frames, compositions defined
at **3840×2160**.

| # | Look | Composition id (A) | Composition id (B) |
|---|------|--------------------|--------------------|
| 1 | Security Dashboard | `SecurityDashboard-Dark` | `SecurityDashboard-Light` |
| 2 | Minimal HUD | `MinimalHUD-White` | `MinimalHUD-Amber` |
| 3 | AI Interface — Code | `AIInterfaceCode-Mono` | `AIInterfaceCode-Blue` |
| 4 | Padlock Grid | `PadlockGrid-Secure` | `PadlockGrid-Breach` |
| 5 | AI Interface — Assistant | `AIInterfaceAssistant-Mono` | `AIInterfaceAssistant-Blue` |

Remotion ids cannot contain `_`, so ids use `-`. Output files use `_`
(`SecurityDashboard_Dark.mp4`, …), as in the delivery list.

## Setup

```bash
npm install          # Node 18+; versions are pinned in package.json
npx remotion studio  # preview all ten compositions
```

## Render commands

### 4K masters (3840×2160, H.264, yuv420p, CRF 16, 30 fps, no audio)

Codec, pixel format, CRF, PNG frame capture and "no audio" are set in
`remotion.config.ts`, so the commands stay short:

```bash
npx remotion render SecurityDashboard-Dark    out/SecurityDashboard_Dark_4K.mp4
npx remotion render SecurityDashboard-Light   out/SecurityDashboard_Light_4K.mp4
npx remotion render MinimalHUD-White          out/MinimalHUD_White_4K.mp4
npx remotion render MinimalHUD-Amber          out/MinimalHUD_Amber_4K.mp4
npx remotion render AIInterfaceCode-Mono      out/AIInterfaceCode_Mono_4K.mp4
npx remotion render AIInterfaceCode-Blue      out/AIInterfaceCode_Blue_4K.mp4
npx remotion render PadlockGrid-Secure        out/PadlockGrid_Secure_4K.mp4
npx remotion render PadlockGrid-Breach        out/PadlockGrid_Breach_4K.mp4
npx remotion render AIInterfaceAssistant-Mono out/AIInterfaceAssistant_Mono_4K.mp4
npx remotion render AIInterfaceAssistant-Blue out/AIInterfaceAssistant_Blue_4K.mp4
```

Or all at once: `npm run render:4k` (writes `renders/4k/`).

### 1080p previews (what was delivered)

```bash
npx remotion render <id> renders/previews/<Name>.mp4 --scale=0.5
# or: npm run render:previews
```

### Stills (6000×3375 PNG, two per composition)

```bash
npx remotion still <id> <file>.png --frame=<N> --scale=1.5625   # 3840 × 1.5625 = 6000
# or: npm run stills   (frames listed in tools/comps.sh)
```

Chosen frames (no panel mid-fade, mid-slide or mid-typing):

| Composition | Frames |
|---|---|
| SecurityDashboard-* | 110, 510 |
| MinimalHUD-* | 100, 400 |
| AIInterfaceCode-* / AIInterfaceAssistant-* | 160, 560 (chat reply complete, held) |
| PadlockGrid-Secure | 100, 400 |
| PadlockGrid-Breach | 155, 555 (red wave crossing the middle of the frame) |

## Render speed

Measured on the build machine (4 vCPU cloud container, no GPU, Chrome
headless shell, `--concurrency=4`). Wall-clock seconds per frame for the
full 600-frame 1080p preview, including bundling and H.264 encode:

| Composition | 1080p s/frame | 1080p full clip | 4K s/frame (60-frame sample) | 4K full clip (est.) |
|---|---|---|---|---|
| AIInterfaceAssistant-Mono / Blue | 0.08 | ~50 s | 0.30 | ~3 min |
| AIInterfaceCode-Mono / Blue | 0.11 | ~70 s | ~0.40 (est.) | ~4 min |
| MinimalHUD-White / Amber | 0.16 | ~95 s | ~0.55 (est.) | ~5.5 min |
| SecurityDashboard-Dark | 0.18 | ~105 s | 0.64 | ~6.5 min |
| SecurityDashboard-Light | 0.34 | ~3.4 min | ~1.3 (est.) | ~13 min |
| PadlockGrid-Secure / Breach | 0.43–0.45 | ~4.5 min | 2.66 | ~27 min |

4K costs about 3–4.5× the 1080p time per frame (4× the pixels). All ten 4K
masters: roughly **1.9 hours** on the same 4-core machine; a desktop with
8–16 cores and `--concurrency=8` or higher should take well under an hour.

Most of the time goes on the two looks with **full-frame grain** (1B,
look 4). Look 4 also runs a full-frame glow on the padlock layer. Grain
was moved from a whole-scene filter to a separate overlay layer, which cut
look 4 from 0.92 to about 0.54 s/frame in a like-for-like test.

## How it is built

* **One SVG per frame.** Each look draws into a single `<svg>` with a fixed
  `1920×1080` viewBox stretched to the composition size from
  `useVideoConfig()` (`src/lib/Stage.tsx`). Every position, font size,
  line and border width is therefore a fraction of the frame: a 1-unit
  hairline is 1 px at 1080p, 2 px at 4K and 3.1 px at 6000 px.
* **Everything is a function of the frame.** All motion is computed from
  `useCurrentFrame()` (`src/lib/loop.ts`). No CSS `@keyframes`, no CSS
  transitions, no `Math.random()`, no `Date.now()`, no `useState`.
  Random tables (chart data, logs, map dots, padlock grid, binary tags,
  globe points) come from a `mulberry32` seeded at module level.
* **Loop maths.** Every periodic function completes a whole number of cycles
  in 600 frames: `wave(f, cycles)` only accepts integer cycles, `cyc(f, period)`
  throws if `period` does not divide 600. Scrolling code and logs move by
  exactly one block height per loop. The chat in look 5 runs three 200-frame
  question/answer cycles. The breach wave in 4B is
  `fract(3·t − u/0.8)`: every lock is hit every 200 frames and each lock's
  state comes only from its distance to the wave front.
* **Camera.** Looks 1, 3, 5 drift on a closed Lissajous path (≤ 10 design
  units = 0.5 % of frame width). Looks 2 and 4 are fixed.
* **Glow.** Three stacked Gaussian blurs, radii 1 : 4 : 12, each fainter
  than the last (`GlowFilter` in `Stage.tsx`), used on status rings,
  the AI mark, alerts, padlocks and HUD lines. Body text is not glowed.
* **Grain** (looks 1B and 4 only): `feTurbulence` with `seed = frame % 600`,
  added as zero-mean noise with `feComposite arithmetic`. Never on look 2.
* **Full repaint every frame.** The stage SVG is keyed by the frame number so
  Chrome repaints it from scratch. Without this, partial-repaint
  invalidation left a 1–2 level anti-aliasing residue from the previously
  rendered frame on a rotating padlock shackle (found by the determinism
  check, see below).

## Changing the palette

| Look | File | What to edit |
|---|---|---|
| 1 | `src/looks/dashboard/theme.ts` | `DASH_DARK`, `DASH_LIGHT` (accent, red, panel, text…) |
| 2 | `src/looks/hud/Hud.tsx` | `HUD_WHITE`, `HUD_AMBER` — one colour each; background stays `#000000` |
| 3 + 5 | `src/looks/ai/theme.ts` | `AI_MONO`, `AI_BLUE` (`accent` is highlights only; code greys in `CODE_GREYS`) |
| 4 | `src/looks/padlock/PadlockGrid.tsx` | `PAD_SECURE` (blue, violet, red, background gradient, light leak) |

To add a third colourway, copy a theme object and add a line to `COMPS` in
`src/Root.tsx`.

## Changing the text labels

| Look | File | Object |
|---|---|---|
| 1 | `src/looks/dashboard/data.ts` | `L` (titles, nav, list rows) and `LOG_MSGS` (event log) |
| 2 | `src/looks/hud/Hud.tsx` | `HUD_LABELS`; scrolling code in `CODE` |
| 3 + 5 | `src/looks/ai/data.ts` | `AL` (titles, nav, footer, model name), `TREE`, `CODE`, `LOG_TEXT`, `BUILD_LOG`, `QA` (chat) |
| 4 | `src/looks/padlock/PadlockGrid.tsx` | binary tags are generated (`TAGS`) |

Keep IP addresses in the reserved example ranges (`192.0.2.x`,
`198.51.100.x`, `203.0.113.x`). Chat answers are word-wrapped
automatically; keep each Q/A short enough to type within its 200-frame cycle.

## Verification

`tools/verify.sh` runs the loop and determinism checks; results of the
delivered build are below.

Final build, all ten compositions:

| Check | Result |
|---|---|
| Step 1 — ffprobe: 1920×1080, 30/1, 20.000 s, 600 frames, h264, yuv420p, no audio stream | **10/10 pass** |
| Step 1 — look 2: empty pixels decode to exactly 0,0,0 (5 frames × 4 regions) | **pass** (White and Amber; 65–69 % of every frame is exactly 0,0,0) |
| Step 2 — text and asset audit | pass (see "Assets" below) |
| Step 3 — loop: frame 600 == frame 0 pixel for pixel (`loopCheck` prop → 601 frames) | **10/10 pass** |
| Step 4 — determinism: cold frames 300/317/333 byte-identical to the same frames from a 4-thread render | **10/10 pass** |
| Step 5 — 1080p vs 4K (looks 1 and 2): layout identical, hairlines visible in both, text same share of frame | pass (PSNR of 4K box-downscaled vs 1080p: 32.6 dB dashboard, 36.2 dB HUD; lit-pixel share 8.0 % vs 7.8 % and 4.07 % vs 4.15 %) |
| Step 6 — five frames per clip: numbers change, pulses/blinks/scrolls, 4B red band in every frame | pass |

Scripts: `bash tools/verify.sh` (loop + determinism),
`python3 tools/check-encoded.py` (ffprobe, black level, grain; needs numpy
and Pillow), `bash tools/contact-sheet.sh` (five-frame sheets).

What the checks caught and what was changed:

1. **Silent audio track.** The first encode had an AAC stream, which also
   padded the duration to 20.053 s. Fixed with `Config.setMuted(true)`.
2. **Render-order dependence.** In 4B, frame 300 from a multithreaded
   render differed from a cold render by up to 2/255 on 22–38 pixels: an
   anti-aliasing residue left by Chrome's partial repaint after the
   previous frame, on a rotating shackle. Fixed by keying the stage SVG by
   frame, so every frame is a full repaint. All ten have been byte-identical since.
3. **Code ligatures.** JetBrains Mono turned `->` and `!=` into ligature
   glyphs. Ligatures are now off for all text.
4. **Names.** Placeholder names that matched real products were renamed,
   for example "Face ID" became "Face Scan" and a code class "KeyVault"
   became "TokenSafe".

## Banding check

Checked on the **encoded** 1080p mp4s, not the browser preview.

* Grain is driven by `feTurbulence` with `seed = frame % 600`, so it is
  deterministic and loops. Measured grain on flat areas of frame 300
  (std-dev of the high-pass residual, median over 16 px blocks):
  1B page and panel 3.2 code values (1.25 %), look 4A 3.6 (1.41 %),
  look 4B 3.6 (1.42 %). That is 1.5 % at source, slightly smoothed by
  H.264 at CRF 16.
* Contrast-stretched crops of the look-4 light leak and background
  gradient, and of the 1B page and panel shadows, show smooth dithered
  ramps with **no contour steps**. The crops are written to `renders/banding/`.
* Look 2 has no grain; its black stays exactly 0,0,0.
* **File-size cost.** Grain that changes every frame barely compresses. At
  CRF 16 the grained 1080p previews are 160–200 MB (about 65–80 Mbps),
  against 3–21 MB for the others. Expect roughly 4× that at 4K. To shrink
  them, raise the CRF for those three clips, or lower `grain` in the theme
  (banding protection drops with it).

## Assets, licences and originality

* **Fonts:** Inter (© The Inter Project Authors) and JetBrains Mono
  (© The JetBrains Mono Project Authors), both SIL Open Font License 1.1.
  WOFF2 files are in `public/fonts/`, licence texts in `licenses/`.
  They are loaded from the project at render time, never from the network.
* **World map:** country outlines from **Natural Earth** 1:110m admin-0
  (public domain, naturalearthdata.com), converted to
  `src/data/world.ts` by `tools/build-world.mjs` (geometry only, no names).
  The same data drives the threat-map dots and the land/sea dots of the
  particle globe.
* **All icons, code and layouts were made for this project.** Every icon is
  an SVG path written in `src/lib/icons.tsx`; no icon library is installed
  (see `package.json`). The C++ and C-like code shown on screen was written
  for this project and does nothing real. Panel layouts are original
  arrangements in the spirit of the references, not copies of any product.
* **Text:** all placeholder or generic. No real product, company or AI
  model names; the model name `QORIN-7` is invented. No currency symbols.
  IP addresses use the reserved documentation ranges only.

## Look 2 as an overlay

Both HUD versions are drawn on pure `#000000` with no grain, so they work
as **screen-blend overlays** (Screen / Add / Lighten in any editor): the
black drops out and only the lines and text remain. Verified in the encoded
1080p files: empty areas decode to exactly 0,0,0.

## Completion checklist

- [x] 10 compositions, 3840×2160, 30 fps, 600 frames, seamless loops
- [x] 2D only: React + SVG, no `@remotion/three`, no WebGL
- [x] All sizes are fractions of the frame (1920×1080 viewBox scaled by `useVideoConfig()`)
- [x] Everything computed from `useCurrentFrame()`; no CSS keyframes/transitions, `Math.random`, `Date.now`, `useState`
- [x] Seeded `mulberry32` at module level for all generated data
- [x] Loop check frame 0 == frame 600: 10/10
- [x] Determinism check (cold vs multithreaded, byte-identical): 10/10
- [x] Glow: three blurs 1 : 4 : 12, fainter each step; body text not glowed
- [x] Grain 1.5 % on 1B and look 4 only, seeded per frame; none on look 2
- [x] Look 2 background pure `#000000`, verified 0,0,0 in the encoded file
- [x] Camera drift on looks 1, 3, 5 (closed path, 0.5 % of width); looks 2 and 4 fixed
- [x] `tabular-nums` on all text, so changing digits don't shift sideways
- [x] Fonts shipped (Inter, JetBrains Mono, OFL) and credited
- [x] Natural Earth map (public domain)
- [x] All icons are hand-written SVG paths; no icon library in `package.json`
- [x] Original code text, generic labels, invented model name, reserved-range IPs, no currency symbols
- [x] 10 × 1080p previews (H.264, yuv420p, CRF 16, 30 fps, 20.0 s, no audio)
- [x] 10 × 1080p PNG stills, 20 × 6000×3375 PNG stills
- [x] `npm install && npx remotion studio` works from a clean copy of the zip
- [ ] 4K masters: not rendered here, by request (commands above)

## Project layout

```
remotion.config.ts      render settings (PNG capture, H.264, yuv420p, CRF 16, muted)
src/Root.tsx            the ten compositions (3840×2160, 30 fps, 600 frames)
src/lib/                loop maths, seeded RNG, fonts, Stage (viewBox, glow, grain, camera), UI primitives, icons
src/looks/dashboard/    look 1
src/looks/hud/          look 2
src/looks/ai/           looks 3 + 5 (shared panels, two layouts)
src/looks/padlock/      look 4
src/data/world.ts       Natural Earth outlines + land mask (generated)
tools/                  render, still and verify scripts; world-map converter
public/fonts/           Inter + JetBrains Mono (OFL)
licenses/               font licences
```
