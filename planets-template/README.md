# Planets template (Remotion + three.js)

One template scene, two shot styles, **17 compositions** at 3840×2160 / 30 fps:

| # | Composition id (Remotion) | Output name | Shot | Frames |
|---|---|---|---|---|
| 1 | `Planet-Mercury-Spin` | `Planet_Mercury_Spin.mp4` | Spin (seamless loop) | 600 |
| 2 | `Planet-Venus-Spin` | `Planet_Venus_Spin.mp4` | Spin | 600 |
| 3 | `Planet-Mars-Spin` | `Planet_Mars_Spin.mp4` | Spin | 600 |
| 4 | `Planet-Jupiter-Spin` | `Planet_Jupiter_Spin.mp4` | Spin | 600 |
| 5 | `Planet-Saturn-Spin` | `Planet_Saturn_Spin.mp4` | Spin | 600 |
| 6 | `Planet-Uranus-Spin` | `Planet_Uranus_Spin.mp4` | Spin | 600 |
| 7 | `Planet-Neptune-Spin` | `Planet_Neptune_Spin.mp4` | Spin | 600 |
| 8 | `DwarfPlanet-Pluto-Spin` | `DwarfPlanet_Pluto_Spin.mp4` | Spin | 600 |
| 9 | `DwarfPlanet-Ceres-Spin` | `DwarfPlanet_Ceres_Spin.mp4` | Spin | 600 |
| 10 | `Planet-Mercury-Crescent` | `Planet_Mercury_Crescent.mp4` | Crescent | 450 |
| 11 | `Planet-Venus-Crescent` | `Planet_Venus_Crescent.mp4` | Crescent | 450 |
| 12 | `Planet-Mars-Crescent` | `Planet_Mars_Crescent.mp4` | Crescent | 450 |
| 13 | `Planet-Jupiter-Crescent` | `Planet_Jupiter_Crescent.mp4` | Crescent | 450 |
| 14 | `Planet-Saturn-Crescent` | `Planet_Saturn_Crescent.mp4` | Crescent | 450 |
| 15 | `Planet-Uranus-Crescent` | `Planet_Uranus_Crescent.mp4` | Crescent | 450 |
| 16 | `Planet-Neptune-Crescent` | `Planet_Neptune_Crescent.mp4` | Crescent | 450 |
| 17 | `DwarfPlanet-Pluto-Crescent` | `DwarfPlanet_Pluto_Crescent.mp4` | Crescent | 450 |

Remotion composition ids may not contain `_`, so the compositions are registered
with hyphens (`Planet-Mars-Spin`); the render scripts write the underscore names.

- **Spin** (20 s loop): body centred and fully lit from the front-left (~35° off
  the camera axis, soft terminator on the right), exactly one turn about its tilted
  axis in its real direction (Venus, Uranus and Pluto retrograde), a ±0.5° closed
  camera drift, faint star field. Frame 600 renders identically to frame 0.
- **Crescent** (15 s): large body (95% of frame height, top cut by the frame, just
  left of centre), lit from behind and to the upper right (~115° off axis) so a
  bright crescent hugs the right limb; 8% eased push-in, 25° of rotation, the sun
  swings 8° toward the camera; relief catches the light along the terminator;
  atmospheres glow as an arc around the limb; stars nearly black.

## Quick start

```bash
npm install
npx remotion studio          # preview in the browser
```

Node 20+ is required. The processed maps are committed in `public/bodies/`, so
nothing else needs to be downloaded to render.

### Chromium / GL flag

Everything renders through WebGL2 via ANGLE: **`--gl=angle`** (set by default in
`remotion.config.ts`; override with `REMOTION_GL`). On a machine with a GPU, ANGLE
uses it. Without a GPU, ANGLE falls back to SwiftShader (software), which is what
the timings below were measured on. `REMOTION_GL=swangle` forces the software path.

## Rendering

### One composition at 4K

```bash
npx remotion render Planet-Mars-Spin out/4k/Planet_Mars_Spin.mp4 \
  --codec=h264 --crf=16 --pixel-format=yuv420p --muted --gl=angle --concurrency=2
```

Replace `Planet-Mars-Spin` / `Planet_Mars_Spin` with any id from the table above.

### All 17 at 4K (batch)

```bash
bash scripts/render-all-4k.sh            # -> out/4k/<Name>.mp4
REMOTION_CONCURRENCY=4 bash scripts/render-all-4k.sh out/4k   # more tabs if RAM/VRAM allow
```

Each render tab holds the two 8K maps of its body (~0.5 GB with mipmaps), so keep
`--concurrency` modest.

### Stills at 6000×3375

