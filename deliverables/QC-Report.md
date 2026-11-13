# Quality-Control Report

**Deliverables:** two Remotion compositions, each in two versions. Every composition is authored at 3840×2160; the delivered MP4s are 1080p renders of those 4K compositions.

| # | File | What it is |
|---|---|---|
| 1 | `Version-1_Holographic-Prism-Light-Leaks_1080p.mp4` | Composition 1 – V1, matches the reference |
| 2 | `Version-2_Holographic-Prism-Light-Leaks_Low-Angle-Tracking-Camera_1080p.mp4` | Composition 1 – V2, new camera angle & movement |
| 3 | `Version-1_Split-Circles-Zoom-Loop_1080p.mp4` | Composition 2 – V1, matches the reference |
| 4 | `Version-2_Split-Circles-Zoom-Loop_Cobalt-Aqua-Palette_1080p.mp4` | Composition 2 – V2, new colour palette |
| 5a | `Holographic-Prism-Light-Leaks_4K-Remotion-Project.zip` | Remotion project, both 4K compositions of composition 1 |
| 5b | `Split-Circles-Zoom-Loop_4K-Remotion-Project.zip` | Remotion project, both 4K compositions of composition 2 |
| 6 | `QC-Report.md` | This report |

Tooling: Remotion 4.0.543 CLI, Chromium headless shell, H.264 (libx264, CRF 16), BT.709. Composition 1 is a WebGL 2 fragment shader; composition 2 is Canvas 2D.

---

## 1. Technical checks on the delivered MP4s

Checked with an automated script (`qc/qc_video.py`; full JSON results in `qc/`). It uses ffprobe metadata plus a full decode with per-frame luma statistics (`signalstats`).

| Check | Holo V1 | Holo V2 | Circles V1 | Circles V2 |
|---|---|---|---|---|
| Codec H.264 (High profile), MP4, no audio | PASS | PASS | PASS | PASS |
| 1920×1080 | PASS | PASS | PASS | PASS |
| 30 fps, constant frame rate (r = avg = 30/1) | PASS | PASS | PASS | PASS |
| `yuv420p`, BT.709, limited (TV) range | PASS | PASS | PASS | PASS |
| Frame count | 589 ✔ | 589 ✔ | 270 ✔ | 270 ✔ |
| Duration vs reference | 19.633 s vs 19.640 s (Δ −6.7 ms) | same | 9.000 s vs 9.009 s (Δ −9 ms) | same |
| Full decode, zero decoder errors | PASS | PASS | PASS | PASS |
| No black frames (mean luma < 20) | PASS | PASS | PASS | PASS |
| No unintended frozen frames | PASS | PASS | PASS ¹ | PASS ¹ |
| No flicker spikes (frame-diff outliers) | PASS | PASS | PASS | PASS |
| Bitrate | 28.3 Mb/s ² | 27.3 Mb/s ² | 2.35 Mb/s | 2.64 Mb/s |

**Duration note.** At exactly 30 fps an exact match is impossible: 19.640 s × 30 = 589.2 frames and 9.009 s × 30 = 270.3 frames. Each composition uses the nearest whole frame count, so both are within 1 frame (< 10 ms) of the reference.

¹ The reference split-circles loop holds still for a few frames at the start and end of every 90-frame cycle. V1 and V2 reproduce these holds, so the static frames are intentional. The checker only accepts static frames that fall inside the reference's own static spans.

² The holographic files carry light film grain to match the reference's photographic texture, so their bitrate is much higher at the same CRF 16.

Integrity (SHA-256):

```
1b6c28b5347330f9572aa74f446d9130beff0840a6ada9efcf52c5a8c8abff26  Version-1_Holographic-Prism-Light-Leaks_1080p.mp4  (69,358,068 bytes)
2e07f5b69fe148a9abaa0cccf43c51f3905efec5a37a6dd8db330e3990968a4e  Version-2_Holographic-Prism-Light-Leaks_Low-Angle-Tracking-Camera_1080p.mp4  (67,014,058 bytes)
3173e3e55ba515587946a71f6afc829dab806c6944a5361a222ed1081a7852b7  Version-1_Split-Circles-Zoom-Loop_1080p.mp4  (2,641,509 bytes)
b02bd54cf247e425604f00e327ff831d15ea2e3161268b0e9c854378f5aa774a  Version-2_Split-Circles-Zoom-Loop_Cobalt-Aqua-Palette_1080p.mp4  (2,965,420 bytes)
13e829b15207ae455e5a6e83eefdf93ae3ad42b63341c1545d51f3b65b8fd424  Holographic-Prism-Light-Leaks_4K-Remotion-Project.zip  (57,584 bytes)
b092a586be0def9c2ca6feddd861a69de39c73dc667632cbfe5df8404fa0dfd3  Split-Circles-Zoom-Loop_4K-Remotion-Project.zip  (55,023 bytes)
```

## 2. Project ZIP checks

Each ZIP was tested from scratch in an empty folder:

1. `unzip -t`: no errors.
2. Extracted file tree checked: all sources present; no `node_modules`, `out` or build artefacts.
3. `npm ci`: 338 packages installed from the lockfile with no errors.
4. `tsc --noEmit`: no type errors.
5. `remotion compositions` lists both 4K compositions at 3840×2160, 30 fps, with the correct frame count.
6. A native 4K render from the extracted copy produced H.264, 3840×2160, `yuv420p`, BT.709 output with the expected frame count.

