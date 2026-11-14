# Quality-Control Report

Two Remotion + Three.js (WebGL 2, custom GLSL shaders) projects, each with two
4K compositions. Final videos are the 4K compositions rendered at half scale.

## Deliverables

| File | Composition | Result |
| --- | --- | --- |
| Version 1 - Bot Network Zoom Out - Reference Match (1080p).mp4 | `BotNetwork-V1-Reference` | Pass with notes |
| Version 2 - Bot Network Zoom Out - Dusk Palette (1080p).mp4 | `BotNetwork-V2-DuskPalette` | Pass |
| Version 1 - AI Chip Activation - Reference Match (1080p).mp4 | `AiChip-V1-Reference` | Pass with notes |
| Version 2 - AI Chip Activation - Orbit Camera (1080p).mp4 | `AiChip-V2-OrbitCamera` | Pass with notes |
| bot-network-zoom-out-4k-project.zip | both Bot Network 4K compositions | Pass |
| ai-chip-activation-4k-project.zip | both AI Chip 4K compositions | Pass |

Version 2 choices: the bot-network shot is defined by its camera pull-back, so
its alternative is a colour palette (plum / violet / teal / gold). The AI-chip
shot is defined by its blue "AI" look, so its alternative is a camera move
(high rear start, descending orbit into a low hero angle).

## Technical checks

| Check | Bot V1 | Bot V2 | Chip V1 | Chip V2 |
| --- | --- | --- | --- | --- |
| Codec / profile | H.264 High | H.264 High | H.264 High | H.264 High |
| Pixel format | yuv420p, limited range, BT.709 | same | same | same |
| Resolution | 1920x1080 | 1920x1080 | 1920x1080 | 1920x1080 |
| Frame rate | 30 fps (constant) | 30 fps | 30 fps | 30 fps |
| Frames / duration | 481 / 16.033 s | 481 / 16.033 s | 241 / 8.033 s | 241 / 8.033 s |
| Reference duration | 16.04 s | 16.04 s | 8.04 s | 8.04 s |
| Full decode errors | 0 | 0 | 0 | 0 |
| Black frames (blackdetect) | 0 | 0 | 0 | 0 |
| Duplicate frames | 0 | 0 | 0 | 0 |
| Audio | none (references have none) | none | none | none |

Duration note: the references are 25 fps clips of 16.04 s and 8.04 s. Those
lengths are not whole numbers of frames at 30 fps, so the videos use the
nearest frame counts: 481 frames (16.033 s) and 241 frames (8.033 s), each
within 7 ms of its reference.

## Visual checks

- Per-frame mean-luma scan of every frame of all four videos: no isolated
  single-frame outliers above 1.3 levels in the bot-network videos; in the
  AI-chip videos the only steps are the impact flash, which ramps over
  several frames.
- Independent reviewer agent compared each Version 1 against its reference
  side by side at matching timestamps, and inspected runs of consecutive
  full-resolution frames in all four videos: no corrupt frames, popping,
  z-fighting, seams or vanishing lines.
- Both Version 2s were judged clearly distinguishable from their Version 1
  (palette / camera) with the same concept, timing and quality.

Defects found during review and fixed before delivery:

- Thin network lines vanished for single frames (depth imprecision on the
  large floor quad). Fixed in both projects.
- Bot-network camera lagged the reference and the far shot had no colour
  pulse. Camera retimed; a 2 s pulse added.
- AI-chip impact flash cut in over one frame and whited out the shot. Now
  ramps in and is smaller.
- First renders were full-range `yuvj420p`. Renders now use PNG frames and
  BT.709 for standard `yuv420p`.

## Remaining differences from the references

These are procedural recreations, not copies of the footage, so the look is
close in concept, timing and composition but not identical.

- **Bot network V1:** tiles are more saturated and glowier than the
  reference's pale glassy tiles; depth of field is absent; the mid-section
  (4.5-6 s) is more oblique with more "done" tiles; the far shot is a sparser
  scatter on near-black where the reference has a denser, more structured
  grid; the bots are an original design, not the reference's characters.
- **AI chip V1:** the board is stylised (flat dark packages) rather than
  photoreal; the hologram lettering is white rather than pink; the impact has
  no radial zoom blur or chromatic fringing; the end-state rim glow is
  thinner; the lettering blooms into a blob for about 5 frames after impact.
- **AI chip V2:** because the orbit starts behind the chip, the hologram
  "AI" reads upside-down or sideways for roughly the first 2.5 s.

## Project ZIP checks

Each ZIP was tested for integrity (`unzip -t`), extracted to an empty
directory, and exercised with the documented commands:

| Step | Bot Network | AI Chip |
| --- | --- | --- |
| Contents: source, README, package.json + lockfile, remotion/ts/eslint config | yes | yes |
| External assets required | none (all generated in code) | none |
| `npm install` | ok | ok |
| `npx remotion compositions` lists both at 3840x2160, 30 fps | yes (481 frames) | yes (241 frames) |
| 1080p render (`--scale=0.5`), 12-frame range | ok, 1920x1080 H.264 | ok, 1920x1080 H.264 |
| Native 4K render, 3-frame range | ok, 3840x2160 H.264 | ok, 3840x2160 H.264 |
| Native 4K still | ok, 3840x2160 | ok, 3840x2160 |

## Not verified

- A full-length native 4K render of each composition (only short 4K ranges
  and stills were rendered; software WebGL takes roughly 15-20 s per 4K frame).
- Real-time playback smoothness and banding on a calibrated display; checks
  were made on extracted frames and metrics.
- GPU rendering (`--gl=angle`); all renders here used the software backend.
- The render browser: this environment could not download Remotion's own
  Chrome Headless Shell, so renders used a pre-installed one that
  `remotion.config.ts` picks up when present. On a normal machine Remotion
  downloads its own browser; that path was not exercised here.
