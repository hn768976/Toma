# Zoom City

A 4K, seamlessly looping "zoom-blur city" animation in Remotion, in three
versions. The frame is a radial motion blur: every element is drawn as a long
tapered streak running outward from a vanishing point, growing longer, wider
and faster as it goes, then dissolving near the frame edge and recycling to a
new angle. 2D canvas only — no 3D and no Three.js.

| Composition | Version | Vanishing point | Streaks | Floor |
| --- | --- | --- | --- | --- |
| `ZoomCityViolet` | v1 — centred, dense, wet floor | 50% × 62% | ~2600 | wet: 35% reflection with a pronounced vertical smear |
| `ZoomCityAmber` | v2 — off-centre, sparser, dry floor | 34% × 58% | ~1500, wider and brighter | dry: 15%, heavily blurred into a soft glow |
| `ZoomCityMono` | v3 — monochrome, no floor, high horizon | 50% × 45% | ~4000, thinner and dimmer | none |

All three are 3840 × 2160, 300 frames at 30 fps (10.0 s), and loop: frame 300
is pixel-identical to frame 0.

## Run

```bash
npm install
npm run dev                       # Remotion Studio
```

## Render

```bash
# 4K
npx remotion render ZoomCityViolet out/zoomcity-violet.mp4 --codec=h264 --crf=12 --concurrency=8

# 1080p preview
npx remotion render ZoomCityViolet out/zoomcity-violet-preview.mp4 --codec=h264 --crf=18 --scale=0.5 --concurrency=8
```

`--concurrency` must not exceed the machine's CPU core count.

The previews in `renders/` were produced with the 1080p command above.

## Layout

Every frame is a pure function of `useCurrentFrame()` — no `Date.now()`, no
`requestAnimationFrame`, no CSS animation, no component state — so rendering is
deterministic and frames can be produced out of order across workers. All
randomness comes from Remotion's `random()` with stable string seeds.

- `src/zoom-city/variants.ts` — the only place a colour or a per-version
  parameter is defined. No hex literal exists anywhere else.
- `src/zoom-city/streaks.ts` — the streak model and the tapered, gradient-filled
  quads that make a streak read as motion blur rather than as a line. The radius
  over a cycle is exponential, which is what makes speed proportional to radius.
- `src/zoom-city/angular.ts` — the uneven angular distribution, built as a seeded
  density and inverted through its CDF: dense fans and sparse sectors rather than
  an even sunburst. The density is pulled towards the horizontal, which opens a
  dark cone above the vanishing point and packs the light into left and right
  walls, and the streaks inside each cell are collapsed into bundles — the sheets
  of parallel filaments a real radial blur produces.
- `src/zoom-city/bursts.ts` — the burst schedule; gaps are normalised to tile the
  loop exactly, and every envelope is evaluated on `frame % 300`.
- `src/zoom-city/components/` — the stacked canvas layers.

The streak field is drawn once per frame into its own canvas; the floor
reflection and the bloom pass read that canvas back with `drawImage` instead of
redrawing the field.

Streak counts, widths, lengths, bundling and traversal speed were set by
measuring reference footage rather than by eye: the temporal decorrelation of
the render (how fast the frame turns over) and its line geometry were compared
against the reference clip and tuned to match.

## Standalone single-version projects

`python3 scripts/package-variant.py` rebuilds `zips/zoom-city-violet.zip`,
`zips/zoom-city-amber.zip` and `zips/zoom-city-mono.zip` — each a
self-contained, independently runnable project holding exactly one version,
with its own README and without `node_modules/`, `out/` or `.git/`.

## Verifying the loop

Temporarily raise `durationInFrames` to `LOOP_FRAMES + 1` for a composition,
render stills at frame 0 and frame 300 and compare them; they hash identically
for all three versions.
