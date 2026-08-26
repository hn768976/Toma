# Code Tunnel Title

A 4K "code tunnel title card": the camera flies into a perspective corridor of
fictional JavaScript while the title stays locked, dead centre, in screen space.
Built with [Remotion](https://remotion.dev) v4 and rendered entirely to a single
`<canvas>`.

## The composition

| | |
| --- | --- |
| Composition id | `CodeTunnelTitle` |
| Resolution | **3840 × 2160 (4K)** |
| Duration | 600 frames |
| Frame rate | 30 fps (20.0 s) |
| Title | a **prop** — `defaultProps={{title: 'WEB 3.0'}}` |

Every size, stroke weight and blur radius in `src/CodeTunnelTitle/` is authored
for 3840 × 2160. Preview renders use the *same* composition scaled down with
`--scale`; nothing in the code changes between a preview and the 4K master.

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
# 1080p preview from the same 4K composition (~a quarter of the time)
npx remotion render CodeTunnelTitle out/code-tunnel-preview.mp4 \
  --codec=h264 --crf=18 --scale=0.5 --concurrency=8

# full 4K master
npx remotion render CodeTunnelTitle out/code-tunnel-4k.mp4 \
  --codec=h264 --crf=12 --concurrency=8
```

## Changing the title without editing code

```bash
npx remotion render CodeTunnelTitle out/other.mp4 \
  --props='{"title":"AI 2026"}'
```

Anything reasonably short works; the type is measured and centred at render
time, so the tracking and the chromatic fringes follow whatever word you pass.

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
* **Cost.** Each of the 50 code blocks is laid out **once** into its own
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
  Root.tsx                       the <Composition>
  CodeTunnelTitle/
    CodeTunnelTitle.tsx          the whole shot: tunnel, flight, title, finish
    blocks.ts                    one-time offscreen layout of the code blocks
    codegen.ts                   the fictional JavaScript generator
    glitch.ts                    seeded, clustered glitch schedule
    grain.ts                     seeded grain tiles
    palette.ts                   the cold blue-white ramp
    rand.ts                      seeded random helpers
```

No audio, no logos, no watermark, and no real library source — all of the code
on screen is invented by `codegen.ts`.
