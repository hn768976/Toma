# QC Report - Neuron compositions (Remotion, 4K masters, 1080p deliveries)

This report covers the re-matched renders (second delivery).

## What was delivered

| File | Content |
| --- | --- |
| Version 1 - Myelinated Neuron Axon (1080p).mp4 | Match of reference 1 (istockphoto-2241473350): slow push-in on a myelinated neuron |
| Version 2 - Myelinated Neuron Axon - Alternate Camera (1080p).mp4 | Same scene, different camera angle and movement: tracking shot from the axon terminal back to the soma with a focus pull |
| Version 1 - Firing Neuron Synapses (1080p).mp4 | Match of reference 2 (istockphoto-1391682061): blue neuron firing orange, rack focus to the axon terminal |
| Version 2 - Firing Neuron Synapses - Alternate Palette (1080p).mp4 | Same animation, different palette: violet / magenta cell with mint firing |
| Myelinated Neuron Axon - Remotion Project (4K compositions).zip | Project with compositions MyelinatedNeuron-V1 / -V2 (3840x2160) |
| Firing Neuron Synapses - Remotion Project (4K compositions).zip | Project with compositions FiringNeuron-V1 / -V2 (3840x2160) |

Technology: Remotion 4.0.543 (projects scaffolded with the Remotion CLI, create-video) + Three.js / WebGL 2 with custom GLSL shaders. Fully procedural: no image, video, font or audio assets.

## What changed in the re-match

- Myelinated neuron: veined cell body (pale tissue, red patches, cyan veins) with spines along the soma and axon; straight bare-tree dendrite and terminal thickets in place of curly fibres; dark flat-ended myelin cylinders with glowing nodes; a row of sister neurons receding up and to the left; finer dust; deeper blacks and higher contrast; background blur that grows through the shot.
- Firing neuron: axon rebuilt on the reference layout (short wavy segment, bead chain, terminal tree at upper right); thinner tapering trunks ending in dense feathery tufts; tree tilted for an oblique view; background neurons removed so the right side stays black; saturated blue; orange dash-shaped sparks; soma and trunks flash first, then the axon lights before each reset.
- Renderer: tube pieces no longer overlap at joints (removes dotted thin lines and stippled blur), ball joints at forks, sheath ends that turn elliptical when seen obliquely.

## Technical checks on the four MP4s (ffprobe + full decode of every frame)

| Check | Result |
| --- | --- |
| Renders completed (exit 0, no errors or warnings in the logs) | Pass, all 4 |
| Codec / container | H.264 High, MP4, yuv420p, BT.709 limited range - all 4 |
| Resolution | 1920x1080 - all 4 |
| Frame rate | exactly 30/1 (r_frame_rate and avg_frame_rate) - all 4 |
| Length vs reference | 300 frames, 10.000 s - identical to both references |
| Decode test (ffmpeg -xerror, every frame) | No errors |
| Black frames | None |
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
| Documented 1080p commands from the extracted copy | Pass; re-rendered frames match the delivered files (PSNR 38-43 dB, i.e. encoder noise) |
| 4K vs 1080p consistency | Same picture. PSNR of 4K frames downscaled vs the 1080p delivery: 35 dB (myelinated), 29-33 dB (firing; the glow and defocused sparks come out a few percent different in brightness between the two sizes) |

Limit of the 4K check: the 4K renders were run on a 6-frame sample range of every composition, not as full 300-frame 4K exports. This machine has no GPU and a full 4K export takes roughly 40-60 minutes per video in software rendering.

## Visual review

An independent reviewer agent compared the re-matched videos with the references in two passes (side-by-side frames, colour and black-level statistics, and a numeric scan of every consecutive frame pair for pops).

- Scores on the final pass: Myelinated V1 6.5/10, Myelinated V2 7/10, Firing V1 6.5/10, Firing V2 7/10 (previous delivery: 6 to 6.5).
- Firing neuron timing: all 9 resets and 9 flash onsets land on exactly the reference frames.
- No one-frame pops, no draw-order glitches, no banding in any of the four files.
- Both Version 2s judged clearly distinguishable from their Version 1 (camera for the myelinated neuron, palette for the firing neuron).

## Known differences from the references

These are procedural recreations, not copies. What the reviewer still sees, most visible first:

- Myelinated neuron: only two of the receding background neurons read clearly (the reference shows about five) and the bright white defocused fibre mass on the left is missing; the soma is a smooth spindle rather than an irregular rooted shape; blacks are close but still slightly lifted (38% near-black pixels vs 47%); background neurons lean pink where the reference is white-grey; nodes glow only faintly.
- Firing neuron: the cell still reads as a fairly frontal star with a lumpy soma, where the reference is an irregular oblique mass filling the left two-thirds; calm phases are darker and stiller than the reference (mean luma 34 vs 56); the peak of each burst is more orange than the reference's blue-white; the bead chain is more angular.
- Minor rendering traits visible on close inspection: flat-cut tube ends at some branch forks (most visible in the first 2 s of the alternate-camera video), faint dashed 1 px edge lines on in-focus striped trunks, hard facets on the firing neuron's soma.
- The firing videos change globally within one frame at resets and flash onsets, and in two steps just before each reset. This is intended and follows the reference.

## SHA-256

```
559e9e84767fb7621ecc17d272819c44b75020b261c8f5bb374b73d08381eeca  Version 1 - Firing Neuron Synapses (1080p).mp4
1c564b86dad5c5894c19e1331ca5c19777331a3d3489e5f427831d1da1ada4bb  Version 1 - Myelinated Neuron Axon (1080p).mp4
6908b02bdf6c6e4159203832143302416b3fb2bef4ae21ab56e39798e4c4afed  Version 2 - Firing Neuron Synapses - Alternate Palette (1080p).mp4
aed2cf5671d08df35b652397de1b1a5dba351d5e953ede558cabd30199398e00  Version 2 - Myelinated Neuron Axon - Alternate Camera (1080p).mp4
090550fbba443f0699901ebae5b8318fd8373d70d2705c47b2669c27a7798aae  Firing Neuron Synapses - Remotion Project (4K compositions).zip
9f1fc909da65024de97eb7453609529ae89855594d48861c6afaa1019b5e2506  Myelinated Neuron Axon - Remotion Project (4K compositions).zip
```
