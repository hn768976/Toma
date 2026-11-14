# Quality-control report

Two Remotion projects, each with two 3840×2160 / 30 fps compositions, delivered as four 1080p H.264 MP4s plus two project ZIPs.

## Deliverables

| File | Composition | Technology |
|---|---|---|
| Version 1 - Hair Serum Repair (1080p).mp4 | `HairSerum-V1-4K` – reference match | Three.js / WebGL 2, custom GLSL shaders, bloom |
| Version 2 - Hair Serum Repair - Rose Palette (1080p).mp4 | `HairSerum-V2-4K` – alternative colour palette (rose serum, plum backdrop) | same |
| Version 1 - Voxel Cube Assembly (1080p).mp4 | `VoxelCube-V1-4K` – reference match | Three.js / WebGL 2, instanced meshes, image-based lighting |
| Version 2 - Voxel Cube Assembly - Graphite Amber Palette (1080p).mp4 | `VoxelCube-V2-4K` – alternative colour palette (graphite/amber, dark studio) plus a slow orbiting camera | same |
| Hair Serum Repair - Remotion Project (4K compositions).zip | both hair compositions | |
| Voxel Cube Assembly - Remotion Project (4K compositions).zip | both cube compositions | |

Both projects were scaffolded with the Remotion CLI (`npx create-video --blank`). Everything is procedural, so there are no external assets. The reference watermark was not reproduced.

## Technical checks

| Check | Hair V1 | Hair V2 | Cube V1 | Cube V2 |
|---|---|---|---|---|
| Renders successfully | yes | yes | yes | yes |
| Codec | H.264 High | H.264 High | H.264 High | H.264 High |
| Resolution | 1920×1080 | 1920×1080 | 1920×1080 | 1920×1080 |
| Frame rate | 30/1 | 30/1 | 30/1 | 30/1 |
| Frames / duration | 251 / 8.3667 s | 251 / 8.3667 s | 600 / 20.000 s | 600 / 20.000 s |
| Reference frames / duration | 251 / 8.3667 s | same | 20.000 s (500 frames at 25 fps) | same |
| Pixel format | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 | yuv420p, BT.709 |
| Audio | none (reference has none) | none | none | none |
| Full decode without errors | yes | yes | yes | yes |
| Black frames | 0 | 0 | 0 | 0 |
| Duplicate / frozen frames | 0 | 0 | 0 | 0 |
| Largest frame-to-frame luma step | 0.64 | 0.52 | 0.12 | 0.12 |
| Single-frame pops (every frame, 1080p) | none | none | none | none |
| Pixels ≥ 250 in any frame | ≤ 0.009% | ≤ 0.087% | ≤ 0.128% | ≤ 0.089% |

- **Project ZIPs:** both pass `unzip -t`. Each contains `src/`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json`, ESLint/Prettier config, `.gitignore` and a README with the commands. `node_modules` and rendered output are excluded.
- **Reproducibility:** each ZIP was extracted to an empty folder, installed with `npm ci`, and rendered with the documented `npm run render:all`. The four delivered MP4s are the output of that run.
- **4K compositions:** a 30-frame native segment of each of the four compositions was rendered from the extracted ZIPs and probed at 3840×2160, 30 fps, H.264. Full-length 4K masters were not rendered; the commands are `npm run render:v1:4k` and `npm run render:v2:4k`.
- **Type check and lint:** `tsc` and `eslint` pass in both projects.

## Independent visual review

A separate reviewer agent compared each video with its reference in three rounds; the first two rounds led to rework, and the figures below are from the last round on the delivered files.

| | Hair Serum Repair | Voxel Cube Assembly |
|---|---|---|
| Version 1 match score | 6.5 / 10 | 6 / 10 |
| Technical artifacts, Version 1 | pass | pass |
| Technical artifacts, Version 2 | pass | pass |
| Version 2 clearly distinguishable | yes | yes |

Issues found and fixed during review:

- **Cube:** voxels passed through each other, causing stipple patterns and one-frame colour pops. The scatter was rebuilt as rows and slabs that slide in their own lanes, so nothing intersects.
- **Cube:** the grid was 6 per edge; the reference is 7.
- **Cube V2:** one frame (356) showed a dark wedge on the floor from a badly conditioned floor triangle. The floor mesh was replaced and the frame is clean.
- **Cube:** white faces clipped for seconds at a time. Lighting was rebalanced; clipping is now at most 0.13% of a frame.
- **Hair:** the droplet was too large, too opaque and glowed too much; the repair front ran about 8–10 frames early; the grid was too coarse; the backdrop kept drifting after the camera settled. All were adjusted.

## Known remaining differences from the references

**Hair Serum Repair, Version 1**

- The droplet reads flatter and more opaque than the reference's clear, glassy drop with a dense bubble cluster.
- On impact it stays rounder and about 1.3× larger than the reference's flattened lens.
- The damaged cuticle is a higher-contrast zigzag pattern; the reference has softer, more organic scales.
- The repaired section is greyer, with a uniform grid; the reference is near-black with a gold rim light and a grid that reveals progressively.
- Overall exposure is about 10 levels darker.
- Cuticle silhouette edges show slight stair-stepping at 1:1.

**Voxel Cube Assembly, Version 1**

- Voxels are matte light grey; the reference is glossy and reflective with brighter whites (99th-percentile luma about 212 against 235).
- Voxels slide as rows and slabs; the reference also scatters individual voxels outward in a looser cloud.
- The tumble path is not matched pose-for-pose at a given timestamp.
- The cube is about 15–20% larger in frame, the shadow is denser, and the upper wall is slightly darker.
- A single face glints to flat white for about 0.4 s (frames 291–302).

**Voxel Cube Assembly, Version 2**

- The darkest voxels sit close to the dark backdrop, so shadow-side faces partly merge with it on a dim display.
- Two faces glint to flat white for about 0.4 s (frames 218–228).
- Faint banding in the dark floor gradient is visible only at about 3× gain.
