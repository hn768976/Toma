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
| `Version 2 - Hair Repair Particles - Sapphire Black Hair (1080p).mp4` | `HairRepairV2` | Colour palette: blue background, aqua molecules, strand sealed to glossy black |
| `skin-layers-anatomy-4k-project.zip` | both skin compositions (4K) | |
| `hair-repair-particles-4k-project.zip` | both hair compositions (4K) | |

Why those variations: the skin reference is a locked-off shot, so a camera
move is the clearest change that keeps the anatomical colours meaningful. The
hair reference already has a strong camera move, so a palette change is the
clearest alternative there.

Hair colour: in the reference the repaired strand is dark caramel brown, so
Version 1 follows that (measured values below). Version 2 is the one that ends
on a black strand.

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
| Worst single-frame luma spike (of 255) | 0.00 | 0.05 | 0.11 | 0.10 |
| Audio | none | none | none | none |

The references have no audio stream, so the outputs have none.

## Project ZIPs

- `unzip -t` reports no errors on either archive.
- Each contains `src/`, `public/` (Montserrat font + licence for the skin
  project), `package.json`, `package-lock.json`, `remotion.config.ts`,
  `tsconfig.json`, ESLint/Prettier config and a README with the commands.
  `node_modules` and rendered output are excluded.
- Clean-room test on the final archives: extracted to an empty directory,
  `npm install` succeeded (346 packages each), then the documented scripts
  were run from the extracted copies:
  - `npm run render:v1:4k` and `render:v2:4k` on a 12-frame range – all four
    produced 3840x2160 H.264 30 fps files that decode cleanly.
  - `npm run render:v1` on a 30-frame range – 1920x1080 output; a frame
    compared against the delivered video gives PSNR 44.2 dB (skin) and
    45.1 dB (hair), i.e. the same picture apart from encoder noise.
- Not done: a full-length native 4K render. The delivered 1080p files were
  rendered full-length with the same documented scripts from the same source.
- TypeScript (`tsc`) and ESLint are clean in both projects.

## Independent visual verification

A separate reviewing agent compared the videos with the references five
times (timestamp-matched side-by-sides, full-resolution frames, per-frame
difference statistics); fixes were made after each round.

Its last pass (all four videos):

- No black or corrupt frames, flicker, popping, stutter, text overlap or
  elements leaving frame in any of the four videos.
- Skin V1: 8/10 similarity (first pass 5.5). Hair V1: 7.5/10 (first pass 6.5).
- Both Version 2s: clearly distinguishable, concept, timing and quality
  preserved; hair V2 reads as a glossy black strand.

After that pass one more change was made to the hair project only, to fix the
reviewer's top remaining item (repaired strand too thin and too bright). That
change was checked by direct measurement on the final file, not by another
review round:

| Time | Strand width, final / reference (px at 960 wide) | Strand colour, final / reference (mean RGB) |
| --- | --- | --- |
| 3.0 s | 219 / 235 | (96, 66, 32) / (93, 65, 35) |
| 4.4 s | 144 / 159 | (94, 66, 34) / (95, 67, 38) |
| 6.0 s | 91 / 89 | (90, 67, 38) / (104, 79, 54) |
| 8.8 s | 67 / 55 | (95, 73, 44) / (103, 77, 50) |

Matched: explode 0.0–2.0 s and collapse 8.4–10.4 s; stack opens downward with
the top sheet fixed; all 11 labels (wording, spelling, columns, bracket
orientation, first label at 1.3 s, fade timing); wavy layers, vessel lattice
on the dermis faces, sweat glands with ducts, leaders reaching the follicle
and gland; hair opening shot near-straight; irregular cracked damaged texture;
first particles at 1.3 s; ring travel; flare dip at 7.0 s and cut-off at 7.8 s;
end framing of the strand.

Remaining differences from the references:

1. Hair: molecules rush in about 1.7x as energetically as the reference and
   the flare enters about 0.15 s early; the late flare (7.1–7.6 s) is smaller
   than the reference's.
2. Hair: the highlight on the repaired strand is a soft band rather than a
   crisp streak; the damaged texture is slightly more pebbled; the opening
   shaft is a little wider at the base.
3. Skin: layer tops are flatter and thinner than the reference's organic
   folds; vessels are slightly thick and protrude at the block edges; dermis
   shading is flat.
4. Skin labels: Epidermis bracket section about 43 px too tall; right-hand
   labels 2–28 px above the reference positions.
5. Skin: short hair segments are visible in the gaps between exploded layers;
   the shadow is centred and faint when exploded.
6. Skin V2: leader lines cross early in the orbit and bunch late; the ground
   shadow does not follow the camera.

The stock watermark in the references was not reproduced.

## SHA-256

```
7c9ed656c553ef2d2758dbfa9c8d2e957219a26c1961b764604e7a0034ee13bd  Version 1 - Skin Layers Anatomy (1080p).mp4
dad75807452fc6932a491070e5be8ecc52db2eeb112e8719d8b1cf5dd5687dfe  Version 2 - Skin Layers Anatomy - Orbit Camera (1080p).mp4
0557ee80674867eb17fd1c7d86f70feed36cc9a7eb613f51082e61a2ead91104  Version 1 - Hair Repair Particles (1080p).mp4
59bbb80fb4c145ea35332970160c344520324aaf4df0abcc2097d1785e41beaa  Version 2 - Hair Repair Particles - Sapphire Black Hair (1080p).mp4
4d15a57f774ff2103b2d5ec1d7014d04e7663efddec41f096baab00c1458beea  skin-layers-anatomy-4k-project.zip
7de0b4b335030ac70cfd67bd6237bdb769d608ae8a95868adb9415a81e9eb9eb  hair-repair-particles-4k-project.zip
```
