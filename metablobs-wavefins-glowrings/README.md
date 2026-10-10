# Meta Blobs · Wave Fins · Glow Rings

Three abstract looks, eight colourways, one Remotion project. Every composition is a
**20 s seamless loop** (600 frames at 30 fps), defined at **3840×2160**, rendered with
**three.js on WebGL2** through `@remotion/three`. No text, logos or brands; everything
is generated in code.

| Composition id | Look | Engine |
|---|---|---|
| `MetaBlobs-NeonBlueMagenta` | 1A, neon blue/magenta on black | raymarched SDF fragment shader |
| `MetaBlobs-WhiteMatte` | 1B, porcelain white on pale grey | raymarched SDF fragment shader |
| `MetaBlobs-SunsetCoral` | 1C, coral/amber on black | raymarched SDF fragment shader |
| `WaveFins-Blue` | 2A, steel blue fins | three.js instanced meshes + gather DoF + bloom |
| `WaveFins-Copper` | 2B, copper fins | three.js instanced meshes + gather DoF + bloom |
| `GlowRings-Magenta` | 3A | fullscreen fragment shader |
| `GlowRings-Violet` | 3B | fullscreen fragment shader |
| `GlowRings-Teal` | 3C | fullscreen fragment shader |

## Setup

```bash
npm install
npx remotion studio          # preview (the Studio canvas runs at half resolution for interactivity)
```

Versions are pinned in `package.json` (Remotion 4.0.515, three 0.180.0,
@react-three/fiber 9.3.0, React 19.2.3).

### Chromium GL flag

WebGL2 in headless Chromium needs ANGLE. `remotion.config.ts` sets
`Config.setChromiumOpenGlRenderer("angle")`; on the command line it is **`--gl=angle`**.
On a machine with a GPU, ANGLE uses it. Without one (CI, containers), Chromium falls
back to SwiftShader: it works and gives the same pictures, only slower (see timings).

`remotion.config.ts` also sets PNG frames, H.264, `yuv420p`, CRF 16 and concurrency 1.

## Render at 4K

```bash
npx remotion render MetaBlobs-NeonBlueMagenta out/MetaBlobs_NeonBlueMagenta.mp4 --gl=angle
npx remotion render MetaBlobs-WhiteMatte      out/MetaBlobs_WhiteMatte.mp4      --gl=angle
npx remotion render MetaBlobs-SunsetCoral     out/MetaBlobs_SunsetCoral.mp4     --gl=angle
npx remotion render WaveFins-Blue             out/WaveFins_Blue.mp4             --gl=angle
npx remotion render WaveFins-Copper           out/WaveFins_Copper.mp4           --gl=angle
npx remotion render GlowRings-Magenta         out/GlowRings_Magenta.mp4         --gl=angle
npx remotion render GlowRings-Violet          out/GlowRings_Violet.mp4          --gl=angle
npx remotion render GlowRings-Teal            out/GlowRings_Teal.mp4            --gl=angle
```

For the Glow Rings files, the previews were encoded with x264 `-tune grain` (see
Banding). Remotion has no `-tune` switch, so to get the same at 4K render a PNG
sequence and encode it with ffmpeg:

```bash
npx remotion render GlowRings-Magenta out/seq/GlowRings-Magenta --sequence --image-format=png --gl=angle
ffmpeg -framerate 30 -i out/seq/GlowRings-Magenta/element-%03d.png \
  -c:v libx264 -preset slow -crf 16 -tune grain -pix_fmt yuv420p -r 30 -an out/GlowRings_Magenta.mp4
```

(`scripts/render-previews.sh` does exactly this, at 720p, for all eight.)

### Stills at 6000×3375

```bash
npx remotion still MetaBlobs-NeonBlueMagenta out/MetaBlobs_NeonBlueMagenta_6K.png --frame=300 --scale=1.5625 --gl=angle
```

Swap the composition id for any of the eight. `--scale=1.5625` turns 3840×2160 into
6000×3375; the canvas drawing buffer follows the scale, so the shaders really render at
6000×3375 (not an upscale).

### 720p previews

