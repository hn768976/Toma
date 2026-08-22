# manim-project

Manim Community animations.

## Requirements

Manim builds `manimpango` and `pycairo` from source on Linux (no wheels are
published), so the system headers must be present before `uv sync`. Rendering
video also needs `ffmpeg`:

```bash
sudo apt-get install -y libcairo2-dev libpango1.0-dev pkg-config ffmpeg
```

Then:

```bash
uv sync
```

## Scenes

### `scenes/binary_rain.py` — `BinaryRain`

A recreation of a "binary data grid" stock-footage loop: a 32x26 grid of 4-bit
groups on a near-white background, with scattered circular face glyphs.

The grid is positionally static. All of the motion comes from two sources:

- **Opacity.** Soft bands of brightness sweep across the grid, tilted so they
  travel diagonally. Each cell has a fixed random offset and gain, which breaks
  the bands into speckle instead of solid bars.
- **Values.** A slice of the cells re-roll to a new nibble every frame.

The band cycle counts are integers over `DURATION`, so the brightness field
loops seamlessly at 30s.

```bash
uv run manim -r 1920,1080 --fps 30 scenes/binary_rain.py BinaryRain
```

Add `-ql` for a fast 480p15 preview. A full 1080p30 render is ~900 frames at
roughly 0.7s/frame.

#### Tuning

| Constant | Effect |
| --- | --- |
| `COLS`, `ROWS` | Grid density. Cost scales with `COLS * ROWS`. |
| `DIM`, `BRIGHT` | Opacity floor and ceiling for a cell. |
| `REROLL_PER_SEC` | Fraction of the grid that changes value each second. |
| `WAVES` | `(cycles, width, weight, y-tilt, phase)` per brightness band. Keep `cycles` an integer to stay loopable. |
| `SEED` | Re-rolls the static layout, including which cells hold face glyphs. |
