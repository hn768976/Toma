"""Mountain lake at dusk in the Pastel UI language: a full-bleed pastel gradient field with soft white light
blooms and bokeh, flat rounded shapes with CSS-style tinted drop shadows, capsule ripples. No windows, cards,
text or companions -- only the field, shapes and shadows of the kit."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import numpy as np

import drawkit
from drawkit import Scaler, seed_all, save_png

from pastelui import PastelUI, _cov, sdf_rrect
from core import spline

STYLE = "Pastel UI · 粉彩界面"
LIB = "pastelui"

WL = 640.0


def paint(W=1920, H=1080, seed=1, stages_dir=None):
    seed_all(seed)
    S = Scaler(W, H)
    s = S.s
    ui = PastelUI(W, H, seed=seed, keep_stages=stages_dir is not None)
    g = np.random.default_rng(seed + 202)
    wl = S(WL)

    # ------------------------------------------------------------------ sky: gradient field, sun bloom, bokeh
    ui.field('peach', glow=S.pt(640, 160), glow_size=S.pt(1200, 760), glow_alpha=0.0, bokeh=())
    ui.rrect(0, 0, W, wl + S(4), 0, grad=[(0.0, '#bfc4f4'), (0.35, '#dcc8f2'), (0.68, '#ffd2dc'), (1.0, '#ffe3c8')],
             angle=180)
    sun = S.pt(1240, 545)

    def bloom(cx, cy, rx, ry, alpha, colour='#ffffff'):
        """a soft pool of light: an elliptical radial falloff, like field()'s glow"""
        g_ = ui._grid(cx - rx, cy - ry, cx + rx, cy + ry)
        if not g_: return
        sl, X, Y = g_
        t = np.hypot((X - cx) / rx, (Y - cy) / ry)
        ui._over(sl, alpha * np.clip(1 - t, 0, 1) ** 1.6, colour)

    bloom(sun[0], sun[1], S(900), S(520), 0.55, '#fff4e0')
    bloom(sun[0], sun[1], S(380), S(260), 0.65, '#ffffff')
    sx, sy = S(1090), S(300)
    bloom(sx, sy, S(260), S(220), 0.5, '#ffffff')
    ui.circle(sx, sy, S(62), grad=('#fff8e2', '#ffcfa6'), angle=180)
    ui.circle(sx, sy, S(62) + S(22), '#ffffff', 0.3, ring=S(9))
    for (fx, fy, r, al) in [(0.08, 0.10, 46, 0.35), (0.23, 0.22, 22, 0.5), (0.42, 0.07, 30, 0.35), (0.66, 0.06, 16, 0.55),
                            (0.92, 0.08, 52, 0.3), (0.80, 0.33, 20, 0.45), (0.33, 0.36, 12, 0.5)]:
        ui.circle(fx * W, fy * H, S(r), '#ffffff', al)
    ui.stage('sky')

    # ------------------------------------------------------------------ helpers
    YY = np.arange(H, dtype=np.float32)[:, None] + 0.5

    def ridge(peaks):
        P = spline(peaks, 18)
        P[:, 1] = np.minimum(P[:, 1], WL)
        return P

    def shape_mask(pts):
        """coverage of a polygon on the whole canvas (for shaped shadows / mirrored copies)"""
        from PIL import Image, ImageDraw
        ss = 2
        im = Image.new('L', (W * ss, H * ss), 0)
        ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in np.asarray(pts).tolist()], fill=255)
        return np.asarray(im.resize((W, H), Image.BOX), np.float32) / 255

    def lookup(M):
        def f(X, Y):
            xi = np.clip((X - 0.5).astype(int), 0, W - 1); yi = np.clip((Y - 0.5).astype(int), 0, H - 1)
            return M[yi, xi]
        return f

    def flat_shadow(M, dy, blur_px, colour, alpha):
        ys, xs = np.nonzero(M > 0.02)
        ui.soft_shadow(lookup(M), (xs.min(), ys.min(), xs.max(), ys.max()), 0, dy, blur_px, colour, alpha)

    def fill_mask(M, colour, alpha=1.0, grad=None):
        ys, xs = np.nonzero(M > 0.002)
        sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
        if grad is not None:
            y0, y1, c0, c1 = grad
            t = np.clip((np.arange(sl[0].start, sl[0].stop)[:, None] + 0.5 - y0) / (y1 - y0), 0, 1)
            col = (1 - t)[..., None] * np.array(c0, np.float32) + t[..., None] * np.array(c1, np.float32)
            col = np.broadcast_to(col, (sl[0].stop - sl[0].start, sl[1].stop - sl[1].start, 3)).copy()
            ui._over(sl, M[sl] * alpha, col)
        else:
            ui._over(sl, M[sl] * alpha, colour)

    def hx(h):
        h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def mirror(M, squash=0.9):
        out = np.zeros_like(M)
        rows = np.arange(H)
        src = wl - (rows - wl) / squash
        ok = (rows >= wl) & (src >= 0)
        out[rows[ok]] = M[np.clip(src[ok].astype(int), 0, H - 1)]
        return out

    # ------------------------------------------------------------------ mountains: two flat rounded layers
    far = ridge([(-40, 400), (120, 362), (300, 340), (440, 372), (620, 330), (800, 360), (960, 342), (1100, 312),
                 (1250, 292), (1400, 330), (1540, 318), (1700, 360), (1840, 342), (1980, 380)])
    far_poly = np.vstack([S.pts(far), [(W + S(40), wl + 1), (-S(40), wl + 1)]])
    far_m = shape_mask(far_poly)
    flat_shadow(far_m, S(-4), S(40), '#8a6ccf', 0.18)
    fill_mask(far_m, None, 1.0, (S(290), wl, hx('#d9cdf6'), hx('#f2d8ee')))
    ui.stage('far_mountains')

    near = ridge([(-40, 470), (120, 440), (300, 452), (480, 428), (680, 446), (880, 488), (1040, 528), (1200, 560),
                  (1340, 552), (1480, 586), (1640, 574), (1800, 606), (1980, 616)])
    near_poly = np.vstack([S.pts(near), [(W + S(40), wl + 1), (-S(40), wl + 1)]])
    near_m = shape_mask(near_poly)
    flat_shadow(near_m, S(-6), S(36), '#5a4aa8', 0.22)
    fill_mask(near_m, None, 1.0, (S(430), wl, hx('#a99ee6'), hx('#c9b6ea')))
    # a flat lit facet on the left shoulder (one lighter rounded plane, UI-style two-tone)
    facet = ridge([(-40, 470), (120, 440), (300, 452), (480, 428), (560, 434)])
    facet_poly = np.vstack([S.pts(facet), S.pts([(470, 520), (260, 560), (60, 600), (-40, 610)])])
    fill_mask(shape_mask(facet_poly), '#bdb3ee', 0.7)
    ui.stage('near_mountains')

    # ------------------------------------------------------------------ water: gradient field, reflections, capsules
    ui.rrect(0, wl, W, H, 0, grad=[(0.0, '#f6d6e4'), (0.35, '#c9c6f2'), (1.0, '#8d8fdc')], angle=180)
    bloom(sun[0], wl + S(120), S(420), S(260), 0.45, '#fff2e6')
    fade = np.clip(1 - (YY - wl) / S(330), 0, 1) ** 1.2
    fill_mask(mirror(np.clip(far_m - near_m, 0, 1)) * fade, '#e6d6f4', 0.45)
    fill_mask(mirror(near_m) * fade, '#9e94e0', 0.5)
    ui.stage('water')

    # ------------------------------------------------------------------ pines: rounded flat triangles with soft shadows
    PINES = [(70, 652, 200, 42), (140, 656, 238, 48), (215, 650, 182, 38), (285, 656, 215, 44), (352, 652, 160, 34),
             (412, 655, 140, 30), (470, 650, 112, 25), (522, 652, 92, 21),
             (1510, 646, 80, 18), (1572, 648, 110, 23), (1642, 645, 72, 16), (1752, 647, 94, 20)]
    rad = S(9)

    def pine(x, y0, h, hw, col, alpha=1.0, flip=1.0):
        tiers = 3 if h > 120 else 2
        for k in range(tiers):
            t0 = k / tiers; t1 = (k + 1.25) / tiers
            top = y0 - flip * h * (1 - t0 * 0.78)
            bot = y0 - flip * h * (1 - min(1.0, t1) * 0.82)
            w = hw * (0.55 + 0.45 * (k + 1) / tiers)
            tri = S.pts([(x, top + flip * 6), (x + w, bot), (x - w, bot)])
            ui.poly(tri, col, alpha)
            ui.line(tri + [tri[0]], rad * 2 * 0.6, col, alpha)
        ui.rrect(S(x - hw * 0.1), S(min(y0, y0 - flip * h * 0.18)), S(x + hw * 0.1), S(max(y0, y0 - flip * h * 0.18)),
                 S(3), '#7b5ea8', alpha)

    pref = [(x, 2 * WL - y0 + 8, h * 0.9, hw) for (x, y0, h, hw) in PINES]
    for (x, y0, h, hw) in pref:
        pine(x, y0, h, hw, '#8088d0', 0.3, -1.0)
    for (x, y0, h, hw) in PINES:
        ui.shadow(S(x - hw * 0.7), S(y0 - 6), S(x + hw * 0.7), S(y0 + 2), S(6), 0, S(6), S(18), 0, '#4a3a90', 0.25)
    for i, (x, y0, h, hw) in enumerate(PINES):
        col = ['#5f69c4', '#6872cc', '#5560b8'][i % 3]
        pine(x, y0, h, hw, col)
        # a light rim on the sun side (right), the UI's gloss highlight
        ui.line(S.pts([(x + 3, y0 - h + 14), (x + hw * 0.55, y0 - h * 0.45)]), S(4), '#ffffff', 0.25)
    ui.stage('trees')

    # ------------------------------------------------------------------ boat: rounded hull, round-headed rower
    BX, BY, BL = 1170.0, 800.0, 180.0
    ui.rrect(S(BX - BL / 2 + 10), S(BY + 14), S(BX + BL / 2 - 10), S(BY + 40), S(13), '#6f6ac8', 0.35)   # reflection
    ui.rrect(S(BX - 16), S(BY + 40), S(BX + 6), S(BY + 70), S(10), '#6f6ac8', 0.18)
    ui.shadow(S(BX - BL / 2), S(BY - 22), S(BX + BL / 2), S(BY + 8), S(16), 0, S(10), S(26), -S(6), '#3c2c86', 0.30)
    hull = S.pts([(BX - BL / 2, BY - 24), (BX + BL / 2, BY - 24), (BX + BL / 2 - 26, BY + 6), (BX - BL / 2 + 26, BY + 6)])
    ui.poly(hull, '#d97757')
    ui.line(hull + [hull[0]], S(10), '#d97757')
    ui.rrect(S(BX - BL / 2 - 4), S(BY - 30), S(BX + BL / 2 + 4), S(BY - 20), S(5), '#f0a27f')
    ui.rrect(S(BX - 26), S(BY - 74), S(BX + 2), S(BY - 28), S(13), '#5560b8')                      # rower
    ui.circle(S(BX - 12), S(BY - 88), S(13), '#ffd6c0')
    ui.line(S.pts([(BX - 4, BY - 54), (BX + 50, BY - 22), (BX + 88, BY + 6)]), S(5), '#7b5ea8')
    ui.rrect(S(BX + 78), S(BY - 2), S(BX + 100), S(BY + 14), S(6), '#7b5ea8')
    ui.stage('boat')

    # ------------------------------------------------------------------ ripples: white capsules, fading down
    for k in range(26):
        y = WL + 26 + (k / 26) ** 1.3 * 400 + g.normal(0, 5)
        x = g.uniform(-40, 1860); L = g.uniform(60, 220) * (0.6 + (y - WL) / 440)
        if abs(y - (BY + 25)) < 40 and x < BX + 120 and x + L > BX - 120: continue
        hgt = S(5 + 4 * (y - WL) / 440)
        ui.rrect(S(x), S(y) - hgt / 2, S(x + L), S(y) + hgt / 2, hgt / 2, '#ffffff', 0.38 - 0.18 * (y - WL) / 440)
    ui.stage('ripples')

    # ------------------------------------------------------------------ birds: round-capped strokes
    for (bx, by, sz) in [(1380, 250, 22), (1450, 210, 17), (1530, 268, 24), (1612, 196, 15), (1682, 240, 19)]:
        P = S.pts([(bx - sz, by - sz * 0.35), (bx - sz * 0.45, by - sz * 0.48), (bx, by),
                   (bx + sz * 0.5, by - sz * 0.5), (bx + sz * 1.05, by - sz * 0.32)])
        ui.line(spline(P, 6), S(4.5), '#5a4f9e')
    ui.stage('birds')

    # ------------------------------------------------------------------ mist: soft white blooms along the water
    for (cx, cy, rx, ry, al) in [(240, 650, 520, 70, 0.75), (620, 662, 460, 52, 0.6), (980, 640, 420, 40, 0.45),
                                 (1500, 652, 380, 36, 0.4), (60, 690, 300, 60, 0.6)]:
        bloom(S(cx), S(cy), S(rx), S(ry), al)
    ui.stage('mist')

    # ------------------------------------------------------------------ foreground reeds: capsules
    for k in range(18):
        x = g.uniform(10, 290); h = g.uniform(90, 180) * (1 - x / 460); lean = g.normal(8, 8)
        col = ['#6a63c4', '#7d74d0', '#8a6ccf'][k % 3]
        ui.line(spline(S.pts([(x, 1090), (x + lean * 0.4, 1090 - h * 0.55), (x + lean, 1090 - h)]), 6), S(6), col, 0.9)
        if k % 3 == 0:
            ui.rrect(S(x + lean - 7), S(1090 - h - 34), S(x + lean + 7), S(1090 - h + 4), S(7), '#7b5ea8')
    ui.stage('reeds')

    img = ui.composite()
    if stages_dir:
        os.makedirs(stages_dir, exist_ok=True)
        for i, (name, png) in enumerate(ui.stages):
            with open(os.path.join(stages_dir, f"{i:02d}_{name}.png"), 'wb') as fh:
                fh.write(png)
    return img


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else 'pastelui_lake.png'
    W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1920, 1080)
    save_png(paint(W, H, stages_dir=os.environ.get('STAGES')), out)
