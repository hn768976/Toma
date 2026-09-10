# AI Hub Network

A seamlessly looping radial-hub motion graphic: a ringed centre disc
carrying a gradient `Ai` mark, with straight glowing spokes running out
to icon nodes over a dark halftone field.

Two versions, same geometry:

| Composition ID | Look                                                      |
| -------------- | --------------------------------------------------------- |
| `V1-AIHubBlue` | Blue field, magenta-to-gold centre                        |
| `V2-AIHubTeal` | Teal field, cyan-to-white centre - cooler, more corporate |

Both are defined at **3840x2160, 30fps, 300 frames (10s)**.

## Setup

```console
npm install
npm run dev        # opens Remotion Studio
```

## Rendering

**4K master** (what the compositions are authored at):

```console
npx remotion render V1-AIHubBlue out/V1_AIHubBlue.mp4 --scale=1 --crf=16
npx remotion render V2-AIHubTeal out/V2_AIHubTeal.mp4 --scale=1 --crf=16
```

Also available as `npm run render:v1` / `npm run render:v2`.

**1080p preview** - same compositions, rendered at half scale:

```console
npx remotion render V1-AIHubBlue out/V1_AIHubBlue.mp4 --scale=0.5 --crf=18
```

**Still frame:**

```console
npx remotion still V1-AIHubBlue out/V1_AIHubBlue.png --frame=90 --scale=0.5
```

Output is H.264 / `yuv420p` with no audio track, set in `remotion.config.ts`.

## How it is put together

Everything is SVG. The composition renders into a single `<svg>` whose
viewBox is centred on the origin and one unit tall, so **every dimension
in the source is a fraction of the frame height** - the same numbers
drive the 1080p preview and the 4K master with nothing to keep in sync.

- `constants.ts` - timing, hub geometry, the two palettes.
- `network.ts` - spoke angles, node radii, sizes, icon and pulse
  assignment. Generated **once at module load** from a seeded PRNG and
  then relaxed so no two node discs collide; per frame only rotation and
  pulse phase are recomputed.
- `halftone.ts` - the background dot field, bucketed into six shimmer
  groups so ~2.5k dots cost six DOM nodes instead of 2,500.
- `icons.ts`, `ai-mark.ts`, `svg-shapes.ts` - the icon set and the `Ai`
  letterforms, drawn as our own path data. No icon library and no font
  glyphs, so the clip carries no third-party attribution requirement.
- `Grain.tsx` - ~2% film grain. Without it the wide gradient behind the
  hub bands visibly once H.264 gets hold of it.

### The loop

Frame 300 lands exactly back on frame 0 by construction, not by
crossfade. Every animated quantity is a function of `frame / 300` that
is periodic over that span: sines take a whole number of cycles, the hub
layers turn a whole number of times (`+1`, `-2`, `+3`, so they visibly
counter-rotate), and each spoke's pulse makes a whole number of trips.
Nothing reads state, and nothing calls `Math.random()` at render time -
Remotion renders frames out of order across worker threads, so anything
that isn't a pure function of `(frame, index)` would flicker.

Grain is the one deliberate exception: it is re-seeded per frame, which
is what grain is supposed to do.
