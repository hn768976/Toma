# Quality-Control Report — 4K Remotion Compositions (1080p delivery)

**Overall result: all 4 videos and both project ZIPs PASS.**

## Deliverables

| # | File | Composition (4K source) | Frames / duration | Size |
|---|------|-------------------------|-------------------|------|
| 1 | `Comp1_DNA_Helix_V1_Match_1080p.mp4` | `DnaHelix-V1-Match` | 520 / 17.333 s | 8.6 MB |
| 2 | `Comp1_DNA_Helix_V2_Orbit_1080p.mp4` | `DnaHelix-V2-Orbit` | 520 / 17.333 s | 9.7 MB |
| 3 | `Comp2_Countdown_V1_Match_1080p.mp4` | `Countdown-V1-Match` | 345 / 11.500 s | 26.0 MB |
| 4 | `Comp2_Countdown_V2_Ember_1080p.mp4` | `Countdown-V2-Ember` | 345 / 11.500 s | 26.2 MB |
| 5 | `Comp1_DNA_Helix_Remotion_4K_Project.zip` | both DNA compositions | — | 64 KB |
| 5 | `Comp2_Particle_Countdown_Remotion_4K_Project.zip` | both countdown compositions | — | 87 KB |

| Composition | Technology | V2 alternative |
|---|---|---|
| 1 — DNA helix repair | Three.js (WebGL 2) with custom GLSL background, sprite and tilt-shift passes, plus bloom | **Camera:** low-angle orbit, dutch tilt, push-in on the repair |
| 2 — Glitter countdown 10 → 1 | Raw WebGL 2 / GLSL ES 3.00 GPU particles, HDR bloom chain | **Colour palette:** molten gold / ember instead of silver-blue |

All four videos were rendered from freshly extracted project ZIPs using the documented
`npm run render:v1` / `render:v2` commands. These render the 3840×2160 composition with `--scale=0.5`, giving 2×2-supersampled 1080p.

## Technical checks (ffprobe / ffmpeg, all four files)

| Check | Result |
|---|---|
| Renders completed without errors | ✅ 4/4 |
| Duration equals the reference exactly | ✅ 17.333333 s = ref (Comp 1); 11.500000 s = ref (Comp 2) |
| Frame count equals the reference | ✅ 520 = 520; 345 = 345 |
| Frame rate exactly 30 fps | ✅ `r_frame_rate` and `avg_frame_rate` = 30/1 |
| Codec / container | ✅ H.264 (High profile) in MP4 |
| Resolution | ✅ 1920×1080 |
| Pixel format / colour | ✅ yuv420p, TV range, BT.709 primaries/transfer/matrix tagged |
| Full decode (`ffmpeg -xerror`) | ✅ 0 errors, so no corrupted frames |
| Audio | None (the references have no audio either), so no audio issues are possible |
| Flicker / jumps (max frame-to-frame mean-luma delta) | ✅ DNA 0.24 / 0.30; countdown 4.4 / 4.3. No spikes; the reviewer measured a peak frame difference below the references' own |
| Unintended black frames (`blackdetect`) | ✅ None in DNA. Countdown has only the intended black lead-in (0–0.27 s, before "10" fades up) and fade-out (10.53–11.5 s, after "1"), matching the reference |

## Project ZIP checks

