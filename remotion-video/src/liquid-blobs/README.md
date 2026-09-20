# Liquid Blobs

A loopable 3D liquid-metaball motion piece, in four colourways, built with
Remotion + three.js. 1920×1080 and 3840×2160 compositions, 30fps, 358 frames
(11.93s) — the length of the reference clips, which run 11.92s at 25fps.

| Composition | Colourway |
| --- | --- |
| `LiquidBlobs-V1-Blue-1080p` / `-4K` | Electric blue on cyan |
| `LiquidBlobs-V2-White-1080p` / `-4K` | White on dusty rose |
| `LiquidBlobs-V3-Red-1080p` / `-4K` | Cherry red on pastel pink |
| `LiquidBlobs-V4-Beige-1080p` / `-4K` | Nude beige on pale sage |

## Rendering

```console
./render-liquid-blobs.sh            # all four, 1080p
./render-liquid-blobs.sh 4K         # all four, 3840x2160
./render-liquid-blobs.sh 4K V3-Red  # one variant
```

On a machine with a real GPU, drop the SwiftShader flag — it is only there for
headless hosts with no graphics hardware, and it is by far the biggest cost:

```console
REMOTION_GL=angle ./render-liquid-blobs.sh 4K
```

Or call Remotion directly:

```console
npx remotion render LiquidBlobs-V1-Blue-4K out/v1-4k.mp4 \
  --codec=h264 --image-format=png --crf=16
```

`--image-format=png` is not optional in spirit: the frames are mostly very
shallow gradient, and the default JPEG intermediate leaves visible blocking in
them before h264 ever sees the picture.

## How it works

### Rendering backend

`renderer.ts` prefers **WebGPU** and falls back to **WebGL2**, then **WebGL**.

three.js' `WebGPURenderer` is backend-agnostic, so the same node graph drives
either API — there is one implementation of the look, not one per backend.
Selection is deliberate rather than automatic, because a browser can advertise
`navigator.gpu`, hand out an adapter, and still fail at the first draw. Two
things are checked:

- **Is the adapter real hardware?** A software adapter (SwiftShader, llvmpipe,
  lavapipe) is declined. Software WebGPU is slower than the WebGL2 path the
  same rasteriser already serves, and on a headless host it tends to drop its
  instance mid-submit.
- **Does it actually draw?** A throwaway frame is rendered on a *separate*
  canvas. A canvas only ever hands out one kind of context, so probing on the
  real canvas would leave it claimed by WebGPU and unable to fall back.

Dawn reports some device failures out of band as unhandled rejections, and
Remotion fails a render on any of those, so the probe suppresses them for its
duration. The result is cached per page.

Force a backend with the `renderer` prop (`auto` / `webgpu` / `webgl2` /
`webgl`); a forced choice still falls back rather than rendering nothing. Set
`debugOverlay: true` to print which backend won.

### The image

`material.ts` builds the entire frame — backdrop and liquid — in one fragment
shader written in **TSL**, three.js' backend-agnostic shading language, which
compiles to WGSL or GLSL ES 3.0 as needed.

The liquid is a signed distance field: eight spheres combined with a
polynomial smooth-minimum. Smooth-min is what gives the characteristic necks
and fillets as two blobs approach — they bulge toward each other and fuse,
rather than intersecting as hard spheres would. Surface normals come from the
field gradient, and ambient occlusion from short marches along the normal,
which is what shades the crease where two blobs meet.

The lighting is deliberately low contrast. Sampling the reference clips shows
each blob spanning only about five code values from shadow to highlight, so a
textbook Lambert terminator is far too hard: the key is wrapped and then
pulled most of the way back toward flat albedo, and the form is carried by a
grazing-angle lip. Highlights run through a soft shoulder, which reproduces
the way the already-strong channel of a saturated blob barely moves while the
others climb. Backdrop colours are sampled straight from the references and
pass through the shoulder untouched.

Because silhouettes are produced *inside* the shader, hardware MSAA cannot see
them. `superSample` is the only antialiasing they get: 1 gives a hard 1px
edge, 2 gives a properly resolved one, 3 is barely distinguishable from 2 and
costs more than twice as much. 2 is the default.

### The loop

`motion.ts` drives every channel as a sum of sines whose frequencies are whole
numbers of cycles per loop. A signal built that way has the loop length as an
exact period, so frame 0 and frame 358 are bit-identical and the clip cuts back
on itself invisibly — no cross-fade, and no frozen moment at the seam either.

Six of the eight balls belong to the mass on the right and orbit each other
inside it; two are free satellites on opposite beats. That split is what holds
the reference's composition: one large body anchored to frame right, one or
two satellites, and nothing else.

## Checking a choreography change

`motion.ts` is easy to break in ways a contact sheet will not show — a
one-frame sliver of background in a corner is invisible in a sample grid and
very obvious in motion. The validator re-implements the ray march on the CPU
at low resolution and scans **every** frame, reporting:

- background appearing at the right edge (the mass must always anchor there)
- a free satellite sliced by the frame (the references never do this; a
  satellite leaves by fusing into the mass)
- more than three separate blobs, or a frame under 25% covered
- a mass whose visible outline is shaped by only one ball, which is what makes
  a frame read as two flat circles rather than liquid

```console
npx tsc src/liquid-blobs/motion.ts src/liquid-blobs/constants.ts \
  --outDir /tmp/lb --module commonjs --target es2022 --skipLibCheck
node tools/validate-choreography.cjs /tmp/lb 358
```

It takes about 13 seconds for the whole loop, against roughly six seconds per
frame for a real render.