| ZIP | Files | Result |
|---|---|---|
| Holographic-Prism-Light-Leaks_4K-Remotion-Project.zip | 19 | PASS (4K still plus 6-frame 4K MP4 renders of both compositions) |
| Split-Circles-Zoom-Loop_4K-Remotion-Project.zip | 21 | PASS (4K stills plus 12-frame 4K MP4 render) |

No external assets are needed: everything is generated in code, so there are no missing assets. Each project's `README.md` documents the install, preview and render commands, including the exact command used for the 1080p delivery files.

## 3. Visual verification against the references

For each round, an independent reviewer agent compared the renders with the reference clips. It used frame-matched contact sheets, consecutive-frame bursts, full-resolution crops, colour statistics, frame-difference curves and high-pass edge maps.

### Composition 1 – Holographic Prism Light Leaks
| Round | Score | Main findings | Action |
|---|---|---|---|
| 1–2 | 5.5, then 6.5/10 | First design (a grid of prismatic shards) | Tuned palette, blur and motion |
| 3 | 4.5/10 | The shard grid read as uniform "sprinkles / confetti" | Full redesign: recycling light elements (large washes, streaks, flares) in seamless periodic tiles; slower camera drift |
| 4 | 5.5/10 | Two single-frame pops (1.43 s, 8.53 s); sparse dark areas; too much magenta; motion about 2× too slow; too few blown-out whites | Pops traced to a direction computed across the repeating tile and fixed; even (stratified) element placement; palette rebalanced; motion sped up; white cores added |
| 5 | 6.0/10 | Pops, coverage and whites fixed. But thin crisp rainbow ribbons and radial ray bursts dominated, where the reference is fat, soft, out-of-focus blobs; an artificial crescent; motion about 0.6× | Ribbons replaced by soft defocused prism bars and bokeh blobs with chromatic fringes; crescent removed; motion matched to the reference (frame-difference curves within 5%); hand-held jitter |
| 6 | 6.5/10 | Thin hard-edged rainbow stripes from sharp "prism-cut" edges; each blob one flat colour | Hard cuts removed; a red→yellow→green→blue gradient inside every wash, bar and blob; light film grain; white hotspots allowed to clip like the reference |
| 7 | 7.3/10 PASS | Fewer and larger elements than the reference; oval blobs still single-hue | More mid-size bars with smeared tapered ends; smaller washes; full gradients across the ovals; lighter vignette |
| 8 (final) | **V1 7.6/10 PASS** | No must-fix items. Density matches without a confetti look; motion matches (about 65 vs 68 change units per second); no pops (all 589 frames scanned), no flicker, banding, stripes, outlines or watermark | — |
| V2 | **8.5/10 PASS** | No must-fix items. Clearly distinct from V1 (receding ground plane, vanishing-point convergence, glide, crane and bank) with the same material and palette; no aliasing or moiré near the horizon, no seams or repeating tiles, smooth motion, no pops or flicker | — |

Reviewer nice-to-haves that were not acted on: some oval blobs show a slightly hard two-tone split; the palette is a touch green and light on violet; white hotspots are slightly more frequent than in the reference; V2 could tilt up to show a sliver of horizon glow.

### Composition 2 – Split Circles Zoom Loop

| Round | V1 score | Main findings | Action |
|---|---|---|---|
| 1 | 6/10 | Weak shadows, wrong band shape, bands popping in, disks too small and late, zoom too early | Rebuilt the bands as rolling trails; added a diagonal stadium platform and two-layer shadows; retimed the zoom |
| 2 | 7.5/10 | Band tone, disk size mid-cycle, disk positions at frame 72, background end colour | Plane colours sampled from the reference; disk scale curve and rotation retimed |
| 3 | 8.5/10 (pass) | Bands leave early; morph 3 frames late; shadows slightly heavy | Fixed all three |
| 4 (final) | **V1 8.0/10 PASS · V2 8.5/10 PASS**, no must-fix items | Disk path and rotation, split angles, band layout, zoom, final hold and colours all match the reference to within about 1 frame. Loop seams at frames 89→90, 179→180 and 269→0 are identical; the three 90-frame cycles are identical; no jitter, aliasing, black or corrupt frames. Earlier notes resolved. One should-fix: the platform circle inflated too abruptly at frames 33–37, while in the reference a band's rounded end wraps the pair and then shortens into a circle. | Morph rebuilt to match: the band now rises from frame 20, its rounded end wraps the pair at about frames 38–41, and it shortens into a circle by frame 55. Re-rendered; both files re-checked, 10/10 PASS |

V2 (cobalt → aqua background, deep-cobalt disk halves, mid-blue planes, navy shadows) is clearly distinguishable from V1's violet → pink palette. The reviewer confirmed it matches V1 frame for frame.

## 4. Version 2 choices

* **Holographic: alternative camera angle and movement.** V1 is a flat, screen-aligned macro drift, like the reference. V2 places the same holographic foil on a ground plane and films it with a low-angle perspective tracking camera. The camera glides forward, cranes down slightly, banks with gentle yaw and roll, and adds depth haze. Crisp edges are widened by their on-screen pixel footprint, so distant detail stays alias-free, and every element lives in a seamless periodic tile so the infinite plane has no edges.
* **Split circles: alternative colour palette (cobalt / aqua).** The animation and timing are identical to V1, so the palette change is the only variable.

## 5. Notes

* The iStock watermark in the references was intentionally not reproduced.
* Render speed: the holographic shader renders on CPU here (SwiftShader). On a machine with a GPU, add `--gl=angle` for a large speed-up. The split-circles composition renders quickly anywhere.
