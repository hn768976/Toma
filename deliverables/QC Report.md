# QC Report - Neuron compositions (Remotion, 4K masters, 1080p deliveries)

## What was delivered

| File | Content |
| --- | --- |
| Version 1 - Myelinated Neuron Axon (1080p).mp4 | Match of reference 1 (istockphoto-2241473350): slow push-in on a myelinated neuron |
| Version 2 - Myelinated Neuron Axon - Alternate Camera (1080p).mp4 | Same scene, different camera angle and movement: low tracking shot from the axon terminal back to the soma with a focus pull |
| Version 1 - Firing Neuron Synapses (1080p).mp4 | Match of reference 2 (istockphoto-1391682061): blue neuron firing orange, rack focus to the axon terminal |
| Version 2 - Firing Neuron Synapses - Alternate Palette (1080p).mp4 | Same animation, different palette: violet / magenta cell with mint-cyan firing |
| Myelinated Neuron Axon - Remotion Project (4K compositions).zip | Project with compositions MyelinatedNeuron-V1 / -V2 (3840x2160) |
| Firing Neuron Synapses - Remotion Project (4K compositions).zip | Project with compositions FiringNeuron-V1 / -V2 (3840x2160) |

Technology: Remotion 4.0.543 (projects scaffolded with the Remotion CLI, create-video) + Three.js / WebGL 2 with custom GLSL shaders. Fully procedural: no image, video, font or audio assets.

## Technical checks on the four MP4s (ffprobe + full decode of every frame)

| Check | Result |
| --- | --- |
| Renders completed (exit 0, no errors or warnings in the logs) | Pass, all 4 |
| Codec / container | H.264 High, MP4, yuv420p, BT.709 limited range - all 4 |
| Resolution | 1920x1080 - all 4 |
| Frame rate | exactly 30/1 (r_frame_rate and avg_frame_rate) - all 4 |
| Length vs reference | 300 frames, 10.000 s - identical to both references (300 frames, 10.000 s) |
| Decode test (ffmpeg -xerror, every frame) | No errors |
| Black frames | None (lowest frame mean luma is far above black in every file) |
| Frozen / duplicate frames | None |
| Audio | None - the references have no audio track, so none was added |
| Watermark / text | None |

## Project ZIP checks

| Check | Result |
| --- | --- |
| ZIP integrity (unzip -t) | Pass, both |
| Contents | package.json, package-lock.json, remotion.config.ts, tsconfig.json, eslint config, README.md, src/ (Root, engine, scene). No external assets are needed |
| Clean extract + npm ci + TypeScript check | Pass, both |
| Documented 4K commands (npm run render:v1:4k / render:v2:4k) from the extracted copy | Pass for all 4 compositions: 3840x2160, H.264, yuv420p, 30 fps |
| Documented 1080p commands from the extracted copy | Pass; re-rendered frames match the delivered files (PSNR 40-44 dB, i.e. only encoder noise) |
| 4K vs 1080p consistency | 4K frames downscaled match the delivered 1080p frames (PSNR 34.6-38.2 dB) |

Limit of the 4K check: the 4K renders were run on sample frame ranges of every composition (4-6 frames each), not as full 300-frame 4K exports. This machine has no GPU and a full 4K export takes roughly 40 minutes per video in software rendering.

## Visual review

An independent reviewer agent compared the videos with the references in three passes (side-by-side frames at matching timestamps, per-frame colour curves, and a numeric scan of every consecutive frame pair for pops). Its findings drove three rounds of fixes.

- Firing neuron: all 18 timed events (9 resets, 9 flash onsets) land on exactly the same frames as the reference. Bloom, hue and black level were corrected after the first pass.
- Myelinated neuron: soma-to-terminal span and the 1.26x push-in match the reference.
- Defects found and fixed: one-frame draw-order pops at the myelin nodes and at the soma, stair-stepped stripe edges, a tint step, a flickering myelin bead, full-range (yuvj420p) encoding.
- The last fix (axon core showing through sheath ends in the alternate-camera version, frames 98-175) was made after the reviewer's final pass. It was re-checked by inspecting crops of that range, not by the reviewer.
- Version 2 distinctness: the reviewer judged both alternates clearly distinguishable while keeping the concept and quality.

## Known differences from the references

These are procedural recreations, not copies. The reviewer scored the matches about 6 to 6.5 out of 10 on its second pass. The main remaining differences:

- Myelinated neuron: the soma is smoother and its bands broader than the reference's veined, spiny soma; the background neurons are brighter; the dendrites are less fine.
- Firing neuron: the soma and its main branches are more regular and tube-like than the reference; particles at peak are slightly paler; flash strength is constant where the reference varies a little per cycle.
- The firing videos change globally within one frame at resets and flash onsets, and in two steps just before each reset. This is intended and follows the reference.

## SHA-256

```
2be319649bfbce49f9dc7d255875160299fc3e2c2dce0f8429275aa33bb8c084  Firing Neuron Synapses - Remotion Project (4K compositions).zip
52848e298015b7fd80e844433daa7bbbf15417bde2f948d5ca5e3b01b1a2e1ad  Myelinated Neuron Axon - Remotion Project (4K compositions).zip
ed7e9e2f266ab75466d16fd9e6a55a26049bc45ac7d7edb2ab71541a576e6063  Version 1 - Firing Neuron Synapses (1080p).mp4
eb22fd9a14dcabe6ac5458a2eb476a2839ce661d6a61ae6fed0d49bcaab1b8ac  Version 1 - Myelinated Neuron Axon (1080p).mp4
754ede624907b59db7c2fca59c78a5321e573857d5dce143ce970fce185d88f5  Version 2 - Firing Neuron Synapses - Alternate Palette (1080p).mp4
33b9101934ef2efacd801627b5a3c129522e54d4f88ddfe88cb7d76d41d86ecc  Version 2 - Myelinated Neuron Axon - Alternate Camera (1080p).mp4
```
