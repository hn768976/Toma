# Equations, Code & Balance — Remotion project

Three looks × two versions = six compositions, all defined at **3840×2160, 30 fps**.

| Composition id | Look | Version | Length | Loops? |
|---|---|---|---|---|
| `EquationFlight-Black` | Equation Flight | white on pure black `#000000` (screen-blend overlay) | 600 f / 20 s | **yes** |
| `EquationFlight-Navy` | Equation Flight | pale cyan glow on deep navy | 600 f / 20 s | **yes** |
| `AICodeScreen-Dark` | AI Code Screen | dark navy editor | 600 f / 20 s | **yes** |
| `AICodeScreen-Light` | AI Code Screen | light editor | 600 f / 20 s | **yes** |
| `BalanceScreen-Drain` | Balance Screen | 230,908.43 → **0.00** USD | 300 f / 10 s | **NO** |
| `BalanceScreen-Grow` | Balance Screen | **0.00** → 248,560.00 USD | 300 f / 10 s | **NO** |

> **Look 3 (Balance Screen) does NOT loop.** It is a one-way change: hold, count, land, hold.
> Do not tag or sell it as a loop.

Built with React, SVG and CSS only: CSS 3D transforms (`perspective`, `translate3d`) for the depth
and the tilted screens. **No `@remotion/three`, no WebGL.** Equations stay vector text at any size.

---

## Install and preview

```bash
npm install
npx remotion studio
```

Node 18+ is required. Every dependency in `package.json` is pinned to an exact version.

## Render commands (4K masters)

```bash
npx remotion render src/index.ts EquationFlight-Black out/EquationFlight_Black_4K.mp4
npx remotion render src/index.ts EquationFlight-Navy  out/EquationFlight_Navy_4K.mp4
npx remotion render src/index.ts AICodeScreen-Dark    out/AICodeScreen_Dark_4K.mp4
npx remotion render src/index.ts AICodeScreen-Light   out/AICodeScreen_Light_4K.mp4
npx remotion render src/index.ts BalanceScreen-Drain  out/BalanceScreen_Drain_4K.mp4
npx remotion render src/index.ts BalanceScreen-Grow   out/BalanceScreen_Grow_4K.mp4
```

`remotion.config.ts` already sets H.264, `yuv420p`, CRF 16, PNG intermediate frames, no audio
and the SwiftShader GL renderer, so no extra flags are needed. For a different quality, add `--crf=<n>`.

**1080p previews** (what was delivered): add `--scale=0.5`, for example

```bash
npx remotion render src/index.ts EquationFlight-Black out/EquationFlight_Black.mp4 --scale=0.5
```

## Still commands (6000×3375 PNG)

`--scale=1.5625` turns the 3840×2160 composition into 6000×3375.

```bash
npx remotion still src/index.ts BalanceScreen-Drain out/stills/BalanceScreen_Drain_f000.png --frame=0   --scale=1.5625
npx remotion still src/index.ts BalanceScreen-Drain out/stills/BalanceScreen_Drain_f120.png --frame=120 --scale=1.5625
npx remotion still src/index.ts BalanceScreen-Drain out/stills/BalanceScreen_Drain_f299.png --frame=299 --scale=1.5625
```

`scripts/render_stills.sh` renders the full set: three frames per composition, far apart. For
Balance Screen that means the start value, mid-count and the end value.

---

## Render time

Measured on the build machine: 4 vCPU, no GPU, Chrome Headless Shell with the SwiftShader GL
backend, `--concurrency=4`. "s/frame" is total wall-clock time divided by frame count, so it
includes encoding.

