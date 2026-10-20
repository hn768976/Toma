"""Mountain lake at dusk — retro synthwave (Synthwave): one pinhole camera over a lake; a striped sun
setting behind two wireframe ranges, rim-lit conifer silhouettes, the sea() mirror torn into glowing bars,
a rowing boat, played back off tape. No chrome title, no VCR OSD."""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np
from PIL import ImageDraw

import drawkit
from drawkit import Scaler, seed_all, save_png
from synthwave import Synthwave, MAGENTA, CYAN, PINK, _c
from core import shift, smoothstep

STYLE = "Retro synthwave · 复古 Synthwave"
LIB = "synthwave"

WL = 640
PINES_L = [(40, 560, 30), (95, 515, 40), (150, 470, 48), (212, 430, 54), (272, 455, 50), (328, 495, 44),
           (384, 470, 46), (438, 520, 38), (486, 548, 32), (522, 566, 26)]
PINES_R = [(1520, 585, 20), (1566, 560, 26), (1612, 592, 18), (1706, 575, 24), (1766, 600, 17)]


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    sw = Synthwave(W, H, seed=seed, horizon=S(WL), vp_x=S(960), focal=1100 * s, eye=3.5, record=True)
    rng = np.random.default_rng(seed + 3)

    def silhouette(draw_fn, colour='#0a0314', rim='#ff6a8a', rim_dir=1, rim_px=2.0, ss=3, emit=0.8):
        """draw a black-violet silhouette (draw_fn(d, T) on a supersampled canvas covering the frame) with a
        thin sunset rim on the sun side, the way the lib's palms are lit"""
        im, d, (ox, oy), T = sw._canvas(0, 0, W, H, ss)
        draw_fn(d, lambda x, y: T(S(x), S(y)))
        A = sw._down(im, ss)
        sw._over(A, _c(colour), at=(ox, oy))
        if rim:
            k = max(1.2, rim_px * s)
            rimm = np.clip(A - shift(A, -rim_dir * k, k * 0.6), 0, 1) * A
            sw._over(rimm, _c(rim), emit=emit, at=(ox, oy))
        return A

    # ---- dusk sky: ink-violet zenith -> magenta -> coral -> peach at the waterline; a few stars up high
    sw.sky(stops=[(0.0, '#090624'), (0.28, '#1d1250'), (0.5, '#4a1a72'), (0.7, '#a03282'),
                  (0.86, '#ff6a7e'), (1.0, '#ffb08a')])
    sw.stars(n=int(700 * s * s) + 50, bright=8, y_max=S(300))
    sw.streaks([(S(205), S(-50), S(820), 7 * s), (S(250), S(380), S(1150), 5 * s), (S(160), S(1050), S(1980), 6 * s)])
    sw.stage('sky')

    # ---- the striped sun, low behind the highest peak (only its crown shows above the far range)
    sw.sun(S(1240), S(560), S(235), bands=8, band_top=0.34, level=0.35, gain=0.68)
    sw.stage('sun')

    # ---- far range: pale, hazy, low-contrast wireframe (peaks ~y 300-380, highest near x 1250)
    sw.mountains(-2600, 2600, 1500, 2600, 430, cell=(90 * 1.0, 150), fill='#3b1d5e', edge=('#b04ab8', '#7fd6ff'),
                 width=1.2 * s, level=0.45, haze=0.8, seed=seed * 7 + 1)
    sw.mountains(80, 760, 1350, 1900, 540, cell=(60, 110), fill='#3b1d5e', edge=('#b04ab8', '#8fe0ff'),
                 width=1.2 * s, level=0.5, haze=0.8, seed=seed * 7 + 2)
    sw.stage('far_mountains')

    # ---- near range: darker, lower, a big shoulder on the left dipping to the right
    sw.mountains(-560, -10, 480, 820, 105, cell=(26, 45), taper=(False, True), fill='#140626',
                 width=1.5 * s, level=0.9, haze=0.5, seed=seed * 7 + 3)
    sw.mountains(80, 480, 520, 760, 50, cell=(24, 40), taper=(True, True), fill='#140626',
                 width=1.5 * s, level=0.8, haze=0.5, seed=seed * 7 + 4)
    sw.stage('near_mountains')

    # ---- conifers on both shores, painted before the water so the sea mirror reflects them
    def pines(d, T):
        for (x, top, hw) in PINES_L + PINES_R:
            hgt = 652 - top
            for k in range(5):                                     # five stacked, slightly drooping tiers
                t0 = top + hgt * k * 0.16
                t1 = top + hgt * min(0.92, 0.24 + k * 0.17)
                half = hw * (0.35 + 0.65 * (k + 1) / 5)
                d.polygon([T(x, t0), T(x + half, t1), T(x + half * 0.55, t1 - 4), T(x - half * 0.55, t1 - 4), T(x - half, t1)], fill=255)
            d.rectangle([T(x - max(2, hw * 0.1), top + hgt * 0.8), T(x + max(2, hw * 0.1), 656)], fill=255)
        d.polygon([T(-20, 638), T(300, 634), T(560, 640), T(640, 652), T(-20, 656)], fill=255)       # left shore
        d.polygon([T(1440, 652), T(1520, 638), T(1960, 634), T(1960, 656)], fill=255)                 # right shore
    silhouette(pines, rim='#ff7a8a', rim_dir=1, rim_px=2.2)
    sw.stage('trees')

    # ---- the lake: everything above the horizon mirrored and torn into bars; faint cyan ripple lines
    sw.sea(coast=1e6, base='#0a0520', reflect=(0.4, 0.92), bar=(4.0, 0.9), sky=0.8, glitter=1.8,
           lines=0.12, line_colour=CYAN, seed=seed * 7 + 5)
    sw.stage('water')

    # ---- mist: a soft pink haze band lying on the water, heavier on the left
    Xd = sw.XX / s; Yd = sw.YY / s
    mist = np.exp(-((Yd - 650) / 34) ** 2) * (0.55 - 0.35 * smoothstep(200, 1500, Xd))
    mist *= 0.75 + 0.25 * np.sin(Xd / 140 + np.sin(Yd / 9))
    sw._over(np.clip(mist, 0, 0.6), _c('#ff9ab0'), emit=0.08)
    sw.stage('mist')

    # ---- rowing boat (Z ~ 24 m) with a seated figure, and its broken reflection
    def boat(d, T):
        d.polygon([T(1080, 778), T(1262, 774), T(1238, 801), T(1104, 802)], fill=255)
        d.ellipse([T(1160, 742), T(1184, 780)], fill=255)                      # body
        d.ellipse([T(1163, 722), T(1181, 740)], fill=255)                      # head
        d.line([T(1150, 768), T(1110, 812)], fill=255, width=max(1, int(4 * s * 3)))
        d.line([T(1192, 768), T(1232, 812)], fill=255, width=max(1, int(4 * s * 3)))
    # reflection first: a dim, bar-broken copy flipped about the boat's waterline
    im, d, (ox, oy), T = sw._canvas(0, 0, W, H, 3)
    boat(d, lambda x, y: T(S(x), S(y)))
    A0 = sw._down(im, 3)
    rows = np.clip(np.round(2 * S(802) - np.arange(H)).astype(int), 0, H - 1)
    R = A0[rows]
    bars = (np.sin(sw.YY / (3.2 * s)) > -0.3).astype(np.float32)
    sw._over(R * bars * 0.55 * (sw.YY > S(802)), _c('#06020e'))
    silhouette(boat, rim='#ff8a7a', rim_dir=1, rim_px=1.6)
    # a thin neon keel line where the hull meets the water (the lake's light catching it)
    km = np.clip(1.2 * s - np.abs(sw.YY - S(802)), 0, 1) * ((Xd > 1104) & (Xd < 1238))
    sw._over(km, _c(PINK), emit=0.9)
    sw.stage('boat')

    # ---- foreground reeds, lower-left: thin silhouettes rim-lit like the palms
    def reeds(d, T):
        for i in range(18):
            x = 12 + i * 16 + rng.uniform(-5, 5); top = 950 + rng.uniform(-30, 45); lean = rng.uniform(-28, 28)
            d.polygon([T(x - 4, 1090), T(x + lean, top), T(x + 4, 1090)], fill=255)
        for x, y in [(55, 962), (140, 982), (226, 1000)]:
            d.ellipse([T(x - 5, y), T(x + 5, y + 28)], fill=255)
    silhouette(reeds, rim='#ff5a9a', rim_dir=1, rim_px=1.5, emit=0.6)
    sw.stage('foreground')

    # ---- birds: small dark gull silhouettes in the upper-right sky
    def birds(d, T):
        for (bx, by, sc) in [(1385, 232, 1.0), (1462, 198, 0.85), (1540, 262, 0.9), (1615, 214, 0.7), (1680, 285, 0.6)]:
            w = max(1, int(3.2 * sc * s * 3))
            d.line([T(bx - 24 * sc, by - 9 * sc), T(bx - 10 * sc, by - 7 * sc), T(bx, by)], fill=255, width=w)
            d.line([T(bx, by), T(bx + 10 * sc, by - 7 * sc), T(bx + 24 * sc, by - 9 * sc)], fill=255, width=w)
    silhouette(birds, colour='#12062a', rim=None)
    sw.stage('birds')

    # ---- played back off tape (no OSD): pixel-sized artefacts scaled with the frame
    sw.vhs(bleed=3.5 * s, shift_px=3.0 * s, jitter=0.35 * s, pitch=3.0 * s, tracking=(0.83, 12 * s, 5.0 * s),
           head=int(round(12 * s)), dropouts=10, seed=seed * 7 + 9)
    img = sw.composite(final=True)
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, im_) in enumerate(sw.stages):
            save_png(im_, f"{stages_dir}/{i:02d}_{name}.png")
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'synthwave_lake.png'
    W = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
    H = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    st = sys.argv[4] if len(sys.argv) > 4 else None
    t0 = time.perf_counter()
    img = paint(W, H, seed=1, stages_dir=st)
    print(f"paint {time.perf_counter() - t0:.2f}s")
    save_png(img, out)