```bash
npx remotion still Planet-Mars-Spin out/stills6k/Planet_Mars_Spin.png \
  --frame=300 --scale=1.5625 --gl=angle
```

(3840 × 1.5625 = 6000, 2160 × 1.5625 = 3375. Use `--frame=400` for Crescent
shots.)

### 720p previews (as delivered)

```bash
npx remotion render Planet-Mars-Spin out/previews/Planet_Mars_Spin.mp4 \
  --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted
npx remotion render Planet-Saturn-Crescent out/previews/Planet_Saturn_Crescent.mp4 \
  --scale=0.3333333333333333 --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

`--scale=0.3333333333333333` gives exactly 1280×720 (checked with ffprobe), so the
ffmpeg downscale fallback was not needed.

### Contact sheets

```bash
node scripts/stills.mjs --out=out/stills            # 720p hero stills of all 17
node scripts/contact-sheet.mjs --in=out/stills --out=out/sheets
```

## Measured render times

Measured in the build container: 4 vCPU, 15 GB RAM, **no GPU**. Chromium's
ANGLE ran on SwiftShader (software Vulkan), so these are worst-case numbers.
Steady-state per-frame times subtract a 1-frame render from an N-frame render of
the same composition, so start-up and map loading (~10–20 s per browser tab)
are excluded.

| What | Result |
|---|---|
| `Planet_Mars_Spin.mp4` preview (600 frames, 1280×720, `--concurrency=4`) | 819 s wall = **1.37 s/frame** |
| `Planet_Saturn_Crescent.mp4` preview (450 frames, 1280×720, `--concurrency=4`) | 842 s wall = **1.87 s/frame** |
| Mars Spin, 720p, one worker, steady state | **1.34 s/frame** |
| Saturn Crescent, 720p, one worker, steady state | **1.86 s/frame** |
| **One real 4K frame of Saturn Crescent** (frame 400, 3840×2160) | **10.5 s/frame** steady state; 32 s for a single cold frame including start-up and map upload |
| One 4K frame of Mars Spin (frame 300) | 5.5 s/frame steady state; 25 s cold |

SwiftShader already uses every core, so extra Remotion concurrency barely helped
here (1.37 s/frame at 4 tabs against 1.34 s/frame at 1).

**4K estimate for all 17 (9 × 600 + 8 × 450 = 9,000 frames):** with Spin frames
at ~5.5–7 s (Saturn/Uranus with rings at the top end) and Crescent frames at
~8–10.5 s, the whole set takes about **19 hours on this CPU-only machine**
(≈ 5,400 × 6 s + 3,600 × 9.5 s ≈ 66,600 s). On a machine with a real GPU
(`--gl=angle` picks it up), WebGL work of this size typically runs one to two
orders of magnitude faster, so expect roughly **1–2 hours** there, dominated by
PNG capture and H.264 encoding at 4K. Measure one composition first with
`--frames=0-29`.


## How it works

```
scripts/build-bodies.mjs      download -> resample to 8192x4096 -> seams/poles -> normals -> public/bodies/<id>/
scripts/lib/tiff.mjs          streaming reader + box resampler for USGS strip GeoTIFFs (multi-GB, planar or chunky)
scripts/lib/img.mjs           blur, push-pull hole fill, pole fix, seam blend, normal maps, WebP/PNG out
scripts/lib/procedural.mjs    procedural bodies, Jupiter detail synthesis, Pluto colour/fill, ring profiles
scripts/lib/noise.mjs         seeded simplex noise on the unit sphere (no seams, no pole pinching)
src/data/versions.ts          the 17 data rows (body, shot, framing, tilt, direction, atmosphere, rings, light)
src/data/bodies.ts            body metadata (imports public/bodies/<id>/meta.json)
src/scene/PlanetShot.tsx      <ThreeCanvas>: loads maps (delayRender), builds the scene, renders each frame
src/scene/motion.ts           every moving value as a pure function of (row, frame)
src/scene/shaders.ts          planet, atmosphere, rings, stars, bloom, final (tone map, grain, dither)
src/scene/post.ts             HDR (4x MSAA, half-float) -> bloom chain -> final pass
src/scene/stars.ts            6,000 stars from a module-level mulberry32 seed
```

- **Sphere:** 512 × 256 segments, scaled to the body's real flattening. The
  fragment shader computes latitude/longitude per pixel and samples with
  `textureGrad` using seam-safe derivatives, so the ±180° seam never drops to a
  tiny mip. Colour map (×1.1 saturation), tangent-space normal map, wrap diffuse
  with a soft terminator, limb darkening, and the rings' analytic shadow.
- **Atmosphere:** an additive shell. For each pixel the view ray's closest
  approach to the body gives an optical depth; light comes from the sun direction
  at that point (wrapping past the terminator), with a forward-scattering boost on
  Crescent shots. Colour, strength and thickness are per body (`meta.json`).
- **Rings:** a ring plane sampling a radial RGBA profile (Saturn: C, B, A rings,
  Cassini Division, Encke and Keeler gaps, F ring, from published radii; Uranus:
  the ten narrow rings). The planet's shadow on the rings and the rings' shadow
  on the planet (and on its atmosphere) are computed analytically in the shaders.
  The unlit face shows only light diffusing through the rings.
- **Stars:** 6,000 seeded points with Gaussian splats whose size is defined in
  2160p pixels and energy-preserving at lower resolutions, so 720p and 4K match.
- **Post:** 4× MSAA half-float HDR, a single-frame bloom (13-tap downsample /
  tent upsample chain sized to the frame height), ACES filmic tone map, sRGB,
  grain (1.5%, faded to zero below ~3% luminance) and a ±1/255 triangular
  dither. Grain and dither are a PCG hash of pixel position and `frame % 600`
  (Spin) or `frame % 450` (Crescent). No `Math.random()`, no clocks, no TAA.

### Determinism

All motion comes from `useCurrentFrame()` through `src/scene/motion.ts`; random
values come only from seeded generators at module level; maps load once behind
`delayRender`; the render pipeline is a `useFrame` callback that reads the
current Remotion frame and keeps no state between frames. Spin shots wrap the
frame (`frame % 600`) before computing anything, so frame 600 is frame 0.

### Texture resolution

Maps are 8192 × 4096 with mipmaps and maximum anisotropic filtering. At 4K a
Spin disc is ~1400 px across and a Crescent disc ~2050 px (2200 px at the end of
the push-in). An 8192-wide map puts 4096 texels across the visible hemisphere,
i.e. ≥1.8 texels per screen pixel at the disc centre even in the Crescent shots,
so 16384 × 8192 maps were not needed (they would also exceed WebP's 16383-px
limit and the 8192 texture limit of the software renderer used here).

## Map sources and credits

All maps are public domain (U.S. Government works: NASA / USGS) or generated in
code. **No Solar System Scope, Planet Pixel Emporium or other CC-BY / NC texture
packs are used.** `scripts/build-bodies.mjs` downloads each source once into
`.cache/raw/` (not shipped), processes it, and ships only the processed maps.
Every body's `meta.json` repeats its credits.

USGS Astrogeology map files are published at `https://planetarymaps.usgs.gov/mosaic/<file>`;
the build script fetches them from the identical public S3 bucket behind that
site (`https://asc-pds-services.s3.amazonaws.com/mosaic/<file>`), which is what
the build environment's network policy allowed.

