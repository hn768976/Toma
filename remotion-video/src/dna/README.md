# DNA / Molecule motion plates

Thirteen 3D motion-graphics plates built on the two supplied GLB models, each
tracking one reference clip for palette, composition, framing and camera move.

Every version is registered twice:

| Composition | Size |
| --- | --- |
| `V01FrostedMolecules` … `V13AzureCopySpace` | 1920 × 1080 |
| `V01FrostedMolecules4K` … `V13AzureCopySpace4K` | 3840 × 2160 |

Both run at **30 fps** and share the same scene code — `resolutionScale`
(`width / 1920`) is the only thing that changes, and it scales pixel-denominated
values such as point sprite size, CSS blur radii and HUD type.

## The models are never modified

Both GLBs ship as a single un-materialed mesh (`POSITION` / `NORMAL` /
`TEXCOORD_0`, no materials, no textures, no images). `model.ts` loads each one,
centres it on the origin and normalises its longest axis to 2 units so every
composition can reason in the same scale — no vertices are added, removed or
moved. All shading is authored in `materials.ts` and attached at render time.

The particle and wireframe versions do not use a different model either. They
draw the *same* geometry a different way:

- `sampleSurface()` does area-weighted triangle sampling to produce a point
  cloud that sits exactly on the mesh surface.
- `edgesOf()` wraps `THREE.EdgesGeometry` to pull the mesh's sharp edges out as
  line segments.

## Layout

| File | Role |
| --- | --- |
| `constants.ts` | fps, sizes and the 13 version specs (durations, models, notes) |
| `model.ts` | GLB loading, normalisation, surface sampling, edge extraction |
| `useModels.ts` | React hook that holds `delayRender()` open until models load |
| `Stage.tsx` | three canvas wrapper: camera rig, procedural environment, fog, glow pass |
| `Primitives.tsx` | `Solid`, `SurfacePoints`, `Wire`, `Dust` |
| `materials.ts` | frosted / glossy glass, ceramic, metal, fresnel rim, iridescent, hologram, band glow |
| `Hud.tsx` | the sci-fi interface layer used by V05 |
| `Plexus.tsx` | SVG point network and skeletal-formula marks used by V11 and V13 |
| `versions/` | one file per plate |
| `register.tsx` | registers all 26 compositions |

## Determinism

Remotion renders frames in parallel across several browser tabs, so a frame must
be a pure function of its frame number. Nothing here uses `useFrame`, a timer or
`Math.random()`:

- every animated value derives from `useCurrentFrame()`;
- all randomness comes from the seeded PRNG in `random.ts`;
- `ThreeCanvas` runs with `frameloop="never"` and is advanced once per frame.

## The glow pass

Refs 02, 04, 05, 07, 08, 11 and 13 need bloom. Rather than run an
`UnrealBloomPass` — expensive under the software rasteriser used for headless
rendering — `Stage` draws the scene a second time into a small drawing buffer
(30% by default), stretches it back over the frame and CSS-blurs it under a
`screen` blend. Dark pixels contribute nothing to a screen blend, so only bright
areas bloom, and the blur runs in the compositor rather than in shaders.

> The `.dna-glow-pass canvas` rule in `src/index.css` is load-bearing: three.js
> sets an explicit CSS width/height on a canvas when it sizes the drawing
> buffer, which would otherwise pin the glow pass to a small box in the
> top-left corner instead of filling frame.

## Depth of field

Versions with a strong focal falloff (01, 03, 06, 09, 12) stack two or three
`Stage` layers with `clearAlpha={0}` and apply a CSS blur to the far ones. This
is far cheaper than a `BokehPass` and gives direct control over each layer.

## Rendering

```bash
npx remotion bundle src/index.ts --out-dir=build   # once
./scripts/render-all.sh                            # 13 × 1080p -> out/1080p
./scripts/render-all.sh 4k                         # 13 × 2160p -> out/4k
```

`--gl=swangle` is required when rendering headless without a GPU. On a machine
with a real GPU, `--gl=angle` is considerably faster.

Single composition:

```bash
npx remotion render src/index.ts V05GenomeHud4K out/v05.mp4 \
  --gl=swangle --codec=h264 --crf=16
```

Interactive preview: `npx remotion studio`.

## Re-labelling the HUD

`HUD_COPY` at the top of `Hud.tsx` holds every string in the V05 interface
(panel title, footer, callout labels, log lines). All of it is invented
placeholder copy — nothing is taken from the reference clip. Change the strings
there and the layout reflows on its own.