| Check | Result |
|---|---|
| Archive integrity (`unzip -t`) | ✅ No errors in either ZIP |
| Contents | ✅ Source (`src/`), 4K compositions (`Root.tsx`, 3840×2160 @ 30 fps), assets (Barlow font + OFL licence), `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, README with commands. No `node_modules` or renders |
| Matches the committed source | ✅ Byte-identical to the git-tracked files (14 + 18 files) |
| Extract → `npm ci` | ✅ Both install cleanly |
| `npm run lint` (ESLint + `tsc`) | ✅ Clean |
| `npx remotion compositions` | ✅ 4 compositions, all 3840×2160, 30 fps, 520 / 345 frames |
| Documented renders | ✅ `npm run render:v1` and `render:v2` succeed in both projects; native 4K stills render at 3840×2160 |

## Visual verification (independent reviewer agent)

A separate agent compared each output against its reference, using side-by-side sheets,
per-frame luma curves and frame-difference analysis. It re-checked after each fix round:
4 rounds for Comp 2 and 3 for Comp 1.

| Video | Final rating | Verdict | Key findings |
|---|---|---|---|
| Comp 1 V1 | 8.5/10 | **PASS** | The red pair enters at frame 64 (reference 66), follows the reference's descent within about 2 px and settles at the same height. The stop, swap choreography and pull-back timing match the reference. |
| Comp 1 V2 | 8.5/10 | **PASS** | Clearly distinct camera language: low-angle diagonal orbit, push-in on the swap, re-centred finale. Same events and timing; the red pair enters at frame 67. |
| Comp 2 V1 | 8.5/10 | **PASS** | Correct 10 → 1 sequence. Number peaks fall within about 3 frames of the reference (luma-curve correlation 0.94), with matching size, position and font proportions. The burst breaks into clumps and streaks and fades cleanly to black by frame 324. |
| Comp 2 V2 | 8.5/10 | **PASS** | Clearly distinct amber/gold palette with identical timing and quality. |

Consistency checks for colours, timing, transitions and animation:
- Every frame is a pure function of the frame number (deterministic GPU shaders, no simulation state).
- No popping at number transitions; a haze-persistence bug was found by QA and fixed.
- The camera moves without jerks, and the thin sticks show no aliasing or shimmer.

Remaining minor notes (non-blocking):
- **Comp 1 V1:** the spheres are slightly less cyan than the reference (RGB about 201/222/236 vs 207/240/253), and the red pair is a little less saturated.
- **Comp 1 V2:** the finale (frames 330–519) is about 20 % darker than V1, an artistic consequence of the low-angle framing.
- **Comp 2:** the dissolving "1" briefly hooks into a "?"-like curve for about 4 frames (298–302) before scattering. Some numbers lose legibility slightly earlier in the dissolve than in the reference.

The reference clips' "iStock by Getty Images" watermark is a stock-site overlay and was intentionally not reproduced.

## SHA-256 checksums

```
bdea7578d6e1dbebb92f49c83d578b394991c7f278001e6e898445181f9d8a4e  Comp1_DNA_Helix_V1_Match_1080p.mp4
92a98c69572aa87f000592cda8b0bf6baa4e11582843abf94b6d291d80543c95  Comp1_DNA_Helix_V2_Orbit_1080p.mp4
005e8d3717875490c8d7230d406c44a090082a92384d1b41043fa21bd12a828c  Comp2_Countdown_V1_Match_1080p.mp4
b597e347ae11680a1d64f76e3c10c7af6ef3b9d9145e6b9b207323e497fd024a  Comp2_Countdown_V2_Ember_1080p.mp4
c3cb260fd635ed6d59e59b073ca63ecf89bfdea1c9c22790149cd78925b33d4b  Comp1_DNA_Helix_Remotion_4K_Project.zip
1551a94e3f0ba90b2a38ab8ab37982d4474f7035897c8a4a4f0e05005ee5c27c  Comp2_Particle_Countdown_Remotion_4K_Project.zip
```

## How to reproduce

```bash
unzip Comp1_DNA_Helix_Remotion_4K_Project.zip && cd dna-helix
npm ci
npm run render:v1        # out/DNA_Helix_V1_Match_1080p.mp4  (4K comp → 1080p)
npm run render:v2        # out/DNA_Helix_V2_Orbit_1080p.mp4
npm run render:v1:4k     # optional full 3840×2160 master
```

The countdown project works the same way (`particle-countdown/`). The default WebGL backend is SwiftShader, so it works on machines without a GPU. On a GPU workstation, append `-- --gl=angle` for much faster renders.
