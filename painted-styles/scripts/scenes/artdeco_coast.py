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
from _artdeco_kit import Deco, Stager, ext_ridge

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
CLOUDS = [[(80, 520, 120, 9), (180, 600, 141, 7)],
          [(760, 1080, 84, 7), (830, 1150, 101, 5)],
          [(1380, 1860, 150, 9), (1300, 1700, 172, 6.5)]]
# houses: (x, w, h, depth, row) -- row 0 back (higher on the slope), 1 front
HOUSES = [(1300, 64, 44, 16, 0), (1392, 80, 58, 18, 0), (1500, 58, 40, 15, 0), (1600, 96, 52, 18, 0),
          (1730, 70, 64, 16, 0), (1830, 90, 46, 18, 0),
          (1188, 62, 40, 15, 1), (1262, 88, 56, 18, 1), (1370, 54, 36, 14, 1), (1446, 100, 48, 18, 1),
          (1572, 66, 62, 16, 1), (1662, 84, 40, 17, 1), (1790, 76, 54, 17, 1)]
CYPRESS = [(1236, 0, 70), (1480, 0, 84), (1700, 1, 76), (1356, 1, 62)]
# sailing boats: (x, waterline, height, facing, sail colour key)
BOATS = [(190, 628, 30, 1, 'sail'), (905, 648, 52, -1, 'sail'), (340, 694, 98, 1, 'sail2'),
         (720, 838, 236, -1, 'sail')]
GULLS = [(820, 300, 30), (905, 252, 24), (1000, 336, 20), (1360, 286, 22), (1440, 338, 16), (300, 400, 17)]

