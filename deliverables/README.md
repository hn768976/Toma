# Deliverables

- `vintage-map-cream-smoke-project.zip`: the Remotion project, ready to
  `npm install && npx remotion studio` and render at 4K (see its README).
- `stills/`: one 720p PNG per composition (frame 300 of the preview render).
- `map-textures/`: the full flat map texture of each Vintage Map version,
  about 2000 px wide (the map accuracy check).
- `previews/`: the eight 1280×720 H.264 previews. They're not in git because
  ParticleSmoke_Gold.mp4 exceeds GitHub's 100 MB file limit; they were sent
  directly. To regenerate them, run `scripts/render-previews.sh` in the
  project.
