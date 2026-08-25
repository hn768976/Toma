# Code Flythrough

A 4K, seamlessly looping camera move through a 3D field of drifting code
fragments, chatbot icons and binary strings. Built in Remotion, drawn to a
single `<canvas>`.

Two cuts of the same shot:

| composition | palette | tilt | length |
| --- | --- | --- | --- |
| `CodeFlythrough` | dark teal | -28° | 540 frames — 9.0s |
| `CodeFlythroughBlue` | dark blue | 0° — straight | 600 frames — 10.0s |

Both are 3840 x 2160 at 60fps, and both close exactly: the last frame is
pixel-identical to the first.

Palette, tilt and length are the only things that differ. They live in
`variant.ts`, and everything tilt implies — the axis the field is rotated to,
the axis it drifts along, how far the frame projects onto each axis, which way
the handheld camera drifts — is derived from the one angle rather than restated.
At 0° the shared axis is horizontal, so the blue cut reads left and drifts
straight across, and the camera drift becomes vertical.

Adding a third cut is a palette, an angle and a frame count.

![teal cut](docs/still.png)
![blue cut](docs/still-blue.png)

---

## Running it

```bash
npm install
npm run dev            # Remotion Studio
npm run render         # 4K master of the teal cut, h264, crf 12
npm run render:blue    # 4K master of the blue cut
npm run verify-loop    # proves both cuts' loops are pixel-identical
npm run typecheck
```

The render command in full:

```bash
npx remotion render CodeFlythrough     out/code-flythrough.mp4      --codec=h264 --crf=12 --concurrency=8
npx remotion render CodeFlythroughBlue out/code-flythrough-blue.mp4 --codec=h264 --crf=12 --concurrency=8
```

Low CRF on purpose: fast motion plus fine text is close to a worst case for
h264. For a 1080p preview add `--scale=0.5`.

If you already have a Chrome headless shell on the machine and would rather not
let Remotion download its own, pass `--browser-executable=<path>` (the loop
verifier reads the same path from `REMOTION_BROWSER_EXECUTABLE`).

---

## How it works

### Faked 3D

There is no Three.js here. Depth is a single number per element,
`z ∈ [0.15, 1.0]`, and everything else falls out of it:

| derived from z | near (z → 1.0) | far (z → 0.15) |
| --- | --- | --- |
| `scale = z * 3.6` | large | small |
| `speed = z * 48` px/frame | fast | slow |
| blur | up to 38px | up to 5px |
| opacity | down to ~0.46 | down to ~0.29 |

Blur is zero only inside a deliberately narrow band around `z = 0.42`. That band
holds roughly a fifth of the field, so at any moment only about 20% of what is on
screen is crisply readable — which is what makes the shot read as photographed
rather than as a text animation. Everything else is either a soft foreground
shape sweeping past the lens or dim distant texture.

### The shared axis

Every element is rotated to exactly the same angle and drifts along that same
axis. There is no per-element rotation jitter: `ROT_JITTER_DEG` is 0, because at
this density any spread at all stops reading as life and starts reading as
inconsistency. The single shared angle is what makes the field cohere into a
stream instead of scattered debris — which is as true at 0° as it is at -28°.

### The hero fragments

Two of the fragments are heroes: large, sharp, on the shared tilt, and unlike
everything else in the shot they do not drift at a constant rate. A hero comes
in quickly, eases to a dead stop in the middle of frame, finishes writing itself
while stationary, sits there a beat, then accelerates away.

Its **last two lines** type themselves out behind a blinking caret:

```
// ai chatbot                     already written
<script>                          already written
function replyStream(txt) {       already written
  document.getElementById("chat")   types out
    .innerHTML = txt;               types out
```

Splitting the call across two lines is what keeps the block tidy — no line runs
more than about a word past the one above it (27 → 33 → 21 characters), so it
holds its shape all the way through instead of growing a long tail off one edge.

Heroes are the one population drawn live instead of from a cached sprite, since
their content changes every frame. That costs nothing: two elements, five short
lines, no blur, no filter.

