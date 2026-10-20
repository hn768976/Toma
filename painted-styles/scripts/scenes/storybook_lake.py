"""Mountain lake at dusk in the picture-book animation look: warm paper, gouache washes with darker dried edges,
thin navy fine-liner contours, crayon dashes, a popped-in sun with crayon rays. The scene is built as timed layers
(the library's native model), so stage() keyframes show it being painted in; the final image is the last frame.
No character, no journey poster, no handwriting."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png

from storybook import Storybook, WHITE, INK
from core import spline

STYLE = "Storybook animation · 绘本角色动画"
LIB = "storybook"

WL = 640.0
T_END = 8.0


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)            # Storybook takes design coordinates itself; S is only used for checks
    sb = Storybook(W, H, seed=seed)
    g = np.random.default_rng(seed + 303)
    steps = []                  # (stage name, time it is complete)

    # ------------------------------------------------------------------ sky: overlapping dusk washes, top to horizon
    bands = [(-20, WL + 10, '#b4b6e4', 0.97), (130, WL + 10, '#d9bde0', 0.6), (230, WL + 10, '#f2bfc0', 0.6),
             (300, WL + 10, '#f8d4b0', 0.65)]
    for i, (y0, y1, col, op) in enumerate(bands):
        top = [(x, y0 + 14 * np.sin(x / 260 + i)) for x in np.linspace(-40, 1960, 9)]
        poly = top + [(1960, y1), (-40, y1)]
        sb.wash(poly, col, z=1 + i * 0.1, when=(0.0 + i * 0.2, 0.3 + i * 0.2), reveal='x', light=0.06, edge=0.25,
                opacity=op, wobble=3.0, smooth=False, name='sky')
    steps.append(('sky', 1.0))
    sb.sun(1090, 262, 58, when=(1.0, 1.5), z=2.0, rays=12, colour='#f5c548', ray_colour='#ee9a4a')
    steps.append(('sun', 1.5))

    # ------------------------------------------------------------------ mountains
    far = [(-40, 392), (140, 360), (300, 338), (450, 372), (620, 330), (790, 362), (950, 344), (1100, 316),
           (1250, 296), (1390, 332), (1540, 318), (1700, 362), (1840, 344), (1960, 378)]
    sb.hill(far, '#c6b9e3', bottom=WL + 6, z=3, when=(1.5, 2.2), outline='#7d7f9e', line=2.4, name='far')
    steps.append(('far_mountains', 2.2))
    near = [(-40, 472), (110, 440), (300, 454), (480, 430), (680, 448), (880, 488), (1040, 526), (1200, 558),
            (1340, 552), (1480, 586), (1640, 574), (1800, 604), (1960, 614)]
    sb.land(near, '#8fa7cf', bottom=WL + 6, z=4, when=(2.2, 3.0), dashes=40, dash_colour='#7189b8', name='near')
    sb.ink(near, 3.4, INK, z=4.5, when=(2.2, 3.0), taper=(0.02, 0.05), tremor=0.5, name='near_line')
    steps.append(('near_mountains', 3.0))

    # ------------------------------------------------------------------ water + reflections
    sb.water(-40, 1960, WL, depth=480, when=(3.0, 3.8), z=6, colour='#9db7dc')
    def flip(pts, squash=0.8):
        return [(x, WL + (WL - y) * squash) for x, y in pts]
    rf = flip(far) + [(1960, WL + 4), (-40, WL + 4)]
    sb.wash(rf, '#c9bfe2', z=6.4, when=(3.8, 4.2), reveal='x', light=-0.1, edge=0.2,
            opacity=0.45, wobble=4.0, smooth=False, name='far_reflection')
    rn = flip(near) + [(1960, WL + 4), (-40, WL + 4)]
    sb.wash(rn, '#7f97c4', z=6.5, when=(3.8, 4.2), reveal='x', light=-0.1, edge=0.2, opacity=0.5, wobble=4.0,
            smooth=False, name='near_reflection')
    # a warm glint under the sun and ripple strokes
    sb.inks([[(1090 - L / 2 + g.normal(0, 8), y), (1090 + L / 2 + g.normal(0, 8), y + 1)]
             for y, L in [(668, 140), (690, 104), (716, 76), (746, 50)]], 5.0, '#f8d4a0', z=6.8, when=(4.0, 4.3),
            taper=(0.3, 0.3), tremor=0.3, name='glint')
    rip = []
    for k in range(18):
        y = WL + 40 + (k / 18) ** 1.3 * 390 + g.normal(0, 5)
        x = g.uniform(0, 1800); L = g.uniform(50, 140) * (0.7 + (y - WL) / 440)
        if abs(y - 820) < 40 and x < 1300 and x + L > 1050: continue
        rip.append([(x, y), (x + L / 2, y + 3), (x + L, y)])
    sb.inks(rip, 3.0, '#4a6fa0', z=6.9, when=(4.2, 4.5), taper=(0.2, 0.3), tremor=0.4, name='ripples')
    steps.append(('water', 4.5))

    # ------------------------------------------------------------------ pines: wash shapes with fine-liner outlines
    PINES = [(70, 652, 200, 42), (140, 656, 236, 48), (215, 650, 182, 38), (285, 656, 214, 44), (352, 652, 160, 34),
             (412, 655, 140, 30), (470, 650, 112, 25), (522, 652, 92, 21),
             (1510, 646, 80, 18), (1572, 648, 110, 23), (1642, 645, 72, 16), (1752, 647, 94, 20)]

    def pine_poly(x, y0, h, hw, flip_=1.0):
        tiers = 4 if h > 120 else 3
        L, R = [], []
        top = y0 - flip_ * h
        for k in range(tiers):
            t = (k + 1) / tiers
            yy = top + (y0 - top) * (0.06 + 0.84 * t)
            w = hw * (0.25 + 0.75 * t)
            yi = yy - flip_ * h * 0.06
            R += [(x + w, yy), (x + w * 0.45, yi)] if k < tiers - 1 else [(x + w, yy)]
            L += [(x - w, yy), (x - w * 0.45, yi)] if k < tiers - 1 else [(x - w, yy)]
        return [(x, top)] + R + L[::-1]

    t0 = 4.5
    for i, (x, y0, h, hw) in enumerate(PINES):
        ref = pine_poly(x, WL + (WL - y0) + 10, h * 0.8, hw, -1.0)
        sb.shape([np.array(ref)], '#5f8a8a', None, 0, z=6.6, when=(t0, t0 + 0.3), pop=(x, WL + 10), light=0.0,
                 name='pine_reflection')
    for i, (x, y0, h, hw) in enumerate(PINES):
        tt = t0 + i * 0.06
        sb.ink([(x, y0 + 6), (x, y0 - h * 0.3)], 6.0, '#5a3a2a', z=9.9, when=(tt, tt + 0.2), taper=(0, 0.3))
        sb.shape([np.array(pine_poly(x, y0 - 6, h - 6, hw))], ['#3f7a5c', '#4a8a63', '#356d55'][i % 3], INK, 2.6,
                 z=10 + i * 0.01, when=(tt, tt + 0.3), pop=(x, y0), dark='#2a5444', light=0.12, name='pine')
    sb.ground([(-40, WL + 2), (300, WL + 4), (620, WL + 1), (900, WL + 3), (1300, WL + 1), (1960, WL + 3)],
              width=3.2, z=9.5, when=(5.0, 5.5), ticks=False, name='waterline')
    steps.append(('trees', 5.5))

    # ------------------------------------------------------------------ boat and rower
    BX, BY, BL = 1170.0, 800.0, 180.0
    hull = [(BX - BL / 2, BY - 24), (BX + BL / 2, BY - 28), (BX + BL / 2 - 30, BY + 6), (BX - BL / 2 + 26, BY + 6)]
    hull_ref = [(x, 2 * BY - y + 6) for x, y in hull]
    sb.shape([np.array(hull_ref)], '#7a86b4', None, 0, z=7.0, when=(5.5, 5.7), pop=(BX, BY), light=0.0,
             name='boat_reflection')
    sb.shape([np.array(hull)], '#c9773f', INK, 2.8, z=30, when=(5.5, 5.8), pop=(BX, BY), dark='#8a4a26',
             name='hull')
    sb.shape([np.array([(BX - BL / 2 - 2, BY - 30), (BX + BL / 2 + 2, BY - 34), (BX + BL / 2, BY - 24),
                        (BX - BL / 2, BY - 22)])], '#e8a466', INK, 2.2, z=30.5, when=(5.6, 5.85), pop=(BX, BY),
             name='gunwale')
    body = [(BX - 30, BY - 26), (BX - 26, BY - 64), (BX - 12, BY - 74), (BX + 2, BY - 64), (BX + 4, BY - 26)]
    sb.shape([np.array(body)], '#e25b4f', INK, 2.4, z=29.5, when=(5.7, 5.95), pop=(BX - 12, BY - 30), name='rower')
    head = [(BX - 12 + 14 * np.cos(a), BY - 90 + 14 * np.sin(a)) for a in np.linspace(0, 2 * np.pi, 30,
                                                                                         endpoint=False)]
    sb.shape([np.array(head)], '#f2c8a0', INK, 2.4, z=29.6, when=(5.75, 6.0), pop=(BX - 12, BY - 90), name='head')
    sb.ink([(BX - 2, BY - 56), (BX + 50, BY - 30), (BX + 96, BY + 10)], 4.0, '#6a4228', z=31, when=(5.8, 6.0),
           taper=(0.05, 0.05), name='oar')
    steps.append(('boat', 6.0))

    # ------------------------------------------------------------------ birds
    birds = []
    for (bx, by, sz) in [(1380, 250, 22), (1450, 210, 17), (1530, 268, 24), (1612, 196, 15), (1682, 240, 19)]:
        birds.append([(bx - sz, by - sz * 0.3), (bx - sz * 0.45, by - sz * 0.5), (bx, by)])
        birds.append([(bx, by), (bx + sz * 0.5, by - sz * 0.52), (bx + sz * 1.05, by - sz * 0.3)])
    sb.inks(birds, 3.4, INK, z=8, when=(6.0, 6.4), taper=(0.1, 0.3), tremor=0.3, name='birds')
    steps.append(('birds', 6.4))

    # ------------------------------------------------------------------ mist: thin white washes over the waterline
    for (x0, x1, yc, hh, op) in [(-60, 900, 642, 22, 0.32), (-60, 560, 668, 16, 0.28), (1350, 1960, 634, 12, 0.22),
                                 (-60, 420, 614, 14, 0.25)]:
        xs = np.linspace(x0, x1, 12)
        top = [(x, yc - hh * (0.6 + 0.4 * np.sin(x / 120))) for x in xs]
        bot = [(x, yc + hh * (0.6 + 0.4 * np.cos(x / 150))) for x in xs[::-1]]
        sb.wash(top + bot, WHITE, z=12, when=(6.4, 7.0), reveal='x', light=0.0, edge=0.0, opacity=op, wobble=5.0,
                name='mist')
    steps.append(('mist', 7.0))

    # ------------------------------------------------------------------ foreground reeds (cattails and tufts)
    for k, x in enumerate([30, 78, 130, 176, 232]):
        sb.cattail(x, 1095, 150 + 40 * np.sin(k * 1.7) - x * 0.2, when=(7.0 + k * 0.08, 7.4 + k * 0.08),
                   lean=0.06 * np.sin(k * 2.3), z=40)
    for x in (12, 100, 156, 210, 270):
        sb.tuft(x, 1084, h=42, when=(7.4, 7.6), z=41)
    steps.append(('reeds', T_END))

    for name, t in steps:
        if stages_dir:
            sb.stage(name, t)
    img = sb.frame(T_END)
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(sb.stages):
            save_png(im, os.path.join(stages_dir, f"{i:02d}_{name}.png"))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'storybook_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H, stages_dir=os.environ.get('STAGES')), out)
