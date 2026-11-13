# Quality-control report

Two Remotion projects, each with two 3840x2160 / 30 fps compositions, delivered
as four 1080p H.264 MP4s plus two project ZIPs. Both scenes are built in
Three.js (WebGL 2, custom GLSL shaders for the hair scene) with an SVG label
overlay for the anatomy scene.

## Deliverables

| File | Composition | Version 2 variation |
| --- | --- | --- |
| `Version 1 - Skin Layers Anatomy (1080p).mp4` | `SkinLayersV1` | – (matches reference) |
| `Version 2 - Skin Layers Anatomy - Orbit Camera (1080p).mp4` | `SkinLayersV2` | Camera movement: orbit + crane instead of a locked-off shot |
| `Version 1 - Hair Repair Particles (1080p).mp4` | `HairRepairV1` | – (matches reference) |
| `Version 2 - Hair Repair Particles - Sapphire Palette (1080p).mp4` | `HairRepairV2` | Colour palette: sapphire / ice instead of olive / amber |
| `skin-layers-anatomy-4k-project.zip` | both skin compositions (4K) | |
| `hair-repair-particles-4k-project.zip` | both hair compositions (4K) | |

Why those variations: the skin reference is a locked-off shot, so a camera
move is the clearest change that keeps the anatomical colours meaningful. The
hair reference already has a strong camera move, so a palette change is the
clearest alternative there.

## Technical checks (final files)

| Check | Skin V1 | Skin V2 | Hair V1 | Hair V2 |
| --- | --- | --- | --- | --- |
| Renders without errors or warnings | pass | pass | pass | pass |
| Codec / container | H.264 High / MP4 | H.264 High / MP4 | H.264 High / MP4 | H.264 High / MP4 |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (real and average) | 30/1 | 30/1 | 30/1 | 30/1 |
| Decoded frames | 360 | 360 | 270 | 270 |
| Duration (reference) | 12.000 s (12.000 s) | 12.000 s (12.000 s) | 9.000 s (9.000 s) | 9.000 s (9.000 s) |
| Pixel format / colour | yuv420p, BT.709 limited | same | same | same |
| Full decode with `-xerror` | clean | clean | clean | clean |
| Black frames (`blackdetect`) | none | none | none | none |
| Worst single-frame luma spike (of 255) | 0.00 | 0.04 | 0.11 | 0.12 |
| Audio | none | none | none | none |

The references have no usable audio, so the outputs carry no audio stream.
An early render came out as full-range `yuvj420p`; the project config was
changed to BT.709 limited range and everything was re-rendered.

## Project ZIPs

- `unzip -t` reports no errors on either archive.
- Each contains `src/`, `public/` (Montserrat font + licence for the skin
  project), `package.json`, `package-lock.json`, `remotion.config.ts`,
  `tsconfig.json`, ESLint/Prettier config and a README with the commands.
  `node_modules` and rendered output are excluded.
- Clean-room test: both ZIPs were extracted to an empty directory,
  `npm install` succeeded (346 packages each), then the documented scripts
  were run from the extracted copies:
  - `npm run render:v1:4k` and `render:v2:4k` on a 12-frame range – all four
    produced 3840x2160 H.264 30 fps files that decode cleanly.
  - `npm run render:v1` on a 30-frame range – 1920x1080 output; a frame
    compared against the delivered video gives PSNR 44.0 dB (skin) and
    46.1 dB (hair), i.e. the same picture apart from encoder noise.
- Not done: a full-length native 4K render. The delivered 1080p files were
  rendered full-length with the same documented scripts from the same source.
- TypeScript (`tsc`) and ESLint are clean in both projects.

## Independent visual verification

A separate reviewing agent compared the videos with the references three
times (timestamp-matched side-by-sides, full-resolution frames, per-frame
difference statistics). Two rounds of fixes were made from its findings.

Final verdict:

- No black or corrupt frames, flicker, popping, stutter, text overlap or
  elements leaving frame in any of the four videos.
- Skin V1: 7.5/10 similarity (first pass 5.5). Hair V1: 7.5/10 (first pass 6.5).
- Both Version 2s: clearly distinguishable, concept, timing and quality preserved.

Matched after fixes: explode 0.0–2.0 s and collapse 8.4–10.4 s with
near-linear rate; stack opens downward with the top sheet fixed; label wording,
spelling, column positions, bracket orientation and fade timing; hair count
and length; particle entry at 1.3 s; ring travel; flare width and 7.8 s
cut-off; end framing of the hair strand.

Remaining differences from the references (not fixed):

1. Skin layers are procedural slabs with gentle waves; the reference model has
   thicker, more organic folds, a vessel lattice drawn on the dermis faces and
   coiled sweat glands with ducts.
2. Hair opening shot (0–2 s): the strand is still somewhat more curved and
   conical than the near-straight reference.
3. Damaged-hair texture reads as regular rows of scales rather than an
   irregular cracked mosaic; the repaired strand is slightly more matte.
4. Hair: glow appears about 0.15 s early and the ring leads slightly until
   about 3.5 s; the flare only partly dips at about 7.0 s.
5. Skin labels: "Hair Follicle" / "Sweat Pore" leaders stop at the model edge;
   some labels sit 10–33 px off the reference positions; the last labels land
   about 0.2 s late.
6. Skin shadow is a little fainter and further from the block.
7. Skin V2: right-hand leader dots sit over vessel loops near 8 s and the
   ground shadow does not follow the orbit.
8. Hair V2: slight highlight clipping along the flare line.
9. Skin V1: a small dark wedge at the right end of the squamous layer and one
   short hair segment visible between layers.

The stock watermark in the references was not reproduced.

## SHA-256

```
8a263dc417ae5a5170f5062a3a60081adc17d8a3d989b91d95e2db70f3aea30d  Version 1 - Skin Layers Anatomy (1080p).mp4
ae3b088153139028c714a261f8d221a083536d3d63350a714c7830db337f4917  Version 2 - Skin Layers Anatomy - Orbit Camera (1080p).mp4
a51e096c6c91a8f7755979dcec1aedc5fffd746d095bcb7c83b1313a9f8868cd  Version 1 - Hair Repair Particles (1080p).mp4
6102e6473665cb84ad24e9e267f424d27e2bdaeffcc94cc4d60bd127663dcc86  Version 2 - Hair Repair Particles - Sapphire Palette (1080p).mp4
70503f30071ea3c5701dc92e8a95c95bf6c94b3e95d49d15ea5fb305281cd80f  skin-layers-anatomy-4k-project.zip
0756113e26fb86f0d05651fd30a25a988d48108f2ccba1e76606dbe15353de7a  hair-repair-particles-4k-project.zip
```
