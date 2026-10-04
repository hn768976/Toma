# Vintage Map · Cream Swirl · Particle Smoke

Three motion-background looks in eight versions, all in one Remotion project.
Every composition is defined at **3840×2160, 30 fps, 600 frames (20 s)**.

| Composition id | Look | Engine | Loop |
|---|---|---|---|
| `VintageMap-Europe` | Vintage Map, Europe | three.js via `@remotion/three` (plane + Canvas 2D texture tiles) | no (camera drift) |
| `VintageMap-NorthAmerica` | Vintage Map, USA with state names | same | no |
| `VintageMap-World` | Vintage Map, Atlantic world view | same | no |
| `CreamSwirl-Cream` | Cream Swirl, cream | three.js via `@remotion/three`, full-screen raymarched SDF | seamless |
| `CreamSwirl-Blush` | Cream Swirl, blush | same | seamless |
| `CreamSwirl-Caramel` | Cream Swirl, caramel | same | seamless |
| `ParticleSmoke-Blue` | Particle Smoke, blue | PixiJS 8, 3 M-point `Mesh`, custom GLSL + custom `Filter` | seamless |
| `ParticleSmoke-Gold` | Particle Smoke, gold | same | seamless |

Remotion ids cannot contain `_`, so the ids use `-`. The deliverable files use
`_` (`VintageMap_Europe.mp4` and so on).

All three looks use **WebGL2** (not WebGPU). There's no text in looks 2 and 3,
and no logos anywhere.

## Setup

```bash
npm install
npx remotion studio        # preview (the Studio caps the pixel ratio at 0.5 so 4K stays interactive)
```

Node 18+ is required (tested on Node 22).

## Chromium GL flag

Headless Chromium needs ANGLE for WebGL2. `remotion.config.ts` already sets
`Config.setChromiumOpenGlRenderer("angle")`, which is the same as passing
`--gl=angle`. On a machine with a GPU, ANGLE uses it. On a machine without
one, `--gl=angle` falls back to SwiftShader (CPU), and so does
`--gl=swangle`. Both work, just slowly.

## Render commands (4K)

```bash
npx remotion render VintageMap-Europe       out/VintageMap_Europe.mp4       --gl=angle
npx remotion render VintageMap-NorthAmerica out/VintageMap_NorthAmerica.mp4 --gl=angle
npx remotion render VintageMap-World        out/VintageMap_World.mp4        --gl=angle
npx remotion render CreamSwirl-Cream        out/CreamSwirl_Cream.mp4        --gl=angle
npx remotion render CreamSwirl-Blush        out/CreamSwirl_Blush.mp4        --gl=angle
npx remotion render CreamSwirl-Caramel      out/CreamSwirl_Caramel.mp4      --gl=angle
npx remotion render ParticleSmoke-Blue      out/ParticleSmoke_Blue.mp4      --gl=angle
npx remotion render ParticleSmoke-Gold      out/ParticleSmoke_Gold.mp4      --gl=angle
```

The config sets H.264, `yuv420p` and CRF 16. Add `--crf=10` (or
`--codec=prores --prores-profile=4444`) for a mastering-grade file.
Concurrency defaults to 2 because the 4K map textures (about 650 MB of GPU
memory with mipmaps) and the 3 M-particle buffer are large. Raise it with
`--concurrency=N` on a big GPU.

### Stills (6000×3375)

```bash
npx remotion still VintageMap-Europe out/VintageMap_Europe_6K.png --frame=300 --scale=1.5625 --gl=angle
```

The same command works for any composition id. `--scale=1.5625` turns
3840×2160 into 6000×3375. Everything is resolution-independent: the map
texture, label layout, blur radii, particle weights and grain all scale with
the output size. A 6K map still needs about 1.6× the 4K texture memory.

### 720p previews (as delivered)

```bash
scripts/render-previews.sh      # all 8; or pass composition ids
```

This renders a PNG sequence at `--scale=0.3333333333333333`, which gives
exactly 1280×720 (checked with ffprobe). It then encodes it with ffmpeg
(H.264, `yuv420p`, CRF 16, 30 fps, no audio) into `out/previews/`. Frame 300
of every render is kept in `out/frame300/` for the determinism check.

