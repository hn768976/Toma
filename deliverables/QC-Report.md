# Quality-control report

Two Remotion projects, two versions each. All compositions are authored at 3840x2160 / 30 fps / 301 frames; the delivered MP4s are the same compositions rendered with `--scale=0.5`.

| Deliverable | Composition id | What V2 changes |
| --- | --- | --- |
| Version 1 - CPU Circuit Activation (Reference Match) - 1080p.mp4 | `CpuActivation-V1-Reference` | - |
| Version 2 - CPU Circuit Activation (Ember Gold Palette) - 1080p.mp4 | `CpuActivation-V2-EmberGold` | Colour palette (graphite board, amber/gold energy) |
| Version 1 - Padlock Circuit Security (Reference Match) - 1080p.mp4 | `PadlockSecurity-V1-Reference` | - |
| Version 2 - Padlock Circuit Security (Orbit Camera) - 1080p.mp4 | `PadlockSecurity-V2-OrbitCamera` | Camera move (bird's-eye spiral descent into a three-quarter orbit) |
| cpu-circuit-activation-4K-project.zip | both CPU compositions | |
| padlock-circuit-security-4K-project.zip | both padlock compositions | |

Technology: Three.js (WebGL 2) with custom GLSL shaders inside Remotion 4. Everything is procedural, so the projects need no asset files.

## Technical checks

| Check | Result |
| --- | --- |
| All four renders complete | Pass - 301/301 frames each, full decode with no errors |
| Frame rate | Pass - exactly 30/1 fps (constant) |
| Codec / resolution | Pass - H.264 High, 1920x1080, yuv420p, BT.709 |
| Duration | 10.033 s (301 frames). The references are 10.04 s at 25 fps; 10.04 s is not a whole number of frames at 30 fps, so 301 frames is the closest possible (6.7 ms shorter) |
| Audio | References have no audio stream; outputs have none |
| Black / frozen / corrupted frames | None (blackdetect, freezedetect, full decode) |
| Flicker / single-frame pops | None. Largest one-frame mean-luma step: 6.0 (CPU, the landing flash, ramped over ~8 frames; the reference's own flash steps 6.2), 1.8 and 2.3 (padlock) |
| Camera jerks, lens clipping | None found |
| ZIP integrity | Pass - `unzip -t` clean; 24 files each (source, config, lockfile, README, no `node_modules`) |
| ZIP reproducibility | Pass - extracted to a clean folder, `npm install`, type-check, then the documented `npm run render:*` commands. 1080p output: 1920x1080 H.264 30 fps. Native 4K output: 3840x2160 H.264 30 fps. A frame rendered from the ZIP matches the delivered video (PSNR 38.6 dB, i.e. compression differences only) |
| V2 clearly distinguishable | Pass - confirmed by the independent reviewer for both |

Scope of the reproducibility test: full-length renders were made at 1080p; the native 4K path was verified on short frame ranges from each project (a full 4K render takes roughly four times as long on this GPU-less machine).

## Independent review against the references

A separate reviewing agent compared the videos with the references in three passes. Its first two passes found real problems, which were fixed and re-rendered:

- the landing flash and traces appeared in a single frame - now eased over several frames, and the traces grow outward from the chip;
- a one-frame focus jump at 1.7 s in the padlock clip (a bug in the focus-pull interpolation) - fixed;
- traces too thick, chip too pale, beam too heavy, opening too dark, padlock too large and settling too early - all adjusted.

Final pass verdicts:

| Video | Verdict | Match to reference |
| --- | --- | --- |
| CPU V1 | Pass with notes | 7/10 |
| CPU V2 | Pass with notes | same shot as V1, palette variant works |
| Padlock V1 | Pass with notes | 7/10 |
| Padlock V2 | Pass | camera variant works |

Remaining differences the reviewer noted (none blocking):

- The look is stylised rather than photoreal: board components are simple dark blocks, and the chip reads as a teal slab rather than a metallic package in a glass socket.
- Traces are somewhat thicker and more uniform than the reference's fine organic routing; the CPU flash is cleaner and less hot.
- Dark defocused blocks pass in the foreground at about 1.0-1.6 s in the CPU clips.
- A faint horizontal light streak crosses the chip at about 9.5 s in the CPU clips (a travelling trace pulse).
- In padlock V1 the lock becomes visible about 1 s later than in the reference and looks slightly milky at 5.3-6.5 s.
- Padlock V2 opens dark for the first 1.5 s.
- The references carry a stock-footage watermark; it is intentionally not reproduced.

## File checksums (SHA-256)

Run `sha256sum *` in this folder to verify; values are listed in `SHA256SUMS.txt`.
