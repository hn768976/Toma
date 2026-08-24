# blender

Procedural Blender scenes, rendered headlessly.

## Glowing brain (`neural_brain.py`)

![neural brain](../render/neural_brain.png)

A holographic brain of light on a dark navy field: a translucent cortex whose
glow follows the crests of its gyri, a fine wireframe net, a halo of radiating
light needles, red synapse sparks, and a low-poly crystal pedestal. Every
element is generated in code — no external meshes, textures, HDRIs or add-ons.

### Render it

With a normal Blender install (4.5 or 5.x):

```sh
blender -b -P blender/neural_brain.py -- --out render/neural_brain.png
```

With Blender as a Python module, which needs no Blender app at all:

```sh
uv venv --python 3.11 .venv-blender
VIRTUAL_ENV=.venv-blender uv pip install bpy
.venv-blender/bin/python blender/neural_brain.py --out render/neural_brain.png
```

The committed image is 1920×1080 at 128 Cycles samples — about 20 minutes on
4 CPU cores. A preview is far quicker:

```sh
.venv-blender/bin/python blender/neural_brain.py \
    --out /tmp/preview.png --width 720 --height 405 --samples 32 --voxel 0.03
```

### Options

| Flag | Default | What it does |
|---|---|---|
| `--out` | `render/brain.png` | output PNG |
| `--width` / `--height` | 1920 / 1080 | resolution |
| `--samples` | 128 | Cycles samples (denoising is on) |
| `--seed` | 7 | everything random derives from this |
| `--streaks` | 900 | light needles in the halo |
| `--sparks` | 170 | synapse dots |
| `--voxel` | 0.022 | remesh voxel size — lower is finer and slower |
| `--fold-scale` | 1.15 | size of the field that lays out the gyri |
| `--fold-freq` | 26.0 | how many ridges that field is cut into |
| `--fold-amp` | 0.09 | fold depth |
| `--wire-ratio` | 0.03 | wire net density (`0` turns the net off) |
| `--blend` | — | also save the .blend |
| `--no-render` | — | build the scene without rendering |

### How the brain is built

1. **Blocking.** Ellipsoids for the cerebrum, two temporal lobes and the
   cerebellum, plus a tapered cone for the stem, are joined and fused into one
   watertight skin by a voxel remesh.
2. **Gyri.** Each vertex is displaced along its normal by
   `sin(freq · noise(p))`, sampled from a smooth, anisotropically stretched
   noise field. The iso-surfaces of that field cut the skin into long winding
   ridges rather than isotropic lumps — the difference between a brain and a
   cauliflower. The cerebellum gets tight parallel folia instead, the midline
   gets a longitudinal fissure, and the stem stays smooth.
3. **Fold attribute.** The same fold value is baked per-vertex into a colour
   attribute named `Fold`. The shader reads it, so the glow sits exactly on the
   crests; deriving it from curvature instead just samples voxel noise.
4. **Shading.** Emission mixed with a Transparent BSDF (mostly transparent, so
   the far side of the cortex shows through), tinted deep blue in the sulci and
   near-white on the crests, with a fresnel term added to the energy for the rim.
5. **Extras.** A decimated copy with a Wireframe modifier supplies the mesh net
   (trimmed off the stem); the needles and sparks are single meshes built in
   bmesh, tinted per element through a vertex-colour attribute so one material
   covers hundreds of differently coloured pieces.
6. **Post.** Two compositor Glare passes — a wide bloom for the halo and a
   subtle streak pass for the star flares on the brightest sparks.
