# QC Report — DNA Helix Growth & Skin Allergy Spots

Date: 2026-11-13

## Deliverables

| # | File | Composition | Variant |
|---|------|-------------|---------|
| 1 | `Version 1 - DNA Helix Growth (1080p).mp4` | `DnaHelixGrowth-V1` | Reference match (cyan / red on teal-black) |
| 2 | `Version 2 - DNA Helix Growth - Gold & Violet Palette (1080p).mp4` | `DnaHelixGrowth-V2` | Different colour palette, same animation |
| 3 | `Version 1 - Skin Allergy Spots (1080p).mp4` | `SkinAllergySpots-V1` | Reference match (static camera) |
| 4 | `Version 2 - Skin Allergy Spots - Orbit Camera (1080p).mp4` | `SkinAllergySpots-V2` | Different camera: low orbiting push-in, same colours |
| 5 | `DNA Helix Growth - Remotion Project (4K compositions).zip` | both DNA compositions, 3840x2160 | source, config, README |
| 6 | `Skin Allergy Spots - Remotion Project (4K compositions).zip` | both skin compositions, 3840x2160 | source, config, README |

Both scenes are fully procedural (Remotion 4 + Three.js / WebGL 2 GLSL shaders), so the
projects contain no external image, video or audio assets. The stock watermark in the DNA
reference is intentionally not reproduced.

## Technical checks (all four videos)

| Check | DNA V1 | DNA V2 | Skin V1 | Skin V2 |
|-------|--------|--------|---------|---------|
| Codec / container | H.264 High / MP4 | H.264 High / MP4 | H.264 High / MP4 | H.264 High / MP4 |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate (r / avg) | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 | 30/1, 30/1 |
| Frames / duration | 400 / 13.333 s | 400 / 13.333 s | 180 / 6.000 s | 180 / 6.000 s |
| Reference frames / duration | 400 / 13.333 s | 400 / 13.333 s | 180 / 6.000 s | 180 / 6.000 s |
| Full decode errors | 0 | 0 | 0 | 0 |
| Timestamp gaps | 0 | 0 | 0 | 0 |
| Freeze detection | none | none | none | none |
| Largest frame-to-frame mean-luma jump (0-255) | 0.25 | 0.25 | 0.35 | 0.40 |
| Audio | none | none | none | none |

- Durations and frame counts equal the references exactly; the references are also 30 fps with no audio, so no audio track is included.
- Black-frame detection flags only the first 0.2 s (V1) / 0.07 s (V2) of the DNA videos. This is the intentionally dark, empty opening before the strands enter, as in the reference; there are no black frames anywhere else.
- No luma spikes, popping or flicker: the per-frame brightness curves are smooth in all four videos.
- Pixel format is `yuvj420p` (4:2:0, full range).

## Project ZIP checks

- `unzip -t` reports no errors for either archive.
- The four delivered videos were produced from the ZIPs themselves: each ZIP was extracted to an empty directory, `npm ci` was run, then the documented `npm run render:v1` and `npm run render:v2`.
- A 4K frame of each of the four compositions was rendered from the extracted copies and confirmed to be 3840x2160.
- ESLint and TypeScript checks pass in both projects.
- The 1080p files are the 4K compositions rendered with `--scale=0.5`; full 4K video is available via `npm run render:v1:4k` / `render:v2:4k` (see each README). Full-length 4K video renders were not run here.

Render environment note: rendering here used software OpenGL (no GPU), about 4-7 s per frame.
On a machine with a GPU, remove or change `setChromiumOpenGlRenderer("swangle")` in
`remotion.config.ts` for much faster renders.

## Visual match review (independent reviewer agent)

An independent agent compared the final videos with the references at identical frame
indices, plus frame-difference curves. Two review rounds were run; after the first, both
scenes were revised and all four videos re-rendered. Second-round result:

| | Composition | Colour / lighting | Motion / timing | Overall | Verdict |
|---|---|---|---|---|---|
| DNA V1 vs reference | 5 | 7 | 6 | 6 / 10 | acceptable with caveats |
| Skin V1 vs reference | 7.5 | 7.5 | 8.5 | 8 / 10 | acceptable as a faithful recreation |

(First round: DNA 5 / 10, skin 7.5 / 10.)

Remaining differences the reviewer listed:

**DNA V1** — same concept, palette and growth, but not a shot-for-shot match.
- A large defocused foreground strand is more dominant than anything in the reference, whose hero helix is sharp and bright at right-centre.
- Rungs are longer and read as "comb" lines; the reference has thinner, shorter rungs enclosed between the two backbones.
- The reference fills the frame faster in the first two seconds and has brighter white-cyan highlights; V1 is calmer and slightly flatter.
- A strand tip is already visible in frame 0, where the reference is empty.

**Skin V1**
- The cluster sits about 10% further right and lower; same six-wheal layout and near-identical timing (first spot around frame 18-20, settled by frame 80-90).
- Wheals are a little taller and more lobed; the reference has flatter tops with a soft rim.
- Hairs are sparser and crisper than the reference's soft fuzz, and look slightly aliased at full resolution.
- Slightly brighter overall; a faint film-grain shimmer continues after the spots settle, where the reference is static.

**Version 2s**
- DNA V2 is clearly distinguishable (gold strands, violet bands, purple background) with identical geometry and animation, so it shares V1's gaps.
- Skin V2 is clearly distinguishable from about frame 60 onward; the first 40 frames look close to V1 because the camera move starts gently.

No corrupted frames, popping, flicker or freezes were found in any video. Banding in the dark
DNA background was not measured reliably; none was obvious at normal viewing.
