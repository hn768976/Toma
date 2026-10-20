"""Mountain lake at dusk — Cross-stitch (Aida cloth, cross-stitch fill, back-stitch details)."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from stitch import Stitch  # noqa: E402

STYLE = "Cross-stitch"
LIB = "stitch"

HORIZON = 640.0
CELL = 12          # design-space cell size (px at 1920 wide) -> 160 x 90 stitches at every resolution


def _hex(c):
    c = c.lstrip('#')
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def _mix(a, b, t):
    t = np.asarray(t, np.float32)[..., None]
    return a * (1 - t) + b * t


def _ramp(y, stops):
    """piecewise-linear colour ramp; stops = [(y, '#hex'), ...] ascending in y"""
    ys = np.array([s[0] for s in stops], np.float32)
    cs = np.stack([_hex(s[1]) for s in stops])
    out = np.zeros(y.shape + (3,), np.float32)
    for k in range(3):
        out[..., k] = np.interp(y, ys, cs[:, k])
    return out


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 7 * np.sin(x / 31.0) + 4 * np.sin(x / 13.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 8 * np.sin(x / 23.0) + 5 * np.sin(x / 9.0 + 0.7))


# pines: (centre x, top y, half-width at the base, root y)
PINES = [(85, 470, 62, 652), (170, 422, 80, 656), (255, 495, 60, 652), (330, 440, 76, 656),
         (410, 515, 56, 651), (470, 478, 64, 654), (520, 552, 44, 650),
         (1530, 578, 32, 646), (1592, 552, 40, 647), (1652, 590, 28, 645), (1765, 566, 36, 646)]


def pine_mask(X, Y):
    """bool (grid) mask of sampler-style conifers (jagged branch tiers) + the lit (left) side"""
    m = np.zeros(X.shape, bool)
    lit = np.zeros(X.shape, bool)
    for (cx, top, hw, root) in PINES:
        h = root - top
        r = np.clip((Y - top) / (h * 0.86), 0, 1)
        tiers = 4 if h > 120 else 3
        saw = (r * tiers) % 1.0                      # each branch tier flares out then steps back in
        half = hw * r * (0.62 + 0.38 * saw) + 1.0
        inside = (Y >= top) & (Y <= top + h * 0.88) & (np.abs(X - cx) <= half)
        trunk = (np.abs(X - cx) <= max(5, hw * 0.12)) & (Y > top + h * 0.8) & (Y <= root)
        m |= inside | trunk
        lit |= inside & (X < cx - half * 0.25)
    return m, lit


def scene_rgb(X, Y):
    """what the land and sky look like at design coords (X, Y) for Y < horizon (also used for reflections)"""
    sky = _ramp(Y, [(0, '#242456'), (110, '#3d3474'), (200, '#7a4c88'), (275, '#c8657c'),
                    (340, '#f08a6c'), (400, '#f9ae72'), (660, '#fcc88a')])
    glow = np.exp(-(((X - 1240) / 380) ** 2 + ((Y - 430) / 160) ** 2))
    sky = _mix(sky, _hex('#fde0a4'), 0.7 * glow)
    region = np.zeros(X.shape, np.int8)            # 0 sky, 1 far, 2 near, 3 pine
    fr = far_ridge(X)
    far = Y >= fr
    farc = _ramp(Y, [(300, '#8a6f98'), (520, '#a3809c'), (640, '#c093a0')])
    farc = _mix(farc, _hex('#7e6894'), 0.5 * ((X > 1250) & (Y < fr + 120)))   # shadow side of the high peak
    col = np.where(far[..., None], farc, sky)
    region[far] = 1
    nr = near_ridge(X)
    near = Y >= nr
    nearc = _ramp(Y, [(430, '#5e4a70'), (560, '#544364'), (640, '#4a3b58')])
    xs = np.arange(0, 1921, 1.0)
    slope = np.convolve(np.gradient(near_ridge(xs)), np.ones(41) / 41, 'same')[np.clip(X.astype(int), 0, 1920)]
    lit = np.clip(-slope * 2.5, 0, 1) * np.clip(1 - (Y - nr) / 110, 0, 1)
    nearc = _mix(nearc, _hex('#86607c'), 0.7 * lit)                               # sunlit flanks face the glow
    col = np.where(near[..., None], nearc, col)
    region[near] = 2
    pm, lit = pine_mask(X, Y)
    pc = np.where(lit[..., None], _hex('#2a4a3e'), _hex('#0f1d1e'))
    col = np.where(pm[..., None], pc, col)
    region[pm] = 3
    return col, region


def build_chart(gw, gh, rng):
    """per-cell target colours and region ids on the stitch grid (design coords at cell centres)"""
    X, Y = np.meshgrid((np.arange(gw) + 0.5) * CELL, (np.arange(gh) + 0.5) * CELL)
    col, region = scene_rgb(X, np.minimum(Y, HORIZON - 1))
    water = Y >= HORIZON
    d = np.clip((Y - HORIZON) / (1080 - HORIZON), 0, 1)
    # reflection: mirror about the waterline, compressed a little, broken into horizontal wobble
    wob = 18 * np.sin(Y / 9.0 + np.sin(X / 70.0) * 2.0) * (0.3 + d)
    Ym = HORIZON - (Y - HORIZON) * 0.95
    rc, rreg = scene_rgb(X + wob, Ym)
    deep = _ramp(Y, [(640, '#3e3a66'), (860, '#26284c'), (1080, '#15173a')])
    rc = _mix(rc * np.array([0.88, 0.86, 0.95], np.float32), deep, 0.12 + 0.55 * d ** 1.2)
    col = np.where(water[..., None], rc, col)
    region = np.where(water, 4, region)
    # mist band over the water, thicker at left
    mx = 1 - 0.7 * X / 1920
    band = np.exp(-((Y - 650) / (18 + 30 * mx)) ** 2) * (0.6 + 0.25 * np.sin(X / 140.0 + Y / 60.0))
    band = band * mx
    band = np.clip(band + rng.normal(0, 0.06, band.shape) * (band > 0.15), 0, 0.95)
    col = _mix(col, _hex('#e8c4c0'), band * 0.85)
    region = np.where((band > 0.3) & (region != 3), 5, region)
    # a stitch never covers the cloth completely: pre-darken so the sewn colour lands on target
    cloth = _hex('#efe6d2')
    col = np.clip((col - 0.2 * cloth) / 0.8, 0, 1)
    col = col + rng.normal(0, 0.018, col.shape)       # breaks single-colour rows in smooth gradients
    return col, region


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    cell = max(2, int(round(CELL * S.s)))
    s = Stitch(W, H, cell=cell, seed=seed, cloth='#efe6d2')
    rng = np.random.default_rng(seed + 101)
    gw, gh = s.gw, s.gh
    col, region = build_chart(gw, gh, rng)

    # the chart: quantise to a floss palette (median cut + error diffusion, like a pattern generator)
    im = Image.fromarray((np.clip(col, 0, 1) * 255 + 0.5).astype(np.uint8))
    q = im.quantize(colors=26, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    idx = np.asarray(q)
    pal = np.asarray(q.getpalette()[:26 * 3]).reshape(-1, 3)
    hexes = ['#%02x%02x%02x' % tuple(p) for p in pal]

    def sew(regions, name):
        sel = np.isin(region, regions)
        for k in range(len(hexes)):
            cells = sel & (idx == k)
            if cells.any():
                s.cross(cells, hexes[k], shade_var=0.04)
        s.stage(name)

    sew([0], 'sky')
    sew([1], 'far_mountains')
    sew([2], 'near_mountains')
    sew([4], 'water')
    sew([3], 'trees')
    sew([5], 'mist')

    C = s.cell
    # ripples: long back stitches in a light and a dark floss across the water
    for k in range(18):
        y = 690 + (k / 18) ** 1.3 * 370 + rng.uniform(-8, 8)
        x0 = rng.uniform(250, 1750)
        L = rng.uniform(60, 220) * (0.6 + (y - 640) / 440)
        if 1040 < x0 < 1300 and 780 < y < 850:
            continue
        colr = '#e9b49c' if (k % 3 and y < 900) else '#6c6290'
        s.back(S.pts([(x0, y), (x0 + L, y)]), colr, width=C * 0.32, step=2.0, smooth=False)

    # boat: cross-stitched hull with a back-stitched gunwale, seated rower, oars, broken reflection
    hull = s.poly(S.pts([(1072, 772), (1268, 764), (1236, 806), (1104, 808)]))
    s.cross(s.cells(hull, 0.4), '#6a3f2c')
    plank = s.poly(S.pts([(1076, 772), (1264, 765), (1258, 776), (1082, 782)]))
    s.cross(s.cells(plank, 0.45), '#9a6440')
    body = s.poly(S.pts([(1150, 768), (1182, 768), (1178, 738), (1156, 738)]))
    s.cross(s.cells(body, 0.4), '#2a2e48')
    s.cross(s.cells(s.circle(*S.pt(1167, 727), S(11)), 0.4), '#3a2b2a')
    refl = s.poly(S.pts([(1104, 812), (1236, 810), (1250, 842), (1090, 846)]))
    rc = s.cells(refl, 0.4) & (rng.random((gh, gw)) < 0.8)
    s.cross(rc, '#3a2b38')
    s.back(S.pts([(1072, 772), (1170, 768), (1268, 764)]), '#3a2418', step=1.0, smooth=False)
    s.back(S.pts([(1160, 760), (1110, 812)]), '#c9a070', width=C * 0.28, step=6, smooth=False)
    s.back(S.pts([(1176, 760), (1232, 814)]), '#c9a070', width=C * 0.28, step=6, smooth=False)
    s.stage('boat')

    # birds: each wing one long stitch from hole to hole (problem list: no L-shaped staircases)
    for (gx, gy, k) in [(118, 17, 2), (124, 20, 2), (130, 16, 3), (136, 22, 2), (114, 23, 1)]:
        hole = lambda a, b: S.pt((gx + a) * CELL, (gy + b) * CELL)
        for a, b in [((-k - 1, 0), (-1, -1)), ((-1, -1), (0, 0)), ((0, 0), (1, -1)), ((1, -1), (k + 1, 0))]:
            s.back([hole(*a), hole(*b)], '#221d38', width=C * 0.42, step=8, smooth=False)
    s.stage('birds')

    # foreground reeds, lower left: back-stitched blades with French-knot seed heads
    for k in range(16):
        x = 20 + k * 17 + rng.uniform(-6, 6)
        top = 950 + rng.uniform(0, 60) + k * 3
        lean = rng.uniform(-30, 40)
        colr = ['#3e4a2c', '#5b5a32', '#2c3628'][k % 3]
        s.back(S.pts([(x, 1080), (x + lean * 0.3, (1080 + top) / 2), (x + lean, top)]), colr, width=C * 0.3, step=2)
        if k % 4 == 1:
            s.knot(*S.pt(x + lean, top - 6), '#6b4a2e', r=C * 0.5)
    s.stage('reeds')

    img = s.composite(vignette=0.10)
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(s.stages):
            save_png(im, os.path.join(stages_dir, '%02d_%s.png' % (i, name)))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'stitch_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    t0 = time.perf_counter()
    im = paint(W, H)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
