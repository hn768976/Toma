"""Mountain lake at dusk — Linocut (黑白麻胶版画), vendor lib/linocut.py `Linocut`.
Key block in black plus one spot-colour block: `Vermilion` (Phase 1: dusk afterglow and its reflection) or
`Indigo` (a cooler daytime print: blue sky streaks, a blue-tinted far range and blue water).
Full-bleed: the block is larger than the sheet, so no paper margin, rim, pencil or chop.

python scripts/scenes/linocut_lake.py out.png [W H [colourway [bleed]]]
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, '..'))
sys.path.insert(0, _HERE)
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png
from core import spline, fbm1d
from linocut_common import STYLE, COLOURWAYS, make_print, D, Stager, day_sky, day_cloud

LIB = "linocut"
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HOR = 640
GLOW = (1240, 560)


def paint(W=1920, H=1080, seed=1, colourway="Vermilion", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    S = Scaler(W, H, bleed)
    d = D(S)
    inc = set(GROUPS) if include is None else set(include)
    L, col = make_print(S, seed, colourway)
    day = colourway == "Indigo"
    st = Stager(L, stages_dir, dense_stages)
    CW, CH = S.W, S.H
    hz = int(round(S.y(HOR)))
    hor = S.y(HOR)
    X0, X1, Y0, Y1 = S.X0 - 30, S.X1 + 30, S.Y0 - 30, S.Y1 + 30      # design range + a margin
    GX, GY = GLOW

    def group(name):
        L.rng = drawkit.group_rng(seed, name + '#lib')
        return drawkit.group_rng(seed, name)

    # ---- geometry (design space, independent of any painting)
    def ridge(xs_ctrl, ys_ctrl):
        P = spline(list(zip(xs_ctrl, ys_ctrl)), 16)
        xs = np.arange(S.x(X0), S.x(X1) + 1, max(2.0, S(4)), dtype=np.float32)
        return xs, np.interp(xs, S.x(P[:, 0]), S.y(P[:, 1])).astype(np.float32)

    fx = np.linspace(-640, 2560, 98)
    fr = fbm1d(98, 8, 3, seed + 11)
    fy = (392 - 80 * np.exp(-((fx - 1250) / 130) ** 2) - 30 * np.exp(-((fx - 1400) / 80) ** 2)
          - 48 * np.exp(-((fx - 560) / 200) ** 2) - 22 * np.exp(-((fx - 1760) / 130) ** 2)
          + 22 * np.exp(-((fx - 900) / 110) ** 2) + 12 * fr)
    FX, FY = ridge(fx, fy)
    nx = np.linspace(-640, 2560, 65)
    ny = (600 - 150 * np.exp(-((nx - 320) / 330) ** 2) - 80 * np.exp(-((nx - 820) / 200) ** 2)
          - 50 * np.exp(-((nx - 1700) / 190) ** 2) + 8 * fbm1d(65, 6, 3, seed + 21))
    NX, NY = ridge(nx, ny)
    far_r = lambda x: np.interp(x, FX, FY)          # canvas px
    near_r = lambda x: np.interp(x, NX, NY)
    top = [(S.x(X0), S.y(Y0)), (S.x(X1), S.y(Y0))]
    sky_poly = top + list(zip(FX[::-1], FY[::-1]))
    far_poly = list(zip(FX, FY)) + [(S.x(X1), hor + S(2)), (S.x(X0), hor + S(2))]
    near_poly = list(zip(NX, NY)) + [(S.x(X1), hor + S(2)), (S.x(X0), hor + S(2))]
    water_poly = [(S.x(X0), hor), (S.x(X1), hor), (S.x(X1), S.y(Y1)), (S.x(X0), S.y(Y1))]
    band = lambda y0, y1: [(S.x(X0), S.y(y0)), (S.x(X1), S.y(y0)), (S.x(X1), S.y(y1)), (S.x(X0), S.y(y1))]
    gd = lambda x, y: float(np.hypot((y - GY) * 1.6, x - GX))      # design px from the hidden sun

    # ======================================================================= groups
    def g_sky(stage=True):
        group('sky')
        stg = st if stage else (lambda *a, **k: None)
        if day:
            day_sky(L, col, S, d, sky_poly, 40, HOR - 120, bands=((Y0 - 40, 250), (250, HOR + 10)), stg=stg)
            stg('sky', major=True)
            return
        L.clear(L.poly(band(400, HOR)), chatter=0.35, angle=2)
        stg('sky low cleared')
        # long horizontal V cuts, carved lighter toward the horizon (three passes, top down)
        skyd = lambda x, y: np.clip((y - 110) / 290, 0.0, 1) ** 1.2
        for (a, b) in ((Y0 - 40, 230), (230, 330), (330, 420)):
            L.hatch(band(60, 420), angle=0, spacing=S(8), width=S(3.4), dash=(S(60), S(320)), gap=(S(8), S(50)),
                    cut=True, density=d.band(skyd, a, b),
                    bend=lambda x, y: S(6) * np.sin(d.ux(x) / 260 + d.uy(y) / 90))
            stg('sky cuts')
        # spot colour streaks left standing on the colour block; they show only through the carved key
        if day:
            dens = lambda x, y: np.clip(0.25 + (y - 150) / 380, 0.05, 0.85) * (y > 120)
        else:
            dens = lambda x, y: np.clip(1.15 - gd(x, y) / 900, 0.05, 1) * (y > 150)
        for (a, b) in ((Y0 - 40, 360), (360, HOR + 10)):
            L.hatch(sky_poly, angle=0, spacing=S(5), width=S(5.0), dash=(S(40), S(260)), gap=(S(4), S(30)),
                    cut=False, on=col, density=d.band(dens, a, b))
            stg('sky colour')
        stg('sky', major=True)

    def g_clouds():
        rng = group('clouds')
        # thin lens-shaped clouds high in the black: stacks of long V cuts tapering at both ends,
        # with a lit underside left standing on the colour block
        clouds = [(330, 118, 520, 1.0), (930, 92, 420, 0.8), (1470, 140, 600, 1.0), (1830, 78, 360, 0.7)]
        if S.X0 < -60: clouds.append((-120, 150, 380, 0.75))
        if S.X1 > 1980: clouds.append((2040, 172, 300, 0.6))
        for (cx, cy, ln, k) in clouds:
            if day:
                day_cloud(L, col, S, rng, cx, cy, ln, k)
                st('cloud')
                continue
            rows = 4 + int(3 * k)
            for i in range(rows):
                f = i / (rows - 1)                                    # 0 top .. 1 underside
                half = ln / 2 * (0.35 + 0.65 * np.sin(np.pi * (0.15 + 0.7 * f))) * rng.uniform(0.85, 1.1)
                y = cy + (f - 0.5) * 46 * k
                x0 = cx - half + rng.uniform(-30, 30) + 40 * (1 - f)
                x1 = cx + half + rng.uniform(-30, 30) - 20 * (1 - f)
                n = 1 if half < 140 else 2
                xs = np.linspace(x0, x1, n + 1)
                for j in range(n):
                    a, b = xs[j] + rng.uniform(0, 14), xs[j + 1] - rng.uniform(0, 14)
                    m = (a + b) / 2
                    pts = [(a, y + 1.5), (m, y - 1.8 * k + rng.uniform(-1, 1)), (b, y + 1.2)]
                    w = (1.8 + 2.0 * f) * k + 0.6
                    L.gouge(S.pts(pts), S(w), 'v', cut=True, taper=(0.35, 0.35))
                    if f > 0.6:                                 # lit underside on the colour block
                        L.gouge(S.pts([(a + 10, y + 2), (m, y + 0.5), (b - 10, y + 2)]), S(w + 2.5), 'v', cut=False, on=col,
                                taper=(0.35, 0.35))
            st('cloud')
        st('clouds', major=True)

    def g_far(stage=True):
        group('far')
        stg = st if stage else (lambda *a, **k: None)
        L.clear(L.poly(far_poly), chatter=0.3, angle=0)
        stg('far cleared')
        L.outline(L.poly(far_poly), S(2.2), cut=False)
        stg('far contour')
        for (a, b) in ((X0, 960), (960, X1)):
            L.hatch(far_poly, angle=0, spacing=S(10), width=S(2.2), dash=(S(18), S(110)), gap=(S(14), S(70)), cut=False,
                    bend=lambda x, y: far_r(x) - far_r(S.x(1000)),
                    density=d.band(lambda x, y: np.clip(0.06 + 0.35 * np.exp(-(y - d.uy(far_r(S.x(x)))) / 30)
                                                        + 0.2 * (x < GX - 300), 0, 0.6), a, b, 'x'))
            stg('far ridges')
        if day:   # the far range prints pale blue: a tint left standing on the colour block, broken by ridge cuts
            fm = L.poly(far_poly) * (np.arange(CH)[:, None] < hor - S(2))
            L.leave(fm, on=col)
            L.hatch(far_poly, angle=0, spacing=S(7), width=S(3.0), dash=(S(30), S(160)), gap=(S(10), S(60)), cut=True, on=col,
                    bend=lambda x, y: far_r(x) - far_r(S.x(1000)),
                    density=d.fn(lambda x, y: np.clip(0.2 + (y - d.uy(far_r(S.x(x)))) / 160, 0, 1)))
            stg('far tint')
        stg('far', major=True)

    def pines_right():
        return [(1505, 540), (1560, 500), (1618, 552), (1668, 512), (1730, 545), (1790, 520), (1850, 560)]

    def g_near(stage=True):
        rng = group('near')
        stg = st if stage else (lambda *a, **k: None)
        L.outline(L.poly(near_poly), S(2.5))
        L.leave(L.poly(near_poly))
        stg('near block')
        quiet = lambda x, y: 1 - 0.65 * np.exp(-((x - 1680) / 230) ** 2) * (y > 520)   # calm behind the right pines
        for (a, b) in ((X0, 800), (800, X1)):
            L.hatch(near_poly, angle=0, spacing=S(9), width=S(2.4), dash=(S(20), S(140)), gap=(S(10), S(70)), cut=True,
                    bend=lambda x, y: near_r(x) - near_r(S.x(600)),
                    density=d.band(lambda x, y: quiet(x, y) * np.clip(0.35 + 0.4 * np.exp(-(y - d.uy(near_r(S.x(x)))) / 50)
                                                                      + 0.25 * (x > 700), 0, 0.9), a, b, 'x'))
            stg('near cuts')
        # pines on both shores (standing black spruces, white halo where they cross the black hill)
        left = [(75, 470), (130, 430), (190, 500), (245, 420), (300, 475), (355, 520), (400, 455),
                (455, 540), (505, 560), (165, 545), (275, 555), (425, 585)]
        if S.X0 < -40:
            left = [(-30, 455), (10, 500)] + left
        for i, (x, ty) in enumerate(sorted(left, key=lambda t: t[1])):
            L.pine(S.x(x + rng.normal(0, 4)), S.y(652), S(652 - ty), snow=0, halo=S(2.4), nicks=0.3)
            if i % 2 == 1: stg('pine')
        # right shore: taller than Phase 1 so their tips stand against the pale far range, a wider halo,
        # fewer needle nicks so each silhouette reads clean
        for i, (x, ty) in enumerate(pines_right()):
            L.pine(S.x(x + rng.normal(0, 3)), S.y(652), S(652 - ty), w=S((652 - ty) * 0.42), snow=0,
                   halo=S(4.5), nicks=0.12)
            if i % 2 == 1: stg('pine')
        stg('near', major=True)

    def g_water():
        group('water')
        # reflections come from the sky, far and near carvings: re-carve them on a scratch copy of the blocks,
        # so this group never depends on which other groups were printed
        saved = [b.a.copy() for b in L.blocks]; ch = L.chatter.copy()
        L.key.a[:] = L._outer
        for b in L.blocks:
            if b is not L.key: b.a[:] = 0
        g_sky(False); g_far(False); g_near(False)
        key1 = (np.asarray(L.key.a, np.float32)[::L.ss, ::L.ss] / 255)[:CH, :CW]
        colm = (np.asarray(col.a, np.float32)[::L.ss, ::L.ss] / 255)[:CH, :CW]
        for b, a in zip(L.blocks, saved): b.a[:] = a
        L.chatter[:] = ch
        group('water')

        L.clear(L.poly(water_poly), chatter=0.45, angle=0)
        L.clear(L.poly(water_poly), on=col, chatter=0)
        st('water cleared')
        src = np.clip(2 * hz - np.arange(CH), 0, CH - 1)
        below = (np.arange(CH)[:, None] > hz + S(3))
        fadein = np.clip(1 - (np.arange(CH)[:, None] - hor) / S(330), 0, 1)
        refl = key1[src] * below * (fadein > 0.05)
        L.leave(refl)
        st('reflection')
        for (a, b) in ((HOR, HOR + 120), (HOR + 120, HOR + 240), (HOR + 240, HOR + 360)):
            L.hatch(water_poly, angle=0, spacing=S(6), width=S(2.6), dash=(S(40), S(300)), gap=(S(6), S(40)), cut=True,
                    density=d.band(lambda x, y: np.clip(0.35 + (y - HOR) / 300, 0, 1), a, b),
                    box=(0, hz, CW, min(CH, hz + int(S(360)))))
            st('ripple cuts')
        for (a, b) in ((HOR, 790), (790, 940), (940, Y1)):
            L.hatch(water_poly, angle=0, spacing=S(11), width=S(2.6), dash=(S(30), S(260)), gap=(S(10), S(90)), cut=False,
                    bend=lambda x, y: S(2) * np.sin(d.ux(x) / 140 + d.uy(y) / 30),
                    density=d.band(lambda x, y: np.clip(0.12 + 0.9 * max(0.0, (y - HOR) / (1080 - HOR)) ** 1.4, 0, 0.95), a, b))
            st('ripple ridges')
        if day:
            # blue water: the far range's tint mirrored, then long blue swells across the lake
            rc = colm[src] * below * (fadein > 0.05) * (key1[src] < 0.5)
            L.leave(rc * 0.999, on=col)
            L.hatch(water_poly, angle=0, spacing=S(7), width=S(4.2), dash=(S(30), S(220)), gap=(S(8), S(60)), cut=False, on=col,
                    density=d.fn(lambda x, y: np.clip(0.15 + 0.75 * max(0.0, (y - HOR) / 440) ** 0.8, 0, 0.9)))
        else:
            # the afterglow's reflection: short horizontal streaks under the hidden sun
            L.hatch([(S.x(GX - 420), hor + S(4)), (S.x(GX + 420), hor + S(4)), (S.x(GX + 420), S.y(1000)), (S.x(GX - 420), S.y(1000))],
                    angle=0, spacing=S(7), width=S(4.4), dash=(S(16), S(110)), gap=(S(8), S(50)), cut=False, on=col,
                    density=d.fn(lambda x, y: np.clip(np.exp(-abs(x - GX) / 110) * (1.2 - (y - HOR) / 420), 0, 1)))
        st('water colour')
        st('water', major=True)

    def g_mist():
        rng = group('mist')
        xs = np.linspace(X0 - 20, X1 + 20, 60)
        mtop = [(x, 634 - 44 * min(1.4, max(0, 1 - x / 1500)) + 8 * np.sin(x / 140)) for x in xs]
        mbot = [(x, 684 + 18 * min(1.4, max(0, 1 - x / 1400)) + 6 * np.sin(x / 110 + 1)) for x in xs[::-1]]
        mist = L.poly(spline(S.pts(mtop), 6).tolist() + spline(S.pts(mbot), 6).tolist())
        L.clear(mist, chatter=0.25, angle=0)
        L.clear(mist, on=col, chatter=0)
        st('mist band')
        nw = 9 + int(9 * (X1 - X0 - 1980) / 1980)
        for i in range(nw):
            x = rng.uniform(X0, X1 - 220); y = rng.uniform(625, 675); ln = rng.uniform(80, 260)
            L.gouge(S.pts([(x, y), (x + ln * 0.5, y - 3), (x + ln, y)]), S(2.0), 'v', cut=False)
            if i % 3 == 2: st('mist wisps')
        st('mist', major=True)

    def g_boat():
        group('boat')
        BX, BY = 1170, 800
        P = lambda pts: np.array(S.pts(pts), np.float32)
        hull = [(BX - 92, BY - 18), (BX - 50, BY - 10), (BX + 50, BY - 10), (BX + 94, BY - 20), (BX + 66, BY + 4), (BX - 66, BY + 4)]
        rower = [(BX - 16, BY - 12), (BX - 18, BY - 42), (BX - 10, BY - 52), (BX + 2, BY - 50), (BX + 4, BY - 36), (BX + 6, BY - 12)]
        head = [(BX - 6 + 8 * np.cos(t), BY - 62 + 8 * np.sin(t)) for t in np.linspace(0, 6.3, 20)]
        parts = [P(hull), P(rower), P(head),
                 L.stroke(S.pts([(BX - 40, BY - 40), (BX + 10, BY - 26), (BX + 72, BY + 14)]), S(4), 'knife')]
        bm = L.mask_of(parts)
        L.outline(bm, S(3))
        L.leave(bm)
        st('boat')
        L.gouge(S.pts([(BX - 80, BY - 14), (BX, BY - 5), (BX + 82, BY - 16)]), S(1.8), 'v')    # gunwale highlight
        st('boat detail')
        for k, yy_ in enumerate((812, 822, 834, 846)):
            w = 80 - k * 14
            L.gouge(S.pts([(BX - w, yy_), (BX + w * 0.9, yy_ + 1)]), S(4.0 - k * 0.5), 'brush', end=S(2), cut=False)
        st('boat reflection')
        st('boat', major=True)

    def g_birds():
        group('birds')
        for (bx, by, sc) in [(1380, 250, 1.0), (1440, 222, 0.8), (1505, 262, 0.7), (1590, 205, 0.9), (1665, 242, 0.6)]:
            k = sc * 1.4
            wd = S(5.0) * max(k, 0.7)
            if day: wd = wd * 0.8                       # daytime: black birds left standing on the pale sky
            L.gouge(S.pts(spline([(bx - 20 * k, by + 2 * k), (bx - 9 * k, by - 8 * k), (bx, by)], 6)), wd, 'v', cut=not day, smooth=False)
            L.gouge(S.pts(spline([(bx, by), (bx + 9 * k, by - 9 * k), (bx + 20 * k, by)], 6)), wd, 'v', cut=not day, smooth=False)
            st('bird')
        st('birds', major=True)

    def g_reeds():
        rng = group('reeds')
        xl = min(-10, X0 + 10)
        n = 26 + int(26 * (-10 - xl) / 310)
        reeds = []
        for i in range(n):
            x = rng.uniform(xl, 300); h = rng.uniform(90, 210) * (1.15 - max(x, -60) / 420)
            lean = rng.normal(10, 12)
            base = max(1084, Y1 + 4)
            reeds.append(L.stroke(S.pts(spline([(x, base), (x + lean * 0.4, 1080 - h * 0.5), (x + lean, 1080 - h)], 8)),
                                  S(5), 'brush', end=S(1.2)))
            if rng.random() < 0.5:
                q = (x + lean * 0.3, 1080 - h * 0.35); side = rng.choice([-1, 1])
                reeds.append(L.stroke(S.pts([q, (q[0] + side * 30, q[1] - 40), (q[0] + side * 55, q[1] - 46)]), S(6), 'v'))
        third = (len(reeds) + 2) // 3
        for j in range(3):
            rmk = L.mask_of(reeds[j * third:(j + 1) * third])
            L.outline(rmk, S(2.4))
            L.leave(rmk)
            st('reeds')
        st('reeds', major=True)

    fns = dict(sky=g_sky, clouds=g_clouds, far=g_far, near=g_near, water=g_water, mist=g_mist, boat=g_boat,
               birds=g_birds, reeds=g_reeds)
    for g in GROUPS:
        if g in inc:
            fns[g]()

    group('finish')
    img = L.pull().convert('RGB')
    st.finish(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'linocut_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Vermilion'
    b = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
    save_png(paint(W, H, colourway=cw, bleed=b), out)
    print('saved', out)
