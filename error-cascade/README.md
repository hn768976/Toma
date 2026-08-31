# Error Dialog Cascade

A 4K Remotion piece in two versions: one dialog box repeating until it buries
the frame. Both versions come out of this single source tree — `variant`
selects a whole palette, a whole dialog style and a whole spawn curve out of
`VARIANTS` in `src/config.ts`, and nothing else differs between them.

| Composition | Look | Structure |
| --- | --- | --- |
| `ErrorCascadeLight` | Pale dialogs, blue title bar, red icon, on pure black | A smooth acceleration — a leak that becomes a flood |
| `ErrorCascadeDark` | Dark dialogs, red-orange title bar, amber icon, on near-black | Bursts with silences between them — repeated attacks |

Both are 3840x2160, 600 frames at 30 fps (20.0 s), and **neither loops**:
dialogs accumulate and nothing ever closes or fades, so frame 0 and frame 599
differ entirely by design.

## Running it

```bash
npm install
npm run dev                     # the Remotion studio

# 1080p previews
npx remotion render ErrorCascadeLight out/error-light-preview.mp4 --codec=h264 --crf=18 --scale=0.5
npx remotion render ErrorCascadeDark  out/error-dark-preview.mp4  --codec=h264 --crf=18 --scale=0.5

# full 4K
npx remotion render ErrorCascadeLight out/error-cascade-light.mp4 --codec=h264 --crf=14 --concurrency=8
npx remotion render ErrorCascadeDark  out/error-cascade-dark.mp4  --codec=h264 --crf=14 --concurrency=8
```

`--concurrency` must not exceed the machine's CPU core count.

## Shipping the two bundles

```bash
node scripts/package.mjs
```

Writes `dist/error-cascade-light/` and `dist/error-cascade-dark/`, each a
self-contained project holding only that one version, plus a zip of each.
Everything variant-specific in `src/config.ts` and `src/Root.tsx` is fenced
with `>>> tag:name` / `<<< tag:name` comments; the script drops the other
variant's fences and then strips the surviving fence comments, so the shipped
code reads as if it had only ever had one variant. The bundles are verified to
render byte-identical frames to this tree.

`deliverables/` holds the built zips and the two 1080p previews.

## How it works

- **Deterministic by construction.** Every value on screen is a pure function
  of `useCurrentFrame()`, and all randomness goes through Remotion's `random()`
  with stable string seeds. No `Math.random()`, no `Date.now()`, no
  `requestAnimationFrame`, no CSS animation, no component state. Seeking to
  frame 437 gives the same image as playing up to it, byte for byte.
- **One sprite, many blits.** The dialog is drawn once into a small offscreen
  canvas; each of the several hundred on-screen dialogs is one `drawImage`
  under a translate/rotate/scale. Re-drawing border, title bar, icon and text
  per dialog per frame at 4K would not render in reasonable time.
- **The spawn curve is data.** `src/config.ts` describes it as segments and
  `src/spawn-curve.ts` resolves them into `spawnsAtFrame(frame)` by
  integer-differencing a cumulative function, so fractional rates ("one every
  20 frames") and exact segment totals ("40 dialogs across 30 frames") both
  come out of one code path. Reshaping a version never touches spawn logic.
- **Placement is jittered-stratified.** The frame is divided into cells small
  enough that a dialog dropped anywhere inside one still reaches its
  neighbours, so once every cell is claimed the background is completely
  buried. v1 visits cells centre-outward; v2 claims a compact blob of cells per
  burst, each burst opening on ground no earlier burst has taken. Uniform
  random sampling leaves holes that no realistic dialog count closes.
- **Generic dialog.** Square corners, thin flat border, flat solid title bar,
  bare close glyph, invented error icon. Deliberately not a reproduction of any
  real operating system.
- **No network at render time.** The UI sans is vendored into `public/fonts/`
  and registered through the FontFace API behind `delayRender()`.
