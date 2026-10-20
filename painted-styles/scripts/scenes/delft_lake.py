"""Mountain lake at dusk — Delft tiles: one cobalt tile picture covering the whole wall (16 x 9 tiles)."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import drawkit  # noqa: E402  (sets sys.path to the skill lib)
from drawkit import Scaler, seed_all, save_png  # noqa: E402

import numpy as np  # noqa: E402
from delft import DelftTile, ellipse_pts  # noqa: E402

STYLE = "Delft tiles"
LIB = "delft"

HORIZON = 640.0


def far_ridge(x):
    return (420 - 118 * np.exp(-((x - 1250) / 230) ** 2) - 70 * np.exp(-((x - 760) / 190) ** 2)
            - 55 * np.exp(-((x - 260) / 200) ** 2) - 62 * np.exp(-((x - 1700) / 170) ** 2)
            + 6 * np.sin(x / 47.0) + 3 * np.sin(x / 19.0 + 1.3))


def near_ridge(x):
    return (612 - 160 * np.exp(-((x - 400) / 430) ** 2) - 62 * np.exp(-((x - 980) / 170) ** 2)
            - 52 * np.exp(-((x - 1760) / 190) ** 2) + 7 * np.sin(x / 33.0) + 4 * np.sin(x / 14.0 + 0.7))


PINES = [(85, 470, 46, 652), (170, 422, 58, 656), (255, 495, 44, 652), (330, 440, 54, 656),
         (410, 515, 40, 651), (470, 478, 46, 654), (520, 552, 32, 650),
         (1530, 578, 26, 646), (1592, 552, 30, 647), (1652, 590, 22, 645), (1765, 566, 28, 646)]


def pine_outline(cx, top, hw, root):
    h = root - top
    tiers = 4 if h > 120 else 3
    left, right = [], []
    for t in range(tiers):
        y_tip = top + h * 0.86 * (t + 1) / tiers
        y_in = top + h * 0.86 * (t + 0.72) / tiers
        w = hw * (t + 1) / tiers
        left += [(cx - w * 0.5, y_in), (cx - w, y_tip)]
        right += [(cx + w * 0.5, y_in), (cx + w, y_tip)]
    yb = top + h * 0.86
    tw = max(4, hw * 0.1)
    return [(cx, top)] + right + [(cx + tw, yb), (cx + tw, root), (cx - tw, root), (cx - tw, yb)] + left[::-1]


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    tile = 120 * s                                            # 16 x 9 tiles at every resolution
    t = DelftTile(W, H, seed=seed, tile=tile, joint=3.6 * s, origin=(0, 0))
    t.tableau(0, 0, 16, 9)                                    # the whole wall is one tile picture
    rng = np.random.default_rng(seed + 3)
    w = lambda v: v * s                                       # brush widths scale with the picture
    P = lambda pts: np.asarray(S.pts(pts), np.float32)
    t.layer('picture')

    # ------------------------------------------------------------ front to back
    # reeds in the lower-left corner
    t.grass(S(0), S(300), S(1074), n=9, h=S(70), lean=0.35, width=w(1.5), dens=0.9, yspread=S(8))
    t.grass(S(10), S(240), S(1050), n=6, h=S(46), lean=0.5, width=w(1.3), dens=0.8, yspread=S(6))
    for k in range(4):                                        # bulrush heads
        x, y = 40 + k * 62 + rng.uniform(-10, 10), 978 + rng.uniform(-14, 14)
        head = ellipse_pts(*S.pt(x, y), S(4.5), S(13), 0.15, 14)
        t.closed(head, w(1.4))
        t.wash(head, 0.5, slip=0.3, pool=0.3)
        t.trek(P([(x - 2, y + 13), (x - 6, 1080)]), w(1.4), taper=(0.05, 0.1))
        t.occlude(head)

    # the rowing boat, rower seated, oars dipping
    BX, BY = 1080.0, 800.0
    hull = P([(BX - 6, BY - 24), (BX + 40, BY - 16), (BX + 100, BY - 13), (BX + 160, BY - 16), (BX + 190, BY - 30),
              (BX + 176, BY - 6), (BX + 150, BY + 4), (BX + 40, BY + 4), (BX + 12, BY - 6)])
    hx, hy = S.pt(BX + 92, BY - 70)
    t.closed(ellipse_pts(hx, hy, S(8), S(9), 0, 18), w(1.6))
    t.trek(P([(BX + 80, BY - 72), (BX + 92, BY - 84), (BX + 106, BY - 74)]), w(1.8), smooth=True)        # cap
    body = P([(BX + 76, BY - 18), (BX + 80, BY - 58), (BX + 104, BY - 58), (BX + 110, BY - 18)])
    t.trek(np.vstack([body, body[:1]]), w(1.7))
    t.wash(body, 0.4, slip=0.4, pool=0.5, angle=-1.3)
    t.occlude(np.vstack([body, ellipse_pts(hx, hy, S(9), S(10), 0, 18)]))
    for (a, b) in [((BX + 84, BY - 44), (BX + 18, BY + 26)), ((BX + 102, BY - 44), (BX + 168, BY + 26))]:
        t.trek(P([a, b]), w(2.2), smooth=False, taper=(0.05, 0.05))
        blade = ellipse_pts(*S.pt(b[0] + (6 if b[0] > BX + 90 else -6), b[1] + 6), S(14), S(4.5), 0.5 if b[0] > BX + 90 else -0.5, 14)
        t.wash(blade, 0.45, slip=0.3)
    t.trek(hull[:5], w(2.2), taper=(0.02, 0.05))
    t.trek(np.vstack([hull[4:], hull[:1]]), w(2.0), taper=(0.02, 0.05))
    t.trek(P([(BX + 6, BY - 12), (BX + 100, BY - 4), (BX + 180, BY - 14)]), w(1.0), 0.8, pounce=False)
    t.wash(hull, 0.42, angle=0.0, pool=0.5)
    t.hatch(hull, angle=0.0, spacing=S(3.6), width=w(0.8), dens=0.6)
    t.occlude(hull)
    t.reflection(S(BX + 92), S(BY + 6), S(170), S(52), step=S(6), width=w(1.6), dens=0.75)

    # pines: outlined tiers, branch dashes on the shade side, a dark wash
    pine_polys = []
    for (cx, top, hw, root) in PINES:
        poly = P(pine_outline(cx, top, hw, root))
        pine_polys.append(poly)
        t.trek(np.vstack([poly, poly[:1]]), w(1.7), taper=(0.02, 0.02))
        h = root - top
        tiers = 4 if h > 120 else 3
        for k in range(tiers):
            y_tip = top + h * 0.86 * (k + 1) / tiers
            ww = hw * (k + 1) / tiers
            for j in range(3):
                yy = y_tip - (j + 1) * h * 0.86 / tiers * 0.22
                t.trek(P([(cx + ww * 0.15, yy - 4), (cx + ww * (0.5 + 0.12 * j), yy)]), w(1.0), 0.8, pounce=False,
                       taper=(0.1, 0.6))
        t.wash(poly, 0.36, angle=-np.pi / 2, pool=0.5, slip=0.8)
        t.reflection(S(cx), S(HORIZON + 2), S(hw * 1.5), S((root - top) * 0.55), step=S(5.5), width=w(1.4), dens=0.7)
    t.occlude(pine_polys)

    # mist: kept as bare white glaze, a soft band over the far shore, thicker at the left
    xs = np.linspace(-10, 1930, 50)
    thick = 46 * (1 - 0.75 * xs / 1920) + 8 * np.sin(xs / 85.0)
    mist = P(list(zip(xs, 636 - thick * 0.5 + 5 * np.sin(xs / 51.0))) +
             list(zip(xs[::-1], (650 + thick * 0.55 + 4 * np.sin(xs / 37.0 + 1))[::-1])))
    for k in range(5):                                        # a few drifting wisp lines at the mist's edges
        x0 = 60 + k * 330 + rng.uniform(-30, 30)
        yv = 628 - 14 * (1 - x0 / 1920) + rng.uniform(-6, 6)
        t.trek(P([(x0, yv), (x0 + 90, yv - 3), (x0 + 200, yv + 1)]), w(0.9), 0.45, pounce=False, taper=(0.3, 0.4))
    t.occlude(mist, grow=0)

    # water: ripples (fine far away, bold near), then a wash that darkens toward the viewer
    t.water(0, W, S(HORIZON + 4), H, width=w(1.6), dens=0.8, far=S(4.0), near=S(13), avoid=t.occ, waves=0.7 * s)
    water = P([(-5, HORIZON), (1925, HORIZON), (1925, 1085), (-5, 1085)])
    t.wash(water, 0.12, angle=0.0, pool=0.3, band=S(11), grad=(S.pt(960, HORIZON), S.pt(960, 1080), 0.5, 1.6))
    nr = np.linspace(0, 1920, 60)                             # the near range mirrored: a darker wash band
    refl = P(list(zip(nr, HORIZON + (HORIZON - near_ridge(nr)) * 0.7)) + [(1920, HORIZON), (0, HORIZON)])
    t.hatch(refl, angle=0.0, spacing=S(4.2), width=w(0.9), dens=0.55, wave=0.6 * s)
    t.occlude(water, grow=0)

    # near range: outline, wash darkening toward its foot, hatched shade on the slopes away from the glow
    xs = np.linspace(-10, 1930, 140)
    ridge = P(list(zip(xs, near_ridge(xs))))
    t.trek(ridge, w(2.0), taper=(0.01, 0.01))
    near = np.vstack([ridge, P([(1930, HORIZON + 2), (-10, HORIZON + 2)])])
    t.wash(near, 0.24, angle=0.0, pool=0.4, grad=(S.pt(400, 450), S.pt(400, HORIZON), 0.7, 1.3))
    for (x0, x1) in [(20, 380), (980, 1150), (1760, 1910)]:
        seg = [(x, near_ridge(x) + 6) for x in np.linspace(x0, x1, 12)]
        poly = P(seg + [(x0 + (x1 - x0) * 0.55, HORIZON - 4)])          # a wedge under the slope, no vertical edges
        t.hatch(poly, angle=1.1, spacing=S(5), width=w(0.9), dens=0.6)
    t.occlude(near, grow=0)

    # far range: a pale wash, a light outline, a few crevices
    ridge = P(list(zip(xs, far_ridge(xs))))
    t.trek(ridge, w(1.6), 0.85, taper=(0.01, 0.01))
    far = np.vstack([ridge, P([(1930, HORIZON), (-10, HORIZON)])])
    t.wash(far, 0.09, angle=0.0, pool=0.4)
    for (x, y, dx, dy) in [(1250, 310, -70, 120), (1250, 310, 80, 110), (760, 352, -40, 90), (1700, 360, 40, 80),
                           (260, 368, 30, 70)]:
        t.trek(P([(x, y + 8), (x + dx * 0.5, y + dy * 0.45), (x + dx, y + dy)]), w(1.1), 0.7, pounce=False, taper=(0.1, 0.8))
    for k in range(7):                                      # shade strokes down the lee flank of the high peak
        x = 1275 + k * 26
        y = far_ridge(x) + 10
        t.trek(P([(x, y), (x + 14, y + 30 + 6 * (k % 3)), (x + 22, y + 58 + 8 * (k % 2))]), w(1.0), 0.6, pounce=False,
               taper=(0.1, 0.7))
    t.occlude(far, grow=0)

    # sky: birds, one long low cloud bank, then the dusk wash -- darkest overhead, the glow left white
    t.birds([S.pt(*p) for p in [(1420, 210), (1490, 248), (1565, 192), (1630, 270), (1370, 282)]], size=S(15),
            width=w(1.8), tilt=0.2)
    t.cloud(S(560), S(225), S(380), S(70), lean=0.35, tone=0.12, width=w(1.6), seed=seed + 20)
    sky = P([(-5, -5), (1925, -5), (1925, HORIZON), (-5, HORIZON)])
    t.wash(sky, 0.3, angle=0.0, pool=0.2, band=S(14), grad=(S.pt(960, 0), S.pt(960, 440), 1.0, 0.0))
    t.wash(sky, 0.16, angle=0.0, pool=0.2, band=S(14), grad=(S.pt(1240, 300), S.pt(0, 300), 0.0, 1.0))   # glow behind the peak
    t.clear_occlusion()

    # ------------------------------------------------------------ the workshop
    if stages_dir:
        t.stage('tiles', hide=('*',))
        t.stage('pounce', hide=('trek', 'wash'))
        t.stage('outline', hide=('wash',))
    t.fire()
    if stages_dir:
        t.stage('fired')
    t.set_wall()
    t.age(craze=0.8, chips=0, specks=0.6, nails=0.3, dirt=0.8)
    img = t.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(t.stages):
            save_png(im, os.path.join(stages_dir, '%02d_%s.png' % (i, name)))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'delft_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    t0 = time.perf_counter()
    im = paint(W, H)
    print('paint %.2fs' % (time.perf_counter() - t0))
    save_png(im, out)
