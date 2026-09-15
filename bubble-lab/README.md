# Serum Bubbles — 15 cosmetic 3D motion graphics

Fifteen abstract skincare/serum bubble animations, rendered with **Remotion** +
**three.js / WebGL**. Each version is matched to one supplied reference clip:
same duration, same frame rate, same aspect.

- **30 fps**, **16:9**
- Master compositions: **3840 × 2160 (4K)**
- Delivered files: **1920 × 1080, H.264, MP4, CRF 16, yuv420p**
- No text, no logo — clean abstract plates

## The fifteen versions

| # | Composition id | Frames | Duration | Look |
|---|---|---|---|---|
| 01 | `v01-crystal-merge`    | 299 | 9.97s  | Clear glass bubbles gathering into a centre cluster, white |
| 02 | `v02-golden-elixir`    | 300 | 10.00s | Golden oil macro with a hero bubble |
| 03 | `v03-lavender-serum`   | 300 | 10.00s | Lavender macro hero bubble |
| 04 | `v04-champagne-rise`   | 360 | 12.00s | Cream bubbles rising, trapped micro-bubbles |
| 05 | `v05-amber-bloom`      | 250 | 8.33s  | Amber oil beads blooming outward to fill frame |
| 06 | `v06-aqua-gel`         | 300 | 10.00s | Dense blue gel spheres, macro |
| 07 | `v07-peach-nectar`     | 300 | 10.00s | Peach macro hero bubble |
| 08 | `v08-porcelain-drift`  | 300 | 10.00s | Blue-white droplets, heavy defocus |
| 09 | `v09-violet-gel`       | 300 | 10.00s | Dense violet gel spheres, macro |
| 10 | `v10-rose-quartz`      | 300 | 10.00s | Pink bubbles under shallow focus |
| 11 | `v11-rose-merge`       | 330 | 11.00s | Pink glass bubbles gathering, white |
| 12 | `v12-marine-swirl`     | 201 | 6.70s  | Pale blue bubbles churning in clear liquid |
| 13 | `v13-iridescent-orbs`  | 450 | 15.00s | Iridescent-rim soap bubbles on blue |
| 14 | `v14-cellular-pink`    | 241 | 8.03s  | Pink bubble-within-bubble biotech cells |
| 15 | `v15-magenta-churn`    | 281 | 9.37s  | Magenta bubbles swirling on pink |

Every id is registered twice: `<id>` is the 4K master and `<id>-1080p` the
delivery-size proxy. Both run the identical component.

## Running it

```bash
npm install
npm run dev                  # Remotion Studio — scrub any composition
npm run render:1080          # all 15 at 1920x1080 -> out/1080p
node scripts/render-all.mjs --4k          # all 15 at 3840x2160 -> out/4k
node scripts/render-all.mjs --only=v06    # a single version
```

Rendering one composition by hand:

```bash
npx remotion render v06-aqua-gel out/v06.mp4 --codec=h264 --crf=16
```

On a headless Linux box without a GPU, point Remotion at a headless shell and
force the ANGLE backend:

```bash
npx remotion render v06-aqua-gel out/v06.mp4 \
  --gl=angle-egl --browser-executable=/path/to/headless_shell
```

`scripts/render-all.mjs` reads `REMOTION_CHROME` for that path.

## How it renders

Bubbles are real three.js sphere meshes shaded by a custom screen-space
refraction material. three's built-in `transmission` renders one shared
transmission target, so transmissive objects cannot show through each other —
which is most of what these clips are. Instead the scene is drawn in ordered
layers and each layer samples the composited layer behind it as its backdrop.

Per frame:

1. **Backdrop** — radial gradient plus two off-camera softboxes. A pure
   gradient refracts to nothing visible, so the softboxes are what give the
   bubbles something to bend and produce the sweeping interior bands.
2. **Far layer** — rear bubbles refracting that backdrop, at half resolution.
3. **Defocus** — separable gaussian over the whole rear plate.
4. **Mid layer** — three depth slices at full resolution, each refracting a
   snapshot of everything already composited behind it.
5. **Near layer** — foreground bubbles on a premultiplied transparent plate,
   blurred into foreground bokeh.
6. **Grade** — bloom, lens chromatic aberration, vignette, film grain.

The glass material itself carries index-of-refraction bending with per-channel
dispersion, Beer-Lambert absorption that deepens with path length, a dark
contour set just inside a bright fresnel rim (the pair that reads as glass
rather than plastic), an anisotropic key highlight, a dimmer highlight off the
far inner wall, and a procedural lattice of trapped micro-bubbles.

## Layout

```
src/
  versions.ts            all 15 art directions — colour, glass, field, camera, grade
  Composition.tsx        canvas shell
  Root.tsx               registers 4K + 1080p compositions
  lib/
    random.ts            seeded PRNG — nothing uses Math.random
    field.ts             bubble population and the motion archetypes
    camera.ts            camera distance derived from desired framing
  three/
    BubbleScene.tsx      the layered render pipeline
    glass-shader.ts      refractive glass
    post-shaders.ts      backdrop, blur, bright-pass, grade
scripts/render-all.mjs   batch renderer
```

Everything is deterministic: motion is a pure function of the Remotion frame
and a fixed per-version seed, so re-renders are identical.

## Retouching a version

`src/versions.ts` is the only file to touch for art direction. Sizes are
expressed against `camera.frameHeight` — the visible world height at z=0 — so a
`maxRadius` of `2.0` against a `frameHeight` of `10` is a bubble 40% of frame
height, independent of fov.
