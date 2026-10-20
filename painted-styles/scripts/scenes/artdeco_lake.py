"""Mountain lake -- Art Deco (airbrush through hand-cut friskets, a 1920s-30s travel poster).
No lettering, no border: full-bleed scene. Colourways: Day (high sun, morning blues) and Dusk (setting sun).
The sky is one long airbrushed fade with a stepped halo of compass-cut rings round the sun and a fan of rays
each sprayed through its own frisket; clouds are stacked streamlined bands; the ranges are stepped, terraced
mountains with rounded ledges (each tier one gradient, lit side / shade side); pines are stacked streamlined
tiers split light/shade; the lake is graded water with the mountains mirrored as stepped stencil bands, long
tapered speed lines, a stacked sun path and chevron ripples; the canoe and its rower are streamlined
silhouettes airbrushed with a rim of light."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from drawkit import Scaler, seed_all, save_png, group_rng
from core import smoothstep
from _artdeco_kit import (Deco, Stager, hand, vary, col, bez, graded_sky, halo_rings, sun_disc, frisket_rays,
                          fan_angles, streamline_cloud, terraced_range, deco_pine, speed_lines, lay_lines,
                          reflect_bands, sun_path, chevrons, deco_bird, haze, strip)

STYLE = "Art Deco · 装饰艺术"
LIB = "artdeco"
COLOURWAYS = ("Day", "Dusk")
GROUPS = ("sky", "clouds", "far", "near", "water", "mist", "boat", "birds", "reeds")

HZ = 640          # waterline (design px)
FAR_BASE = 600
# stepped mountains: cx, height, half width left / right, tiers, top
FAR = [(130, 250, 270, 220, 3, 'dome'), (470, 320, 250, 290, 4, 'point'), (800, 215, 230, 200, 3, 'dome'),
       (1020, 262, 210, 150, 3, 'point'), (1520, 300, 230, 270, 4, 'dome'), (1840, 245, 240, 270, 3, 'point')]
FAR_FOOT = 566
NEAR = [(170, 200, 340, 270, 3, 'dome'), (560, 118, 230, 240, 2, 'dome'), (1650, 150, 290, 260, 3, 'dome'),
        (1940, 190, 250, 290, 3, 'point')]
PINES_L = [(70, 480, 66), (140, 452, 80), (215, 470, 70), (282, 440, 84), (352, 488, 70), (420, 520, 60),
           (488, 552, 50), (35, 535, 56), (250, 540, 60), (180, 552, 52)]
PINES_R = [(1560, 560, 38), (1615, 545, 46), (1690, 575, 34), (1760, 556, 42), (1815, 585, 30)]
# birds: x, y, span, wing lift, tilt
BIRDS = [(1376, 262, 30, 0.42, 0.05), (1449, 224, 21, -0.05, -0.08), (1531, 290, 25, 0.25, 0.12),
         (1602, 198, 17, 0.55, -0.15), (1661, 246, 15, 0.1, 0.1), (1700, 222, 11, 0.35, 0.0)]
# streamlined clouds: x0, x1, y (lowest band), band height
CLOUDS = [(40, 640, 150, 30), (600, 860, 212, 17), (860, 1300, 108, 24), (1420, 1900, 140, 27)]

PAL = {
    'Dusk': dict(
        sun=(1240, 492), sun_r=96,
        sky=[(0, '#18203c'), (0.28, '#2c3862'), (0.5, '#6c4a6e'), (0.68, '#c86a4a'), (0.86, '#eea25a'),
             (1, '#f8d892')],
        rings=(150, 205, 280), ring='#ffd99a', ring_d=(0.16, 0.13, 0.1),
        ray='#ffe0aa', ray_d=0.4, rays=(10, 170, 13),
        sun_stops=((0, '#fff6dc'), (0.5, '#ffd88e'), (1, '#f39a52')),
        cloud=[(0, '#f6b46a'), (0.55, '#b8685a'), (1, '#3e4676')], cloud_edge='#f6b86a', cloud_lit_below=True,
        far=[(0, '#8a6e8e'), (1, '#5c5078')], far_sh=[(0, '#463e6a'), (1, '#36325a')], far_rim='#ffc488',
        far_foot=[(0, '#56507a'), (1, '#46426c')],
        near=[(0, '#323e64'), (1, '#252e50')], near_sh=[(0, '#161c36'), (1, '#10152c')], near_rim='#f0a060',
        pine=[(0, '#3e4e66'), (1, '#1a2438')], pine_sh=[(0, '#141c30'), (1, '#0c1222')], trunk='#0e1424',
        water=((0, '#f0b876'), (0.07, '#b87068'), (0.3, '#3c3e66'), (1, '#121830')),
        refl_far=[(0, '#5c5478'), (1, '#3a3c62')], refl_near=[(0, '#141a32'), (1, '#1c2240')],
        line_light='#f6cc8a', path='#ffe0a0', line_dark='#0c1024', chev='#f2c488',
        mist='#f6cf8e', mist_k=0.8,
        hull=[(0, '#f0a060'), (0.5, '#b04a30'), (1, '#3a1a1c')], sheer='#ffd28e', refl_boat='#0e1226',
        figure=[(0, '#2a2c48'), (1, '#121628')], rim='#ffb870', oar='#121628',
        bird='#1c2240',
        reed=[(0, '#0b0f1e'), (0.6, '#222a42'), (1, '#c07a46')], cattail=[(0, '#d08048'), (1, '#2a1a1a')],
        vignette=0.14),
    'Day': dict(
        sun=(1240, 236), sun_r=60,
        sky=[(0, '#1b4874'), (0.3, '#3a78a6'), (0.62, '#8ebccc'), (0.85, '#d2e4d6'), (1, '#f2eed6')],
        rings=(98, 140, 196), ring='#fff6d8', ring_d=(0.2, 0.16, 0.12),
        ray='#fff6dc', ray_d=0.32, rays=(-168, 168, 19),
        sun_stops=((0, '#fffef8'), (0.55, '#fff6d4'), (1, '#f6d890')),
        cloud=[(0, '#fbfaf2'), (0.5, '#dfe8e6'), (1, '#9db8c8')], cloud_edge='#ffffff', cloud_lit_below=False,
        far=[(0, '#c6d2d8'), (1, '#9eb2c4')], far_sh=[(0, '#7f96b0'), (1, '#6e86a2')], far_rim='#ffffff',
        far_foot=[(0, '#9cb0c0'), (1, '#86a0b4')],
        near=[(0, '#6a9a80'), (1, '#4c7c6a')], near_sh=[(0, '#2a5452'), (1, '#204846')], near_rim='#e2eccc',
        pine=[(0, '#4e8a62'), (1, '#1e4a3c')], pine_sh=[(0, '#123228'), (1, '#0a241e')], trunk='#12261f',
        water=((0, '#dce8dc'), (0.07, '#8cbcc4'), (0.32, '#3e7e98'), (1, '#123850')),
        refl_far=[(0, '#7f9cb2'), (1, '#4e7c98')], refl_near=[(0, '#123a3c'), (1, '#184458')],
        line_light='#f2f6ea', path='#fffbe8', line_dark='#0c2c40', chev='#e8f2ec',
        mist='#f5f2e2', mist_k=0.7,
        hull=[(0, '#f4a066'), (0.5, '#b8452e'), (1, '#3a1a16')], sheer='#fff0c8', refl_boat='#123448',
        figure=[(0, '#2a3a44'), (1, '#121e26')], rim='#fff0c8', oar='#121e26',
        bird='#1a2f42',
        reed=[(0, '#08201c'), (0.6, '#2a5642'), (1, '#d2bc78')], cattail=[(0, '#c08a50'), (1, '#3a2418')],
        vignette=0.12),
}


def _light_at(P, x):
    """the side a form at x is lit from: toward the sun"""
    return 1 if P['sun'][0] > x else -1


# ------------------------------------------------------------------ groups
def g_sky(a, S, P, st, rng):
    """one long fade, the stepped halo, a fan of frisket rays, then the sun disc"""
    sx, sy = P['sun']
    graded_sky(a, S, P['sky'], S.Y0, HZ)
    st('sky_fade', dense=True)
    halo_rings(a, S, rng, sx, sy, P['rings'], P['ring'], P['ring_d'], bottom=HZ)
    st('sky_halo', dense=True)
    a0, a1, n = P['rays']
    angs = fan_angles(rng, a0, a1, n, 1.3, 3.4)
    half = len(angs) // 2
    frisket_rays(a, S, rng, sx, sy, angs[:half], P['sun_r'] * 1.25, 1250, P['ray'], P['ray_d'], bottom=HZ)
    st('rays', dense=True)
    frisket_rays(a, S, rng, sx, sy, angs[half:], P['sun_r'] * 1.25, 1250, P['ray'], P['ray_d'], bottom=HZ,
                 soft_side=-1)
    st('rays', dense=True)
    sun_disc(a, S, sx, sy, P['sun_r'], P['sun_stops'], bottom=HZ)
    st('sky')


def g_clouds(a, S, P, st, rng):
    for i, (x0, x1, y, h) in enumerate(CLOUDS):
        streamline_cloud(a, S, rng, x0, x1, y, h, P['cloud'], P['cloud_lit_below'], edge_col=P['cloud_edge'],
                         head='R' if (x0 + x1) / 2 < P['sun'][0] else 'L')
        st(f'cloud{i + 1}', dense=True)


def _range(a, S, P, rng, peaks, base, key, rim_k, shade_k, foot, st, name, dense):
    union = np.zeros((a.H, a.W), np.float32)
    if foot is not None:
        m = a.poly(S.pts(hand([(S.X0 - 20, foot[0]), (S.X1 + 20, foot[0])], rng, amp=0.6, step=40, closed=False) +
                         [(S.X1 + 20, base + 4), (S.X0 - 20, base + 4)]))
        a.fade(m, foot[1], S.pt(0, foot[0]), S.pt(0, base))
        union = np.maximum(union, m)
    for pk in peaks:
        L = _light_at(P, pk[0])
        u = terraced_range(a, S, rng, [pk], base, P[key], P[key + '_sh'], P[key + '_rim'], light=L,
                           rim_k=rim_k, shade_k=shade_k)
        union = np.maximum(union, u)
        st(name, dense=dense)
    return union


def g_far(a, S, P, st, rng, dense=True):
    u = _range(a, S, P, rng, FAR, FAR_BASE, 'far', 0.4, 0.7, (FAR_FOOT, P['far_foot']), st, 'far_mountain', dense)
    st('far_mountains', dense=dense)
    return u


def g_near(a, S, P, st, rng, dense=True):
    u = _range(a, S, P, rng, NEAR, HZ + 1, 'near', 0.5, 0.85, None, st, 'near_hill', dense)
    # the low shore the pines stand on
    for pts, c in (([(S.X0 - 10, 628), (300, 626), (560, 630), (640, 641), (S.X0 - 10, 641)], P['near_sh'][0][1]),
                   ([(1470, 634), (1660, 630), (1840, 632), (1900, 641), (1440, 641)], P['near_sh'][1][1])):
        m = a.poly(S.pts(hand(pts, rng, amp=0.6)))
        a.spray(m, c, grain=0.8)
        u = np.maximum(u, m)
    st('shore', dense=dense)
    pm = np.zeros_like(u)
    for i, (x, top, w) in enumerate(PINES_L + PINES_R):
        right = i >= len(PINES_L)
        before = a.img.copy()
        deco_pine(a, S, rng, x + rng.uniform(-6, 6), HZ + rng.uniform(-1, 2) - (6 if right else 10),
                  HZ - top + rng.uniform(-8, 8), w * rng.uniform(0.85, 1.12), P['pine'], P['pine_sh'], P['trunk'],
                  light=_light_at(P, x), tiers=int(rng.integers(3, 5)) if right else None)
        pm = np.maximum(pm, (np.abs(a.img - before).max(-1) > 1e-4).astype(np.float32))
        if i % 2 == 1 or i == len(PINES_L + PINES_R) - 1:
            st('pine', dense=dense)
    st('near')
    return np.maximum(u, pm)


UPPER = (('sky', g_sky), ('clouds', g_clouds), ('far', g_far), ('near', g_near))


def _masks(a, S, P, seed, have):
    """silhouettes of the far and near ranges (for the reflections). Taken from this board if those groups
    were painted; otherwise each is painted silently on a scratch board, so water never depends on them."""
    out = {}
    for n, fn in (('far', g_far), ('near', g_near)):
        if n in have:
            out[n] = have[n]
            continue
        ref = Deco(a.W, a.H, seed=a.seed, s=a.s)
        ref.rng = group_rng(seed, n)
        out[n] = fn(ref, S, P, lambda *_, **__: None, group_rng(seed, n), dense=False)
    return out


def g_water(a, S, P, st, rng, masks):
    """graded water; the ranges mirrored as stepped stencil bands; the sun's path as stacked bars; long
    tapered speed lines (light ones clustering toward the sun's path, dark ones in the foreground); a few
    nests of chevron ripples"""
    hz = int(round(S.y(HZ)))
    m = np.zeros((a.H, a.W), np.float32)
    m[hz:] = 1
    a.fade(m, P['water'], S.pt(0, HZ), S.pt(0, S.Y1))
    st('water_fade', dense=True)
    reflect_bands(a, S, rng, masks['far'], HZ, 300, P['refl_far'], 0.75, compress=0.72, th0=2.2, th1=9,
                  gap0=1.4, gap1=5)
    st('reflection_far', dense=True)
    reflect_bands(a, S, rng, masks['near'], HZ, 330, P['refl_near'], 0.9, compress=0.62, th0=2.6, th1=12,
                  gap0=1.3, gap1=6)
    st('reflection_near', dense=True)
    sx = P['sun'][0]
    sun_path(a, S, rng, sx, HZ, S.Y1, 70, 460, P['path'], 0.85)
    st('sun_path', dense=True)
    near_sun = lambda x: 0.35 + 1.6 * np.exp(-((x - sx) / 330) ** 2)
    segs = speed_lines(rng, S.X0, S.X1, HZ + 6, S.Y1, 1.4, 5.0, 90, 420, 26, cover=0.3, x_pref=near_sun)
    lay_lines(a, S, rng, segs, P['line_light'], 0.55)
    st('speed_lines', dense=True)
    segs = speed_lines(rng, S.X0, S.X1, HZ + 200, S.Y1, 2.5, 7.0, 160, 520, 12, cover=0.35)
    lay_lines(a, S, rng, segs, P['line_dark'], 0.45)
    st('speed_lines_dark', dense=True)
    for x, y, n, sp, dp in ((560, 720, 3, 70, 7), (1590, 905, 4, 120, 12), (300, 975, 3, 150, 14)):
        chevrons(a, S, rng, x + rng.uniform(-20, 20), y + rng.uniform(-6, 6), n, sp, dp, 2.4 + (y - HZ) / 140,
                 P['chev'], 0.55, flip=1 if x < 960 else -1)
    st('water')


def g_mist(a, S, P, st, rng):
    haze(a, S, rng, S.X0, S.X1, 597, 18, P['mist'], 0.42 * P['mist_k'],
         xfade=lambda x: 0.55 + 0.45 * np.cos((x - 1240) / 700) ** 2, jag=3)
    st('mist_band', dense=True)
    haze(a, S, rng, S.X0, 1340, 652, 9, P['mist'], 0.28 * P['mist_k'],
         xfade=lambda x: 1 - smoothstep(350, 1340, x), jag=2)
    st('mist')


def _canoe(rng):
    """a streamlined canoe and a seated rower, all smooth curves (design px)"""
    bow, stern = (1268, 772), (1072, 776)
    hull = [stern] + bez(stern, (1170, 790), bow, 16)[1:] + bez(bow, (1236, 806), (1170, 806), 10)[1:] + \
        bez((1170, 806), (1100, 805), stern, 10)[1:-1]
    sheer = bez(stern, (1170, 790), bow, 16)
    sheer = sheer + [(x, y + 2.6 - 1.4 * abs(x - 1170) / 100) for x, y in sheer[::-1]]
    lean = rng.uniform(-1.5, 1.5)
    # a slim, elongated figure: narrow waist widening to square shoulders, a long neck, a small oval head
    # with sleek bobbed hair; the near arm reaching forward and down to the paddle
    body = bez((1160, 791), (1152, 770), (1154 + lean, 751), 9) + \
        bez((1154 + lean, 751), (1155 + lean, 743), (1166 + lean, 742), 6)[1:] + \
        bez((1166 + lean, 742), (1179 + lean, 742), (1180 + lean, 752), 6)[1:] + \
        bez((1180 + lean, 752), (1172, 770), (1176, 791), 9)[1:]
    neck = [(1162.5 + lean, 744), (1170.5 + lean, 744), (1171 + lean, 733), (1164 + lean, 733)]
    hx, hy = 1168.5 + lean, 727
    head = [(hx + 5.6 * np.cos(t) - 1.4 * np.sin(t), hy + 7.6 * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 22)]
    hat = bez((hx - 6.8, hy + 7), (hx - 9.5, hy - 9), (hx + 1, hy - 8.6), 9) + \
        bez((hx + 1, hy - 8.6), (hx + 7.4, hy - 7), (hx + 6.2, hy - 1), 6)[1:] + [(hx - 2, hy - 2.5), (hx - 3.5, hy + 6)]
    arm = bez((1176 + lean, 750), (1166, 770), (1141, 776.5), 9) + bez((1141, 779.5), (1168, 776), (1181 + lean, 758), 9)
    return hull, sheer, body, neck, head, hat, arm


def g_boat(a, S, P, st, rng):
    hull, sheer, body, neck, head, hat, arm = _canoe(rng)
    # the canoe's reflection as stepped bands (its own silhouette mirrored and cut into strips)
    sil = np.zeros((a.H, a.W), np.float32)
    for poly in (hull, body, neck, head, arm, hat):
        sil = np.maximum(sil, a.poly(S.pts(poly)))
    wl = 802
    rows = np.arange(a.H)
    y = wl + 2
    k = 0
    while y < wl + 52:
        th = rng.uniform(1.6, 3.2) * (1 + (y - wl) / 40)
        r0, r1 = int(S.y(y)), int(np.ceil(S.y(y + th)))
        if r1 > r0:
            src = np.clip(np.round(S.y(wl) - (rows[r0:r1] - S.y(wl)) / 0.7).astype(int), 0, a.H - 1)
            band = np.zeros_like(sil)
            dx = int(round(S(rng.normal(0, 2 + k))))
            band[r0:r1] = np.roll(sil[src], dx, 1)
            a.spray(band, P['refl_boat'], density=0.7 * (1 - (y - wl) / 70), grain=1.0)
        y += th + rng.uniform(1.5, 3.5) * (1 + (y - wl) / 50)
        k += 1
    st('boat_reflection', dense=True)
    # the wake: stepped chevrons opening behind the stern
    chevrons(a, S, rng, 1060, 800, 4, 110, 10, 2.6, P['chev'], 0.6, flip=-1, gap=14)
    st('wake', dense=True)
    hm = a.poly(S.pts(hull))
    sx = P['sun'][0]
    a.fade(hm, P['hull'], S.pt(1268 if sx > 1170 else 1072, 776), S.pt(1072 if sx > 1170 else 1268, 800))
    a.spray(a.poly(S.pts(sheer)), P['sheer'], density=0.9, grain=0.8)
    st('hull', dense=True)
    L = 1 if sx > 1165 else -1
    fig = np.maximum.reduce([a.poly(S.pts(p)) for p in (body, neck, head, hat, arm)])
    xs = [p[0] for p in body]
    lx = max(xs) if L > 0 else min(xs)
    a.fade(fig, [(0, P['rim']), (0.22, P['figure'][0][1]), (1, P['figure'][1][1])], S.pt(lx + 1 * L, 760),
           S.pt(lx - L * 30, 760), grain=0.8)
    # the near arm a shade lighter where it crosses the body, so the gesture reads
    am = a.poly(S.pts(arm))
    a.fade(am, [(0, P['rim']), (0.3, P['figure'][0][1]), (1, P['figure'][1][1])], S.pt(1180, 752), S.pt(1150, 780),
           grain=0.6)
    st('rower', dense=True)
    # the paddle: a long tapered shaft and a leaf blade
    shaft = [(1141, 773.5), (1143, 775), (1102, 806), (1100, 804.5)]
    blade = bez((1104, 803), (1098, 808), (1090, 817), 6) + bez((1090, 817), (1100, 814), (1106, 806), 6)
    a.spray(a.poly(S.pts(shaft)), P['oar'], grain=0.5)
    a.fade(a.poly(S.pts(blade)), [(0, P['oar']), (1, P['hull'][1][1])], S.pt(1104, 803), S.pt(1090, 817))
    st('boat')


def g_birds(a, S, P, st, rng):
    for bx, by, sz, lift, tilt in BIRDS:
        deco_bird(a, S, rng, bx, by, sz, lift, tilt, vary([(0, P['bird'])], rng.uniform(0.9, 1.15))[0][1])
        st('bird', dense=True)
    st('birds')


def g_reeds(a, S, P, st, rng):
    """stylised reeds: long smooth tapered blades sprayed dark at the root to lit at the tip, and a few
    cattails (a long rounded head on a hairline stem, lit down one side)"""
    x_lo = min(0.0, S.X0)
    n = int(round(16 * (310 - x_lo) / 310))
    bot = S.Y1 + 5
    blades = []
    for k in range(n):
        x = rng.uniform(x_lo, 310)
        top = rng.uniform(900, 975) - (310 - x) * 0.3 + (bot - 1085) * 0.5
        blades.append((x, top))
    blades.sort(key=lambda b: -b[1])
    for k, (x, top) in enumerate(blades):
        lean = rng.uniform(-14, 34)
        w = rng.uniform(4.0, 8.5)
        bend = rng.uniform(-0.3, 1.0) * lean
        ts = np.linspace(0, 1, 14)
        cxs = x + lean * ts ** 2 + bend * ts * (1 - ts)
        cys = bot + (top - bot) * ts
        hw = w * (1 - ts) ** 0.9
        pts = [(cx - h_, cy) for cx, cy, h_ in zip(cxs, cys, hw)] + \
              [(cx + h_, cy) for cx, cy, h_ in zip(cxs[::-1], cys[::-1], hw[::-1])]
        a.fade(a.poly(S.pts(pts)), vary(P['reed'], rng.uniform(0.85, 1.15)), S.pt(x, bot), S.pt(x + lean, top))
        if k % 4 == 3:
            st('reeds', dense=True)
    for k in range(3):
        x = rng.uniform(60, 260)
        top = rng.uniform(850, 905)
        hlen, hw = rng.uniform(40, 58), rng.uniform(5.5, 7.5)
        lean = rng.uniform(-8, 12)
        a.spray(a.bar(S.pt(x, bot), S.pt(x + lean, top - 18), S(1.6)), P['reed'][1][1], grain=0.4)
        cy = top + hlen * 0.5 + 6
        hx = x + lean * (1 - (cy - top) / (bot - top))
        head = [(hx + hw * np.cos(t), cy + hlen / 2 * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 24)]
        a.fade(a.poly(S.pts(head)), P['cattail'], S.pt(hx + hw, cy), S.pt(hx - hw, cy))
    st('reeds')


def paint(W=1920, H=1080, seed=1, colourway="Dusk", bleed=0.0, include=None, stages_dir=None,
          dense_stages=False):
    seed_all(seed)
    P = PAL[colourway]
    S = Scaler(W, H, bleed)
    a = Deco(S.W, S.H, seed=seed, s=S.s)
    st = Stager(a, stages_dir, dense_stages)
    inc = set(GROUPS) if include is None else set(include)
    have = {}
    for name in GROUPS:
        if name not in inc:
            continue
        rng = group_rng(seed, name)
        a.rng = group_rng(seed, name)
        if name == 'sky':
            g_sky(a, S, P, st, rng)
        elif name == 'clouds':
            g_clouds(a, S, P, st, rng)
        elif name == 'far':
            have['far'] = g_far(a, S, P, st, rng)
        elif name == 'near':
            have['near'] = g_near(a, S, P, st, rng)
        elif name == 'water':
            g_water(a, S, P, st, rng, _masks(a, S, P, seed, have))
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