## Measured render time

The measurements were taken in this build's container: 4 vCPUs, **no GPU**,
so WebGL ran on SwiftShader on the CPU.

<!-- TIMINGS -->

## How each look is built

### 1 · Vintage Map (`src/vintage-map/`)

- **Data:** Natural Earth 1:10m (Europe, North America) or 1:50m (world).
  This covers admin-0 countries, land boundary lines, disputed-area lines and
  polygons, coastlines, lakes, marine polygons for sea names, and populated
  places. North America also uses 1:50m admin-1 for US states and Canadian
  provinces. The data is prepared by `scripts/prepare-data.mjs` into compact
  TopoJSON in `public/data/`. Projections come from `d3-geo`.
- **Texture:** `buildTexture.ts` draws the printed map once per version into
  Canvas 2D tiles. Each tile is 4096 px with a 48 px overlap gutter, so
  mipmapping never shows a seam. The drawing has these parts:
  - rust land `#7A4428` with darker `#5A2E1A` and lighter mottling;
  - parchment sea `#E6CFA0`, blotchy and darker along the coasts;
  - an ink edge on the land side of each coast;
  - pale embossed borders `#D8B58A`, with disputed boundaries dashed;
  - a 10° graticule, clear on the sea and faint on land.
- **Texture size:** chosen from the camera so the **nearest visible point
  gets 1.6 texels per screen pixel**. At 4K that's about 10 800×6 700 px (3×2
  tiles). Textures use mipmaps and 16× anisotropic filtering.
- **Labels:** IM Fell English throughout.
  - Countries: letter-spaced cream capitals, sized by area.
  - Seas: dark italic.
  - States and provinces: smaller capitals.
  - Cities: pale ringed dots with labels.
  - Every label is tried at several sizes, on one or two lines, and as an
    abbreviation. It is kept only if it lies inside its own country or sea
    (by a sample grid) and clear of every label already placed. Placement
    order is seas, then countries, states, capitals and cities. Labels never
    overlap.
  - Disputed and indeterminate territories (Natural Earth `TYPE`) get no
    labels, and no label may touch a disputed-area polygon.
- **Paper:** the plane's fragment shader multiplies in procedural fibres,
  soft stains, dust specks, fine scratches and four seeded crease lines.
  Fine detail fades out where it would alias.
- **Camera** (`camera.ts`): the paper is tilted **40° from flat**, which is a
  camera elevation of 50°, with a 27° vertical field of view. The camera
  drifts diagonally about 12% of the view width and turns 3° over 20 s, with
  eased start and end.
- **Post pass:** tilt-shift depth of field computed from the analytic depth
  of the paper. The middle band is sharp, the far edge is soft and the near
  edge slightly soft. The pass also adds soft warm light, a dark-brown
  vignette weighted to the far edge, a slight sepia fade, about 1.5% exposure
  breathing, 3% grain and ±1/255 dither.

### 2 · Cream Swirl (`src/cream-swirl/`)

- **Surface:** a signed-distance field raymarched in a full-screen shader. It
  combines:
  - a wavy base sheet with folds;
  - a bowl inside the swirl, with an S-shaped crest across it;
  - a closed twisted torus "roll" whose radius, thickness and height change
    around the ring, plus a second outer rim;
  - a rolled lip where the sheet drops away to the bright gap at the top
    left.

  Everything is joined with a smooth minimum, and domain warping makes it
  flow.
- **Shading:** wrap diffuse, a broad satin sheen, SDF ambient occlusion and
  soft shadows. Fake subsurface glow (SDF thickness probe) lights the
  creases, thin parts and the hollow, which glows with the version's glow
  colour.
- **Optics:** the surface is raymarched at half resolution, because most of
  the frame is out of focus. Depth of field is a full-resolution gather from
  the depth in alpha. Then AgX tone mapping (the same formula as three.js),
  1.5% grain and ±1/255 dither.

### 3 · Particle Smoke (`src/particle-smoke/`)

- **Particles:** 3 000 000 points, made by a module-level `mulberry32`. Each
  stores `(u, v)` on its sheet, a sheet id and a seed. Sheet 0 is one broad
  curling band; sheets 1–2 are thin trailing strands; 10% are loose dust off
  the edges.
