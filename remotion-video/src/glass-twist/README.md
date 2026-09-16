# Glass twist

A seamlessly looping 3D motion graphic: a long stack of glass rods, each
bent into a closed rounded rectangle, threaded along one axis with a
fixed rotation between neighbours so the stack reads as a helical twist.
Built with three.js (WebGPU) and rendered through Remotion.

Two colour variants ship, identical in geometry and motion:

| Variant | Composition (1080p) | Composition (4K) | Look |
| --- | --- | --- | --- |
| `emerald` | `GlassTwistEmerald` | `GlassTwistEmerald4K` | Green glass, axis running lower-left to upper-right |
| `azure` | `GlassTwistAzureMirror` | `GlassTwistAzureMirror4K` | Electric azure glass, true mirror image of the above |

All four are 600 frames at 30fps (20s), 16:9.

## Rendering

```console
npx remotion render GlassTwistEmerald out/emerald-1080p.mp4 --codec=h264 --crf=16
npx remotion render GlassTwistEmerald4K out/emerald-4k.mp4  --codec=h264 --crf=16
```

On a machine without a GPU, add `--gl=angle`.

4K is the same code at twice the resolution — everything that could look
resolution-dependent (bloom radius, geometry, camera) is expressed in
normalised or world units, so the two sizes stay visually identical.

## How the loop works

The stack is an infinite helix sampled into `PLATE_COUNT` bars. Bar `k`
sits at `z = (k + u) * PLATE_SPACING` and is rotated `(k + u) *
TWIST_PER_PLATE` about the axis, where `u` is a single animated scalar.

Advancing `u` by exactly 1 moves every bar into the position its
neighbour just vacated, so the image is unchanged. That means only the
*fractional* part of `u` is ever needed: the stack stays centred, the
pattern flows through it, and the last frame joins the first with no
seam and no drift. `LOOP_ADVANCE_PLATES` sets how many notches pass in
one loop, and so sets the apparent speed. Any integer loops cleanly;
a non-integer will not.

The travelling bend is a function of world `z` plus a phase that
completes exactly one cycle per loop, so it is seamless for the same
reason.

## Gaps and transparency

These two are coupled, and the coupling is the whole reason the glass
reads as glass.

The bars are alpha-blended, not opaque, so you can see through the near
side of a loop to its far side and through each bar to the ones behind
it. That only holds while the bars are spaced well apart. At a tight
pitch roughly twenty loops overlap on screen at once, blending them
stops reading as depth, and the image collapses into a wiry lattice --
which is why an earlier pass rendered them opaque instead. Widening
`PLATE_SPACING` is what buys the transparency back.

Two knobs matter beyond spacing:

- **Ambient floor.** The studio's "dark" stops are a dim blue-grey
  rather than true black. With pure black, any surface not catching a
  highlight is completely unlit and reads as near-opaque dark material.
  A low floor lights the glass all over so it looks transparent; too
  high a floor flattens the contrast and it turns frosted.
- **Loop advance.** Notches are measured in plate spacings, so widening
  the gaps without changing `LOOP_ADVANCE_PLATES` speeds the on-screen
  travel by the same factor. The two are scaled together to hold the
  travel speed fixed and change only the density.

Blending needs the bars drawn back to front, which `updateInstances()`
handles; see the note there on why the order is derived from the axis
rather than hard-coded.

## Mirroring

The `azure` variant is a true reflection about the vertical axis, not a
re-aimed camera. Three things flip together:

1. the stack's yaw, so the axis runs the other way across frame;
2. the twist step's sign, reversing the helix's handedness;
3. the environment map, so highlights fall on the mirrored side.

Flipping only the first would read as a different shot of the same
object.

## Renderer

The scene is built on `WebGPURenderer` from `three/webgpu`, WebGPU first
with a fall back to three's WebGL2 backend.

The fallback is not just a capability check. A browser can report a
WebGPU adapter and let `renderer.init()` succeed, then fail on the first
real render because its WebGPU implementation and three's disagree.
`TwistScene.init()` therefore builds the scene *and* renders a probe
frame inside a try, and only a clean frame counts as success; anything
else tears down and rebuilds on WebGL2. `scene.backend` reports which
one won. On a GPU-less render box this lands on WebGL2.

### Why frames are read back instead of screenshotted

Frames are rendered into a `RenderTarget`, read back with
`readRenderTargetPixelsAsync`, and painted onto a plain 2D canvas that
Remotion screenshots.

The direct routes do not work. Letting Remotion screenshot the
WebGL/WebGPU canvas, and copying that canvas with `drawImage`, both hand
back a stale frame: three renders through internal framebuffers, and what
reaches the canvas and the compositor is a frame behind. It fails
quietly and convincingly — every still comes out as frame 0, and the
video looks animated but sits one frame late. Neither
`preserveDrawingBuffer` nor forcing the GPU to finish fixes it, because
the lag is in presentation, not in GPU completion.

Reading the render target takes the canvas and the browser's compositor
out of the loop, so the frame Remotion captures is the frame that was
asked for. The two backends disagree on row order — the WebGL path ends
in `gl.readPixels` (bottom-up) while WebGPU copies the texture
(top-down) — so the readback flips rows when running on WebGL2.

## Tuning

`glassTwistSchema` exposes an optional `tuning` object overriding camera,
twist, spacing and plate size. It exists so framing can be swept from the
CLI or the Studio without a rebuild:

```console
npx remotion still GlassTwistEmerald out/test.png --frame=0 --scale=0.4 \
  --props='{"variant":"emerald","tuning":{"cameraDistance":7,"twistPerPlate":0.14}}'
```

Production renders leave it unset; every value defaults to `constants.ts`.