| Look | 1080p preview: total | 1080p s/frame | 4K ÷ 1080p (single-frame test) | **4K estimate** s/frame | 4K estimate, whole clip |
|---|---|---|---|---|---|
| EquationFlight-Black | 1470 s / 600 f | **2.5** | ×3.8 | ~10 | ~1.6 h |
| EquationFlight-Navy | 2534 s / 600 f | **4.2** | ×4.7 | ~20 | ~3.3 h |
| AICodeScreen-Dark | 1185 s / 600 f | **2.0** | ×4.1 | ~8 | ~1.4 h |
| AICodeScreen-Light | 1164 s / 600 f | **1.9** | ×4.1 | ~8 | ~1.3 h |
| BalanceScreen-Drain | 762 s / 300 f | **2.5** | ×5.0 | ~13 | ~1.1 h |
| BalanceScreen-Grow | 766 s / 300 f | **2.6** | ×5.0 | ~13 | ~1.1 h |

The 4K ratio comes from rendering frame 200 as a still at `--scale=0.5` and at `--scale=1` and
subtracting about 4 s of browser start-up from each. It is an estimate: a machine with more cores
or a real GPU will be much faster. Look 1 is the heaviest, because of its six blurred depth bands
and the SVG glow on the navy version. The CSS blur and SVG filter cost scales with pixel count.

## Motion blur

**Motion blur is OFF.** `@remotion/motion-blur` is not installed and not used.

`<CameraMotionBlur>` renders N sub-frames per frame, so it multiplies render time by N. At 4–6
samples, Look 1 would cost about 10–15 s/frame (black) or 17–25 s/frame (navy) at 1080p, and
roughly 4× that at 4K. That is about 1–2 days of CPU time per 4K clip on this machine. This is an
estimate from the measured times above, not a separate measurement.

The sense of speed comes from deterministic speed streaks: faint dust motes drawn from their
current depth to a slightly further depth, so they smear along the direction of travel.

---

## How each look works

### Equation Flight
* `src/equation-flight/formulas.ts`: the formula list (KaTeX syntax).
* `src/equation-flight/field.ts`: the seeded field. One block of depth `D = 3700` holds 80 planes:
  66 "chalkboard lines" of one to four formulas each, turned like the walls, ceiling and floor of a tunnel, plus 14 hand-drawn graphs (bell curves,
  parabolas, sine curves, construction triangles, line fits). The block is repeated **3×** along the
  view axis, giving 240 planes. The camera travels **exactly `D` in 600 frames**, so frame 600 is
  identical to frame 0.
* Sway (1 and 2 cycles), roll (1 cycle) and ray rotation (1 full turn) all complete whole cycles
  per loop.
* Depth of field uses **6 blur bands**. Planes are grouped by distance and each band is blurred
  once. Planes crossing a band edge cross-fade between bands, so focus never jumps. Far planes fade
  in from the dark and near planes fade out just before the lens, so nothing pops.
* KaTeX HTML is rendered **once at module load** (`katex-cache.ts`), never per frame.
* The hand-drawn wobble is an SVG `feTurbulence` + `feDisplacementMap` with a **fixed seed**,
  applied once to the sharp band.
* The glow (navy version) is the stacked SVG filter `feGaussianBlur ×3 (1 : 4 : 12) → feMerge →
  SourceGraphic on top` in `src/common/GlowFilter.tsx`. It is applied in one pass over the middle
  bands, and the cores stay sharp.
* The light rays are soft conic-gradient wedges fanning from a point right of centre. They fade
  in away from that point, so there is no bright blob where they meet (the bloom was removed on
  request).
  They are screen-blended, so empty black stays `0,0,0`. See "Deviations" for why the rays use a
  gradient instead of an SVG blur.

### AI Code Screen
* `src/code-screen/code.ts` holds the code: an **original** binary search tree in Python (class,
  insert, search, find-minimum, in-order traversal) written for this project, plus a tiny
  highlighter.
* The code is one fixed block of lines repeated. It scrolls **exactly one block height per 600
  frames**, and line numbers repeat with the block, so the loop closes.
* Particle sphere: a seeded Fibonacci lattice of 2,600 points, one full turn per loop, drawn as 2D
  dots. Nearer dots are larger and brighter.
* The `AI` mark is upright plain sans (Inter SemiBold, capitals) with a violet → cyan
  gradient and the stacked glow.