```bash
scripts/render-previews.sh          # all 8 -> out/previews/*.mp4 + out/stills/*.png
scripts/verify.sh                   # ffprobe, loop seam, cold-start determinism
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe on every
frame sequence and every mp4).

## Render times

TIMINGS_PLACEHOLDER

## Determinism

Remotion renders frames out of order across tabs, so every pixel is a pure function of
`useCurrentFrame()`:

* All random layout (blob sizes, positions, groups, sway phases) comes from
  `mulberry32` seeded **at module level** (`src/metablobs/blobs.ts`). There is no
  `Math.random()` anywhere.
* Time enters only as `phase = (frame % 600) / 600`. Every motion is a whole number of
  cycles of that phase, so frame 600 is the same picture as frame 0 *and* the motion
  is continuous across the seam.
* Grain and dither are integer hashes (PCG3D) of pixel position and `frame % 600`.
* No `Date.now()`, no `useState` for visuals, nothing carried between frames, no TAA.
  Depth of field and bloom are single-frame passes with fixed sample patterns.
* `@remotion/three` calls R3F's `advance()` once per frame; the project registers a
  priority-1 `useFrame` callback only as the hook that runs its own render pipeline.
  The callback ignores R3F's clock/delta and reads the frame number from
  `useCurrentFrame()`.
* The Wave Fins environment map is drawn once into a canvas (fixed panels, no
  randomness) and pre-filtered with PMREM, identically in every tab.

## How it is built

**Meta Blobs** (`src/metablobs`). 24 spheres in 16 groups (10 singles, 4 pairs,
2 triplets), radii 0.35–1.1, in x ∈ [−6, 6], z ∈ [−5, 1.5]. The field is a polynomial
smooth-min (k = 0.55). Groups rise with a vertical period H = 11 and travel exactly 1 or
2 periods per loop; each group wraps as a unit, and its radius is limited by its depth
so that it (and its glow halo) is outside the frustum when it wraps, which means no pop.
Members of a group breathe apart and together (whole cycles), so peanuts form and
split. Camera: fixed, fov 38°, at z = 7.5 looking along −z. The raymarcher (≤ 96 steps)
first intersects each ray with every blob's bounding sphere inflated by k, and marches
only between the nearest entry and the farthest exit, evaluating only those blobs. That
is exact, because a blob more than k away along the ray cannot change a polynomial smin
at the surface. Normals come from the tetrahedral gradient, AO from 4 taps. Silhouettes
are anti-aliased by shading the ray's closest approach and blending by cone coverage.
The neon glow is the analytic closest-approach distance in frame-height units, about
4% wide and cut to exactly zero beyond 4.5%. Neon post: bloom mip-chain, then grain
1.5% and dither.

**Wave Fins** (`src/wavefins`). 20 instanced `PlaneGeometry(1.2, 6, 64, 256)` fins,
0.55 apart, turned 60°, the row leaning about −35°. The vertex shader bends each fin by
`A(t)·sin(y·k + φ(t) + i·δ(t))` plus a second harmonic and a slight cross-curvature,
with normals from the analytic derivative. Material: `MeshStandardMaterial` (metalness
1, roughness 0.28) extended in `onBeforeCompile` with the bend, a thin leading-edge
highlight band (fresnel weighted, brightness drifting along the edge), and a contact
darkening where each fin tucks behind its neighbour. The environment is a canvas
equirect with 3 soft panels on black, put through PMREM, and its rotation sweeps on a
closed path. One point key light also moves on a closed path. The camera does one
closed lap: ±1.2 sideways drift, ±8° orbit and a slight push. Post: 4× MSAA scene
target (view depth in alpha), then a 64-tap golden-spiral gather DoF focused on the
middle fins, then a bloom mip-chain, vignette, grain 1.5% faded to zero below 3%
luminance, and dither.

**Glow Rings** (`src/glowrings`). Rings are centred at (50%, −25%) of the frame and drift
on a small closed path. Six rings are alive at once; ring *i* is at life
`(t + i/6) mod 1`, so its radius grows from 0.2 to 1.6 frame heights. Each ring is a
Gaussian core (σ 4.5–8% of frame height, widening with age) plus a 3.2× wider faint
halo. Arc brightness is 3D value noise sampled on (cos θ, sin θ) offset around a
circle in time, so the bright stretches slide around the ring and loop. The inner tint
copy sits 0.9σ inside at 25%. A faint breathing centre glow, a slight vignette, then
grain 2.5% (not faded in the darks) and dither.

## Adding a colourway

Every version is one data row in `src/versions.ts`. To add one, copy a row, give it a
new `id` (letters, digits and `-` only) and change the colours:

```ts
// src/versions.ts, in GLOW_RINGS
{ id: "GlowRings-Amber", props: { ring: "#B8803A", tint: "#5A6A8A", background: "#060402", grain: 0.025 } },
```

`Root.tsx` maps each array to compositions, so nothing else needs editing. Fields:

* **Meta Blobs:** `mode` (`"neon"` or `"white"`), `colorA` (neon: upper-left light, rim
  and glow; white: lit side), `colorB` (neon: right light; white: shadow grey),
  `background`, `backgroundCentre` (white mode only), `glow`, `bloom`, `grain`.
* **Wave Fins:** `metal`, `highlight`, `panelA`, `panelB` (environment light panels),
  `keyLight`, `background`, `envIntensity`, `edgeStrength`, `bloom`, `grain`.
* **Glow Rings:** `ring`, `tint`, `background`, `grain`.

Add the new id to the list in `scripts/render-previews.sh` / `scripts/verify.sh` if you
use them.

## Banding

BANDING_PLACEHOLDER

## Completion checklist

CHECKLIST_PLACEHOLDER
