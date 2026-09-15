# Dental motion graphics — nine versions

Nine 3D dental animations built with **three.js / WebGL** and rendered
with the **Remotion CLI**. Each one matches a supplied reference clip in
subject, duration and frame rate.

## Deliverables

| Version | Subject | Duration | Frames |
|---|---|---|---|
| `01-PlaqueClean` | Plaque removal by cleaning bubbles | 6.70s | 201 |
| `02-CariesFormation` | Formation of a carious lesion | 7.03s | 211 |
| `03-Biofilm` | Biofilm and a plant-essence rinse | 10.03s | 301 |
| `04-GingivalDisease` | Progression of gingival disease | 6.70s | 201 |
| `05-GumRestoration` | Restoring inflamed, receded gingiva | 6.70s | 201 |
| `06-TartarCrystals` | Calculus lifted by mineral crystals | 10.00s | 300 |
| `07-WireframeScan` | Scan visualisation | 16.70s | 501 |
| `08-WhiteningArch` | Whitening across the arch | 5.00s | 150 |
| `09-EnamelSparkle` | Enamel polish | 6.68s | 200 |

All nine are 30fps, 16:9, silent, H.264 in an MP4 container.

Every version is registered twice:

* `<id>` — 1920×1080, the delivered files
* `<id>-4K` — 3840×2160, the master composition

The compositions differ only in the `resolutionScale` prop, which
controls supersampling and nothing about layout, so the 4K master is the
same shot at four times the pixels.

## Rendering

```bash
npm install
python3 tools/bake_mandible.py <source.glb> public/models/mandible.bin   # only if re-baking
tools/render-all.sh out/1080p                                            # all nine, 1080p
```

A single composition, at either resolution:

```bash
npx remotion render 03-Biofilm out/03.mp4 --codec=h264 --crf=17
npx remotion render 03-Biofilm-4K out/03-4k.mp4 --codec=h264 --crf=17
```

Interactive preview:

```bash
npx remotion studio
```

## How it is put together

### The mesh is preprocessed, not authored

The source GLB is a Meshy reconstruction of a lower dental cast: **one
fused shell, 56k vertices, no materials, no textures, no per-tooth
grouping, no animation**. Nothing in it distinguishes enamel from
gingiva. `tools/bake_mandible.py` derives all of that offline:

1. **Gum margin as a curve.** Per-edge concavity is measured across the
   mesh; the gingival sulcus is its strongest feature. Vertices are then
   binned by arch angle and, in each bin, the crease height and the
   tooth-band radius are read off and smoothed around the arch. This
   recovers the *scalloped* margin — a flat height threshold cannot.
2. **Loop subdivision.** The scan is low-poly enough that macro framings
   show facets, so it is subdivided once, to 375k triangles, which also
   smooths the limit surface.
3. **Ambient occlusion**, baked by voxel ray marching.
4. **Tooth islands**, found at the interproximal dips in the crown-height
   profile (18 islands on this scan).

The result is a flat little-endian buffer, `public/models/mandible.bin`,
whose layout is documented in `src/dental/mesh/mandible.ts`.

### One shader, nine looks

`src/dental/materials/archShader.ts` is the only material the arch uses.
Stain, plaque, calculus, gingival inflammation, caries, enamel polish and
the fluoride layer are all uniforms, so **a version is a set of uniform
curves over time**, not a separate scene. That is what keeps the nine
looking like one set, and what lets version 05 be version 04 run
backwards.

Two decisions carry most of the realism:

* **The gum line is not baked.** Each vertex stores its signed height
  above the margin, so driving `gumLine` negative retreats the gingiva and
  uncovers root that was always modelled underneath — real recession
  rather than a texture cross-fade.
* **Disease accumulates where it would in life.** Every deposit layer is
  masked by the baked occlusion and by proximity to the margin, so stain
  and plaque settle into fissures and interproximal spaces instead of
  coating the tooth evenly.

The light rig is authored in **view space**. Enamel only reads as glossy
when a source sits near the view axis, and a world-fixed rig would slide
the highlight off the buccal faces the moment the camera moved.

### Effects

`src/dental/fx/ParticleField.tsx` is one instanced system with four
looks — bubble, sparkle, debris, crystal. Spawn points are **sampled off
the arch surface itself** (filtered by the baked attributes: crown, gum
margin, gingiva, or occluded crevice), and emission is gated on the same
arch-angle wavefront that drives the cleaning in the shader. Bubbles
therefore only appear where enamel is actually being cleared. All motion
is derived in the vertex shader from `uTime`, so there is no per-frame
CPU work.

### Depth of field

`src/dental/scene/DepthOfField.tsx` is a single-pass effect: the scene is
drawn once into a target carrying a depth texture, and one full-screen
pass derives a circle of confusion and gathers a 12-tap disc. three's
`BokehPass` renders the scene a second time for depth, which ~2300
software-rasterised frames cannot afford.

Two things worth knowing if you touch it:

* three always writes **linear** into a plain render target regardless of
  the texture's `colorSpace`, so this pass owns the conversion to sRGB.
* The target is sized inside `useFrame`, not an effect — Remotion captures
  the frame that `useFrame` draws, and an effect that has not run yet
  leaves the pass sampling one texel per screen.

### Loading

The mesh is loaded with React's `use()` and **suspends**.
`<ThreeCanvas />` only calls three's `advance()` when the Remotion frame
changes, so resolving the buffer with `setState` would update React but
never trigger a redraw, and the frame would be captured with an empty
canvas. Suspending lets `ThreeCanvas` hold its own `delayRender` until the
buffer lands.

## Layout

```
public/models/mandible.bin      baked arch (11MB)
tools/bake_mandible.py          GLB -> mandible.bin
tools/render-all.sh             render all nine at 1080p
src/dental/
  mesh/                         binary format, loader, tooth anchors
  materials/                    arch shader, wireframe shader, palette, noise
  scene/                        stage, camera paths, backdrop, depth of field
  fx/                           instanced particles, surface sampling
  versions/                     the nine shots
```

## Notes and limits

* **Only a lower jaw was supplied.** Versions 04 and 05 need an opposing
  arch, so the mandible is mirrored, widened slightly and given an
  overjet. It is a stand-in, not maxillary anatomy — the palate and
  maxillary tuberosity are wrong if you look for them, though at these
  framings they sit behind the subject and out of focus.
* Tooth islands are geometric, not anatomical. The bake finds 18 on a
  16-tooth arch, since two molars split at a deep central fissure. They
  are used for staggering effects and for targeting one tooth, never as
  anatomical labels.
* Rendering is software-rasterised in this environment (~2s/frame at
  1080p). On a machine with a GPU this will be far quicker, and the 4K
  masters become practical.