* Prompt bar: `Type your prompt`, with a cursor that blinks 20 times per loop (15 frames on,
  15 off), computed from the frame.
* Camera: a slow closed elliptical slide along the screen.
* **Tilt-shift:** the whole screen is rendered **4×** with increasing blur. Radial gradient masks
  blend from sharp (middle of the code) to heavy blur (top, bottom and right).

### Balance Screen
* `src/balance-screen/data.ts`: figures, currency and timing.
* Frames 0–30 hold, 30–210 count with ease-out (fast first, slowing into the end value),
  210–299 hold.
* Every digit uses tabular figures (`font-variant-numeric: tabular-nums` in Inter). The figure is
  **right-anchored at a fixed point**, so the decimals and `USD` never move. Thousands separators
  are inserted by `formatCents()` for every value.
* Tilt-shift: 4 copies with masks. The balance figure is the sharpest thing in the frame.
* Camera: a very slow straight push-in only, linear over the 10 s.
* The phone is a generic black slab with a thin warm metallic rim, with no model-specific details.

---

## How to change things

| What | Where |
|---|---|
| **Formula list** | `src/equation-flight/formulas.ts`. Add or remove KaTeX strings. `star: true` makes a formula repeat more often. The field rebuilds from the same seed. |
| Field density, depth, tilt | `src/equation-flight/field.ts` (`FORMULAS_PER_BLOCK`, `GRAPHS_PER_BLOCK`, `BLOCK_DEPTH`). Keep the total at about 150–250 planes (×3 blocks) for render time. |
| **The code** | `src/code-screen/code.ts` → `CODE`. Any length works, because the scroll distance is derived from the line count. Keep a blank last line so the repeat reads naturally. |
| Code colours | `src/code-screen/themes.ts` (`DARK`, `LIGHT`). |
| **Balance figures** | `src/balance-screen/data.ts` → `BALANCE_VERSIONS` (amounts in **cents**). |
| **Currency** | the `currency` field of each row in `BALANCE_VERSIONS`. To add a EUR or GBP version, add a row (for example `drainEUR: { id: "BalanceScreen-Drain-EUR", startCents: …, endCents: 0, currency: "EUR" }`), extend the key type, and register it in `src/Root.tsx`. |
| Count timing | `COUNT_START`, `COUNT_END`, `DURATION` in `data.ts`. |

---

## Determinism rules (kept everywhere)

* Every value on screen is a function of `useCurrentFrame()` only.
* There is no `Math.random()`. Everything random comes from `mulberry32` seeded at **module level**.
* There are no CSS `@keyframes`, CSS transitions, `Date.now()`, `requestAnimationFrame`, or
  `useState` driving visuals. The blinking cursor and the counting number are inline styles
  computed from the frame.
* Grain is `feTurbulence` with `seed = frame % 600` on the loops (`seed = frame` on Balance Screen).
* Fonts load through `delayRender()` from `/public`, so no frame is ever captured with a fallback
  font.

## Verification

All checks below were run on the **encoded mp4 files** (and on PNG frames for the byte-level
tests). The script is `python3 scripts/verify_previews.py out/previews`.

