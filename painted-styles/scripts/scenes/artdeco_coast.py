"""Coastal village on a cliff -- Art Deco (airbrush through cut friskets, 1930s travel-poster look).
A faceted headland on the right with cubic white houses and a banded lighthouse on its tip, sailing boats on
a sea that mirrors a sunburst sky, gulls. No lettering, no border. Colourways: Day and Dusk."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import (Deco, Stager, ext_ridge, hand, vary, col, mix, stencil_cloud, stencil_water, dashes,
                          strip_mask, strip, banded_sky, band_fields, bird)

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

HZ = 610
# cliff top edge, left (headland tip) -> right; foot line right -> left
TOP = [(1034, 552), (1052, 512), (1084, 494), (1150, 488), (1260, 474), (1400, 462), (1560, 452), (1720, 444),
       (1940, 438)]
FOOT = [(1780, 878), (1620, 846), (1460, 806), (1310, 774), (1190, 742), (1096, 712), (1040, 690)]
# facet cuts (x on top edge, x on foot line): the rock is split into chiselled vertical planes
CUTS = [(1084, 1100), (1180, 1230), (1300, 1350), (1430, 1480), (1580, 1640), (1760, 1800)]
LH_X, LH_BASE = 1112, 494          # lighthouse
# hand-cut stepped clouds: x0, x1, y (underside), lump height
CLOUDS = [(70, 600, 142, 26), (760, 1150, 100, 18), (1300, 1860, 170, 24)]
# houses: (x, w, h, depth, row) -- row 0 back (higher on the slope), 1 front
HOUSES = [(1300, 64, 44, 16, 0), (1392, 80, 58, 18, 0), (1500, 58, 40, 15, 0), (1600, 96, 52, 18, 0),
          (1730, 70, 64, 16, 0), (1830, 90, 46, 18, 0),
          (1188, 62, 40, 15, 1), (1262, 88, 56, 18, 1), (1370, 54, 36, 14, 1), (1446, 100, 48, 18, 1),
          (1572, 66, 62, 16, 1), (1662, 84, 40, 17, 1), (1790, 76, 54, 17, 1)]
CYPRESS = [(1236, 0, 70), (1480, 0, 84), (1700, 1, 76), (1356, 1, 62)]
# sailing boats: (x, waterline, height, facing, sail colour key)
BOATS = [(190, 628, 30, 1, 'sail'), (905, 648, 52, -1, 'sail'), (340, 694, 98, 1, 'sail2'),
         (720, 838, 236, -1, 'sail')]
# gulls: x, y, span, wing lift (+ raised / - lowered), tilt
GULLS = [(818, 302, 30, 0.38, 0.06), (908, 250, 23, -0.1, -0.1), (1002, 338, 20, 0.5, 0.14),
         (1362, 284, 22, 0.15, -0.05), (1436, 340, 15, -0.3, 0.12), (302, 398, 17, 0.45, -0.12)]

PAL = {
    'Dusk': dict(
        sun=(560, 600), sun_r=74,
        bands=[(118, '#1d2846', '#24304f'), (232, '#34406a', '#3c4a72'), (345, '#b85d3c', '#c86a42'),
               (470, '#de8a4c', '#e69a56'), (HZ + 2, '#f0b663', '#f7d58e')],
        ray='#ffe2b0', ray_c=0.16, ray_glow=0.45,
        sun_stops=((0, '#fff4d6'), (0.55, '#ffd68a'), (1, '#f29a52')), halo='#ffd59a', halo_s=0.6,
        cloud=[(0, '#3a4676'), (0.5, '#b8685a'), (1, '#f6b46a')], cloud_edge='#f6b86a', cloud_lit_below=True,
        head=[(0, '#6c6a8c'), (1, '#7c7896')],
        sea=((0, '#4a4f6c'), (0.22, '#2c3454'), (1, '#121830')), reflect=0.85,
        ripple_light='#f6d08e', glint='#ffd890', ripple_dark='#0c1024',
        rock_lit='#d98a56', rock_shade='#3a3c62', rock_foot='#161a30', grass=[(0, '#4a4a66'), (1, '#262a44')],
        wall=[(0, '#f8dcae'), (1, '#eebf8a')], side=[(0, '#5e5a80'), (1, '#4a4870')], roof='#ffe6bc',
        win='#ffd27a', win_glow=0.5, cypress=[(0, '#1c2440'), (1, '#10142a')],
        lh=[(0, '#f8dcae'), (0.45, '#eebf8a'), (1, '#5e5a80')], band=[(0, '#d8603e'), (0.45, '#a8402e'), (1, '#4a2238')],
        lh_dark='#161a30', lamp='#fff2b8', beam=True,
        hull=[(0, '#141a30'), (0.6, '#2c3454'), (1, '#5a5a7a')],
        sail=[(0, '#ffe6bc'), (0.5, '#f2bd84'), (1, '#6a6488')], sail2=[(0, '#f6a066'), (0.5, '#d0603e'), (1, '#5a3048')],
        refl='#10142a', gull='#1c2240', gull_under=None, foam='#f6d4a0', vignette=0.14),
    'Day': dict(
        sun=(470, 206), sun_r=56,
        bands=[(140, '#1f4a72', '#265680'), (262, '#3a73a0', '#4580a8'), (380, '#78a9c0', '#86b4c6'),
               (500, '#bfd6cf', '#cadfd4'), (HZ + 2, '#ece6cc', '#f3edd6')],
        ray='#fff6d6', ray_c=0.14, ray_glow=0.45,
        sun_stops=((0, '#fffef8'), (0.6, '#fff6d4'), (1, '#f6d890')), halo='#fff4cc', halo_s=0.5,
        cloud=[(0, '#9db8c8'), (0.45, '#dfe8e6'), (1, '#fbfaf2')], cloud_edge='#ffffff', cloud_lit_below=False,
        head=[(0, '#8aa4bc'), (1, '#a4b8c6')],
        sea=((0, '#9cc6cc'), (0.22, '#3f88a2'), (1, '#0f3a56')), reflect=0.72,
        ripple_light='#eef0dc', glint='#fffbe8', ripple_dark='#0c3048',
        rock_lit='#ecc48a', rock_shade='#8a5a40', rock_foot='#3a2620', grass=[(0, '#a2c47a'), (1, '#5a8a52')],
        wall=[(0, '#fffcf2'), (1, '#f2ead8')], side=[(0, '#b8c8d6'), (1, '#98aec0')], roof='#ffffff',
        win='#2a5470', win_glow=0.0, cypress=[(0, '#3c7a52'), (1, '#123a2e')],
        lh=[(0, '#ffffff'), (0.5, '#eef0ea'), (1, '#8a9eb0')], band=[(0, '#e2523c'), (0.5, '#b8382c'), (1, '#6a1e1c')],
        lh_dark='#1e2e3e', lamp='#d8eef4', beam=False,
        hull=[(0, '#10203a'), (0.6, '#24486e'), (1, '#5a86a8')],
        sail=[(0, '#ffffff'), (0.5, '#f2f0e6'), (1, '#a8bccc')], sail2=[(0, '#f8a870'), (0.5, '#e2683e'), (1, '#8a3a2c')],
        refl='#0e3048', gull='#fdfdf8', gull_under='#9fb2c0', foam='#ffffff', vignette=0.12),
}


def _lerp_y(line, x):
    xs = [p[0] for p in line]
    ys = [p[1] for p in line]
    if xs[0] > xs[-1]:
        xs, ys = xs[::-1], ys[::-1]
    return float(np.interp(x, xs, ys))


def _sun(a, cx, cy, r, stops, halo, halo_s):
    a.glow(cx, cy, r * 3.0, halo, strength=halo_s, power=2.4)
    m = a.disc(cx, cy, r)
    lx, ly = cx - 0.35 * r, cy - 0.4 * r
    t = np.clip(np.hypot(a.xx - lx, a.yy - ly) / (r * 1.6), 0, 1)
    limb = smoothstep(0.75, 1.0, np.hypot(a.xx - cx, a.yy - cy) / r)
    a.spray(m, ramp(np.clip(t * 0.85 + limb * 0.25, 0, 1), stops), grain=0.6)


def _sailboat(a, S, P, x, wl, h, face, sail_key, rip, rng):
    """a sloop: hull frisket, mast, a curved mainsail and a jib, each sprayed light->shade across;
    a broken reflection of the sails and hull in the ripple dashes below"""
    L = h * 0.78
    hh = h * 0.12
    f = face
    hull = [(x - L / 2 * f, wl - hh), (x + L / 2 * f, wl - hh), (x + L * 0.36 * f, wl), (x - L * 0.4 * f, wl)]
    mx = x - L * 0.06 * f
    top = wl - hh - h
    foot = wl - hh - h * 0.07
    boom = mx - L * 0.44 * f
    # mainsail: luff along the mast, leech bellied out as a gentle curve
    leech = [(mx + (boom - mx) * t + f * (-1) * h * 0.06 * np.sin(np.pi * t), top + (foot - top) * t)
             for t in np.linspace(0, 1, 9)]
    main = [(mx, top)] + leech[1:] + [(mx, foot)]
    jib = [(mx + 2 * f, top + h * 0.12)] + \
          [(mx + 2 * f + (L * 0.5 + 2) * f * t + f * h * 0.035 * np.sin(np.pi * t), top + h * 0.12 + (foot - top - h * 0.12) * t)
           for t in np.linspace(0.12, 1, 8)] + [(mx + 2 * f, foot)]
    sails = (hand(main, rng, amp=0.35, step=10), hand(jib, rng, amp=0.35, step=10))
    hull = hand(hull, rng, amp=0.3, step=10)
    # reflection first (under everything of this boat)
    for poly, k in ((hull, 0.6), (main, 0.38), (jib, 0.38)):
        rp = [(px, wl + (wl - py) * 0.72 + 2) for px, py in poly]
        a.spray(a.poly(S.pts(rp)) * rip * k, P['refl'], grain=1.0)
    lit = -1 if P['sun'][0] < x else 1          # side of the boat facing the sun
    for poly in sails:
        m = a.poly(S.pts(poly))
        xs = [p[0] for p in poly]
        xl, xr = (min(xs), max(xs)) if lit < 0 else (max(xs), min(xs))
        a.fade(m, vary(P[sail_key], rng.uniform(0.95, 1.04)), S.pt(xl, top), S.pt(xr, foot), grain=0.8)
    a.spray(a.bar(S.pt(mx, top - h * 0.03), S.pt(mx, wl - hh), S(max(1.2, h * 0.012))), P['lh_dark'], grain=0)
    m = a.poly(S.pts(hull))
    a.fade(m, P['hull'], S.pt(x, wl), S.pt(x, wl - hh))
    a.spray(a.rect(S.x(min(hull[0][0], hull[1][0])), S.y(wl - hh), S.x(max(hull[0][0], hull[1][0])),
                   S.y(wl - hh + max(1.2, h * 0.012))), P['sail'][0][1], density=0.8, grain=0.3)


def _house(a, S, P, x, base, w, h, d, rng):
    """a cubic whitewashed house: lit front, shaded side to the right, bright roof plane, a few windows"""
    dy = d * 0.45
    front = a.rect(S.x(x), S.y(base - h), S.x(x + w), S.y(base))
    a.fade(front, vary(P['wall'], rng.uniform(0.95, 1.02), rng.uniform(-0.015, 0.02)), S.pt(x, base - h),
           S.pt(x + w, base))
    side = a.poly(S.pts([(x + w, base - h), (x + w + d, base - h - dy), (x + w + d, base - dy), (x + w, base)]))
    a.fade(side, P['side'], S.pt(x + w, base - h), S.pt(x + w + d, base))
    roof = a.poly(S.pts([(x, base - h), (x + d, base - h - dy), (x + w + d, base - h - dy), (x + w, base - h)]))
    a.spray(roof, P['roof'], grain=0.3)
    # a parapet line under the roof edge
    a.spray(a.rect(S.x(x), S.y(base - h), S.x(x + w), S.y(base - h + 2.2)), P['side'][1][1], density=0.5, grain=0.2)
    nw = max(1, int(w // 26))
    rows = 2 if h > 46 else 1
    for r in range(rows):
        for k in range(nw):
            if rng.random() < 0.25:
                continue
            wx = x + (k + 0.5) * w / nw - 4
            wy = base - h + 10 + r * 20
            if rows == 1 and rng.random() < 0.5:        # a tall arched door instead
                wy = base - 18
                m = a.rect(S.x(wx), S.y(wy), S.x(wx + 9), S.y(base - 1)) + a.disc(S.x(wx + 4.5), S.y(wy), S(4.5))
            else:
                m = a.rect(S.x(wx), S.y(wy), S.x(wx + 8), S.y(wy + 11))
            m = np.clip(m, 0, 1) * front
            a.spray(m, P['win'], grain=0.3)
            if P['win_glow']:
                a.glow(S.x(wx + 4), S.y(wy + 6), S(16), P['win'], strength=P['win_glow'] * 0.5, power=2)


def _cypress(a, S, P, x, base, h, rng):
    """a cypress flame: each one its own width, belly height and lean, lit on the sun side"""
    w = h * rng.uniform(0.14, 0.2)
    pk = rng.uniform(0.6, 1.0)
    lean = rng.uniform(-0.06, 0.06) * h
    pts = [(x + lean * t + w * np.sin(np.pi * t ** pk) ** 0.8 * (1 if s > 0 else -1) * rng.uniform(0.92, 1.05),
            base - h * t)
           for s in (1, -1) for t in (np.linspace(0, 1, 14) if s > 0 else np.linspace(1, 0, 14))]
    m = a.poly(S.pts(pts))
    a.fade(m, vary(P['cypress'], rng.uniform(0.85, 1.15)), S.pt(x - w, base), S.pt(x + w, base))


def _lighthouse(a, S, P):
    x, b = LH_X, LH_BASE
    hb, ht, top = 27, 17, b - 196
    # keeper's cottage behind and to the right
    _house(a, S, P, x + 18, b + 2, 52, 30, 14, np.random.default_rng(5))
    body = a.poly(S.pts([(x - hb, b + 4), (x + hb, b + 4), (x + ht, top), (x - ht, top)]))
    a.fade(body, P['lh'], S.pt(x - hb, b), S.pt(x + hb, b))
    for k in range(3):                                  # three painted bands
        y0 = b - 30 - k * 52
        y1 = y0 - 24
        hw0 = hb + (ht - hb) * (b - y0) / (b - top)
        hw1 = hb + (ht - hb) * (b - y1) / (b - top)
        m = a.poly(S.pts([(x - hw0, y0), (x + hw0, y0), (x + hw1, y1), (x - hw1, y1)])) * body
        a.fade(m, P['band'], S.pt(x - hb, b), S.pt(x + hb, b))
    # gallery, lantern, dome, finial
    a.fade(a.rect(S.x(x - 26), S.y(top - 7), S.x(x + 26), S.y(top + 1)), P['band'], S.pt(x - 26, 0), S.pt(x + 26, 0))
    for px in np.linspace(x - 22, x + 22, 7):
        a.spray(a.rect(S.x(px - 0.8), S.y(top - 17), S.x(px + 0.8), S.y(top - 7)), P['lh_dark'], grain=0)
    a.spray(a.rect(S.x(x - 24), S.y(top - 18), S.x(x + 24), S.y(top - 16)), P['lh_dark'], grain=0)
    lamp = a.rect(S.x(x - 13), S.y(top - 40), S.x(x + 13), S.y(top - 7))
    if P['beam']:
        a.glow(S.x(x), S.y(top - 24), S(120), P['lamp'], strength=0.75, power=2.2)
        a.searchlight(S.x(x), S.y(top - 24), 174, S(1200), spread=3.2, colour=P['lamp'], strength=0.38)
        a.searchlight(S.x(x), S.y(top - 24), 186, S(700), spread=2.0, colour=P['lamp'], strength=0.18)
    a.fade(lamp, [(0, P['lamp']), (1, '#ffffff' if P['beam'] else '#8ab6c8')], S.pt(x - 13, 0), S.pt(x + 13, 0))
    for px in (x - 4.5, x + 4.5):
        a.spray(a.rect(S.x(px - 0.9), S.y(top - 40), S.x(px + 0.9), S.y(top - 7)), P['lh_dark'], density=0.8, grain=0)
    dome = a.disc(S.x(x), S.y(top - 40), S(16)) * (a.yy <= S.y(top - 40))
    a.fade(dome, P['band'], S.pt(x - 16, 0), S.pt(x + 16, 0))
    a.spray(a.bar(S.pt(x, top - 55), S.pt(x, top - 44), S(2.2)), P['lh_dark'], grain=0)
    a.spray(a.disc(S.x(x), S.y(top - 57), S(2.6)), P['lh_dark'], grain=0)


def _cliff(a, S, P, rng, rip):
    """the headland cut as chiselled planes under ONE light (the sun, to the left): every plane is sprayed
    from its lit (left) edge to its shadow edge in an ink between the lit and shade ink set by how far it
    turns toward the sun; some planes carry a cut ledge a step darker; a soft hairline of light along the
    lit edges; the foot darkens into the sea"""
    top = TOP[:-1] + [(max(TOP[-1][0], S.X1 + 20), TOP[-1][1])]
    foot = [(S.X1 + 20, FOOT[0][1])] + FOOT
    outline = hand(top, rng, amp=0.8, step=14, closed=False) + [(S.X1 + 20, top[-1][1]), (S.X1 + 20, foot[0][1])] + \
        hand(foot, rng, amp=0.8, step=14, closed=False)
    m = a.poly(S.pts(outline))
    # reflection of the rock in the sea, broken into the stencil strips
    rf = [(x, y) for x, y in foot] + [(x, y + 70 + (x - 1040) * 0.02) for x, y in foot[::-1]]
    a.spray(a.poly(S.pts(rf)) * rip * 0.6, P['rock_foot'], grain=1.0)
    edges = [(TOP[0][0] - 20, FOOT[-1][0] - 20)] + CUTS + [(S.X1 + 40, S.X1 + 40)]
    # how far each plane turns toward the sun: wanders plane to plane, never flips the light
    turn = np.clip(0.55 + np.cumsum(rng.normal(0, 0.22, len(edges))) * 0.5, 0.12, 0.95)
    turn[0] = 0.95                                     # the headland's nose faces the sun
    kinks = rng.uniform(-14, 14, len(edges))
    a.spray(m, mix(P['rock_shade'], P['rock_lit'], 0.5), grain=1.0)      # ground coat under the planes
    for i in range(len(edges) - 1):
        (t0, f0), (t1, f1) = edges[i], edges[i + 1]
        kink0, kink1 = kinks[i], kinks[i + 1]
        face = [(t0, 380), (t1, 380), ((t1 + f1) / 2 + kink1, 640), (f1, 900), (f0, 900), ((t0 + f0) / 2 + kink0, 640)]
        fm = a.poly(S.pts(hand(face, rng, amp=0.7, step=14))) * m
        c0 = mix(P['rock_shade'], P['rock_lit'], turn[i])
        c1 = mix(P['rock_shade'], P['rock_lit'], turn[i] * rng.uniform(0.6, 0.8))
        a.fade(fm, [(0, c0), (1, c1)], S.pt(t0, 600), S.pt(t1, 600))
        if rng.random() < 0.55:
            # a ledge: a lower wedge of the plane cut a step darker
            yl = rng.uniform(560, 700)
            ledge = [((t0 + f0) / 2 + kink0 - 10, yl), ((t1 + f1) / 2 + kink1 + 10, yl + rng.uniform(-30, 50)),
                     (f1 + 10, 900), (f0 - 10, 900)]
            lm = a.poly(S.pts(hand(ledge, rng, amp=0.7, step=14))) * fm
            a.spray(lm, P['rock_shade'], density=rng.uniform(0.2, 0.4), grain=1.0)
        # the hairline of light along the lit edge, soft on the side away from the cut
        lit_edge = a.bar(S.pt(t0 + 1.5, 400), S.pt(f0 + 1.5, 900), S(1.6)) * m
        a.spray(lit_edge, P['rock_lit'], density=0.35 * turn[i], grain=1.0)
        a.overspray(lit_edge * m, P['rock_lit'], dx=S(2.5), dy=0, width=S(2.5), density=0.25 * turn[i])
    # the foot darkens into the sea
    yy = (a.yy - S.oy) / S.s
    footy = np.interp((a.xx - S.ox) / S.s, [p[0] for p in foot[::-1]], [p[1] for p in foot[::-1]])
    a.spray(m * smoothstep(-110, 0, yy - footy) ** 1.5 * 0.55, P['rock_foot'], grain=1.0)
    # grassy cap along the top edge, its underside cut with a wavering knife
    under = [(x, y + 15 + rng.uniform(-3, 5)) for x, y in top[::-1]]
    cap = hand(top, rng, amp=0.5, step=12, closed=False) + hand(under, rng, amp=1.0, step=10, closed=False)
    a.fade(a.poly(S.pts(cap)) * m, P['grass'], S.pt(0, 440), S.pt(0, 470))
    # foam: short cut dashes where the rock meets the sea, clustered
    for k in range(26):
        x = 1050 + (min(S.X1, 1960) - 1050) * rng.beta(0.8, 1.4)
        y = _lerp_y(FOOT, x) + rng.uniform(3, 18)
        ln = rng.uniform(14, 80)
        sl_cov = strip(a, S, x - ln, x, y, rng.uniform(1.8, 4.2),
                       taper=(rng.uniform(0.1, 0.4), rng.uniform(0.1, 0.4)))
        if sl_cov[0] is not None:
            a._spray_in(sl_cov[0], sl_cov[1] * rng.uniform(0.35, 0.8), col(P['foam']), 0.8, 'paint')


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed, s=S.s)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)
    hz = int(round(S.y(HZ)))

    if 'all' in inc:
        rng = group_rng(seed, 'all')
        a.rng = group_rng(seed, 'all')
        sx, sy = P['sun']
        banded_sky(a, S, rng, P['bands'])
        lit_f, dark_f = band_fields(a, S, P['bands'], P['ray'])
        a.burst(S.x(sx), S.y(sy), rays=40, contrast=P['ray_c'], reach=S(1200), colour=lit_f, dark=dark_f,
                glow=P['ray_glow'], phase=2.0, bottom=S.y(HZ), rng=rng, soft_side=-1)
        _sun(a, S.x(sx), S.y(sy), S(P['sun_r']), P['sun_stops'], P['halo'], P['halo_s'])
        st('sky')
        for x0, x1, y, h in CLOUDS:
            stencil_cloud(a, S, rng, x0, x1, y, h, P['cloud'], P['cloud_lit_below'] and sy > y,
                          edge_col=P['cloud_edge'])
        st('clouds')
        # a pale far headland on the left horizon
        head = ext_ridge([(-20, 586), (120, 572), (260, 566), (330, 578), (420, 596), (470, 610)], S)
        head = [(head[0][0], 586)] + head[1:]
        hm = a.poly(S.pts(hand(head, rng, amp=0.6, step=12, closed=False) + [(470, 612), (head[0][0], 612)]))
        a.fade(hm, P['head'], S.pt(0, 566), S.pt(0, 610))
        st('headland')
        src = a.img[:hz].copy()
        stencil_water(a, S, rng, HZ, src, P['sea'], reflect=P['reflect'], compress=0.8,
                      light=P['ripple_light'], glint=P['glint'], dark=P['ripple_dark'], x_sun=(sx, 80))
        # the strips that break every later reflection (cliff, boats) into stencil strokes
        rip = strip_mask(a, S, dashes(rng, S.X0, S.X1, HZ + 1, S.Y1, 1.8, 7.0, 40, 160, 0.8, 0.45, spacing=1.6), rng)
        st('sea')
        _cliff(a, S, P, rng, rip)
        st('cliff')
        back = [hh for hh in HOUSES if hh[4] == 0]
        front = [hh for hh in HOUSES if hh[4] == 1]
        for x, row, h in CYPRESS:
            if row == 0:
                _cypress(a, S, P, x, _lerp_y(TOP, x) - 14, h, rng)
        for x, w, h, d, _ in back:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) - 14, w, h, d, rng)
        for x, row, h in CYPRESS:
            if row == 1:
                _cypress(a, S, P, x, _lerp_y(TOP, x) + 6, h, rng)
        for x, w, h, d, _ in front:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) + 6, w, h, d, rng)
        st('village')
        _lighthouse(a, S, P)
        st('lighthouse')
        for x, wl, h, face, key in BOATS:
            _sailboat(a, S, P, x, wl, h, face, key, rip, rng)
        st('boats')
        for bx, by, sz, lift, tilt in GULLS:
            bird(a, S, rng, bx, by, sz, lift, tilt, P['gull'], P['gull_under'])
        st('gulls')

    a.rng = group_rng(seed, 'finish')
    a.finish(vignette=P['vignette'])
    img = a.composite()
    st.final(img)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'artdeco_coast.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    cw = sys.argv[4] if len(sys.argv) > 4 else 'Dusk'
    save_png(paint(W, H, colourway=cw), out)
