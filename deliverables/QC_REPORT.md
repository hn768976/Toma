# Quality-Control Report — Globe Network Compositions

Two 4K (3840×2160) Remotion compositions, each in two versions, rendered with
Three.js / WebGL 2 shaders. Delivered as 1080p H.264 MP4s plus the 4K project ZIPs.

## Deliverables

| # | File | Description | Size |
|---|---|---|---|
| 1 | `videos/Comp1_V1_Reference_1080p.mp4` | Comp 1, V1: blue relief-map fly-over with arc bursts, matched to reference 1 | 66.0 MB |
| 2 | `videos/Comp1_V2_AmberPalette_1080p.mp4` | Comp 1, V2: same shot, alternative **amber/gold colour palette** | 66.6 MB |
| 3 | `videos/Comp2_V1_Reference_1080p.mp4` | Comp 2, V1: blue-hour Earth with clouds, city lights and a growing network, matched to reference 2 | 44.6 MB |
| 4 | `videos/Comp2_V2_OrbitalPullback_1080p.mp4` | Comp 2, V2: alternative **camera movement**, a low close start rising to an orbital pull-back of the whole globe | 35.5 MB |
| 5 | `Comp1_GlobalNetworkMap_4K_RemotionProject.zip` | 4K project: both Comp 1 compositions, source, assets, config | 11.4 MB |
| 5 | `Comp2_EarthNetwork_4K_RemotionProject.zip` | 4K project: both Comp 2 compositions, source, assets, config | 4.7 MB |

**Why each V2 alternative was chosen**
- **Comp 1** is a graphic, monochrome map, so its identity is the colour. An amber/gold palette gives the clearest alternative and keeps the shot, timing and arcs identical.
- **Comp 2** is photoreal, so recolouring it would look wrong. A camera alternative suits it: the orbital pull-back reveals the whole planet with its limb, atmosphere and stars.

## Technical checks (all four videos), all passed

Automated with `qc/qc_videos.py` (ffprobe, a full ffmpeg decode, `blackdetect`, and per-frame luma/difference analysis of all 900 frames). Raw data is in `qc/qc_results.json`.

| Check | C1 V1 | C1 V2 | C2 V1 | C2 V2 |
|---|---|---|---|---|
| Codec H.264 (High), yuv420p, MP4 | ✅ | ✅ | ✅ | ✅ |
| Resolution 1920×1080 | ✅ | ✅ | ✅ | ✅ |
| Frame rate exactly 30/1 (r and avg) | ✅ | ✅ | ✅ | ✅ |
| 900 frames = 30.000 s, same as reference | ✅ | ✅ | ✅ | ✅ |
| Full decode, zero errors | ✅ | ✅ | ✅ | ✅ |
| Black frames (`blackdetect`; frames with mean luma < 16) | none | none | none | none |
| Frozen/duplicate frames (frame difference < 0.02) | 0 | 0 | 0 | 0 |
| Flicker / pops (difference spikes > 6× median) | 0 | 0 | 0 | 0 |
| Largest frame-to-frame mean-luma change | 0.94 | 1.17 | 0.31 | 0.29 |
| Audio | none; reference has none | none | none | none |

## Project ZIP checks, all passed

Done by `qc/package_and_verify.sh`; the log is `qc/zip_verification.log`.

Each ZIP was:
1. tested for integrity (`unzip -t`),
2. extracted into an empty folder,
3. installed with `npm ci`,
4. linted and type-checked (`npm run lint`),
5. listed with `npx remotion compositions` (both compositions are 3840×2160, 30 fps, 900 frames),
6. rendered with the documented `npm run render:v1` / `render:v2` commands (H.264, 1920×1080, 30 fps),
7. used to render native 4K stills (3840×2160).

Each ZIP contains `src/`, `public/` (textures and data), `scripts/build_assets.py`, `package.json`, `package-lock.json`, `remotion.config.ts`, `tsconfig.json` and a `README.md` with the commands. `node_modules` and renders are excluded.

## Reference fidelity and visual review

Independent reviewer agents compared every version against its reference frame by frame, in three rounds. Each round's findings were fixed and re-rendered. Defects found and fixed along the way:
- parallel lines across the ocean (caused by Fiji's coastline crossing the 180° meridian),
- dark lake specks on the land,
- a pale polygon in the South Atlantic (a sea-tint latitude sign bug),
- pink-tinted clouds and lights,
- network starting in the wrong place,
- several framing and timing issues.

The final pass was run on the last renders:
- the South Atlantic polygon is gone, checked at 24–29.3 s at 2× contrast;
- the contact sheets of all four videos are clean;
- every metric in the tables above passes.

**Known remaining differences (stylistic, not defects)**
- **Comp 1 V1:** arc placement is generated procedurally, so individual arcs don't land on exactly the same cities as in the reference. The opening is slightly less oblique than the reference.
- **Comp 2 V1:** cloud layout comes from real NASA cloud imagery, so it differs from the reference's own clouds. The network is a procedural mesh that grows on the reference's timeline: central US at about 1.5 s, West Africa at about 12 s, Iberia at about 14 s.
- **Comp 2 V2:** in the first ~3 s the camera is very close, so the 4K Earth textures appear slightly soft.
