# Acronym Cubes: deliverables

- `acronym-cubes-project.zip`: the whole Remotion project (13 compositions,
  ready to render at 4K). See the README inside, or `../../acronym-cubes/`.
- `stills_1080/`: one 1920×1080 PNG per acronym at frame 200 (cubes at rest).
- `stills_1080_contact_sheet.png`: all 13 on one sheet.
- `previews/`: the two 1080p previews (`Cubes_ETF.mp4`, `Cubes_401K.mp4`),
  about 122 MB each at CRF 16 with 1.75% grain. That is over GitHub's 100 MB
  per-file limit, so each is stored as byte-exact 45 MB parts. Rejoin and
  verify with:

      bash previews/join.sh

- `previews/Cubes_ETF_720p.mp4` (CRF 16, 49 MB) and
  `previews/Cubes_ETF_720p_crf20.mp4` (CRF 20, 20 MB): ETF rendered natively at
  1280×720 (`--scale=0.3333333333333333`), 30 fps, 10.0 s, H.264 yuv420p, no audio.

Or re-render the 1080p previews:

    cd acronym-cubes
    npx remotion render Cubes-ETF  out/Cubes_ETF.mp4  --scale=0.5
    npx remotion render Cubes-401K out/Cubes_401K.mp4 --scale=0.5

These clips do NOT loop.
