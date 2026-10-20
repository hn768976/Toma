"""Mountain lake at dusk -- VHS home video (VHS 家庭录像).
One frame of a holiday tape: the camcorder pointed at the dusk lake from the shore, reeds right in front of the lens
out of focus. Scene -> camcorder -> tape, exactly as the library models it; chroma bleed, tracking noise, dropouts
and head-switching kept, but NO OSD (no REC, date, counter or battery)."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import numpy as np
import drawkit
from drawkit import Scaler, seed_all, save_png
from vhs import VHSCamcorder
from core import spline

STYLE = "VHS home video · VHS 家庭录像"
LIB = "vhs"

HZ = 640


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    v = VHSCamcorder(W, H, seed=seed, keep_stages=True)
    rng = np.random.default_rng(seed + 5)
    hz = S(HZ)
    P = S.pts

    # dusk light: warm low ambient, the sun just behind the far range
    v.ambient('#ffc39a', 0.62)
    v.light(S(1240), S(560), S(700), '#ffb070', 0.35)

    # ---- 1. sky: self-lit gradient, the glow round the sun
    sky = v.rect(0, 0, W, hz + S(4))
    top = v.lin((0, 0), '#2a2a5a', (0, S(330)), '#8a5a82')
    low = v.lin((0, S(330)), '#8a5a82', (0, hz), '#ffb084')
    v.paint(sky, '#000000')
    v.emit(sky, np.where((v.YY < S(330))[..., None], top, low), 0.95)
    v.emit(v.ellipse(S(1240), S(560), S(420), S(260)), v.rad(S(1240), S(560), S(420), S(260), '#ffe2a8', '#000000', 0.7),
           0.7)
    v.emit(v.ellipse(S(1240), S(560), S(46), S(46)), '#fff2d0', 1.6)
    v.stage('sky')

    # ---- 2. far range: hazy, lit from behind, aerial perspective as emitted haze
    far = [(-30, 420), (110, 362), (240, 405), (400, 335), (530, 390), (670, 350), (810, 400), (960, 326),
           (1090, 384), (1250, 296), (1410, 372), (1540, 342), (1670, 392), (1800, 350), (1950, 400),
           (1950, HZ + 4), (-30, HZ + 4)]
    fm = v.poly(P(far))
    v.paint(fm, v.lin((0, S(300)), '#6a4a6e', (0, hz), '#7a5068'), form=0.15, form_r=S(30))
    v.emit(fm, v.lin((0, S(300)), '#3a2442', (0, hz), '#6a3a50'), 0.4)
    v.rim(fm, (S(1240), S(200)), '#ffc890', 0.3, S(4))
    v.stage('far_mountains')

    # ---- 3. near range: darker, left-heavy
    near = [(-30, 470), (140, 436), (300, 456), (470, 428), (640, 466), (800, 452), (950, 516), (1080, 556),
            (1230, 543), (1380, 584), (1560, 560), (1720, 598), (1950, 588), (1950, HZ + 4), (-30, HZ + 4)]
    nm = v.poly(P(near))
    v.paint(nm, v.lin((0, S(430)), '#3a3048', (0, hz), '#2a2434'), form=0.25, form_r=S(40))
    v.emit(nm, '#3a2030', 0.25)
    v.rim(nm, (S(1240), S(300)), '#ffb070', 0.25, S(5))
    v.stage('near_mountains')

    # ---- 4. pines on the shores
    def pine(x, root, h, w):
        pts = [(x, root - h)]
        n = 5
        for i in range(1, n + 1):
            y = root - h + h * 0.85 * i / n
            hw = w / 2 * (0.3 + 0.7 * i / n)
            pts += [(x + hw, y), (x + hw * 0.45, y - h * 0.04)]
        pts = pts + [(x + w * 0.05, root), (x - w * 0.05, root)] + [(2 * x - a, b) for a, b in pts[1:][::-1]]
        m = v.poly(P(pts))
        v.paint(m, '#1a2420', form=0.3, form_r=S(8))
        v.emit(m, '#100c14', 0.2)
        return m

    pines = [(80, 470, 70), (150, 430, 82), (230, 452, 76), (300, 418, 90), (370, 470, 76), (440, 505, 62),
             (500, 540, 50), (40, 525, 56), (270, 522, 60), (190, 536, 54),
             (1520, 575, 36), (1580, 558, 42), (1650, 585, 32), (1740, 568, 38), (1790, 592, 28)]
    for x, top_, w in pines:
        pm = pine(x, HZ + 6, HZ + 6 - top_, w)
        v.rim(pm, (S(1240), S(560)), '#ffa060', 0.18, S(3))
    v.paint(v.poly(P([(-10, 634), (560, 634), (600, 644), (520, 652), (-10, 654)])), '#1a1418')
    v.paint(v.poly(P([(1490, 637), (1830, 637), (1860, 645), (1480, 646)])), '#1a1418')
    v.stage('trees')

    # ---- 5. water: dark albedo, the lit scene above mirrored into it as emitted light, broken by ripples
    above = v._lit()                                        # what the lens sees above the waterline so far
    rows = np.arange(H)
    src = np.clip(2 * hz - rows, 0, H - 1).astype(int)
    depth = np.clip((rows - hz) / (H - hz), 0, 1).astype(np.float32)
    off = (np.sin(rows / S(3.1)) * S(5) + rng.normal(0, 1, H) * S(2)) * (0.3 + 2.5 * depth)
    xs = np.clip((np.arange(W)[None, :] + off[:, None]).astype(int), 0, W - 1)
    mir = np.take_along_axis(above[src], xs[..., None].repeat(3, 2), axis=1)
    water = v.rect(0, hz, W, H)
    v.paint(water, '#0c1018')
    fade = (0.75 - 0.45 * depth)[:, None, None]
    v.emit(water, mir * fade * np.array([0.9, 0.92, 1.0], np.float32), 1.0)
    for i in range(40):                                     # sparkle on ripple crests in the sun's path
        y = HZ + 12 + (i / 39) ** 1.6 * 420
        cx = 1240 + rng.normal(0, 40 + (y - HZ) * 0.4)
        ln = 20 + (y - HZ) * 0.25 * rng.uniform(0.5, 1.5)
        v.emit(v.line(P([(cx - ln / 2, y), (cx + ln / 2, y)]), S(1.5 + (y - HZ) / 160)), '#ffd6a0',
               0.5 * (1 - 0.6 * (y - HZ) / 440))
    v.stage('water')

    # ---- 6. the boat with a rower, and its reflection
    hull = P([(1080, 784), (1100, 803), (1240, 803), (1262, 782), (1170, 787)])
    hm = v.shape(hull, per=6)
    rm = v.shape([(x, 2 * S(800) - y) for x, y in hull], per=6)
    v.paint(rm, '#0a0c12', alpha=0.85)
    v.paint(hm, '#6a3a24', form=0.4, form_r=S(5))
    v.paint(v.line(P([(1084, 784), (1170, 788), (1258, 782)]), S(2.5)), '#c08050')
    body = v.shape(P([(1150, 786), (1148, 760), (1156, 748), (1170, 748), (1176, 762), (1176, 786)]), per=6)
    v.paint(body, '#2a3a5a', form=0.4, form_r=S(5))
    v.paint(v.ellipse(S(1163), S(740), S(8), S(9)), '#c08a6a', form=0.4, form_r=S(4))
    v.paint(v.ellipse(S(1162), S(733), S(9), S(5)), '#3a2a20')
    v.paint(v.line(P([(1120, 812), (1170, 770), (1205, 762)]), S(3)), '#4a3020')
    v.rim(np.clip(hm + body, 0, 1), (S(1240), S(560)), '#ffb070', 0.35, S(2))
    v.paint(v.shape([(x, 2 * S(786) - y) for x, y in P([(1150, 786), (1148, 760), (1170, 748), (1176, 786)])]),
            '#0a0c14', alpha=0.6)
    v.stage('boat')

    # ---- 7. birds against the bright sky
    for bx, by, sz in [(1380, 260, 26), (1450, 225, 20), (1530, 285, 22), (1600, 200, 17), (1665, 250, 15)]:
        m = v.line(P(spline([(bx - sz, by - sz * 0.15), (bx - sz * 0.5, by - sz * 0.42), (bx, by),
                             (bx + sz * 0.5, by - sz * 0.42), (bx + sz, by - sz * 0.15)], 6)), S(2.6))
        v.paint(m, '#1a1420')
    v.stage('birds')

    # ---- 8. mist over the water: a soft emitted band, thicker at the left
    yy, xx = v.YY / S.s, v.XX / S.s
    band = (np.exp(-((yy - 650) / 32.0) ** 2) * (0.85 - 0.6 * np.clip((xx - 150) / 1550, 0, 1))).astype(np.float32)
    v.paint(band, '#c8a0a0', alpha=0.55)
    v.emit(band, '#ffc8b0', 0.35)
    v.stage('mist')

    # ---- 9. reeds right in front of the lens: out of focus
    with v.layer(defocus=S(5)):
        for i in range(16):
            bx = rng.uniform(-20, 300)
            top_ = rng.uniform(860, 950) - (300 - bx) * 0.25
            lean = rng.uniform(-30, 40)
            rm_ = v.line(P(spline([(bx, 1100), (bx + lean * 0.35, (1100 + top_) / 2), (bx + lean, top_)], 6)),
                         S(rng.uniform(6, 10)))
            v.paint(rm_, '#2a3020')
            v.rim(rm_, (S(1240), S(560)), '#ffb070', 0.5, S(3))
    v.stage('reeds')

    # ---- 10. camcorder, tape, playback wear -- and no OSD at all
    v.camera(tilt=-1.2, white_balance=(1.02, 0.97, 0.92), exposure=1.05, knee=0.74, lag=(S(-20), 0, 0.25),
             soft=S(1.2), bloom=0.45)
    v.stage('camera')
    v.record()
    v.stage('tape')
    v.wear(tracking=(0.93, 0.03), dropouts=16)
    v.stage('wear')

    img = v.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im) in enumerate(v.stages):
            im.save(os.path.join(stages_dir, f'{i:02d}_{name}.png'))
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'vhs_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H), out)
