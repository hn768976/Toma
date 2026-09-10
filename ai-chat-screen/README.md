# AI Chat Screen — Remotion

A dark code editor typing a Python module on the left, with a large glowing
dotted orb labelled **AI / Chat** floating in open space on the right.

Two versions of the same build, differing only in the orb's gradient:

| Composition | Orb |
|---|---|
| `AIChatScreenCyan` | cyan `#22d3ee` → violet `#7a4ae8` |
| `AIChatScreenAmber` | amber `#f0a020` → deep orange `#e04a10` |

Both are **3840×2160, 30 fps, 600 frames (20s)**, and both hold rather than
loop: the code types on and stays, while the orb keeps turning.

## Install and preview

```console
npm install
npx remotion studio
```

## Render at 4K

The compositions are authored at 3840×2160, so `--scale=1` is a native 4K
render — no resampling.

```console
npx remotion render AIChatScreenCyan  out/V1_AIChatScreenCyan.mp4  --scale=1 --crf=16
npx remotion render AIChatScreenAmber out/V2_AIChatScreenAmber.mp4 --scale=1 --crf=16
```

### 1080p preview

```console
npx remotion render AIChatScreenCyan  out/V1_AIChatScreenCyan.mp4  --scale=0.5 --crf=18
npx remotion render AIChatScreenAmber out/V2_AIChatScreenAmber.mp4 --scale=0.5 --crf=18
```

### Stills

```console
npx remotion still AIChatScreenCyan  out/V1_AIChatScreenCyan.png  --frame=500 --scale=0.5
npx remotion still AIChatScreenAmber out/V2_AIChatScreenAmber.png --frame=500 --scale=0.5
```

Neither composition has an audio track, so the output files carry none.

## A note on `remotion.config.ts`

The config ends with a guarded fallback to a Playwright Chromium at
`/opt/pw-browsers/...`. That exists so the project renders inside sandboxed
CI images that block Remotion's own Chrome Headless Shell download. The
path is checked with `existsSync` first, so on an ordinary machine it does
not exist, the branch is skipped, and Remotion uses its own managed
browser. Delete those lines if you would rather not carry them.

## How it is built

**It is 2D.** The orb is a sphere's worth of points projected
orthographically — `x·cos θ + z·sin θ`, with depth driving opacity and dot
size — not a 3D scene. That keeps the code beside it real DOM text, which
is what makes it genuinely crisp rather than resampled off a texture.

- `src/orb/points.ts` — the point cloud, generated **once** at module scope
  from a seeded PRNG on a Fibonacci-sphere distribution. Sampling spherical
  coordinates at random instead clumps points at the poles, which is
  plainly visible on a rotating orb.
- `src/orb/Orb.tsx` — draws those points to a canvas that covers only the
  orb's bounding box, batching dots into (colour × alpha) buckets so a
  frame is a few hundred `fill()` calls rather than 3200. Bloom is a
  blurred copy of the same canvas screened back over the crisp one, so it
  is confined to the orb and never touches the code.
- `src/code/highlight.ts` — Prism tokenizes the Python module **once**, at
  module scope. Revealing the code is then just slicing an array; nothing
  is re-highlighted per frame.
- `src/code/schedule.ts` — when each line lands, and how far the view has
  scrolled, as pure functions of the frame. The rhythm is deliberately
  uneven: blank lines cost nothing, a new `def` gets a beat of hesitation,
  and some lines arrive in a burst.
- `src/fonts.ts` — JetBrains Mono and Inter are self-hosted in
  `public/fonts` and registered behind `delayRender()`. System fallbacks
  would change every glyph advance, and with it the caret position,
  between this machine and the render machine.

Everything animated is a pure function of `useCurrentFrame()`; there is no
component state and no timer anywhere, because Remotion renders frames out
of order across threads.

## Layout

`src/layout.ts` derives every measurement from the frame size given by
`useVideoConfig()`, so a `--scale=0.5` preview is the same picture as the
4K render, only smaller.

If the type ever has to give, **reduce the number of visible lines rather
than the type size** — legibility of the code is the point of the shot.