| Body | Colour map | Normal map | Credit line |
|---|---|---|---|
| Mercury | [Mercury_MESSENGER_mosaic_global_250m_2013.tif](https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_mosaic_global_250m_2013.tif) (panchromatic, tinted grey-brown) | from DEM: [Mercury_Messenger_USGS_DEM_Global_665m_v2.tif](https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif) | NASA / Johns Hopkins University Applied Physics Laboratory / Carnegie Institution of Washington; USGS Astrogeology Science Center |
| Venus | **procedural** cloud tops (cream `#E8D8A8` → tan `#C8A870`, low-contrast flowing bands) | from the procedural height | — (the public-domain Venus globals are Magellan radar of the hidden surface) |
| Mars | [Mars_Viking_ClrMosaic_global_925m.tif](https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif) (caps whitened, gentle grade) | from DEM: [Mars_MGS_MOLA_DEM_mosaic_global_463m.tif](https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif) | NASA / JPL / USGS Astrogeology Science Center (Viking MDIM2.1); NASA / GSFC MOLA Science Team (MOLA) |
| Jupiter | [NASA 3D Resources "Jupiter" texture](https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/Images%20and%20Textures/Jupiter/Jupiter.tif) (720×360) for belts, zones, Great Red Spot and ovals, **plus procedural** fine turbulence (domain warp), colour grade and polar caps | from colour luminance (gentle high-pass) | NASA (NASA 3D Resources, github.com/nasa/NASA-3D-Resources) |
| Saturn | **procedural** pale-gold bands from a latitude profile matched to Cassini true-colour images, north polar hexagon | from the procedural height (very gentle) | — ; rings procedural from published ring radii (C, B, A rings, Cassini Division, Encke/Keeler gaps, F ring) |
| Uranus | **procedural** pale cyan `#AEE4E8`, very faint bands, brighter north polar cap | flat | — ; ten narrow rings from published radii |
| Neptune | **procedural** deep blue `#3A5AD8`, faint bands, Great Dark Spot + companion clouds, small dark spot, "Scooter", irregular cirrus streaks | from the procedural height (gentle) | — |
| Pluto | [Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif](https://planetarymaps.usgs.gov/mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif), colourised with a ramp matched to New Horizons colour images; **procedural** fill of the never-imaged south (polar night in 2015) and fine detail over the low-resolution far side | from DEM where it exists: [Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif](https://planetarymaps.usgs.gov/mosaic/Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif); elsewhere from colour luminance | NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute; USGS Astrogeology Science Center |
| Ceres | [Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif](https://planetarymaps.usgs.gov/mosaic/Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif) (panchromatic, neutral tint) | from DEM: [Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif](https://planetarymaps.usgs.gov/mosaic/Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif) | NASA / JPL-Caltech / UCLA / MPS / DLR / IDA; USGS Astrogeology Science Center |

**Procedural bodies:** Venus, Saturn, Uranus, Neptune (fully), Jupiter (detail,
colour grade and polar caps over the NASA map), Pluto (south fill and far-side
detail). Every procedural map is generated deterministically (fixed seeds) on the
unit sphere, so it has no seam and no pole pinching.

**Processing (all bodies):** area-weighted resample to 8192 × 4096 with the left
edge at −180°; data holes filled by push-pull interpolation (with the coverage
mask eroded so dark fringes at data edges never survive); poles fixed with a
latitude-adaptive horizontal blur that becomes the row mean at the pole; the
±180° seam blended; normals from the elevation model (metres per pixel from the
body's radius, per-body exaggeration, faded near the poles) or from a gentle
luminance high-pass; colour as WebP q93, normals as WebP q95 (x, y in RG, z in B).

**Network note.** Build-time downloads must reach `asc-pds-services.s3.amazonaws.com`
(or `planetarymaps.usgs.gov` with `USGS_BASE=https://planetarymaps.usgs.gov/mosaic/`) and
`raw.githubusercontent.com`. Raw downloads total ~7 GB; the build takes ~15
minutes on 4 cores (`--only=<id>` to rebuild one body, `--size=2048` for drafts).


## Verification (all run on the delivered code)

Scripts live in `scripts/verify/`; each prints PASS/FAIL.

| Step | Check | How | Result |
|---|---|---|---|
| 1 | Previews: 1280×720, 30/1, h264, yuv420p, no audio, 20.0 s / 15.0 s | `ffprobe` | **PASS.** Mars Spin first failed: Remotion's default silent AAC track was present and padded the container to 20.053 s. Fixed with `Config.setMuted(true)` / `--muted`; the existing Mars file was remuxed with `-an -c:v copy` (video stream untouched). Saturn Crescent, rendered after the fix, passed first time. Frame counts 600 / 450. |
| 2 | Loop: frame 600 ≡ frame 0, all 9 Spins | `REMOTION_LOOP_CHECK=1` makes Spins 601 frames; `node scripts/verify/loop-check.mjs` | **PASS** (pixel-identical, all 9), first time and again on the final code |
| 3 | Same result every time | `node scripts/verify/determinism.mjs` | **PASS.** Both previews: a cold-start frame 300 is byte-identical to frame 300 of the full 4-tab PNG-sequence render. The other 15 hero stills rendered twice from cold (fresh bundle + browser) are identical PNG byte for byte. |
| 4 | Banding | `node scripts/verify/banding.mjs` reads a row of the **encoded mp4** across the terminator and the atmosphere rim | **PASS.** Mars Spin terminator: monotonic 41→0 in 1–2 level steps, longest flat run inside a gradient 3 px; rim 1→3→8→10→15→23→38. Saturn Crescent terminator 0→240 in 1–3 level steps; limb glow 186→10 smooth. Space: mean 0.01 (Saturn, below the rings), 0.6 (Mars, incl. stars). Grain stayed at 1.5%. |
| 5 | What each shows; motion | Contact sheets; `node scripts/verify/motion.mjs` steps 2 s around frame 300 of each encoded preview | **PASS.** Frame-to-frame change is even: Mars 3.08 ± 0.14 (max 1.08× mean), Saturn 0.62 ± 0.04 (max 1.11× mean); no shimmer in the crop strips. |
| 6 | Accuracy (3 fresh sub-agents, blind numbered sheet) | see below | All 9 identified with high confidence in every round |
| 7–8 | Look vs the references (self-check, then 3 rounds of fresh sub-agents) | see below | Fixed: size, lighting, contrast, glow, stars, crescent shape |

**Accuracy rounds.**
- Round 1 flagged: Mars without polar caps (the cap was in the map but on the
  limb; the north pole is now tipped 20° toward the camera and the caps
  whitened), Pluto too saturated (muted ramp), Neptune streaks stamped
  (irregular, clustered cirrus), Saturn's hexagon pasted-on and striping
  (softened, faded), slight Mercury pole swirl (wider pole fix), Uranus glow
  (softened).
- Round 2 flagged: a straight resolution edge on Pluto (fine detail added over
  the low-resolution far side), dotted Uranus rings and faint Saturn polar
  streaks.
- Round 3 flagged: Uranus rings still dotted and Saturn ring edges jagged
  (cause: SwiftShader's anisotropic path with a 1-D gradient; now isotropic
  trilinear radial filtering, verified smooth at native pixels), Pluto still
  saturated (muted further), no visible ring shadow on Saturn's globe in the
  Spin (the sun was ~25° above the ring plane so the shadow hid behind the
  rings; the Spin sun now stands ~47° above it while staying ~35° off the
  camera axis). Not changed: Neptune's saturated blue (the brief specifies
  `#3A5AD8`) and Mars's unseen south cap (on the dark limb in this framing).

**Reference rounds (step 8).** Differences in the exact surface pattern were
ignored as instructed (the references use a generic made-up planet).
- Round 1: Spin: softer, more even light, disc 62 → 65% of frame height,
  thinner rim, denser and brighter stars. Crescent: warmer, more saturated light;
  stronger relief; disc moved to 0.48 W; Mars rim and stars nearly off.
- Round 2: Spin: redder Mars grade with lifted darks, fewer stars. Crescent:
  light from the upper right (terminator diagonal, lower disc dark), faint
  relief fill on the night side, hotter amber light on Mars.
- Round 3: Crescent: no limb darkening (a backlit crescent brightens toward its
  limb), narrower crescent, stronger night-side relief, more saturated
  highlights; Spin stars dimmed slightly.
- Deliberately not matched: the Spin reference is lit from the right and almost
  frontally, but the brief asks for front-left at ~35° with a soft right
  terminator; the reference's embossed noise relief and the absence of polar
  caps or real features (ignored as instructed); and the reference's stronger,
  wider glow on the crescent limb (kept as an atmosphere arc only on the bodies
  the brief lists).

## Completion checklist

- [x] 17 compositions (9 Spin × 600 frames loop, 8 Crescent × 450), 3840×2160, 30 fps, one data row each
- [x] three.js / `@remotion/three`, WebGL2 via `--gl=angle`, custom shaders, 512×256 sphere
- [x] Public-domain maps only (USGS / NASA); sources and credits above; procedural bodies listed
- [x] Normal maps from MOLA, MESSENGER, Dawn and New Horizons DEMs; luminance high-pass elsewhere
- [x] Saturn and Uranus rings with analytic shadows both ways
- [x] Bloom, filmic tone map, dither and grain (faded in the blacks), from `frame % 600` / `% 450`
- [x] Deterministic: no `Math.random()`, clocks or carried state; maps behind `delayRender`
- [x] Loop, determinism, banding, motion, accuracy and reference checks (above)
- [x] 2 previews at exactly 1280×720 (no fallback needed), contact sheets, 4K Mars crop
- [x] `npm install && npx remotion studio` from a clean copy


## Adding a new body

1. **Maps.** Add an entry to `BODIES` in `scripts/build-bodies.mjs`: name, kind
   (`planet` / `dwarf`), radius, flattening, obliquity (> 90° = retrograde),
   `color` (a public-domain global equirectangular mosaic URL; `mode: "rgb"` or
   `"gray"` with a tint), optional `dem` (elevation model URL and relief
   exaggeration), `atmosphere` (colour, strength, thickness, crescent boost),
   optional `rings`, `surface` (wrap, normal strength) and `credits`. For a body
   with no usable map, write a generator in `scripts/lib/procedural.mjs` and set
   `procedural: "<name>"`.
2. Run `node scripts/build-bodies.mjs --only=<id>` (add `--size=2048` for a fast
   draft). It writes `public/bodies/<id>/{color.webp, normal.webp, meta.json}`.
3. **Data.** Import the new `meta.json` in `src/data/bodies.ts`, add the id to
   `BodyId`, add a `PRESENT` entry in `src/data/versions.ts` (pole roll/pitch,
   rotation direction, hero longitude) and add the id to `SPIN_BODIES` and/or
   `CRESCENT_BODIES`. The compositions appear automatically.
4. Run `node scripts/stills.mjs --only=<Composition-Id>` and the checks in
   `scripts/verify/`.
