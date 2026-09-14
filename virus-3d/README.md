# Virus 3D — 10 shot-matched motion backgrounds

Ten 3D virus shots built in **Remotion + three.js (WebGL)**, each one matched to
a supplied reference clip. Every shot renders at **30 fps, H.264 / MP4**, in both
**1920×1080** and **3840×2160**.

The supplied model (`public/virus.glb`) is used **as-is**. Its topology is never
modified — no remeshing, no decimation, no vertex edits. All ten looks differ
only in shading, lighting, colour, framing and motion.

## Quick start

```bash
npm install
npm run dev                  # Remotion Studio — all 20 compositions
./scripts/render.sh 1080     # 10 × 1080p MP4  -> out/1080p/
./scripts/render.sh 4k       # 10 × 4K MP4     -> out/4k/
./scripts/render.sh 4k v03   # one look only
```

## Compositions

Each look is registered twice, `<id>-1080` and `<id>-4k`. Durations match the
reference clips in *seconds* (the references run at 25 and 29.97 fps; these are
re-timed to 30 fps, so the frame counts differ but the running time does not).

| id  | Look                        | Reference             | Length  | Frames @30fps |
|-----|-----------------------------|-----------------------|---------|---------------|
| v01 | Deep Navy Hero              | istock-2248309812     | 10.00 s | 300 |
| v02 | Clinical Blue               | istock-2262127445     | 10.00 s | 300 |
| v03 | Crimson Clinical            | istock-1217649829     | 16.67 s | 500 |
| v04 | Macro Teal Data             | istock-1308357363     | 15.02 s | 451 |
| v05 | Macro Light Data            | istock-1308355965     | 15.02 s | 451 |
| v06 | Bio Green                   | istock-2249957548     |  9.04 s | 271 |
| v07 | Mint Microscope             | istock-1212544935     | 29.96 s | 899 |
| v08 | Violet Particle Hero        | istock-1251512321     | 15.02 s | 451 |
| v09 | Particle Dissolve Flythrough| istock-1329035209     |  7.04 s | 211 |
| v10 | Hero Dissolve               | istock-1329035137     |  7.04 s | 211 |

## How a shot is built

`src/VirusVideo.tsx` composites back to front:

```
plate → defocused swarm (half-res WebGL + CSS blur) → network graph
      → hero (full-res WebGL) → dust → foreground bokeh
      → backlight bloom → vignette → grain → grade
```

Two WebGL contexts, not three. The foreground layer is pure out-of-focus
bokeh, which CSS draws identically to a third canvas for a fraction of the
cost, and the swarm canvas renders at half resolution because it sits behind a
blur where the extra pixels are invisible.

### The model, and what "texture only" means here

The GLB carries **positions only** — no normals, no UVs, no materials. So:

* vertex normals are computed at load time (`src/three/useVirusGeometry.ts`),
* the mesh is centred and normalised to unit radius,
* and because there are no UVs, all surface detail is **procedural**, generated
  in object space so it sticks to the mesh as it rotates.

The two-tone capsid/spike split (clearest in v03: bone capsid, crimson spikes)
comes from each vertex's distance from the centre. The measured radius
distribution of this mesh runs 0.59 → 1.00, with the capsid body around
0.60–0.78 and spikes reaching 1.00, so `spikeStart`/`spikeEnd` per look mask
between those.

### Surface shader — `src/three/VirusSurface.tsx`

fbm-perturbed normals for the protein shell, then a hand-rolled lighting model:
key + fill diffuse, Blinn-Phong specular, a directional back-light for shell
translucency, a grazing-angle rim gated to the backlit side, emissive spike
tips, and a depth fade toward the plate colour.

Two things matter if you tune it:

* **Subsurface and rim read off the geometric normal, not the bumped one.**
  Driving them from the perturbed normal makes every micro-facet that tilts
  away from the key light glow, and the capsid ends up covered in coloured fuzz.
* Defocused copies compile with `#define SIMPLE`, which skips the fbm entirely.

### Point cloud — `src/three/VirusPoints.tsx`

v04, v05, v08, v09 and v10 draw the *same* geometry with `gl.POINTS`, one point
per source vertex. Nothing about the mesh changes; only the draw mode does.
`uDissolve` pushes each point outward along its own normal plus a curl offset,
with a per-point lag so the cloud comes apart unevenly — that's the v09/v10
dispersal.

Point size is a **world-space diameter** scaled by `drawingBufferHeight / 2`,
so a dot covers the same fraction of frame at 1080p and 4K.

## Resolution parity

The 4K compositions are a true up-res of the 1080p ones, not a different-looking
frame. Everything resolution-dependent scales off composition width: CSS blur
radii, bokeh and dust sizes, SVG line weights (`useScale()` in `src/fx/Plate.tsx`)
and point sizes (via `pixelScale`). Render either and the framing, defocus and
grain grade match.

## Determinism

Remotion renders frames out of order and in parallel, so nothing may animate on
its own clock:

* no `useFrame()`, no `Date.now()`, no unseeded `Math.random()`;
* every shader time uniform is `useCurrentFrame() / fps`;
* swarm placement, bokeh, dust and grain all come from Remotion's seeded
  `random()`;
* the camera never moves — the world group does — so all transforms stay
  declarative props rather than mutations during render.

## Rendering notes

`scripts/chrome-swiftshader.sh` wraps the Chrome binary to add
`--enable-unsafe-swiftshader`. Remotion 4.x passes `--use-gl=angle
--use-angle=swiftshader` for `--gl=swangle`, but Chrome ≥140 refuses the
software WebGL fallback without that extra flag, and the canvases come back
empty with only a console warning. On a machine with a real GPU, drop both
`--gl=swangle` and `--browser-executable` and render with Remotion's own Chrome.

Set `VIRUS3D_CHROME_BIN` to point the shim at a specific browser.

Frame intermediates are PNG (`remotion.config.ts`): these plates are mostly
smooth dark gradients, where JPEG intermediates band visibly.

Software WebGL renders at roughly 1.6 s/frame at 1080p on 4 cores. The full
1080p set (4,045 frames) takes about 1.8 hours; 4K is substantially longer and
is best run on a GPU machine.

## Layout

```
public/virus.glb            supplied model, unmodified
src/looks.ts                the 10 look definitions — all per-shot tuning lives here
src/VirusVideo.tsx          layer compositing
src/Root.tsx                registers 10 × 1080p + 10 × 4K
src/three/
  useVirusGeometry.ts       GLB load, normals, unit-radius normalise, seeded per-vertex randoms
  VirusSurface.tsx          surface shader + material factory
  VirusPoints.tsx           point-cloud shader (dotted surfaces + dissolve)
  Layers.tsx                hero and swarm layers
  motion.ts                 frame-driven camera/world/swarm motion
  noise.ts                  simplex + fbm GLSL
src/fx/Plate.tsx            plate, bloom, bokeh, dust, network graph, vignette, grain
scripts/render.sh           batch render
scripts/chrome-swiftshader.sh
```

To retune a shot, edit its entry in `src/looks.ts` — colours, lighting
directions, spike masks, framing, camera move, swarm density, dust and grade are
all there. Nothing else needs touching.
