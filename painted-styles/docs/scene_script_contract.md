# Scene script contract

File: `scripts/scenes/<style_key>_lake.py`

```python
import drawkit                       # sets sys.path to vendor/claude-drawing-skill/lib
from drawkit import Scaler, seed_all

STYLE = "Watercolour"                # exact repo display name
LIB = "watercolor"                   # lib module

def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    ...   # use the skill class with seed=seed; author coordinates as S(x) / S.pts([...])
    return PIL.Image (RGB, size W x H)

if __name__ == "__main__":           # python scripts/scenes/x_lake.py out.png [W H]
    ...
```
- Must run with `.venv/bin/python` from the project root (put `scripts/` on sys.path
  at the top: `sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))`).
- Deterministic: all randomness from the class's own rng / `seed`; no time, no hash().
- Size-aware: scale every coordinate, radius and stroke width you author by `S.s`. Where the
  class has size-related constructor args (tile size, cell, pen_width, screen, ss) scale
  them too when that keeps the look the same at 4K.
- Call `p.stage(name)` at natural steps (sky, far mountains, near mountains, water, trees,
  boat, birds, mist) so the drawing order can be exported later.
- Do NOT modify anything in `vendor/`.
