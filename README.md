# Code Tunnel Title

A 4K "code tunnel title card": the camera flies into a perspective corridor of
fictional JavaScript while the title stays locked, dead centre, in screen space.
Built with [Remotion](https://remotion.dev) v4 and rendered entirely to a single
`<canvas>`.

## The compositions

Two variants, **one component**. They differ only by the `variant` prop, which
selects an entry of `THEMES` in `src/CodeTunnelTitle/themes.ts`. Motion, timing,
acceleration, recycling and the darkening are identical.

| | `CodeTunnelTitle` (v1) | `CodeTunnelTitleV2` (v2) |
| --- | --- | --- |
| Variant | `cold` (default) | `electric` |
| Default title | `WEB 3.0` | `NEURAL NETWORK` |
| Look | cold, desaturated, corporate blue — clinical | saturated electric blue — energetic |
| Fringes | red `#E02040` / cyan `#20D0E0` | hot pink `#FF2D6F` / cyan `#00E5FF` |
| Blocks on screen | 34 | 22 |
| Block pool | 50 | 34 |
| Code size at 4K | 26 px | 32 px |
| Chromatic offset | 7 px | 9 px |
| Glitch interval | 40–110 frames | 50–130 frames |
| Title cap height | 9 % of frame height | 7.5 %, fitted to a 62 % width ceiling |
| Letterspacing | 0.15 em | 0.09 em |

Both are **3840 × 2160**, 600 frames at 30 fps (20.0 s), and both take the title
as a **prop**.

`NEURAL NETWORK` is long enough that 7.5 % cap height with wide letterspacing
would carry it to about 70 % of frame width. `titleMaxWidthFraction` caps it at
62 %, scaling cap height and tracking together, so v2's type lands at an
effective ~7.1 % cap with roughly 19 % clear margin on each side. Shorter titles
are never enlarged — the ceiling only shrinks.

Every size, stroke weight and blur radius in `src/CodeTunnelTitle/` is authored
for 3840 × 2160. Preview renders use the *same* composition scaled down with
`--scale`; nothing in the code changes between a preview and the 4K master.

Every colour and every look-defining number lives in `THEMES`. Nothing outside
`themes.ts` hardcodes a colour, so a third variant is a new entry in that object
and a new `<Composition>` — no other file needs to change.

The piece is one shot, not a loop: the camera accelerates throughout and the
last ~120 frames dim progressively, so frame 0 and frame 600 differ by design.

## Fonts

The monospace face (JetBrains Mono) and the title face (Montserrat 800) are
fetched through `@remotion/google-fonts` on first run, so **the first render
needs network access**. Loading is gated with `delayRender()` /
`continueRender()`, so no frame is ever captured before the faces are ready.

## Install and preview

```bash
npm install
npx remotion studio                        # preview and tune
```

## Render

```bash
# 1080p previews from the same 4K compositions (~a quarter of the time)
npx remotion render CodeTunnelTitle out/code-tunnel-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8
npx remotion render CodeTunnelTitleV2 out/code-tunnel-v2-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# full 4K masters
npx remotion render CodeTunnelTitle out/code-tunnel-4k.mp4 \
  --codec=h264 --crf=12 --concurrency=8
npx remotion render CodeTunnelTitleV2 out/code-tunnel-v2.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

`--concurrency` must not exceed what your machine allows; Remotion caps it
against the CPU count and errors out rather than clamping.

## Changing the title without editing code

```bash
npx remotion render CodeTunnelTitle out/other.mp4 \
  --props='{"title":"AI 2026"}'

# either look, any title
npx remotion render CodeTunnelTitle out/other.mp4 \
  --props='{"title":"AI 2026","variant":"electric"}'
```

Any title works. The type is measured and centred at render time, so tracking
and the chromatic fringes follow whatever you pass, and a title longer than the
variant's width ceiling is scaled down as a whole — cap height and letterspacing
together — rather than being allowed to run into the frame edges.

## How it works

* **Determinism.** Every value comes from `useCurrentFrame()` and Remotion's
  seeded `random()`. There is no `Date.now()`, no `requestAnimationFrame`, no
  CSS animation and no animation state — each frame is a pure function of its
  frame number, so `npx remotion render` is reproducible.
* **Perspective.** A single vanishing point sits just below frame centre.
  Elements carry a depth `z`; `z = 1.0` is at the vanishing point and `z = 0.05`
  is the moment an element sweeps past the camera. Positions and sizes are
  divided by `z`, which is the entire perspective effect. When `z` reaches 0.05
  the element is recycled back to 1.0 with a freshly seeded position.
* **Cost.** Each code block is laid out **once** into its own
  offscreen canvas and then blitted with a transform every frame. Depth tint and
  depth blur are applied on a shared scratch canvas at *source* resolution, so a
  near block that fills the screen costs no more to blur than a distant one.
* **Motion blur** is radial — along each block's outward vector from the
  vanishing point — and only applies nearer than `z = 0.6`, where 30 fps would
  otherwise strobe.

## Layout

```
src/
  index.ts                       registerRoot
  Root.tsx                       both <Composition> registrations
  CodeTunnelTitle/
    CodeTunnelTitle.tsx          the whole shot: tunnel, flight, title, finish
    blocks.ts                    one-time offscreen layout of the code blocks
    codegen.ts                   the fictional JavaScript generator
    title.ts                     prerendered title layers + fit-to-width
    glitch.ts                    seeded, clustered glitch schedule
    grain.ts                     seeded grain tiles
    themes.ts                    THEMES: every colour and look-defining number
    rand.ts                      seeded random helpers
```

No audio, no logos, no watermark, and no real library source — all of the code
on screen is invented by `codegen.ts`.
