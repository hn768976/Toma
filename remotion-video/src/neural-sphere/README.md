# Neural sphere

A 3D neural-network core: a white-hot sphere with branching digital filaments
radiating out of it, light nodes travelling along those filaments, and a dust
field behind. Rendered with three.js / WebGL through `@remotion/three`.

20s, 30fps, 600 frames, 16:9.

## Compositions

| ID                   | Resolution  | Colour        |
| -------------------- | ----------- | ------------- |
| `NeuralSphereBlue`   | 1920 x 1080 | electric blue |
| `NeuralSphereBlue4K` | 3840 x 2160 | electric blue |
| `NeuralSphereCyan`   | 1920 x 1080 | dark cyan     |
| `NeuralSphereCyan4K` | 3840 x 2160 | dark cyan     |

The 1080p and 4K entries render the *same* scene. Only `resolutionScale`
differs, and it scales the pixel-space quantities — filament ribbon width and
node point size — so line weight and dot size read identically at either
output size. Everything else lives in resolution-independent world units.

## Rendering

```console
npx remotion render NeuralSphereBlue4K out/blue-4k.mp4 \
  --codec=h264 --image-format=png --crf=15 --pixel-format=yuv420p
```

`--image-format=png` matters here: the default JPEG intermediate leaves
visible blocking in the dark background gradient.

## How it is built

`filaments.ts` grows each tendril by walking outward from the core one step at
a time, bending the heading a little on every step. The bend strength ramps up
with distance, so strands leave the core as a tight radial starburst and only
begin to curl once they are clear of it. Everything derives from a seeded PRNG
keyed on the filament index — Remotion renders frames out of order across
worker processes, so any value that isn't a pure function of (index, frame)
would flicker.

Three pieces then draw that data:

- **`FilamentLines`** renders the strands as camera-facing ribbons. GL lines
  can't go above 1px reliably, so each sample becomes two vertices that the
  vertex shader pushes apart perpendicular to the strand. The widening happens
  in *view* space rather than screen space — screen-space widening needs a
  perspective divide, and vertices behind the camera flip the sign of `w`,
  which threw straight streaks across the frame whenever a strand swept past
  the lens.
- **`TravellingNodes`** bakes the curves into a float texture (one row per
  filament, one texel per sample) so the shader can look up a position
  anywhere along a strand with no CPU work per frame.
- **`Core`** stacks additive camera-facing quads — disc, three halos, a
  star-burst — instead of running a post-process bloom pass. It renders
  identically on every worker and gives direct control over the balance.

`FilamentLines` and `TravellingNodes` share the `filamentWobble` GLSL function
from `shared-glsl.ts` verbatim. If the two ever disagreed, the dots would
visibly float off the strands they ride.
