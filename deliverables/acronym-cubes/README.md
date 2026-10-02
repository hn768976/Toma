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

Or re-render them:

    cd acronym-cubes
    npx remotion render Cubes-ETF  out/Cubes_ETF.mp4  --scale=0.5
    npx remotion render Cubes-401K out/Cubes_401K.mp4 --scale=0.5

These clips do NOT loop.
