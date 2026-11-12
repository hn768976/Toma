# QC Report: ToggleField and GlowSpheres

## Deliverables

| File | Contents |
|---|---|
| `ToggleField-V1_1080p.mp4` | Composition A, V1: matches reference A |
| `ToggleField-V2_1080p.mp4` | Composition A, V2: alternative camera (tilted perspective, orbit and dolly) |
| `GlowSpheres-V1_1080p.mp4` | Composition B, V1: matches reference B |
| `GlowSpheres-V2_1080p.mp4` | Composition B, V2: alternative colour palette (electric cyan / teal) |
| `ToggleField_4K_RemotionProject.zip` | Complete Remotion project, 3840×2160 compositions |
| `GlowSpheres_4K_RemotionProject.zip` | Complete Remotion project, 3840×2160 compositions |

- **Stack:** Remotion 4 CLI, with Three.js (WebGL 2) and custom GLSL passes.
- **Rendering:** compositions are authored at 3840×2160 and delivered at 1080p with `--scale=0.5`, so every 1080p frame is a supersampled 4K frame.
- **Assets:** every texture and shape is generated in code, so the projects have no external asset files to lose.

## Technical checks (ffprobe, plus a full decode of every frame)

| Check | TF-V1 | TF-V2 | GS-V1 | GS-V2 |
|---|---|---|---|---|
| Codec | H.264 High, yuv420p | same | same | same |
| Colour | BT.709, TV range | same | same | same |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate (r / avg) | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 | 30/1 / 30/1 |
| Frames (reference) | 320 (320) | 320 (320) | 250 (250) | 250 (250) |
| Duration | 10.667 s | 10.667 s | 8.333 s | 8.333 s |
| Decode errors | 0 | 0 | 0 | 0 |
| Unintended black frames | 0 | 0 | 0 ¹ | 0 ¹ |
| Flicker events | 0 | 0 | 0 | 0 |
| Frozen frames | 0 | 0 | 0 | 0 |
| Audio streams | none | none | none | none |
| Bitrate | 2.85 Mb/s | 3.79 Mb/s | 9.2 Mb/s | 8.9 Mb/s |

¹ The near-black fade-in at the start, the dip around f118–130 and the fade-out at the end follow the reference's own dark moments.

**Duration note.** Both reference clips run at 29.97 fps (30000/1001). The renders match their frame counts exactly (320 and 250 frames) at the required exact 30 fps. That makes them 10.7 ms and 8.3 ms shorter, a third of a frame or less. Matching the reference's frame count and its length in seconds at the same time is impossible at exactly 30 fps.

## Project ZIPs: clean-room test

Each ZIP was extracted into an empty directory and run with the commands documented in its README:

| Step | ToggleField | GlowSpheres |
|---|---|---|
| `unzip -t` integrity | OK | OK |
| `npm ci` | OK | OK |
| `npm run lint` (eslint + tsc) | OK | OK |
| `npx remotion compositions` | V1 and V2 at 3840×2160, 30 fps, 320 frames | V1 and V2 at 3840×2160, 30 fps, 250 frames |
| `npm run render:v1` / `render:v2` (frame range) | OK: H.264 1920×1080 30/1 | OK: H.264 1920×1080 30/1 |
| `npx remotion still` (native 4K) | 3840×2160 OK | 3840×2160 OK |

Each ZIP holds `src/`, `public/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, the eslint config and a `README.md`. The README lists the render commands, including `render:v1:4k` and `render:v2:4k` for native 4K output. `node_modules` and `out` are excluded.

## Fidelity: independent verification agent

A separate review agent compared each final video with its reference frame by frame. It also measured luma curves, colour clusters, optical flow and edge orientation.

| Video | Score / verdict | Main findings |
|---|---|---|
| **ToggleField V1** | 6/10, **PASS WITH NOTES** | **Matches:** palette clusters within a few RGB units, and near-exact camera drift (total shift +314/−329 px vs +311/−330 px). Piece scale, shapes, main diagonal and soft shadows also match. **Differs:** the layout is less ordered than the reference's tight herringbone, there is less constant rotation activity, the material is flatter (no thick paper rim highlight), and the clip does not loop seamlessly. |
| **ToggleField V2** | **PASS** | Clearly different: tilted perspective with an orbit and dolly camera, keeping the same palette and animation. |
| **GlowSpheres V1** | 7/10, **PASS WITH NOTES** | **Matches:** brightness over time (correlation 0.977), average level 24.6 vs 25.4, and dark/mid-tone pixel shares (0.79 / 0.108 vs 0.81 / 0.111). The two light waves and dark gaps are at the same times, and the palette family is the same. **Differs:** stripes have less inner glow, spheres are fewer and larger, glow cores are slightly pinker, and unlit spheres are a little too visible around f150 and f220. |
| **GlowSpheres V2** | **PASS** | Clearly electric cyan (lit-area hue about 190°) with identical motion and timing (luma correlation 0.976). |

## Fixes made in response to QC rounds

- **GlowSpheres:**
  - Replaced a per-frame light strobe with a smooth shimmer. This removed 3 flicker reversals.
  - Raised the floor glow, which removed a run of 13 fully black frames.
  - Made the glow more saturated and tightened the light pockets, so unlit spheres stay dark. The verification score went from 6.5 to 7.
- **ToggleField:**
  - Rebuilt the rotation model from a per-frame orientation analysis of the reference: switch groups swing 90° out and back in about 80-frame cycles while the main diagonal stays dominant.
  - Added yellow and pink accents to match the reference's share.
  - Rounded tiles became pill-shaped.

## Checksums (SHA-256)

```
032ea99cef1286e6924c85150d7d739676f07d1c9c6b277ef41247a1d3043e4a  GlowSpheres-V1_1080p.mp4
e8d428fe0c7c53d9ecfd332111e890cee6a115d91844036d0c39e610c43ba99c  GlowSpheres-V2_1080p.mp4
3c37724aefac50b46de17f0e4ec53fba2c4737cb5c13cea0c619395f1b359fa0  ToggleField-V1_1080p.mp4
9088af51bdbaaefc7fa951ef9d9c9fdff64c25c46f397b5ea689caf210478481  ToggleField-V2_1080p.mp4
21ec269b154038e84871c31565939c2613c6b746f28d77eda89dc5eeaeb9c4f1  GlowSpheres_4K_RemotionProject.zip
0f3d1001e49600fbf4e18b06a58aaa13a03f6ba7b5a51036616cc647124d8cae  ToggleField_4K_RemotionProject.zip
```