| Step | Check | Result |
|---|---|---|
| 1 | 1920×1080, 30/1, h264, yuv420p, 20.0 s / 10.0 s, no audio stream | **PASS** for all six |
| 1 | EquationFlight_Black empty areas are exactly 0,0,0 after decoding | **PASS**: the darkest 2% of pixels are 0 in frames 0, 150, 300, 450 and 599 (39–48% of each frame is exactly 0,0,0) |
| 3 | Loop: frame 600 = frame 0 (601-frame test composition) | **PASS**: PNGs byte-identical for all four loops |
| 4 | Determinism: frame 150 rendered alone from a cold start vs frame 150 from a 4-thread `--sequence` render of frames 140–160 | **PASS**: byte-identical for all six |
| 4 | Source grep for `@keyframes`, `transition`, `Math.random`, `Date.now`, `requestAnimationFrame`, `useState` | none present |
| 5 | Frame 150 at 1080p vs 4K (downscaled) | **PASS**: same layout and text proportion, graph axes and borders visible in both; correlation 0.989 / 0.998 / 0.998 |
| 6 | Banding (see below) | **PASS** |
| 7 | Look 1: ≥3 blur levels, a readable formula in every sampled frame, parallax, no popping (30 consecutive frames: frame-to-frame change in the far region 3.2–3.5, max/median 1.03), rays no brighter than the equations | **PASS** |
| 7 | Look 2: sharp centre → soft edges with no hard seam, code scrolls, AI inside the rotating sphere, `Type your prompt` bar, cursor on at frame 0 and off at frame 15, 2B light and readable | **PASS** |
| 7 | Look 3: 3A frame 0 = `230,908.43 USD`, frames ≥210 = `0.00 USD`; 3B frame 0 = `0.00 USD`, frames ≥210 = `248,560.00 USD`; separators correct mid-count (`75,249.81`, `3,045.57`, `167,557.79`, `245,281.61`); adjacent-frame overlay shows no sideways digit shift; the figure is the sharpest element | **PASS** |

## Banding check

Frame 150 was extracted from the encoded mp4 and read along the smoothest gradient, with rows
averaged to remove grain:

* **EquationFlight-Navy**, navy background toward the right edge: 51.9 → 44.0 → 40.4 → 36.7 → 36.0 → 34.5 → 32.6 → 31.2 → 30.6 → 29.7 → 28.6 → 27.1 → 25.7, with a largest smoothed step of 0.39 levels. Monotonic, with no plateau-then-jump.
* **AICodeScreen-Dark**, blue screen area: values change by at most 0.19 levels per pixel (smoothed), with no steps.
* **AICodeScreen-Light** and **BalanceScreen**: smooth, with steps of at most 1.4 levels and no plateaus.

Contrast-stretched crops of the same areas show no contour lines. Grain is 1.8–2.2%, from
`feTurbulence` with a per-frame seed (`frame % 600` on the loops). EquationFlight-Black has **no
grain**, so its black stays 0,0,0.

## Loop check (how to repeat it)

```bash
npx remotion still src/index.ts EquationFlight-Black out/loop0.png   --frame=0   --scale=0.5 --props='{"variant":"black","loopCheck":true}'
npx remotion still src/index.ts EquationFlight-Black out/loop600.png --frame=600 --scale=0.5 --props='{"variant":"black","loopCheck":true}'
cmp out/loop0.png out/loop600.png && echo identical
```

`loopCheck: true` makes a looping composition 601 frames long, for this test only.

---

## Licences

* **Inter**: SIL Open Font License 1.1, © The Inter Project Authors. `public/fonts/inter/OFL.txt`
* **JetBrains Mono**: SIL Open Font License 1.1, © The JetBrains Mono Project Authors. `public/fonts/jetbrains-mono/OFL.txt`
* **KaTeX** (library and CSS): MIT, © Khan Academy and contributors. `public/katex/LICENSE.txt`
* **KaTeX fonts** (`public/katex/fonts`): SIL Open Font License 1.1 (KaTeX font project).
* **Remotion**: see https://remotion.dev/license. Some companies need a Remotion company licence to render.

## Originality

* **All code text shown in AI Code Screen was written for this project.** None of it is copied
  from any repository.
* **All interface designs** (editor layout, sidebar, prompt bar, banking screen) were designed for
  this project. They contain no real product, bank, app or company names, no logos, no account or
  card numbers, and no copy of a real editor theme or banking app.
* The `AI` mark is plain upright Inter capitals, not a stylised product icon.
* The phone is a generic rounded black slab with a thin metallic rim, not a real phone model.
* Equations are standard textbook formulas (public knowledge), typeset with KaTeX.

## Deviations from the brief

* **Light rays** use soft conic-gradient wedges, not an SVG-blurred group with the stacked glow.
  The SVG version cost about 9 s/frame at 1080p on its own. The wedges are soft by construction.
  The stacked 1 : 4 : 12 glow is used on the navy equations and the AI mark, as specified.