- **Vertex shader:** each sheet is a parametric band (S-bend, twist,
  half-pipe curl, thickness). Layered loopable flow noise bends it. The
  shader adds per-particle jitter and sparkle, projects the point through a
  perspective camera that orbits ±12.5°, and grows and dims out-of-focus
  points to fake depth of field.
- **Drawing:** a PixiJS 8 `Mesh` with `point-list` topology and additive
  blending into an **`rgba16float` render texture**, so density never gets
  quantised to 8 bits. A downsample chain (½, ¼, ⅛) feeds the glow.
- **Final pass:** one custom PixiJS `Filter` adds the radial background, maps
  density to colour (particle colour, then the dense colour, then hot cores),
  adds the soft glow, rolls off the highlights, and applies 2% grain and
  ±1/255 dither.
- **PixiJS setup:** `app.init({ canvas, width, height, preference: 'webgl',
  antialias: true, autoStart: false, preserveDrawingBuffer: true })`. The
  ticker is stopped and there is exactly one `app.render()` per Remotion
  frame.

## Determinism and loops

- Every visual value comes from `useCurrentFrame()`. There is no
  `Math.random()` at render time (seeded `mulberry32` at module level only),
  no CSS animation, no clock, no `useState`-driven visuals, and no temporal
  effects.
- Looping looks use the frame folded into one cycle (`frame % 600`). All
  motion comes from noise sampled around a circle in time, plus sines with a
  whole number of cycles per loop. That makes frame 600 equal frame 0, and
  599 flows into 0.
- Grain and dither come from an integer hash of pixel position and
  `frame % 600`.
- Fonts, map data and texture builds sit behind `delayRender` /
  `continueRender`. A shader compile error cancels the render instead of
  producing black frames.

## Verification

Run these after `scripts/render-previews.sh`:

```bash
node scripts/map-check.mjs out/map-check   # full map textures (~2000 px) + label checks against Natural Earth
scripts/verify-frames.sh                   # frame 300 cold vs full render (byte compare), loop 0 == 600, seam 599 -> 0
python3 scripts/check-output.py            # ffprobe, banding and exposure on frames decoded from the mp4s, contact sheets
```

The `MapTexture-*` compositions (Debug folder) show the whole flat map
texture. For the loop check, `--props='{"loopCheck":true}'` makes a looping
composition 601 frames long.

<!-- RESULTS -->

## Adding a map region

1. Add a row to `MAP_REGIONS` in `src/vintage-map/regions.ts`:
   - projection (`conicConformal` with rotate/centre/parallels, or
     `naturalEarth1`);
   - camera focus start and end (lon/lat);
   - visible width in degrees;
   - heading start and end;
   - dataset: `"regional"` = 1:10m, `"world"` = 1:50m;
   - optional `admin1` countries;
   - city population thresholds, sea classes and label scale.
2. The composition appears automatically (`VintageMap-<id>`); `Root.tsx`
   maps over the rows.
3. Check it with `REGIONS=<id> node scripts/map-check.mjs`.

Admin-1 data for countries other than the USA and Canada isn't shipped. To
add it, extend the filter in `scripts/prepare-data.mjs` and re-run it.

## Adding a colour

- **Cream Swirl:** add `{ id, base, glow }` to
  `src/cream-swirl/versions.ts`.
- **Particle Smoke:** add `{ id, particle, dense, bgCenter, bgEdge }` to
  `src/particle-smoke/versions.ts`.

The composition (`CreamSwirl-<id>` / `ParticleSmoke-<id>`) appears
automatically.

## Licences

- **Fonts:** IM Fell English, by Igino Marini, SIL Open Font License 1.1
  (`public/fonts/OFL-IMFellEnglish.txt`).
- **Map data:** Natural Earth, public domain
  (`public/data/LICENSE-NaturalEarth.md`).
- **Code dependencies:**
  - three.js: MIT
  - PixiJS: MIT
  - d3-geo: ISC
  - topojson: ISC
  - polylabel: ISC
  - Remotion: Remotion licence. Companies may need a company licence; see
    remotion.dev/license.
- **Simplex noise GLSL:** Ashima Arts / Stefan Gustavson, MIT.