**The stop.** Velocity is a smoothstep of how far the crossing clock is from its
middle — zero across the stop window, rising to a peak at either end. That peak
lands on the wrap, where the hero is off frame, so the fast part is never seen
and the slow part is the whole readable pass. Roughly 49px/frame on the way in,
0 at centre, 13px/frame through the readable zone.

The hold is specified in **seconds**, not as a fraction of the crossing, and each
cut converts it to its own fraction. 1.3s in a 9-second cut and 1.3s in a
10-second one. As a fraction it would stretch with the cut, and a longer edit
would sit on the hero far too long.

The position curve is the integral of that velocity, normalised so a crossing
still advances exactly 1 — the stop redistributes time *within* a crossing
without adding or removing any, which is what keeps the loop exact.

**The typing** is keyed to the crossing clock rather than to the hero's
position, so the writing carries on at its steady rate straight through the stop
instead of freezing with it. It is timed to finish just as the hero settles.

Both are functions of the crossing rather than of a wall clock, so they loop for
free: at frame 540 a hero is back at its frame-0 crossing position and therefore
at its frame-0 characters. The caret blink is on a 36-frame period, and
540 / 36 = 15. The two heroes cross once each per loop, half a loop apart, so
they take turns being the one that stops.

### Determinism

Every value comes from Remotion's `random()` with a stable string seed — no
`Math.random()`, no `Date.now()`, no `requestAnimationFrame`, no CSS animation,
no component state driving motion. The canvas is drawn once per React render
inside `useLayoutEffect`, so each frame is a pure function of the frame number
and `npx remotion render` is reproducible.

The monospace face is vendored under `public/fonts` rather than fetched, so a
render needs no network at all. See `src/CodeFlythrough/font.ts` to switch back
to `@remotion/google-fonts`. Either way a `delayRender()` handle is held until
the font has loaded *and* the first frame has actually rastered, so nothing is
ever captured half-drawn.

### Why it is fast

The naive version of this shot costs about 600 large scaled `drawImage` calls
and several 4K canvas filters per frame. Three things fix that, and together
they took it from ~13s to ~2.3s per frame:

- **Sprites are built once.** An element's rotation, depth blur and colour never
  change, so the text is laid out and rasterised a single time into a small
  offscreen canvas. Per frame it is one blit. (The two hero fragments are the
  deliberate exception - they retype themselves, so there is nothing to cache.)
- **Motion blur is baked in.** Speed is constant per element, so the 3–5 offset
  copies that make the directional smear are composited into the sprite when it
  is built instead of being redrawn 540 times.
- **Bloom filters run small.** The frame is downscaled unfiltered first; the
  bright-pass and blur then happen at an eighth and a twentieth of full
  resolution. The vignette, which never changes, is a cached layer.

Sprites are rasterised at a resolution chosen from how blurred they will end up
— a heavily blurred foreground element is rendered small and upscaled, which is
invisible once it is 38px soft — and capped by area so memory stays bounded.

---

## Layout

```
src/
  index.ts                    registerRoot
  Root.tsx                    <Composition id="CodeFlythrough" ...>
  CodeFlythrough/
    index.tsx                 the component: font gate, memoised field, one draw per render
    constants.ts              geometry, depth curve, palette, population sizes
    field.ts                  seeded generation of every element
    snippets.ts               the fictional code fragments
    sprites.ts                offscreen rasterisation, motion smear, grain, scratch surfaces
    draw.ts                   the per-frame blit loop and the post chain
    font.ts                   font loading, local or CDN
    variant.ts                the cuts: palette, tilt, length, derived geometry
public/fonts/                 vendored Roboto Mono (Apache-2.0)
scripts/verify-loop.mjs       loop proof
```

---

## Content

All code fragments are invented for this animation — the function names,
comments, ids and DOM calls are fictional. No real library source, no copyright
header, no real logo or wordmark, no watermark, no audio.