* **Hand-drawn wobble** is one fixed-seed displacement pass over the sharp depth band, not one
  filter per plane, for speed. Because the pass is in screen space, strokes shimmer very slightly
  as they travel. The blurred bands don't need it.
* **EquationFlight-Black black level:** the dense blurred depth left a faint 1–3/255 haze over
  "empty" areas. A levels crush (≤ 3.5/255 → 0) is applied to the black version only, so empty
  black is exactly 0,0,0 for screen-blend use.
* **GL renderer:** SwiftShader (`remotion.config.ts`). It measured about 2× faster than the
  default here. Use the same renderer for every render of a clip.
* **Known differences from the reference clips** that remain after the side-by-side reviews,
  kept on purpose because the brief requires them:
  * AI Code Screen uses **JetBrains Mono** with line numbers. The reference uses a bold
    proportional sans with no gutter.
  * AI Code Screen also blurs toward the **top and bottom**, as the brief asks. The reference
    keeps the whole code column sharp.
  * AI Code Screen has the **"Type your prompt"** bar, which the reference does not show.
  * Balance Screen uses **Inter**. The reference uses a wider Verdana-like face.
  * Equation Flight uses typeset KaTeX with a slight chalk weight and wobble. The reference's
    lettering is more hand-written.


### Step 8: differences still open after three fix rounds

A fresh reviewer compared one final frame per look with the reference. These differences remain.
They were **not fixed** because each look has had its three attempts:

* **Equation Flight:** the reference has a large blown-out light bloom. Ours has none, because
  it was removed on request. The reference is blurrier overall (about half the frame
  is bokeh; ours is about 30–40%). Its tunnel perspective is steeper, and its lettering is
  hand-drawn chalk where ours is typeset KaTeX. The reference also has a large parabola and
  bar-like shapes in the foreground.
* **AI Code Screen:** the reference's particle orb is denser and brighter, with a glowing
  magenta ring. Ours is sparser and fainter. The reference has a blurred top menu bar, and its
  sharp band is narrower. Text size was judged differently in each round (too large, then too
  small, then too large), because the reference camera moves and each round compared against a
  different reference frame.
* **Balance Screen:** the reference tilt is milder (heading at about 9° vs about 17° here), and
  the screen fills more of the frame. The reference bezel is a thick gold band with a warm
  bloom, and it shows a strip of screen below the button. The reference digits are slightly
  smaller (about 9% of frame height vs about 11%) and set in a wider, heavier face.

## Completion checklist

- [x] Six compositions, 3840×2160, 30 fps, sizes as fractions of the frame
- [x] Looks 1 and 2: 600-frame seamless loops (frame 600 ≡ frame 0, byte-identical)
- [x] Look 3: 300 frames, one-way, **not a loop**
- [x] No `@remotion/three` and no WebGL. CSS 3D only.
- [x] KaTeX rendered once at module load. Fonts (Inter, JetBrains Mono, KaTeX) shipped in `public/`.
- [x] Seeded `mulberry32` at module level. No `Math.random`, `@keyframes`, transitions, `Date.now`, rAF or `useState` visuals.
- [x] Determinism: frame 150 cold == frame 150 from a multi-thread render, byte for byte
- [x] Glow: stacked SVG blur ×3 (1 : 4 : 12) with the SourceGraphic on top
- [x] Grain 1.8–2.2% from `feTurbulence` with a fixed seed per frame. None on the black version.
- [x] 1A black is 0,0,0 in the encoded file
- [x] Banding checked on the encoded mp4
- [x] Six 1080p previews (H.264, yuv420p, CRF 16, 30 fps, no audio) plus a 1080p still of each
- [x] 18 stills at 6000×3375 (3 per composition)
- [x] No real product, bank, app or company names or logos. Code and interface designs are original. Generic phone.
- [x] Side-by-side comparison by a separate reviewer (three rounds per look). **Open differences are listed above. Not every difference was closed.**
- [x] `npm install && npx remotion studio` works from a clean copy