PAL = {
    'Dusk': dict(
        sun=(560, 600), sun_r=74, sun_glow=0.65,
        sky=[(0, '#1a1a44'), (0.3, '#43306a'), (0.55, '#a2527a'), (0.78, '#ee8f6c'), (1, '#fcd2a0')],
        ray='#ffd6a0', ray_dark='#4a2a58', ray_c=0.12,
        sun_stops=((0, '#fff4d6'), (0.55, '#ffcf86'), (1, '#f08050')), halo='#ffc890', halo_s=0.7,
        cloud=[(0, '#3e2c60'), (0.55, '#a8607e'), (1, '#f0a07e')], cloud_rim='#ffc896',
        head=[(0, '#9a6894'), (1, '#c98d98')],
        sea=((0, '#c27a82'), (0.25, '#5a3a6c'), (1, '#141030')), reflect=0.8,
        rock=[('#f0a67a', '#c47a70'), ('#6a4068', '#4a2e58'), ('#8a5674', '#6a4068'), ('#4a2e58', '#352446'),
              ('#7a4c6e', '#5a3a64'), ('#3e2850', '#2c1e3e'), ('#5a3a62', '#3e2850')],
        rock_foot='#1e1530', grass=[(0, '#4a4a5a'), (1, '#262838')],
        wall=[(0, '#ffd8b4'), (1, '#e6a88c')], side=[(0, '#9a6680'), (1, '#6a4466')], roof='#ffe2c0',
        win='#ffd27a', win_glow=0.5, cypress=[(0, '#3a3450'), (1, '#16142a')],
        lh=[(0, '#9a6a7c'), (0.3, '#ffe6cc'), (1, '#5a3a5a')], band=[(0, '#7a2a3a'), (0.3, '#d8604a'), (1, '#4a1c30')],
        lh_dark='#2a1d36', lamp='#fff2b8', beam=True,
        hull=[(0, '#1e1630'), (0.6, '#4a2c48'), (1, '#9a5a5a')],
        sail=[(0, '#ffe2c0'), (0.5, '#f4b892'), (1, '#9a6488')], sail2=[(0, '#ffb07a'), (0.5, '#e0704e'), (1, '#7a3a58')],
        refl='#2a1c40', gull='#2a1d3e', gull_under='#2a1d3e', foam='#f8c8ae', vignette=0.14),
    'Day': dict(
        sun=(470, 206), sun_r=56, sun_glow=0.5,
        sky=[(0, '#1d5a96'), (0.35, '#3f8cc0'), (0.7, '#9cc9da'), (1, '#eaeedc')],
        ray='#fff6d0', ray_dark='#2f6e9e', ray_c=0.10,
        sun_stops=((0, '#fffef8'), (0.6, '#fff6d4'), (1, '#f8d890')), halo='#fff4cc', halo_s=0.55,
        cloud=[(0, '#fbfcf6'), (0.6, '#e4eeee'), (1, '#a9c6d6')], cloud_rim='#ffffff',
        head=[(0, '#7f9fba'), (1, '#b2c8d2')],
        sea=((0, '#86c0cc'), (0.22, '#2f82a0'), (1, '#0b3350')), reflect=0.7,
        rock=[('#f6dcb0', '#e8bc8a'), ('#c08458', '#a06a48'), ('#dca878', '#c08a60'), ('#9a5e44', '#7e4a36'),
              ('#c89062', '#a87450'), ('#86503a', '#6a3c2c'), ('#b07a52', '#8e5c40')],
        rock_foot='#3e2620', grass=[(0, '#a6c87a'), (1, '#5a8e52')],
        wall=[(0, '#fffcf2'), (1, '#f2ead8')], side=[(0, '#c4d2dc'), (1, '#9eb2c2')], roof='#ffffff',
        win='#2a5470', win_glow=0.0, cypress=[(0, '#4a8a5a'), (1, '#123a2e')],
        lh=[(0, '#a8b8c4'), (0.3, '#ffffff'), (1, '#7a8ea0')], band=[(0, '#8a2a24'), (0.3, '#e04a3a'), (1, '#6a1e1c')],
        lh_dark='#1e2e3e', lamp='#d8eef4', beam=False,
        hull=[(0, '#10203a'), (0.6, '#24486e'), (1, '#5a86a8')],
        sail=[(0, '#ffffff'), (0.5, '#f2f2ea'), (1, '#b4c6d2')], sail2=[(0, '#ffb880'), (0.5, '#e8784c'), (1, '#9a4430')],
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


def _gull(a, S, bx, by, sz, col, under):
    """a gull in flight: a shallow M of two cut wings, slightly darker underside wedge"""
    pts = [(bx - sz, by - sz * 0.18), (bx - sz * 0.55, by - sz * 0.46), (bx - sz * 0.12, by - sz * 0.08),
           (bx, by + sz * 0.02), (bx + sz * 0.12, by - sz * 0.08), (bx + sz * 0.55, by - sz * 0.46),
           (bx + sz, by - sz * 0.18), (bx + sz * 0.5, by - sz * 0.3), (bx + sz * 0.1, by + sz * 0.16),
           (bx - sz * 0.1, by + sz * 0.16), (bx - sz * 0.5, by - sz * 0.3)]
    m = a.poly(S.pts(pts))
    a.fade(m, [(0, col), (0.6, col), (1, under)], S.pt(bx, by - sz * 0.46), S.pt(bx, by + sz * 0.16), grain=0.3)


def _sailboat(a, S, P, x, wl, h, face, sail_key, rip):
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
    sails = (main, jib)
    # reflection first (under everything of this boat)
    for poly, k in ((hull, 0.6), (main, 0.38), (jib, 0.38)):
        rp = [(px, 2 * wl - py) for px, py in poly]
        rp = [(px, wl + (py - wl) * 0.8) for px, py in rp]
        a.spray(a.poly(S.pts(rp)) * rip * k, P['refl'], grain=0.6)
    lit = -1 if P['sun'][0] < x else 1          # side of the boat facing the sun
    for poly in sails:
        m = a.poly(S.pts(poly))
        xs = [p[0] for p in poly]
        xl, xr = (min(xs), max(xs)) if lit < 0 else (max(xs), min(xs))
        a.fade(m, P[sail_key], S.pt(xl, top), S.pt(xr, foot), grain=0.6)
    a.spray(a.bar(S.pt(mx, top - h * 0.03), S.pt(mx, wl - hh), S(max(1.2, h * 0.012))), P['lh_dark'], grain=0)
    m = a.poly(S.pts(hull))
    a.fade(m, P['hull'], S.pt(x, wl), S.pt(x, wl - hh))
    a.spray(a.rect(S.x(min(hull[0][0], hull[1][0])), S.y(wl - hh), S.x(max(hull[0][0], hull[1][0])),
                   S.y(wl - hh + max(1.2, h * 0.012))), P['sail'][0][1], density=0.8, grain=0.3)


def _house(a, S, P, x, base, w, h, d, rng):
    """a cubic whitewashed house: lit front, shaded side to the right, bright roof plane, a few windows"""
    dy = d * 0.45
    front = a.rect(S.x(x), S.y(base - h), S.x(x + w), S.y(base))
    a.fade(front, P['wall'], S.pt(x, base - h), S.pt(x + w, base))
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


def _cypress(a, S, P, x, base, h):
    w = h * 0.17
    pts = [(x + w * np.sin(np.pi * t) ** 0.8 * (1 if s > 0 else -1), base - h * t)
           for s in (1, -1) for t in (np.linspace(0, 1, 14) if s > 0 else np.linspace(1, 0, 14))]
    m = a.poly(S.pts(pts))
    a.fade(m, P['cypress'], S.pt(x - w, base), S.pt(x + w, base))


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
    top = TOP[:-1] + [(max(TOP[-1][0], S.X1 + 20), TOP[-1][1])]
    foot = [(S.X1 + 20, FOOT[0][1])] + FOOT
    outline = top + [(S.X1 + 20, top[-1][1]), (S.X1 + 20, foot[0][1])] + foot
    m = a.poly(S.pts(outline))
    # reflection of the rock in the sea, broken into ripple dashes
    rf = [(x, y) for x, y in foot] + [(x, y + 70 + (x - 1040) * 0.02) for x, y in foot[::-1]]
    a.spray(a.poly(S.pts(rf)) * rip * 0.55, P['rock_foot'], grain=0.6)
    # facets: chiselled vertical planes, each sprayed from its lit edge to its shadow edge
    edges = [(TOP[0][0] - 20, FOOT[-1][0] - 20)] + CUTS + [(S.X1 + 40, S.X1 + 40)]
    rock = P['rock']
    for i in range(len(edges) - 1):
        (t0, f0), (t1, f1) = edges[i], edges[i + 1]
        fm = a.poly(S.pts([(t0, 380), (t1, 380), (f1, 900), (f0, 900)])) * m
        c0, c1 = rock[min(i, len(rock) - 1)]
        a.fade(fm, [(0, c0), (1, c1)], S.pt(t0, 600), S.pt(t1, 600))
        # a hairline of light along the facet's lit edge
        a.spray(a.bar(S.pt(t0 + 1.5, 400), S.pt(f0 + 1.5, 900), S(2.0)) * m, rock[0][0], density=0.3, grain=0.3)
    # the foot darkens into the sea
    yy = (a.yy - S.oy) / S.s
    footy = np.interp((a.xx - S.ox) / S.s, [p[0] for p in foot[::-1]], [p[1] for p in foot[::-1]])
    a.spray(m * smoothstep(-110, 0, yy - footy) ** 1.5 * 0.5, P['rock_foot'], grain=0.8)
    # grassy cap along the top edge
    cap = top + [(x, y + 16 + 4 * np.sin(x * 0.05)) for x, y in top[::-1]]
    a.fade(a.poly(S.pts(cap)) * m, P['grass'], S.pt(0, 440), S.pt(0, 470))
    # foam: speed-line dashes where the rock meets the sea
    for k in range(24):
        x = rng.uniform(1060, min(S.X1, 1960))
        y = _lerp_y(FOOT, x) + rng.uniform(3, 18)
        ln = rng.uniform(16, 70)
        r = rng.uniform(1.0, 2.4)
        cm = a.capsule(S.x(x - ln), S.x(x), S.y(y), S(r))
        a.spray(cm * rng.uniform(0.35, 0.8), P['foam'], grain=0.6)


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)
    hz = int(round(S.y(HZ)))

    if 'all' in inc:
        rng = group_rng(seed, 'all')
        a.rng = group_rng(seed, 'all')
        sx, sy = P['sun']
        a.sky(P['sky'], top=S.y(0), bottom=S.y(HZ))
        a.burst(S.x(sx), S.y(sy), rays=40, contrast=P['ray_c'], reach=S(1200), colour=P['ray'],
                dark=P['ray_dark'], glow=P['sun_glow'], phase=2.0, bottom=S.y(HZ))
        _sun(a, S.x(sx), S.y(sy), S(P['sun_r']), P['sun_stops'], P['halo'], P['halo_s'])
        st('sky')
        for bars in CLOUDS:
            for x0, x1, y, r in bars:
                m = a.capsule(S.x(x0), S.x(x1), S.y(y), S(r)) * 0.92
                a.fade(m, P['cloud'], S.pt(0, y - r), S.pt(0, y + r))
                ly = y + r * 0.55 if sy > y else y - r * 0.55
                line = a.capsule(S.x(x0 + r * 1.5), S.x(x1 - r * 1.2), S.y(ly), S(max(0.7, r * 0.16)))
                a.spray(line * m, P['cloud_rim'], density=0.55, grain=0.3)
        st('clouds')
        # a pale far headland on the left horizon
        head = ext_ridge([(-20, 586), (120, 572), (260, 566), (330, 578), (420, 596), (470, 610)], S)
        head = [(head[0][0], 586)] + head[1:]
        hm = a.poly(S.pts(head + [(470, 612), (head[0][0], 612)]))
        a.fade(hm, P['head'], S.pt(0, 566), S.pt(0, 610))
        st('headland')
        a.water(hz, stops=P['sea'], reflect=P['reflect'])
        rip = np.zeros((a.H, a.W), np.float32)
        rip[hz:] = a._ripples(a.H - hz, a.W, 0.36)
        st('sea')
        _cliff(a, S, P, rng, rip)
        st('cliff')
        back = [hh for hh in HOUSES if hh[4] == 0]
        front = [hh for hh in HOUSES if hh[4] == 1]
        for x, row, h in CYPRESS:
            if row == 0:
                _cypress(a, S, P, x, _lerp_y(TOP, x) - 14, h)
        for x, w, h, d, _ in back:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) - 14, w, h, d, rng)
        for x, row, h in CYPRESS:
            if row == 1:
                _cypress(a, S, P, x, _lerp_y(TOP, x) + 6, h)
        for x, w, h, d, _ in front:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) + 6, w, h, d, rng)
        st('village')
        _lighthouse(a, S, P)
        st('lighthouse')
        for x, wl, h, face, key in BOATS:
            _sailboat(a, S, P, x, wl, h, face, key, rip)
        st('boats')
        for bx, by, sz in GULLS:
            _gull(a, S, bx, by, sz, P['gull'], P['gull_under'])
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
