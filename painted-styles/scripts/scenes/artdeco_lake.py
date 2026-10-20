"""Mountain lake -- Art Deco (airbrush through hand-cut friskets, 1930s travel-poster look).
No lettering, no border: full-bleed scene. Colourways: Day (high sun, morning blues) and Dusk.
Period poster palette: a handful of flat inks, the sky laid as stepped bands, gradients only inside cut shapes.
Everything is cut by hand: unequal sunburst rays with one oversprayed edge, stepped streamlined clouds,
facets under one light, pines that differ tree to tree, water and reflections as stencilled strips."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import (Deco, Stager, ext_ridge, design_xy, hand, vary, col, stencil_cloud, facet_range, pine,
                          stencil_water, haze, dashes, strip_mask, banded_sky, band_fields, bird)

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
# birds: x, y, span, pose (wing lift: + raised, - lowered), tilt
BIRDS = [(1376, 262, 27, 0.42, 0.05), (1449, 224, 19, -0.12, -0.08), (1531, 287, 23, 0.2, 0.12),
         (1602, 198, 15, 0.55, -0.15), (1661, 246, 14, -0.25, 0.1), (1700, 222, 10, 0.3, 0.0)]
# hand-cut stepped clouds: x0, x1, y (underside), lump height
CLOUDS = [(60, 560, 140, 27), (590, 820, 196, 16), (850, 1230, 112, 23), (1440, 1890, 122, 24)]

PAL = {
    'Dusk': dict(
        sun=(1240, 560), sun_r=78,
        # stepped sky: (bottom edge, ink at the top of the band, ink at its foot)
        bands=[(126, '#1d2846', '#24304f'), (236, '#34406a', '#3c4a72'), (338, '#b85d3c', '#c86a42'),
               (452, '#de8a4c', '#e69a56'), (HZ + 2, '#f0b663', '#f7d58e')],
        ray='#ffe2b0', ray_dark='#24304f', ray_glow=0.45, ray_contrast=0.16,
        sun_stops=((0, '#fff4d6'), (0.55, '#ffd696'), (1, '#f0a060')), halo='#ffd9a0', halo_s=0.5,
        cloud=[(0, '#3a4676'), (0.5, '#b8685a'), (1, '#f6b46a')], cloud_edge='#f6b86a', cloud_lit_below=True,
        far=[(0, '#8a7f98'), (1, '#9c8c9c')], far_sh=[(0, '#545a7e'), (1, '#626684')], far_mid=[(0, '#76708e'), (1, '#867c92')],
        near=[(0, '#3e4c6e'), (1, '#4a5674')], near_sh=[(0, '#1f2844'), (1, '#28304c')], near_mid=[(0, '#323e5e'), (1, '#3c4664')],
        pine=[(0, '#0f1626'), (0.6, '#1a2638'), (1, '#3a4c5a')], trunk='#111624',
        bank='#10152a', bank_r='#151a30',
        water=((0, '#4a4f6c'), (0.22, '#2c3454'), (1, '#121830')), reflect=0.85,
        ripple_light='#f6d08e', glint='#ffd890', ripple_dark='#0c1024',
        mist='#f6cf8e', mist_k=0.8,
        boat_refl='#0e1226', hull=[(0, '#3a1c18'), (0.55, '#a8482e'), (1, '#e48a48')], gunwale='#f4c27e',
        rower='#161c30', rower_lit='#e8954e', oar='#161c30',
        bird='#1c2240',
        reed=[(0, '#0b0f1e'), (0.65, '#232a40'), (1, '#c07a46')],
        vignette=0.14),
    'Day': dict(
        sun=(1240, 236), sun_r=54,
        bands=[(150, '#1f4a72', '#265680'), (282, '#3a73a0', '#4580a8'), (400, '#78a9c0', '#86b4c6'),
               (520, '#bfd6cf', '#cadfd4'), (HZ + 2, '#ece6cc', '#f3edd6')],
        ray='#fff6d6', ray_dark='#1f4a72', ray_glow=0.45, ray_contrast=0.14,
        sun_stops=((0, '#fffef8'), (0.6, '#fff6d4'), (1, '#f6d890')), halo='#fff4cc', halo_s=0.5,
        cloud=[(0, '#9db8c8'), (0.45, '#dfe8e6'), (1, '#fbfaf2')], cloud_edge='#ffffff', cloud_lit_below=False,
        far=[(0, '#a8bccb'), (1, '#c3cfd2')], far_sh=[(0, '#7891ab'), (1, '#8ea3b6')], far_mid=[(0, '#90a8be'), (1, '#a8b9c6')],
        near=[(0, '#4f8170'), (1, '#5f8e77')], near_sh=[(0, '#285250'), (1, '#305e58')], near_mid=[(0, '#3c6c62'), (1, '#487a68')],
        pine=[(0, '#0b2421'), (0.6, '#1b473e'), (1, '#578c66')], trunk='#12261f',
        bank='#10242a', bank_r='#15302e',
        water=((0, '#a3c8c8'), (0.25, '#4f8a9a'), (1, '#173f54')), reflect=0.72,
        ripple_light='#eef0dc', glint='#fffbe8', ripple_dark='#0f3044',
        mist='#f5f2e2', mist_k=0.75,
        boat_refl='#123448', hull=[(0, '#3a1a16'), (0.55, '#b0452e'), (1, '#e88a52')], gunwale='#fff0c8',
        rower='#17262e', rower_lit='#f0dcb0', oar='#17262e',
        bird='#1a2f42',
        reed=[(0, '#08201c'), (0.65, '#2a5642'), (1, '#d2bc78')],
        vignette=0.12),
}


def _light(P):
    """one light for the whole picture: from the side the sun is on"""
    return 1 if P['sun'][0] > 960 else -1


def _sun(a, cx, cy, r, stops, halo, halo_s, halo_r=3.0):
    """the sun: a disc frisket sprayed with an off-centre radial fade, inside a soft halo"""
    a.glow(cx, cy, r * halo_r, halo, strength=halo_s, power=2.4)
    m = a.disc(cx, cy, r)
    lx, ly = cx - 0.35 * r, cy - 0.4 * r
    t = np.clip(np.hypot(a.xx - lx, a.yy - ly) / (r * 1.6), 0, 1)
    limb = smoothstep(0.75, 1.0, np.hypot(a.xx - cx, a.yy - cy) / r)
    a.spray(m, ramp(np.clip(t * 0.85 + limb * 0.25, 0, 1), stops), grain=0.6)


# ------------------------------------------------------------------ groups
def g_sky(a, S, P, st, rng):
    """the sky in stepped bands, each its own frisket (a hand-cut horizontal edge) with a short fade inside,
    then the sunburst (two tones of each band's own ink) and the sun"""
    sx, sy = P['sun']
    banded_sky(a, S, rng, P['bands'], stage=lambda: st('sky_band', dense=True))
    lit_f, dark_f = band_fields(a, S, P['bands'], P['ray'])
    a.burst(S.x(sx), S.y(sy), rays=36, contrast=P['ray_contrast'], reach=S(1150), colour=lit_f,
            dark=dark_f, glow=P['ray_glow'], phase=5.0, bottom=S.y(HZ), rng=rng)
    st('sunburst', dense=True)
    _sun(a, S.x(sx), S.y(sy - 10), S(P['sun_r']), P['sun_stops'], P['halo'], P['halo_s'])
    st('sky')


def g_clouds(a, S, P, st, rng):
    for i, (x0, x1, y, h) in enumerate(CLOUDS):
        stencil_cloud(a, S, rng, x0, x1, y, h, P['cloud'], P['cloud_lit_below'], edge_col=P['cloud_edge'])
        st(f'cloud{i + 1}', dense=True)


def g_far(a, S, P, st, rng):
    facet_range(a, S, rng, FAR, HZ, P['far'], P['far_sh'], light=_light(P), mid=P['far_mid'],
                ext=lambda r: ext_ridge(r, S))
    st('far_mountains')


def g_near(a, S, P, st, rng, dense=True):
    facet_range(a, S, rng, NEAR, HZ, P['near'], P['near_sh'], light=_light(P), mid=P['near_mid'],
                ext=lambda r: ext_ridge(r, S))
    st('near_mountains', dense=dense)
    # the shore banks the pines stand on
    a.spray(a.poly(S.pts(hand([(S.X0 - 10, 631), (300, 629), (540, 632), (604, 641), (S.X0 - 10, 641)], rng,
                              amp=0.8))), P['bank'], grain=0.6)
    a.spray(a.poly(S.pts(hand([(1488, 635), (1660, 632), (1830, 634), (1862, 641), (1478, 641)], rng, amp=0.8))),
            P['bank_r'], grain=0.6)
    st('shore', dense=dense)
    L = _light(P)
    for x, top, w in PINES_L:
        pine(a, S, rng, x + rng.uniform(-6, 6), HZ + rng.uniform(-1, 2), HZ - top + rng.uniform(-8, 8),
             w * rng.uniform(0.85, 1.12), P['pine'], P['trunk'], light=L)
        st('pine', dense=dense)
    for x, top, w in PINES_R:
        pine(a, S, rng, x + rng.uniform(-4, 4), HZ, HZ - top + rng.uniform(-4, 5), w * rng.uniform(0.85, 1.15),
             P['pine'], P['trunk'], light=L, tiers=int(rng.integers(3, 5)))
        st('pine', dense=dense)
    st('near')


UPPER = (('sky', g_sky), ('clouds', g_clouds), ('far', g_far), ('near', g_near))


def g_water(a, S, P, st, rng, seed, inc):
    """the lake: a few flat tones, then the reflection of sky, clouds, ranges and pines laid as stencilled
    horizontal strips (colour sampled from what they mirror, never a copy of it). If any upper group is
    skipped it is painted silently on a scratch board just to be sampled, so this group never depends on them."""
    hz = int(round(S.y(HZ)))
    if all(n in inc for n, _ in UPPER):
        src = a.img
    else:
        ref = Deco(a.W, a.H, seed=a.seed, s=a.s)
        ref.speck = a.speck
        for n, fn in UPPER:
            ref.rng = group_rng(seed, n)
            fn(ref, S, P, lambda *_, **__: None, group_rng(seed, n))
        src = ref.img
    src = src[:hz].copy()
    sx = P['sun'][0]
    stencil_water(a, S, rng, HZ, src, P['water'], reflect=P['reflect'], compress=0.78,
                  light=P['ripple_light'], glint=P['glint'], dark=P['ripple_dark'], x_sun=(sx, 70),
                  stage=lambda: st('water', dense=True))
    st('water')


def g_mist(a, S, P, st, rng):
    haze(a, S, rng, S.X0, S.X1, 628, 22, P['mist'], 0.62 * P['mist_k'],
         xfade=lambda x: 1 - 0.65 * smoothstep(200, 1750, x), jag=5)
    st('mist_band', dense=True)
    haze(a, S, rng, S.X0, 1300, 683, 12, P['mist'], 0.3 * P['mist_k'],
         xfade=lambda x: 1 - smoothstep(350, 1300, x), jag=3)
    st('mist')


def _rower_parts(rng):
    """the boat and rower as cut friskets (design px): hull with a sheer, a hunched body leaning into the
    stroke, a capped head, the arms and the oar"""
    hull = [(1076, 781), (1100, 784), (1170, 785.5), (1238, 783), (1264, 777), (1246, 793), (1226, 802),
            (1120, 803), (1098, 797)]
    body = [(1148, 785), (1150, 772), (1153, 761), (1160, 753), (1170, 750.5), (1177, 755), (1180, 765),
            (1178, 776), (1180, 785)]
    head = [(1163, 749), (1161, 743), (1163, 737.5), (1169, 735), (1175, 737), (1177, 742), (1175, 748),
            (1170, 750)]
    cap = [(1160, 739.5), (1162, 734.5), (1168, 731.8), (1175, 733.5), (1179, 737.5), (1174, 739), (1166, 740)]
    arm = [(1172, 758), (1162, 768), (1147, 774), (1145, 777), (1150, 777), (1166, 771), (1178, 763)]
    oar = [(1146, 774.5), (1110, 804)]
    blade = [(1112, 800), (1102, 811), (1096, 812), (1104, 802)]
    return [hand(p, rng, amp=0.3, step=6) for p in (hull, body, head, cap, arm)], oar, blade


def g_boat(a, S, P, st, rng):
    (hull, body, head, cap, arm), oar, blade = _rower_parts(rng)
    wl = 801
    # the boat's own reflection: the cut shapes mirrored, shortened and broken into stencil strips
    segs = dashes(rng, 1060, 1290, 802, 850, 1.6, 3.4, 26, 70, 0.9, 0.55, spacing=1.6)
    brk = strip_mask(a, S, segs, rng)
    refl = np.zeros_like(brk)
    for poly, k in ((hull, 0.8), (body, 0.6), (head, 0.5), (arm, 0.5)):
        rp = [(x, wl + (wl - y) * 0.7 + 1) for x, y in poly]
        refl = np.maximum(refl, a.poly(S.pts(rp)) * k)
    a.spray(refl * brk, P['boat_refl'], grain=1.0)
    st('boat_reflection', dense=True)
    hm = a.poly(S.pts(hull))
    a.fade(hm, P['hull'], S.pt(1110, 803), S.pt(1250, 780))
    a.spray(a.poly(S.pts(hand([(1078, 780.5), (1170, 784.2), (1240, 782), (1262, 776.5), (1262, 778.5),
                               (1240, 784.5), (1170, 786.6), (1078, 783)], rng, amp=0.2, step=8))),
            P['gunwale'], grain=0.6)
    st('hull', dense=True)
    L = _light(P)
    fig = np.maximum(a.poly(S.pts(body)), a.poly(S.pts(head)))
    a.spray(fig, P['rower'], grain=0.6)
    # the rim of light on the sun side of the figure, sprayed across from the lit edge
    xs = [p[0] for p in body]
    lx = max(xs) if L > 0 else min(xs)
    a.fade(fig * 0.85, [(0, P['rower_lit']), (0.35, P['rower']), (1, P['rower'])], S.pt(lx, 760),
           S.pt(lx - L * 16, 760), grain=0.8)
    a.spray(a.poly(S.pts(cap)), P['rower'], grain=0.6)
    a.spray(a.poly(S.pts(arm)), P['rower'], grain=0.6)
    st('rower', dense=True)
    a.spray(a.bar(S.pt(*oar[0]), S.pt(*oar[1]), S(2.6)), P['oar'], grain=0.5)
    a.spray(a.poly(S.pts(blade)), P['oar'], grain=0.5)
    st('boat')


def g_birds(a, S, P, st, rng):
    for bx, by, sz, lift, tilt in BIRDS:
        bird(a, S, rng, bx, by, sz, lift, tilt, vary([(0, P['bird'])], rng.uniform(0.9, 1.15))[0][1])
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
        w = rng.uniform(4.0, 9.0)
        bend = rng.uniform(-0.5, 0.9) * lean
        ts = np.linspace(0, 1, 9)
        cxs = x + lean * ts ** 2 + bend * ts * (1 - ts)
        cys = bot + (top - bot) * ts
        hw = w * (1 - ts) ** 0.8
        pts = [(cx - h_, cy) for cx, cy, h_ in zip(cxs, cys, hw)] + \
              [(cx + h_, cy) for cx, cy, h_ in zip(cxs[::-1], cys[::-1], hw[::-1])]
        a.fade(a.poly(S.pts(pts)), vary(P['reed'], rng.uniform(0.85, 1.15)), S.pt(x, bot), S.pt(x + lean, top))
        if k % 3 == 2:
            st('reeds', dense=True)
    st('reeds')


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed, s=S.s)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)
    fns = dict(UPPER)
    for name in GROUPS:
        if name not in inc:
            continue
        rng = group_rng(seed, name)
        a.rng = group_rng(seed, name)
        if name in fns:
            fns[name](a, S, P, st, rng)
        elif name == 'water':
            g_water(a, S, P, st, rng, seed, inc)
        elif name == 'mist':
            g_mist(a, S, P, st, rng)
        elif name == 'boat':
            g_boat(a, S, P, st, rng)
        elif name == 'birds':
            g_birds(a, S, P, st, rng)
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
