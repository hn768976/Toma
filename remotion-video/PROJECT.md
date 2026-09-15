# DNA / Molecule motion plates — 13 versions

Thirteen 3D motion-graphics plates built in **Remotion + three.js (WebGL)** from
the two supplied GLB models, each one tracking a reference clip for palette,
composition, framing and camera move.

- **30 fps**, H.264 / MP4, 16:9
- **1920 × 1080** masters delivered, **3840 × 2160** compositions included
- Durations match each reference to the frame

## The 13 versions

| # | Composition | Duration | Frames | Models | Look |
| --- | --- | --- | --- | --- | --- |
| 01 | `V01FrostedMolecules` | 14.00s | 420 | DNA + molecule | Near-black navy, frosted glass molecules in front of a faint helix, heavy depth of field |
| 02 | `V02NavySparkle` | 10.00s | 300 | DNA | Vertical helix right of centre, deep navy, blue glow falling away downward, sparkle points |
| 03 | `V03VioletCascade` | 8.40s | 252 | DNA | Layered diagonal helices, magenta/violet iridescent sheen over a blue field |
| 04 | `V04ParticleStrand` | 20.00s | 600 | DNA | Diagonal helix drawn entirely as glowing blue dots sampled from the mesh |
| 05 | `V05GenomeHud` | 15.00s | 450 | DNA | Horizontal cyan hologram helix under a sci-fi analysis interface |
| 06 | `V06ClinicalLight` | 10.03s | 301 | DNA + molecule | Pale studio background, blue glass helix with red base-pair accents, molecules behind |
| 07 | `V07DualDust` | 11.07s | 332 | DNA | Two vertical particle helices — amber in front, blue behind — in a starfield |
| 08 | `V08NeonWire` | 8.33s | 250 | DNA | Pure black, cyan and magenta wireframe edges reading as neon light streaks |
| 09 | `V09CeramicStudio` | 12.00s | 360 | DNA | Pale blue-grey studio, matte ceramic ribbons, strong defocus on the back layers |
| 10 | `V10DeepFog` | 22.00s | 660 | DNA | Misty blue-grey gradient, horizontal helix half-lost in fog, very slow drift |
| 11 | `V11CrimsonNetwork` | 18.00s | 540 | DNA + molecule | Red-hot horizontal helix over a plexus network, data grid and molecular diagrams |
| 12 | `V12GlassRimlight` | 20.00s | 600 | DNA | Dark field, glossy translucent helix with a hard blue rim light and silhouetted back strands |
| 13 | `V13AzureCopySpace` | 12.01s | 360 | DNA | Bright blue field, vertical particle helix held left, plexus lines, copy space right |

Every version is registered twice — `V05GenomeHud` is the 1080p composition,
`V05GenomeHud4K` the 3840 × 2160 one. Both run the same scene code.

`npx remotion studio` will also list `BluetoothExplainer`, `ParticleRingHalo`
and `ParticleRingHalo4K`. Those are pre-existing compositions from this repo and
are unrelated to these plates — ignore them, or delete their entries from
`src/Root.tsx` along with `src/components/`, `src/scenes/` and
`src/particle-ring/` if you want the project to contain nothing else.

Three references are 25 fps sources and three are 29.97 fps; since everything
here is 30 fps, each duration is the nearest whole frame to the original
wall-clock length (e.g. ref 08 at 8.320s → 250 frames = 8.333s).

## Getting set up

```bash
npm install
npx remotion studio          # interactive preview, all 26 compositions
```

## Rendering

Bundle once, then render:

```bash
npx remotion bundle src/index.ts --out-dir=build

./scripts/render-all.sh          # 13 × 1080p  -> out/1080p
./scripts/render-all.sh 4k       # 13 × 2160p  -> out/4k
```

`--muted` is deliberate: these are silent plates, and without it Remotion writes
a silent AAC track that also pads the container past the exact video duration.
If you ever render without it, `./scripts/strip-audio.sh <dir>` removes the
track with a stream copy, leaving the video bit-identical.

Or a single composition:

```bash
npx remotion render src/index.ts V05GenomeHud4K out/v05-4k.mp4 \
  --gl=swangle --codec=h264 --crf=16 --pixel-format=yuv420p --muted
```

### The `--gl` flag matters

These are real WebGL scenes, so the renderer needs a GL backend:

| Flag | Use |
| --- | --- |
| `--gl=angle` | machine with a GPU — much faster, use this if you have one |
| `--gl=swangle` | headless / no GPU — software rasteriser, always works |

The 1080p masters shipped with this project were rendered with `--gl=swangle`
at roughly 1.2 s/frame on 4 CPU cores. **4K is about four times the pixels**, so
budget accordingly, and use `--gl=angle` on a GPU machine if you can.

## The models are never modified

Both GLBs contain a single un-materialed mesh — `POSITION`, `NORMAL` and
`TEXCOORD_0` only, with no materials, textures or embedded images. On load each
is centred on the origin and uniformly scaled so its longest axis is 2 units,
so all compositions share one coordinate scale. No vertices are added, removed
or moved, and no topology changes.

All shading is authored in `src/dna/materials.ts` and attached to that untouched
geometry at render time.

The particle and wireframe versions (04, 05, 07, 08, 13) don't use a different
model either — they draw the *same* mesh a different way:

- `sampleSurface()` — area-weighted triangle sampling for a point cloud that
  sits exactly on the mesh surface
- `edgesOf()` — `THREE.EdgesGeometry` for the mesh's sharp edges as line
  segments

## Re-skinning

| I want to change… | Edit |
| --- | --- |
| a version's colours, camera or timing | `src/dna/versions/V*.tsx` |
| durations or composition sizes | `src/dna/constants.ts` |
| a material preset used across versions | `src/dna/materials.ts` |
| the HUD copy in version 05 | `HUD_COPY` at the top of `src/dna/Hud.tsx` |

All strings in the version 05 interface are invented placeholder copy. Nothing
is taken from any reference clip.

## Implementation notes

`src/dna/README.md` covers the internals: determinism under Remotion's parallel
frame rendering, how the cheap glow pass works and why the
`.dna-glow-pass` CSS rule is load-bearing, and how depth of field is layered.
