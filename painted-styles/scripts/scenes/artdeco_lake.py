"""Mountain lake -- Art Deco (airbrush through cut friskets, 1930s travel-poster look).
No lettering, no border: full-bleed scene. Colourways: Day (high sun, morning blues) and Dusk (Phase 1 look)."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import Deco, Stager, ext_ridge, design_xy

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HZ = 640          # waterline (design px)

FAR = [(-20, 430), (110, 372), (230, 410), (390, 338), (520, 395), (660, 352), (800, 405), (950, 330),
       (1080, 392), (1250, 296), (1400, 380), (1530, 345), (1660, 400), (1790, 352), (1940, 410)]
NEAR = [(-20, 470), (140, 438), (300, 458), (470, 430), (640, 470), (800, 452), (950, 520), (1080, 560),
        (1230, 545), (1380, 585), (1560, 560), (1720, 600), (1940, 590)]
PINES_L = [(80, 470, 70), (150, 430, 82), (230, 450, 76), (300, 420, 88), (370, 470, 74), (440, 505, 62),
           (500, 540, 50), (40, 520, 56), (270, 520, 60), (190, 535, 54)]
PINES_R = [(1520, 575, 34), (1580, 560, 40), (1650, 585, 30), (1740, 570, 36), (1790, 590, 26)]
BIRDS = [(1380, 260, 26), (1450, 225, 20), (1530, 285, 22), (1600, 200, 17), (1665, 250, 15)]
# thin streamlined clouds high in the sky; each is a short stack of round-ended bars (x0, x1, y, half-height)
CLOUDS = [[(70, 470, 112, 10), (170, 560, 134, 8)],
          [(560, 760, 176, 6), (610, 820, 190, 4.5)],
          [(820, 1150, 92, 9), (900, 1230, 112, 7)],
          [(1500, 1880, 96, 8), (1440, 1760, 116, 6)]]

PAL = {
    'Dusk': dict(
        sun=(1240, 560), sun_r=78,
        sky=[(0, '#1b1840'), (0.22, '#3a2a5c'), (0.42, '#8a4a6e'), (0.56, '#e0866e'), (0.70, '#f6c08c'),
             (1, '#fbd6a4')],
        ray='#ffd9a0', ray_dark='#5a2c55', ray_glow=0.6, ray_contrast=0.12,
        sun_stops=((0, '#fff4d6'), (0.55, '#ffd08a'), (1, '#f08a5a')), halo='#ffcf96', halo_s=0.6,
        cloud=[(0, '#3e2c60'), (0.55, '#a8607e'), (1, '#f0a07e')], cloud_rim='#ffc896', cloud_d=0.92,
        far=[(0, '#c28aa0'), (1, '#e7a99a')], far_sh=[(0, '#9a6f97'), (1, '#c48e9c')],
        near=[(0, '#4a3866'), (1, '#6e4a6e')], near_sh=[(0, '#2a2148'), (1, '#3d2a52')],
        pine=[(0, '#120f22'), (0.6, '#21304a'), (1, '#3c5a5e')], trunk='#1a1626',
        bank='#14111f', bank_r='#1a1528',
        water=((0, '#a8687a'), (0.3, '#4a3462'), (1, '#120e26')), reflect=0.75,
        mist='#f1c7b6', mist_k=1.0,
        boat_refl='#1a1430', hull=[(0, '#2a1a24'), (0.6, '#6a3a34'), (1, '#c97a52')], gunwale='#f2b77a',
        rower=[(0, '#1c1428'), (1, '#5b3a4a')], ink='#2a1d30',
        bird='#2a1d3e',
        reed=[(0, '#0c0a16'), (0.7, '#3a2a40'), (1, '#c07a6a')],
        vignette=0.14),
    'Day': dict(
        sun=(1240, 236), sun_r=54,
        sky=[(0, '#1f4f86'), (0.25, '#3a78a8'), (0.5, '#78acc4'), (0.72, '#bcd8d2'), (0.88, '#e9ecd2'),
             (1, '#f6efd6')],
        ray='#fff3c8', ray_dark='#2a5f8f', ray_glow=0.55, ray_contrast=0.10,
        sun_stops=((0, '#fffef8'), (0.6, '#fff6d4'), (1, '#f8d890')), halo='#fff4cc', halo_s=0.55,
        cloud=[(0, '#fbfcf6'), (0.6, '#e4eeee'), (1, '#a9c6d6')], cloud_rim='#ffffff', cloud_d=0.9,
        far=[(0, '#8fa9c8'), (1, '#c3d3d8')], far_sh=[(0, '#6f8db4'), (1, '#9fb6c8')],
        near=[(0, '#2f5f6a'), (1, '#4f8276')], near_sh=[(0, '#1b3f50'), (1, '#2b5a5e')],
        pine=[(0, '#0b2228'), (0.6, '#1c4a44'), (1, '#5c9a72')], trunk='#14262a',
        bank='#10242a', bank_r='#16302e',
        water=((0, '#a6cfd0'), (0.3, '#4f8ea0'), (1, '#0f3448')), reflect=0.7,
        mist='#f4f3e4', mist_k=0.85,
        boat_refl='#0f2c3a', hull=[(0, '#3a1a18'), (0.6, '#a2402e'), (1, '#e88a52')], gunwale='#fff0c8',
        rower=[(0, '#14232c'), (1, '#3f5c66')], ink='#17262e',
        bird='#1a2f42',
        reed=[(0, '#08201c'), (0.7, '#2c5a44'), (1, '#d8c27a')],
        vignette=0.12),
}


def _ridge_faces(a, S, ridge, base, body, shade, light_x):
    """one mountain range: the whole silhouette as one frisket sprayed with a vertical fade, then each peak's
    shadow face (the side turned away from the sun) sprayed darker through its own cut frisket."""
    ridge = ext_ridge(ridge, S)
    pts = S.pts(ridge) + [S.pt(ridge[-1][0], base), S.pt(ridge[0][0], base)]
    m = a.poly(pts)
    top = min(y for _, y in ridge)
    a.fade(m, body, S.pt(0, top), S.pt(0, base))
    faces = np.zeros_like(m)
    for i in range(1, len(ridge) - 1):
        (x0, y0), (x1, y1), (x2, y2) = ridge[i - 1], ridge[i], ridge[i + 1]
        if not (y1 < y0 and y1 < y2):
            continue
        if x1 < light_x:      # sun to the right: the left flank is in shadow
            xs = x1 - (x1 - x0) * 0.75
            face = [(x1, y1), (x0, y0), (xs, base), (x1 + (x1 - x0) * 0.1, base)]
        else:
            xs = x1 + (x2 - x1) * 0.75
            face = [(x1, y1), (x2, y2), (xs, base), (x1 - (x2 - x1) * 0.1, base)]
        fm = a.poly(S.pts(face)) * m
        a.fade(fm, shade, S.pt(0, y1), S.pt(0, base))
    return m


def _pine(a, S, x, root, h, w, body, trunk, light_x, tiers=4):
    """a Deco conifer: a stack of cut triangular tiers on a thin trunk, each tier sprayed dark->lit across"""
    tw = max(1.0, w * 0.08)
    a.spray(a.rect(S.x(x - tw / 2), S.y(root - h * 0.18), S.x(x + tw / 2), S.y(root)), trunk, grain=0.4)
    top = root - h
    for k in range(tiers):
        f = k / tiers
        ty = top + h * 0.78 * f * 0.92
        by = top + h * (0.30 + 0.62 * (k + 1) / tiers)
        hw = w / 2 * (0.42 + 0.58 * (k + 1) / tiers)
        m = a.poly(S.pts([(x, ty), (x + hw, by), (x + hw * 0.55, by - h * 0.035), (x, by + h * 0.01),
                          (x - hw * 0.55, by - h * 0.035), (x - hw, by)]))
        lit = 1 if x < light_x else -1
        a.fade(m, body, S.pt(x - hw * lit, by), S.pt(x + hw * lit, ty))


def _sun(a, cx, cy, r, stops, halo, halo_s, halo_r=3.0):
    """the sun: a disc frisket sprayed with an off-centre radial fade, inside a soft halo (no maria)"""
    a.glow(cx, cy, r * halo_r, halo, strength=halo_s, power=2.4)
    m = a.disc(cx, cy, r)
    lx, ly = cx - 0.35 * r, cy - 0.4 * r
    t = np.clip(np.hypot(a.xx - lx, a.yy - ly) / (r * 1.6), 0, 1)
    limb = smoothstep(0.75, 1.0, np.hypot(a.xx - cx, a.yy - cy) / r)
    a.spray(m, ramp(np.clip(t * 0.85 + limb * 0.25, 0, 1), stops), grain=0.6)


# ------------------------------------------------------------------ groups
def g_sky(a, S, P, st):
    sx, sy = P['sun']
    a.sky(P['sky'], top=S.y(0), bottom=S.y(HZ))
    st('sky_fade', dense=True)
    a.burst(S.x(sx), S.y(sy), rays=36, contrast=P['ray_contrast'], reach=S(1150), colour=P['ray'],
            dark=P['ray_dark'], glow=P['ray_glow'], phase=5.0, bottom=S.y(HZ))
    st('sunburst', dense=True)
    _sun(a, S.x(sx), S.y(sy - 10), S(P['sun_r']), P['sun_stops'], P['halo'], P['halo_s'])
    st('sky')


def g_clouds(a, S, P, st):
    """streamlined Deco clouds: thin round-ended bars, sprayed cool on top and lit along the underside,
    with a hairline of light cut along the belly"""
    for i, bars in enumerate(CLOUDS):
        for x0, x1, y, r in bars:
            m = a.capsule(S.x(x0), S.x(x1), S.y(y), S(r)) * P['cloud_d']
            a.fade(m, P['cloud'], S.pt(0, y - r), S.pt(0, y + r))
            # the sunlit hairline: on the belly at dusk (sun below), on the crown by day (sun above)
            ly = y + r * 0.55 if P['sun'][1] > y else y - r * 0.55
            line = a.capsule(S.x(x0 + r * 1.5), S.x(x1 - r * 1.2), S.y(ly), S(max(0.7, r * 0.16)))
            a.spray(line * m, P['cloud_rim'], density=0.55, grain=0.3)
        st(f'cloud{i + 1}', dense=True)


def g_far(a, S, P, st):
    _ridge_faces(a, S, FAR, HZ, P['far'], P['far_sh'], P['sun'][0])
    st('far_mountains')


def g_near(a, S, P, st, dense=True):
    _ridge_faces(a, S, NEAR, HZ, P['near'], P['near_sh'], P['sun'][0])
    st('near_mountains', dense=dense)
    # the shore banks the pines stand on
    a.spray(a.poly(S.pts([(S.X0 - 10, 631), (540, 631), (600, 641), (S.X0 - 10, 641)])), P['bank'], grain=0.3)
    a.spray(a.poly(S.pts([(1490, 634), (1830, 634), (1860, 641), (1480, 641)])), P['bank_r'], grain=0.3)
    st('shore', dense=dense)
    for x, top, w in PINES_L:
        _pine(a, S, x, HZ, HZ - top, w, P['pine'], P['trunk'], P['sun'][0])
        st('pine', dense=dense)
    for x, top, w in PINES_R:
        _pine(a, S, x, HZ, HZ - top, w, P['pine'], P['trunk'], P['sun'][0], tiers=3)
        st('pine', dense=dense)


UPPER = (('sky', g_sky), ('clouds', g_clouds), ('far', g_far), ('near', g_near))


def g_water(a, S, P, st, seed, inc):
    """the lake mirrors sky, clouds and both ranges with their pines. If any of those groups is skipped,
    they are painted (silently) on a scratch board just to be mirrored, so this group never depends on them."""
    hz = int(round(S.y(HZ)))
    if all(n in inc for n, _ in UPPER):
        src = a.img
    else:
        ref = Deco(a.W, a.H, seed=a.seed)
        ref.speck = a.speck
        for n, fn in UPPER:
            ref.rng = group_rng(seed, n)
            fn(ref, S, P, lambda *_, **__: None)
        src = ref.img
    keep = a.img[:hz].copy()
    a.img[:hz] = src[:hz]
    a.water(hz, stops=P['water'], reflect=P['reflect'])
    a.img[:hz] = keep
    st('water')


def g_mist(a, S, P, st):
    xx, yy = design_xy(a, S)
    band = np.exp(-((yy - 648) / 34.0) ** 2) * (0.62 - 0.4 * smoothstep(200, 1700, xx))
    a.spray((band * P['mist_k']).astype(np.float32), P['mist'], grain=0.8, blend='paint')
    st('mist_band', dense=True)
    band = np.exp(-((yy - 690) / 16.0) ** 2) * 0.28 * (1 - smoothstep(300, 1300, xx))
    a.spray((band * P['mist_k']).astype(np.float32), P['mist'], grain=0.8, blend='paint')
    st('mist')


def g_boat(a, S, P, st):
    bw = 800
    hull = [(1080, 784), (1260, 784), (1240, 803), (1104, 803)]
    refl = [(x, 2 * bw - y) for x, y in hull]
    a.spray(a.poly(S.pts(refl)) * 0.55, P['boat_refl'], grain=0.6)
    rm = a.poly(S.pts([(1150, 816), (1176, 816), (1172, 848), (1154, 848)]))
    a.spray(rm * 0.35, P['boat_refl'], grain=0.6)
    st('boat_reflection', dense=True)
    hm = a.poly(S.pts(hull))
    a.fade(hm, P['hull'], S.pt(1100, 803), S.pt(1240, 784))
    a.spray(a.rect(S.x(1080), S.y(782), S.x(1260), S.y(785.5)), P['gunwale'], grain=0.4)
    st('hull', dense=True)
    fig = a.poly(S.pts([(1150, 784), (1176, 784), (1172, 752), (1154, 752)]))
    a.fade(fig, P['rower'], S.pt(1150, 770), S.pt(1176, 760))
    a.spray(a.disc(S.x(1163), S.y(744), S(9)), P['ink'], grain=0.4)
    st('rower', dense=True)
    a.spray(a.bar(S.pt(1120, 812), S.pt(1200, 764), S(3)), P['ink'], grain=0.3)
    st('boat')


def g_birds(a, S, P, st):
    for bx, by, sz in BIRDS:
        a.spray(a.poly(S.pts([(bx - sz, by - sz * 0.25), (bx - sz * 0.45, by - sz * 0.42), (bx, by),
                              (bx + sz * 0.45, by - sz * 0.42), (bx + sz, by - sz * 0.25),
                              (bx + sz * 0.45, by - sz * 0.22), (bx, by + sz * 0.16),
                              (bx - sz * 0.45, by - sz * 0.22)])), P['bird'], grain=0.3)
        st('bird', dense=True)
    st('birds')


def g_reeds(a, S, P, st, rng):
    x_lo = min(0.0, S.X0)
    n = int(round(22 * (300 - x_lo) / 300))
    bot = S.Y1 + 5
    for k in range(n):
        x = rng.uniform(x_lo, 300)
        top = rng.uniform(930, 990) - (300 - x) * 0.25 + (bot - 1085) * 0.5
        lean = rng.uniform(-18, 26)
        w = rng.uniform(5.0, 9.0)
        m = a.poly(S.pts([(x - w, bot), (x + w, bot), (x + lean, top)]))
        a.fade(m, P['reed'], S.pt(x, bot), S.pt(x + lean, top))
        if k % 3 == 2:
            st('reeds', dense=True)
    st('reeds')


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)

    for name in GROUPS:
        if name not in inc:
            continue
        rng = group_rng(seed, name)
        a.rng = group_rng(seed, name)
        if name == 'sky':
            g_sky(a, S, P, st)
        elif name == 'clouds':
            g_clouds(a, S, P, st)
        elif name == 'far':
            g_far(a, S, P, st)
        elif name == 'near':
            g_near(a, S, P, st)
        elif name == 'water':
            g_water(a, S, P, st, seed, inc)
        elif name == 'mist':
            g_mist(a, S, P, st)
        elif name == 'boat':
            g_boat(a, S, P, st)
        elif name == 'birds':
            g_birds(a, S, P, st)
        elif name == 'reeds':
            g_reeds(a, S, P, st, rng)

    a.rng = group_rng(seed, 'finish')
    a.finish(vignette=P['vignette'])
    img = a.composite()
    st.final(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'artdeco_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    save_png(paint(W, H, colourway=cw), out)
