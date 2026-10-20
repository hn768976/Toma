"""Coastal village on a cliff -- Art Deco (airbrush through cut friskets, a 1920s-30s travel poster).
A headland on the right built of stacked, streamlined rock strata (each shelf a rounded bullet nose sprayed
toward the sun, its ledge catching the light), cubic white houses and streamlined cypresses on top, a banded
lighthouse on its tip; sailing boats on a graded sea laid with long speed lines, stepped stencil reflections
and a stacked sun path; a setting / high sun with a halo of compass-cut rings and a fan of frisket rays;
streamlined banded clouds; gulls. No lettering, no border. Colourways: Day and Dusk."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from artdeco import ramp
from _artdeco_kit import (Deco, Stager, hand, vary, col, mix, bez, _box, graded_sky, halo_rings, sun_disc,
                          frisket_rays, fan_angles, streamline_cloud, terraced_range, cypress, speed_lines,
                          lay_lines, reflect_bands, sun_path, chevrons, deco_bird, strip)

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("all",)

HZ = 610
# cliff top edge, left (headland tip) -> right
TOP = [(1034, 552), (1052, 514), (1084, 496), (1150, 489), (1260, 475), (1400, 463), (1560, 452), (1720, 444),
       (1940, 438)]
# where the rock meets the sea, left -> right (it comes toward the viewer)
BASE = [(1030, 694), (1200, 736), (1400, 790), (1600, 846), (1800, 900), (1990, 950)]
LH_X, LH_BASE = 1112, 496          # lighthouse
CLOUDS = [(60, 620, 150, 28), (760, 1150, 104, 20), (1300, 1880, 176, 26)]
# houses: (x, w, h, depth, row) -- row 0 back (higher on the slope), 1 front
HOUSES = [(1300, 64, 44, 16, 0), (1392, 80, 58, 18, 0), (1500, 58, 40, 15, 0), (1600, 96, 52, 18, 0),
          (1730, 70, 64, 16, 0), (1830, 90, 46, 18, 0),
          (1188, 62, 40, 15, 1), (1262, 88, 56, 18, 1), (1370, 54, 36, 14, 1), (1446, 100, 48, 18, 1),
          (1572, 66, 62, 16, 1), (1662, 84, 40, 17, 1), (1790, 76, 54, 17, 1)]
CYPRESS = [(1236, 0, 78), (1480, 0, 92), (1700, 1, 80), (1356, 1, 66), (1868, 0, 70)]
# sailing boats: (x, waterline, height, facing, sail colour key)
BOATS = [(190, 628, 30, 1, 'sail'), (905, 648, 52, -1, 'sail'), (340, 694, 98, 1, 'sail2'),
         (720, 838, 236, -1, 'sail')]
GULLS = [(818, 302, 32, 0.38, 0.06), (908, 250, 25, -0.05, -0.1), (1002, 338, 22, 0.5, 0.14),
         (1362, 284, 24, 0.15, -0.05), (1436, 340, 17, -0.1, 0.12), (302, 398, 19, 0.45, -0.12)]
HEAD = [(-90, 92, 220, 200, 2, 'dome'), (130, 125, 240, 230, 2, 'dome'), (340, 88, 170, 200, 2, 'dome')]      # the pale far headland

PAL = {
    'Dusk': dict(
        sun=(560, 572), sun_r=84,
        sky=[(0, '#18203c'), (0.3, '#2e3a64'), (0.52, '#704a6a'), (0.7, '#cc6c48'), (0.88, '#f0a85c'),
             (1, '#f8d892')],
        rings=(130, 182, 250), ring='#ffd99a', ring_d=(0.17, 0.13, 0.1),
        ray='#ffe0aa', ray_d=0.36, rays=(12, 168, 13),
        sun_stops=((0, '#fff6dc'), (0.5, '#ffd68a'), (1, '#f29a52')),
        cloud=[(0, '#f6b46a'), (0.55, '#b8685a'), (1, '#3e4676')], cloud_edge='#f6b86a', cloud_lit_below=True,
        head=[(0, '#76688e'), (1, '#5a547c')], head_sh=[(0, '#4c4870'), (1, '#3e3c64')], head_rim='#ffc488',
        sea=((0, '#f0b876'), (0.06, '#b87068'), (0.3, '#3c3e66'), (1, '#121830')),
        refl_head=[(0, '#5a5078'), (1, '#3a3c62')],
        line_light='#f6cc8a', path='#ffe0a0', line_dark='#0c1024', chev='#f2c488',
        rock=[(0, '#9a6a6e'), (1, '#4a3c60')], rock_lit='#f0a468', rock_sh=[(0, '#3a3a62'), (1, '#262848')],
        rock_rim='#ffc080', rock_refl='#141a32',
        grass=[(0, '#5a5272'), (1, '#2e2e4c')],
        wall=[(0, '#f8dcae'), (1, '#eebf8a')], side=[(0, '#5e5a80'), (1, '#4a4870')], roof='#ffe6bc',
        win='#ffd27a', win_glow=0.5,
        cyp=[(0, '#3a3e62'), (1, '#1c2240')], cyp_sh=[(0, '#141a32'), (1, '#0c1024')],
        lh=[(0, '#f8dcae'), (0.45, '#eebf8a'), (1, '#5e5a80')], band=[(0, '#d8603e'), (0.45, '#a8402e'), (1, '#4a2238')],
        lh_dark='#161a30', lamp='#fff2b8', beam=True,
        hull=[(0, '#5a5a7a'), (0.5, '#2c3454'), (1, '#141a30')],
        sail=[(0, '#ffe6bc'), (0.5, '#f2bd84'), (1, '#6a6488')], sail2=[(0, '#f6a066'), (0.5, '#d0603e'), (1, '#5a3048')],
        refl='#10142a', gull='#1c2240', gull_under=None, foam='#f6d4a0', vignette=0.14),
    'Day': dict(
        sun=(470, 206), sun_r=58,
        sky=[(0, '#1b4874'), (0.32, '#3a78a6'), (0.62, '#8ebccc'), (0.85, '#d2e4d6'), (1, '#f2eed6')],
        rings=(94, 136, 190), ring='#fff6d8', ring_d=(0.2, 0.16, 0.12),
        ray='#fff6dc', ray_d=0.3, rays=(-168, 168, 19),
        sun_stops=((0, '#fffef8'), (0.6, '#fff6d4'), (1, '#f6d890')),
        cloud=[(0, '#fbfaf2'), (0.5, '#dfe8e6'), (1, '#9db8c8')], cloud_edge='#ffffff', cloud_lit_below=False,
        head=[(0, '#a8bccb'), (1, '#8aa2b8')], head_sh=[(0, '#7c94ac'), (1, '#6c86a0')], head_rim='#ffffff',
        sea=((0, '#dce8dc'), (0.06, '#8cc0c8'), (0.3, '#3a86a2'), (1, '#0f3a56')),
        refl_head=[(0, '#7c9cb2'), (1, '#4e86a2')],
        line_light='#f2f6ea', path='#fffbe8', line_dark='#0c3048', chev='#e8f2ec',
        rock=[(0, '#e2b07a'), (1, '#9a6248')], rock_lit='#fbe0b0', rock_sh=[(0, '#8a5a48'), (1, '#5a3a32')],
        rock_rim='#fff0d0', rock_refl='#0e3048',
        grass=[(0, '#a2c47a'), (1, '#5a8a52')],
        wall=[(0, '#fffcf2'), (1, '#f2ead8')], side=[(0, '#b8c8d6'), (1, '#98aec0')], roof='#ffffff',
        win='#2a5470', win_glow=0.0,
        cyp=[(0, '#4c8a5a'), (1, '#1e4a34')], cyp_sh=[(0, '#163a2a'), (1, '#0c2a20')],
        lh=[(0, '#ffffff'), (0.5, '#eef0ea'), (1, '#8a9eb0')], band=[(0, '#e2523c'), (0.5, '#b8382c'), (1, '#6a1e1c')],
        lh_dark='#1e2e3e', lamp='#d8eef4', beam=False,
        hull=[(0, '#5a86a8'), (0.5, '#24486e'), (1, '#10203a')],
        sail=[(0, '#ffffff'), (0.5, '#f2f0e6'), (1, '#a8bccc')], sail2=[(0, '#f8a870'), (0.5, '#e2683e'), (1, '#8a3a2c')],
        refl='#0e3048', gull='#fdfdf8', gull_under='#9fb2c0', foam='#ffffff', vignette=0.12),
}


def _lerp_y(line, x):
    xs = [p[0] for p in line]
    ys = [p[1] for p in line]
    if xs[0] > xs[-1]:
        xs, ys = xs[::-1], ys[::-1]
    return float(np.interp(x, xs, ys))


def _sailboat_parts(x, wl, h, face):
    """a sloop: a streamlined hull (sheer and keel as smooth curves), a curved mainsail and a jib"""
    L = h * 0.8
    hh = h * 0.13
    f = face
    bow, stern = (x + L * 0.52 * f, wl - hh * 1.15), (x - L * 0.48 * f, wl - hh * 0.95)
    hull = [stern] + bez(stern, (x, wl - hh * 0.7), bow, 10)[1:] + \
        bez(bow, (x + L * 0.25 * f, wl + hh * 0.15), (x - L * 0.2 * f, wl), 8)[1:] + \
        bez((x - L * 0.2 * f, wl), (x - L * 0.42 * f, wl - hh * 0.2), stern, 6)[1:-1]
    mx = x - L * 0.06 * f
    top = wl - hh - h
    foot = wl - hh - h * 0.07
    boom = mx - L * 0.46 * f
    main = [(mx, top)] + bez((mx, top + 2), (boom - f * h * 0.08, top + h * 0.55), (boom, foot), 12)[1:] + [(mx, foot)]
    jt = top + h * 0.12
    jib = [(mx + 2 * f, jt)] + bez((mx + 2 * f, jt), (mx + f * (L * 0.36 + h * 0.06), jt + h * 0.5),
                                    (mx + f * (L * 0.5 + 2), foot), 10)[1:] + [(mx + 2 * f, foot)]
    return hull, main, jib, mx, top, foot


def _sailboat(a, S, P, rng, x, wl, h, face, sail_key):
    hull, main, jib, mx, top, foot = _sailboat_parts(x, wl, h, face)
    hull, main, jib = (hand(p, rng, amp=0.25, step=12) for p in (hull, main, jib))
    # the boat's reflection: its silhouette read upside down and cut into stepped bands
    sil = np.maximum.reduce([a.poly(S.pts(p)) for p in (hull, main, jib)])
    reflect_bands(a, S, rng, sil, wl, h * 0.75, [(0, P['refl']), (1, P['refl'])], 0.55, compress=0.7,
                  th0=max(1.2, h * 0.02), th1=max(2.0, h * 0.06), gap0=max(1.0, h * 0.015), gap1=max(1.6, h * 0.04),
                  shear=0.4, cuts=0.15)
    lit = -1 if P['sun'][0] < x else 1
    for poly in (main, jib):
        m = a.poly(S.pts(poly))
        xs = [p[0] for p in poly]
        xl, xr = (min(xs), max(xs)) if lit < 0 else (max(xs), min(xs))
        a.fade(m, vary(P[sail_key], rng.uniform(0.95, 1.04)), S.pt(xl, top), S.pt(xr, foot), grain=0.8)
    a.spray(a.bar(S.pt(mx, top - h * 0.03), S.pt(mx, foot + 1), S(max(1.2, h * 0.012))), P['lh_dark'], grain=0)
    m = a.poly(S.pts(hull))
    a.fade(m, P['hull'], S.pt(x, wl - h * 0.14), S.pt(x, wl))
    # a streak of light along the sheer
    sh = [(px, py) for px, py in hull[:len(hull) // 2]]
    if len(sh) > 2:
        a.spray(a.poly(S.pts(sh + [(px, py + max(1.2, h * 0.016)) for px, py in sh[::-1]])), P['sail'][0][1],
                density=0.75, grain=0.4)


def _house(a, S, P, x, base, w, h, d, rng):
    """a cubic whitewashed house: lit front, shaded side to the right, bright roof plane, a few windows"""
    dy = d * 0.45
    front = a.rect(S.x(x), S.y(base - h), S.x(x + w), S.y(base))
    a.fade(front, vary(P['wall'], rng.uniform(0.95, 1.02), rng.uniform(-0.015, 0.02)), S.pt(x, base - h),
           S.pt(x + w, base))
    side = a.poly(S.pts([(x + w, base - h), (x + w + d, base - h - dy), (x + w + d, base - dy), (x + w, base)]))
    a.fade(side, P['side'], S.pt(x + w, base - h), S.pt(x + w + d, base))
    roof = a.poly(S.pts([(x, base - h), (x + d, base - h - dy), (x + w + d, base - h - dy), (x + w, base - h)]))
    a.fade(roof, [(0, P['roof']), (1, P['wall'][1][1])], S.pt(x, base - h - dy), S.pt(x + w + d, base - h), grain=0.4)
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


def _lighthouse(a, S, P, rng):
    x, b = LH_X, LH_BASE
    hb, ht, top = 27, 17, b - 196
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
    # stepped gallery: two ledges, each a little wider than the tower
    for k, (wd, y0, y1) in enumerate(((24, top - 2, top + 3), (28, top - 8, top - 2))):
        a.fade(a.rect(S.x(x - wd), S.y(y0), S.x(x + wd), S.y(y1)), P['band'], S.pt(x - wd, 0), S.pt(x + wd, 0))
    for px in np.linspace(x - 20, x + 20, 6):
        a.spray(a.rect(S.x(px - 0.8), S.y(top - 18), S.x(px + 0.8), S.y(top - 8)), P['lh_dark'], grain=0)
    a.spray(a.rect(S.x(x - 22), S.y(top - 19), S.x(x + 22), S.y(top - 17)), P['lh_dark'], grain=0)
    lamp = a.rect(S.x(x - 13), S.y(top - 40), S.x(x + 13), S.y(top - 8))
    if P['beam']:
        # the beam: two long rays cut as friskets and sprayed out from the lantern
        frisket_rays(a, S, rng, x, top - 24, [(174, 1.6), (186, 1.1)], 16, 1150, P['lamp'], 0.32)
        a.glow(S.x(x), S.y(top - 24), S(90), P['lamp'], strength=0.6, power=2.2)
    a.fade(lamp, [(0, P['lamp']), (1, '#ffffff' if P['beam'] else '#8ab6c8')], S.pt(x - 13, 0), S.pt(x + 13, 0))
    for px in (x - 4.5, x + 4.5):
        a.spray(a.rect(S.x(px - 0.9), S.y(top - 40), S.x(px + 0.9), S.y(top - 8)), P['lh_dark'], density=0.8, grain=0)
    dome = a.disc(S.x(x), S.y(top - 40), S(16)) * (a.yy <= S.y(top - 40))
    a.fade(dome, P['band'], S.pt(x - 16, 0), S.pt(x + 16, 0))
    a.spray(a.bar(S.pt(x, top - 55), S.pt(x, top - 44), S(2.2)), P['lh_dark'], grain=0)
    a.spray(a.disc(S.x(x), S.y(top - 57), S(2.6)), P['lh_dark'], grain=0)


def _strata(rng, S):
    """the headland as stacked shelves of rock (design px): boundaries running between the cliff top and the
    line where it meets the sea, at irregular heights; each shelf ends toward the sea in a rounded bullet nose,
    stepping in and out shelf to shelf. Returns [(outline, nose_x, y_top_at_nose, y_bot_at_nose)] top -> bottom"""
    n = 6
    fr = np.concatenate([[0], np.sort(rng.uniform(0.08, 0.95, n - 1)), [1.0]])
    xs = np.linspace(1000, S.X1 + 30, 40)
    top = np.array([_lerp_y(TOP, x) for x in xs])
    top[xs > TOP[-1][0]] = TOP[-1][1]
    base = np.array([_lerp_y(BASE, x) for x in xs]) + 40
    out = []
    for j in range(n):
        y0 = top + (base - top) * fr[j]
        y1 = top + (base - top) * fr[j + 1] + 2
        nose = 1034 + (0 if j == 0 else rng.uniform(-34, 26))
        k0 = np.searchsorted(xs, nose + 10)
        ya, yb = float(np.interp(nose, xs, y0)), float(np.interp(nose, xs, y1))
        r = (yb - ya) * rng.uniform(0.45, 0.8)
        upper = [(nose + r * 0.6, ya)] + [(x, y) for x, y in zip(xs[k0:], y0[k0:])]
        lower = [(x, y) for x, y in zip(xs[k0:][::-1], y1[k0:][::-1])] + [(nose + r * 0.6, yb)]
        bulge = bez((nose + r * 0.6, yb), (nose - r * 0.55, (ya + yb) / 2 + (yb - ya) * 0.25), (nose + r * 0.6, ya), 12)[1:-1]
        out.append((upper + [(S.X1 + 30, y0[-1]), (S.X1 + 30, y1[-1])] + lower + bulge, nose, ya, yb))
    return out


def _cliff(a, S, P, rng):
    """the strata, top shelf last so each overhangs the one below a little. Every shelf: one vertical fade
    (its ledge to its foot), the rounded nose sprayed with the lit ink toward the sun, the far end sprayed
    with the shade ink, and a streak of light along the ledge."""
    strata = _strata(rng, S)
    below = a.poly(S.pts([(980, 300), (S.X1 + 40, 300), (S.X1 + 40, _lerp_y(BASE, S.X1) + 2)] +
                         [(x, y) for x, y in BASE[::-1] if x < S.X1 + 40] + [(980, BASE[0][1])]))
    union = np.zeros((a.H, a.W), np.float32)
    for j, (outline, nose, ya, yb) in enumerate(strata[::-1]):
        m = a.poly(S.pts(hand(outline, rng, amp=0.4, step=20))) * below
        sl = _box(m > 0)
        if sl is None:
            continue
        union = np.maximum(union, m)
        a.fade(m, vary(P['rock'], rng.uniform(0.9, 1.08)), S.pt(0, ya), S.pt(0, yb + 30))
        e = a._edge(m[sl])
        X = a.xx[sl]
        # the nose turned to the sun
        tn = np.clip((X - S.x(nose)) / S(rng.uniform(70, 140)), 0, 1)
        a._spray_in(sl, m[sl] * (1 - smoothstep(0, 1, tn)) * rng.uniform(0.55, 0.8), col(P['rock_lit']), 1.0,
                    'paint', e)
        # the shelf turning away toward the right
        ts = np.clip((X - S.x(nose + 220)) / S(700), 0, 1)
        sh = ramp(np.clip((a.yy[sl] - S.y(ya)) / max(1.0, S(yb - ya + 40)), 0, 1), P['rock_sh'])
        a._spray_in(sl, m[sl] * smoothstep(0, 1, ts) * rng.uniform(0.45, 0.7), sh, 1.0, 'paint', e)
        # the ledge: light sprayed down from the shelf's top edge
        top_c = np.full(m.shape[1], np.inf, np.float32)
        rows = np.argmax(m > 0.5, axis=0)
        has = (m > 0.5).any(0)
        top_c[has] = rows[has]
        tc = top_c[sl[1]][None, :]
        dist = np.maximum(a.yy[sl] - tc, 0)
        rw = S(rng.uniform(3, 6))
        a._spray_in(sl, m[sl] * np.exp(-dist / rw) * (0.25 + 0.75 * (1 - ts)) * 0.6, col(P['rock_rim']), 0.6,
                    'paint', None)
    # the grassy cap along the top
    top = [(x, y) for x, y in TOP[:-1]] + [(S.X1 + 30, TOP[-1][1])]
    under = [(x, y + 15) for x, y in top[::-1]]
    cap = hand(top, rng, amp=0.4, step=14, closed=False) + under + \
        bez((top[0][0] + 6, top[0][1] + 15), (top[0][0] - 8, top[0][1] + 8), top[0], 6)[1:-1]
    cm = a.poly(S.pts(cap))
    a.fade(cm, P['grass'], S.pt(0, 440), S.pt(0, 470))
    return union


def _foam(a, S, P, rng):
    """where the rock meets the sea: stacked short speed lines of foam along the foot, clustered"""
    for k in range(30):
        x = 1040 + (min(S.X1, 1960) - 1040) * rng.beta(0.8, 1.3)
        y = _lerp_y(BASE, x) + rng.uniform(2, 22)
        ln = rng.uniform(20, 110)
        head = rng.random() < 0.5
        sl, cov = strip(a, S, x - ln, x, y, rng.uniform(1.6, 3.8),
                        taper=(0.05, 0.5) if head else (0.5, 0.05), point=1.0)
        if sl is not None:
            a._spray_in(sl, cov * rng.uniform(0.4, 0.85), col(P['foam']), 0.8, 'paint', None)


def _cliff_reflection(a, S, P, rng):
    """the rock's dark reflection below its foot: a few stepped bands that follow the foot line"""
    for k in range(5):
        off0 = 4 + k * rng.uniform(9, 14)
        th = rng.uniform(4, 9)
        pts = [(x, y + off0) for x, y in BASE] + [(x, y + off0 + th) for x, y in BASE[::-1]]
        m = a.poly(S.pts(pts))
        x_end = 1040 + rng.uniform(10, 120)
        sl = _box(m > 0)
        if sl is None:
            continue
        cut = np.clip((a.xx[sl] - S.x(x_end)) / S(30), 0, 1)
        d = np.zeros_like(m)
        d[sl] = m[sl] * cut * (0.6 - 0.08 * k)
        a.spray(d, P['rock_refl'], grain=1.0)


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
        graded_sky(a, S, P['sky'], S.Y0, HZ)
        halo_rings(a, S, rng, sx, sy, P['rings'], P['ring'], P['ring_d'], bottom=HZ)
        a0, a1, n = P['rays']
        angs = fan_angles(rng, a0, a1, n, 1.3, 3.2)
        frisket_rays(a, S, rng, sx, sy, angs[:n // 2], P['sun_r'] * 1.25, 1300, P['ray'], P['ray_d'], bottom=HZ)
        frisket_rays(a, S, rng, sx, sy, angs[n // 2:], P['sun_r'] * 1.25, 1300, P['ray'], P['ray_d'], bottom=HZ,
                     soft_side=-1)
        sun_disc(a, S, sx, sy, P['sun_r'], P['sun_stops'], bottom=HZ)
        st('sky')
        for x0, x1, y, h in CLOUDS:
            streamline_cloud(a, S, rng, x0, x1, y, h, P['cloud'], P['cloud_lit_below'] and sy > y,
                             edge_col=P['cloud_edge'], head='R' if (x0 + x1) / 2 < sx else 'L')
        st('clouds')
        hm = terraced_range(a, S, rng, HEAD, HZ + 1, P['head'], P['head_sh'], P['head_rim'], light=1, rim_k=0.35, shade_k=0.6)
        st('headland')
        # the sea
        m = np.zeros((a.H, a.W), np.float32)
        m[hz:] = 1
        a.fade(m, P['sea'], S.pt(0, HZ), S.pt(0, S.Y1))
        reflect_bands(a, S, rng, hm, HZ, 70, P['refl_head'], 0.7, compress=0.7, th0=1.8, th1=4, gap0=1.2, gap1=2.5)
        sun_path(a, S, rng, sx, HZ, S.Y1, 80, 520, P['path'], 0.85)
        near_sun = lambda x: 0.35 + 1.6 * np.exp(-((x - sx) / 330) ** 2)
        lay_lines(a, S, rng, speed_lines(rng, S.X0, S.X1, HZ + 6, S.Y1, 1.4, 5.5, 90, 460, 30, cover=0.32,
                                         x_pref=near_sun), P['line_light'], 0.55)
        lay_lines(a, S, rng, speed_lines(rng, S.X0, 1100, HZ + 180, S.Y1, 2.5, 7.0, 160, 520, 12, cover=0.35),
                  P['line_dark'], 0.45)
        for x, y, nn, sp, dp in ((120, 760, 3, 110, 9), (520, 990, 4, 170, 15), (980, 700, 3, 80, 7)):
            chevrons(a, S, rng, x + rng.uniform(-20, 20), y, nn, sp, dp, 2.4 + (y - HZ) / 130, P['chev'], 0.5,
                     flip=1)
        st('sea')
        _cliff_reflection(a, S, P, rng)
        _cliff(a, S, P, rng)
        _foam(a, S, P, rng)
        st('cliff')
        back = [hh for hh in HOUSES if hh[4] == 0]
        front = [hh for hh in HOUSES if hh[4] == 1]
        L = -1 if sx < 1200 else 1
        for x, row, h in CYPRESS:
            if row == 0:
                cypress(a, S, rng, x, _lerp_y(TOP, x) - 12, h, P['cyp'], P['cyp_sh'], light=L)
        for x, w, h, d, _ in back:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) - 14, w, h, d, rng)
        for x, row, h in CYPRESS:
            if row == 1:
                cypress(a, S, rng, x, _lerp_y(TOP, x) + 8, h, P['cyp'], P['cyp_sh'], light=L)
        for x, w, h, d, _ in front:
            _house(a, S, P, x, _lerp_y(TOP, x + w / 2) + 6, w, h, d, rng)
        st('village')
        _lighthouse(a, S, P, rng)
        st('lighthouse')
        for x, wl, h, face, key in BOATS:
            _sailboat(a, S, P, rng, x, wl, h, face, key)
        st('boats')
        for bx, by, sz, lift, tilt in GULLS:
            deco_bird(a, S, rng, bx, by, sz, lift, tilt, P['gull'], P['gull_under'])
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
