# Equations, Code & Balance — Remotion project

Three looks × two versions = six compositions, all defined at **3840×2160, 30 fps**.

| Composition id | Look | Version | Length | Loops? |
|---|---|---|---|---|
| `EquationFlight-Black` | Equation Flight | white on pure black `#000000` (screen-blend overlay) | 600 f / 20 s | **yes** |
| `EquationFlight-Navy` | Equation Flight | pale cyan glow on deep navy | 600 f / 20 s | **yes** |
| `AICodeScreen-Dark` | AI Code Screen | dark royal-blue editor | 600 f / 20 s | **yes** |
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

__RENDER_TIMES__

## Motion blur

__MOTION_BLUR__

---

## How each look works

### Equation Flight
* `src/equation-flight/formulas.ts`: the formula list (KaTeX syntax).
* `src/equation-flight/field.ts`: the seeded field. One block of depth `D = 3700` holds 80 planes:
  66 "chalkboard lines" of one to four formulas each, plus 14 hand-drawn graphs (bell curves,
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
* The light rays are soft conic-gradient wedges fanning from a blown-out bloom right of centre.
  They are screen-blended, so empty black stays `0,0,0`. See "Deviations" for why the rays use a
  gradient instead of an SVG blur.

### AI Code Screen
* `src/code-screen/code.ts` holds the code: an **original** binary search tree in Python (class,
  insert, search, find-minimum, in-order traversal) written for this project, plus a tiny
  highlighter.
* The code is one fixed block of lines repeated. It scrolls **exactly one block height per 600
  frames**, and line numbers repeat with the block, so the loop closes.
* Particle sphere: a seeded Fibonacci lattice of 1,500 points, one full turn per loop, drawn as 2D
  dots. Nearer dots are larger and brighter.
* The `AI` mark is upright plain sans (Inter SemiBold, capitals) with a cyan → violet → pink
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

__VERIFICATION__

## Banding check

__BANDING__

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

__DEVIATIONS__

## Completion checklist

__CHECKLIST__
