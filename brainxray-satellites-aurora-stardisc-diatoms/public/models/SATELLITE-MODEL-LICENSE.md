# Satellite model — provenance and licence

Satellite model: NASA 3D Resources

- **Source:** NASA 3D Resources, `github.com/nasa/NASA-3D-Resources`,
  file `3D Models/Tracking and Data Relay Satellites (TDRS) (C)/Tracking and Data Relay Satellites (TDRS) (C).glb`
  (Draco-compressed glTF, 51,218 triangles, one 1600x1600 WebP texture atlas plus an unused JPEG copy).
- **Licence:** The model folder has no separate licence or readme. The repository README
  (copied here as `NASA-3D-Resources-README.md`) states: *"These assets are free and
  without copyright"* and refers to NASA's media usage guidelines
  (https://www.nasa.gov/nasa-brand-center/images-and-media). Those guidelines also say NASA
  insignia (the "meatball", logotype, seal) may not be used without permission and that
  NASA material must not be used to imply NASA endorsement.
- **Logos / insignia:** The texture atlas was inspected at full resolution. It contains gold
  foil, solar-cell grids, dish meshes and structural parts only — no NASA meatball, logotype,
  flag or mission text was found, and the geometry carries no text. Nothing therefore had to
  be painted out. In the animation the satellite materials are additionally colour-graded to
  the blue/white palette of the look.
- **Processing (`scripts/clean-satellite.mjs`, run once at build time):** Draco decoded,
  unused duplicate JPEG texture pruned, welded and simplified with meshoptimizer to
  **40,985 triangles** (`satellite_tdrs.glb`, hero), texture re-encoded as PNG, Draco and
  WebP extensions removed so three.js loads it without decoders. A second LOD at
  **9,647 triangles** with a 512² texture (`satellite_tdrs_lod.glb`) is instanced for the
  background satellites.

Credit line: **Satellite model: NASA 3D Resources.** This project is not a NASA product
and is not endorsed by NASA.
