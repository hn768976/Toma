"""Hand-made watercolour marks shared by watercolour_lake / _coast / _forest.

Everything here works on the bounding box of one mark (a "crop") instead of the whole sheet, and every
mark carries its own texture, so the look comes from the paint and not from an overlay:
  * `paper`       : cold-press tooth with only a faint raking shade (raw paper stays quiet)
  * `wash`        : a glaze with wet-in-wet pigment drift, colour charged in while wet, granulation that
                    settles into the tooth (more where the pigment is heavy), flocculated clumps, a dried
                    hard edge that varies along the rim, pooling on lower edges and cauliflower back-runs
  * `lift`        : paint dabbed/scrubbed back toward the paper, uneven and catching the tooth
  * `pencil`      : graphite underdrawing, thin wobbly strokes that skip over the tooth hollows
  * `ribbon`      : a tapered, wobbling brush mark as a polygon (blades, branches, trunks, dashes)
  * `reflect`     : a reflection painted as broken horizontal strokes (sampled from the object's mask,
                    each stroke shifted, gapped, shorter and paler with depth) -- not a flipped blur
  * `pine`        : one hand-built fir (its own lean, bow, tier spacing, ragged drooping branches)
Masks are `Crop(x0, y0, a)` (a float array placed at x0, y0 on the canvas) or full-canvas arrays.
"""
import numpy as np
from PIL import Image, ImageDraw

from core import blur, fbm1d, noise2d, smoothstep, spline, blob_pts

GRAPHITE = np.array([0.40, 0.40, 0.43], np.float32)


class Crop:
    __slots__ = ('x0', 'y0', 'a')

    def __init__(self, x0, y0, a):
        self.x0, self.y0, self.a = int(x0), int(y0), a

    @property
    def sl(self):
        h, w = self.a.shape
        return (slice(self.y0, self.y0 + h), slice(self.x0, self.x0 + w))

    def full(self, H, W):
        out = np.zeros((H, W), np.float32)
        out[self.sl] = self.a
        return out

    def grow(self, pad, H, W):
        """same mask on a bigger box (room for blurs)"""
        h, w = self.a.shape
        x0, y0 = max(0, self.x0 - pad), max(0, self.y0 - pad)
        x1, y1 = min(W, self.x0 + w + pad), min(H, self.y0 + h + pad)
        out = np.zeros((y1 - y0, x1 - x0), np.float32)
        out[self.y0 - y0:self.y0 - y0 + h, self.x0 - x0:self.x0 - x0 + w] = self.a
        return Crop(x0, y0, out)


def crop_of(m, pad=0, thr=1e-3):
    """full-canvas mask -> Crop around its non-zero part (None if empty)"""
    if m is None or isinstance(m, Crop):
        return m
    m = np.asarray(m, np.float32)
    rows = np.flatnonzero(m.max(1) > thr)
    if rows.size == 0:
        return None
    cols = np.flatnonzero(m.max(0) > thr)
    H, W = m.shape
    y0, y1 = max(0, rows[0] - pad), min(H, rows[-1] + 1 + pad)
    x0, x1 = max(0, cols[0] - pad), min(W, cols[-1] + 1 + pad)
    return Crop(x0, y0, m[y0:y1, x0:x1].copy())


def union(crops, H, W):
    crops = [c for c in crops if c is not None]
    if not crops:
        return None
    x0 = min(c.x0 for c in crops); y0 = min(c.y0 for c in crops)
    x1 = max(c.x0 + c.a.shape[1] for c in crops); y1 = max(c.y0 + c.a.shape[0] for c in crops)
    out = np.zeros((y1 - y0, x1 - x0), np.float32)
    for c in crops:
        h, w = c.a.shape
        sl = out[c.y0 - y0:c.y0 - y0 + h, c.x0 - x0:c.x0 - x0 + w]
        np.maximum(sl, c.a, out=sl)
    return Crop(x0, y0, out)


def on_box(c, box):
    """Crop `c` resampled onto another Crop's box (zeros where it does not reach)"""
    out = np.zeros_like(box.a)
    if c is None:
        return out
    h, w = c.a.shape
    ys0, xs0 = max(c.y0, box.y0), max(c.x0, box.x0)
    ys1 = min(c.y0 + h, box.y0 + box.a.shape[0]); xs1 = min(c.x0 + w, box.x0 + box.a.shape[1])
    if ys1 > ys0 and xs1 > xs0:
        out[ys0 - box.y0:ys1 - box.y0, xs0 - box.x0:xs1 - box.x0] = c.a[ys0 - c.y0:ys1 - c.y0, xs0 - c.x0:xs1 - c.x0]
    return out


def polys(polygons, H, W, ss=2, pad=2):
    """filled polygons (canvas px) -> Crop (supersampled edges)"""
    P = [np.asarray(q, np.float32) for q in polygons if len(q) >= 3]
    if not P:
        return None
    allp = np.vstack(P)
    x0 = int(max(0, np.floor(allp[:, 0].min()) - pad)); x1 = int(min(W, np.ceil(allp[:, 0].max()) + pad + 1))
    y0 = int(max(0, np.floor(allp[:, 1].min()) - pad)); y1 = int(min(H, np.ceil(allp[:, 1].max()) + pad + 1))
    if x1 <= x0 or y1 <= y0:
        return None
    im = Image.new('L', ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    d = ImageDraw.Draw(im)
    for q in P:
        d.polygon([((x - x0) * ss, (y - y0) * ss) for x, y in q], fill=255)
    if ss > 1:
        im = im.resize((x1 - x0, y1 - y0), Image.BOX)
    return Crop(x0, y0, np.asarray(im, np.float32) / 255)


def _seed(rng):
    return int(rng.integers(1 << 30))


def noise(rng, h, w, scale, octaves=3):
    return noise2d(h, w, max(1.0, scale), octaves, _seed(rng))


def soften(c, soft, ragged, rng, H, W):
    """watercolour edge on a Crop: blur, then threshold against noise so the edge is ragged"""
    if c is None:
        return None
    if soft <= 0:
        return c
    c = c.grow(int(soft * 2.5) + 2, H, W)
    m = blur(c.a, soft)
    h, w = m.shape
    n = noise(rng, h, w, max(4, soft * 3), 3)
    c.a = smoothstep(0.25, 0.75, m + (n - 0.5) * ragged).astype(np.float32)
    return c


# ------------------------------------------------------------------ paper
def _composite(self):
    """the sheet as seen: paint, with the graphite underneath it. Graphite is grey, so it only shows where the
    paint is lighter than the lead (light washes, raw paper) and vanishes under darker passes."""
    img = self.img
    if getattr(self, 'has_graphite', False):
        g = self.graphite[..., None]
        img = np.minimum(img, img + g * (GRAPHITE - img))
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def paper(p, s, rng, shade=0.05):
    """tooth (height map) for granulation and pencil; only a very faint raking shade on the raw sheet --
    the tooth shows up where pigment settles into it (see `wash`), not as an even overlay"""
    import types
    H, W = p.H, p.W
    t = 0.55 * noise(rng, H, W, 2.5 * s, 2) + 0.3 * noise(rng, H, W, 10 * s, 3) + 0.15 * noise(rng, H, W, 60 * s, 3)
    p.tooth = t.astype(np.float32)
    tb = blur(t, max(0.6, 1.0 * s))
    sh = np.gradient(tb, axis=1) + np.gradient(tb, axis=0)
    sh = sh / (np.abs(sh).mean() + 1e-6) * 0.012          # resolution-independent shade amplitude
    sizing = 0.993 + 0.01 * noise(rng, H, W, 300 * s, 3)    # slightly uneven sizing / tone
    p.base = (p.base * (1 - shade * 10 * sh[..., None]) * sizing[..., None]).astype(np.float32)
    p.img = p.base.copy()
    p.graphite = np.zeros((H, W), np.float32)               # pencil lives under the paint (see _composite)
    p.has_graphite = False
    p.composite = types.MethodType(_composite, p)


# ------------------------------------------------------------------ glaze
def _colour_field(colour, h, w, rng, charge_px):
    c = np.asarray(colour, np.float32)
    if c.ndim == 1:
        return c
    if c.ndim == 3:
        return c
    # several pigments charged into the wet wash: weights from soft noise fields
    k = c.shape[0]
    wts = [noise(rng, h, w, charge_px, 3) ** 2.2 for _ in range(k)]
    tot = sum(wts) + 1e-6
    return sum(wts[i][..., None] * c[i] for i in range(k)) / tot[..., None]


def _hold_on(hold, c, H, W):
    if hold is None:
        return None
    if isinstance(hold, Crop):
        return on_box(hold, c)
    return np.asarray(hold, np.float32)[c.sl]


def wash(p, m, colour, k=0.8, s=1.0, rng=None, edge=0.6, edge_px=4.0, gran=0.35, flocc=0.3, var=0.25, var_px=90,
         pool=0.5, blooms=0, bloom_px=(25, 60), charge_px=120, apply=True, edge_var=0.9, bloom_k=0.5, bloom_zone=None,
         hold=None, cover=0.3):
    """transparent glaze over mask `m` (Crop or full array). Returns (Crop-box, transmittance) when apply=False.
    `hold`: paper reserved while painting (the wash goes round it and dries with an edge against it).
    The tooth shows only in proportion to the pigment load: pale washes stay smooth, heavy ones granulate.
    The dried edge is broken and changes width along the rim instead of an even outline."""
    rng = rng if rng is not None else p.rng
    c = crop_of(m) if not isinstance(m, Crop) else m
    if c is None:
        return None
    pad = int(edge_px * s * 3) + 2
    c = c.grow(pad, p.H, p.W)
    a = c.a
    hd = _hold_on(hold, c, p.H, p.W)
    if hd is not None:
        a = a * (1 - np.clip(hd, 0, 1))
    h, w = a.shape
    if h < 2 or w < 2:
        return None
    sl = c.sl
    # wet-in-wet pigment drift: two scales, the big one like the wash flowing on a tilted board
    d = a * (1 - var + var * (0.65 * noise(rng, h, w, var_px * s, 4) + 0.35 * noise(rng, h, w, var_px * 3 * s, 2)))
    if edge > 0:
        r = max(0.8, edge_px * s)
        ba = blur(a, r)
        ring = np.clip(a - ba, 0, None) * (a > 0.12)
        ba2 = blur(a, r * 2.4)
        ring2 = np.clip(a - ba2, 0, None) * (a > 0.12)
        wm = smoothstep(0.35, 0.7, noise(rng, h, w, 70 * s, 3))                  # the rim widens and narrows
        ring = ring * (1 - wm) + ring2 * 0.6 * wm
        brk = smoothstep(0.38, 0.62, noise(rng, h, w, 40 * s, 3))                 # and is lost in places
        ev = (1 - edge_var) * 0.7 + edge_var * brk * (0.3 + 1.7 * noise(rng, h, w, 18 * s, 2))
        d = d + edge * 2.4 * ring * ev
        if pool > 0:
            down = np.clip(-np.gradient(ba, axis=0) * r * 2.5, 0, 1)            # lower edges: pigment pools
            d = d + pool * 2.4 * ring * down * ev
    for _ in range(blooms):
        ys, xs = np.nonzero((a > 0.7) if bloom_zone is None else (a > 0.7) & (on_box(crop_of(bloom_zone), c) > 0.5))
        if len(xs) == 0:
            break
        j = int(rng.integers(len(xs))); cx, cy = xs[j], ys[j]
        r0 = rng.uniform(*bloom_px) * s
        R = int(r0 * 1.6) + 2
        ya, yb, xa, xb = max(0, cy - R), min(h, cy + R), max(0, cx - R), min(w, cx + R)
        yy, xx = np.mgrid[ya:yb, xa:xb].astype(np.float32)
        bh, bw = yb - ya, xb - xa
        if bh < 3 or bw < 3:
            continue
        dist = np.hypot(xx - cx, (yy - cy) * rng.uniform(1.0, 1.6)) / r0
        dist = dist * (1 + 0.7 * (noise(rng, bh, bw, r0 / 2.5, 3) - 0.5) + 0.3 * (noise(rng, bh, bw, r0 / 8, 2) - 0.5))
        inner = np.clip(1 - dist, 0, 1) ** 0.6
        rim = np.exp(-((dist - 1) / 0.05) ** 2) * (0.4 + 0.6 * noise(rng, bh, bw, r0 / 4, 2))
        aw = a[ya:yb, xa:xb]
        d[ya:yb, xa:xb] = d[ya:yb, xa:xb] * (1 - bloom_k * 0.55 * inner * aw) + bloom_k * 0.4 * rim * aw
    cf = np.asarray(colour, np.float32)
    if cf.ndim == 3 and cf.shape[:2] == (p.H, p.W):
        cf = cf[sl]
    col = _colour_field(cf, h, w, rng, charge_px * s)
    if gran > 0:
        # pigment load: how dark this wash makes the paper here. Granulation follows the load, so a pale
        # wash barely shows the tooth and a heavy, pooled one settles hard into the hollows
        strength = np.mean(1 - np.asarray(col, np.float32), axis=-1)
        load = np.clip(d * k * strength * 2.4, 0, 1)
        hollow = (0.5 - p.tooth[sl]) * 2.2
        fl = (noise(rng, h, w, 3.5 * s, 2) - 0.5) * 2 if flocc > 0 else 0
        d = d * np.clip(1 + gran * (hollow * (0.08 + 1.25 * load ** 1.5) + flocc * fl * load ** 1.2), 0.15, None)
    d = np.clip(d * k, 0, 1.3)
    T = np.clip(1 - d[..., None] * (1 - col), 0.03, 1).astype(np.float32)
    if getattr(p, 'has_graphite', False) and cover > 0:      # each pass softens the lead under it a little
        p.graphite[sl] *= 1 - cover * np.clip(d, 0, 1)
    if apply:
        p.img[sl] *= T
        return None
    return c, T


def apply_T(p, box, T, r):
    """apply part of a wash: transmittance raised to `r` (0..1 per pixel); successive parts multiply up"""
    p.img[box.sl] *= T ** np.clip(r, 0, 1)[..., None]


def lift(p, m, amount, s=1.0, rng=None, rough=0.35, rough_px=30, tooth=0.5):
    """dab/scrub paint off: uneven, and the tooth tops come back cleaner than the hollows"""
    rng = rng if rng is not None else p.rng
    c = crop_of(m) if not isinstance(m, Crop) else m
    if c is None:
        return
    a = c.a
    h, w = a.shape
    sl = c.sl
    am = a * amount * (1 - rough + rough * noise(rng, h, w, rough_px * s, 3)) * (1 + tooth * (p.tooth[sl] - 0.5))
    am = np.clip(am, 0, 1)
    if getattr(p, 'has_graphite', False):
        p.graphite[sl] *= 1 - 0.5 * am
    am = am[..., None]
    p.img[sl] = p.img[sl] + (p.base[sl] - p.img[sl]) * am


# ------------------------------------------------------------------ brush shapes
def resample(pts, step):
    P = np.asarray(pts, np.float32)
    seg = np.hypot(*np.diff(P, axis=0).T)
    L = float(seg.sum())
    if L < 1e-3:
        return P, 0.0
    t = np.concatenate([[0], np.cumsum(seg)])
    n = max(3, int(L / max(step, 0.5)) + 1)
    u = np.linspace(0, L, n)
    return np.stack([np.interp(u, t, P[:, 0]), np.interp(u, t, P[:, 1])], 1), L


def ribbon(pts, w0, w1, rng, wob=0.15, peak=None, step=2.0, ends=0.0):
    """tapered brush mark around a centre line: width goes w0 -> w1 (optionally bellying at `peak`),
    with an uneven, wobbling edge on both sides"""
    P, L = resample(pts, step)
    n = len(P)
    t = np.linspace(0, 1, n)
    if peak is not None:
        prof = np.where(t < peak, (t / max(peak, 1e-3)) ** 0.6, ((1 - t) / max(1 - peak, 1e-3)) ** 0.8)
        wid = (w0 + (w1 - w0) * t) * (ends + (1 - ends) * prof)
    else:
        wid = w0 + (w1 - w0) * t
    tg = np.gradient(P, axis=0)
    tg /= (np.hypot(tg[:, 0], tg[:, 1])[:, None] + 1e-6)
    nr = np.stack([-tg[:, 1], tg[:, 0]], 1)
    sc = max(3.0, n / 5)
    wl = wid * 0.5 * (1 + wob * fbm1d(n, sc, 3, _seed(rng)))
    wr = wid * 0.5 * (1 + wob * fbm1d(n, sc, 3, _seed(rng)))
    left = P + nr * wl[:, None]
    right = P - nr * wr[:, None]
    return np.vstack([left, right[::-1]])


def wobble_line(pts, amp, rng, step=3.0, scale=12):
    """a hand-drawn version of a polyline: resampled, with a slow sideways wander"""
    P, L = resample(pts, step)
    n = len(P)
    if n < 3:
        return P
    tg = np.gradient(P, axis=0)
    tg /= (np.hypot(tg[:, 0], tg[:, 1])[:, None] + 1e-6)
    nr = np.stack([-tg[:, 1], tg[:, 0]], 1)
    off = fbm1d(n, max(3, scale), 3, _seed(rng)) * amp
    return P + nr * off[:, None]


# ------------------------------------------------------------------ graphite underdrawing
def pencil(p, lines, s, rng, k=0.55, width=1.3, colour=GRAPHITE, ss=3):
    """thin, slightly wobbly graphite lines (canvas-px polylines). Pressure varies along each line, the
    lead skips the tooth hollows, some lines are restated with a second, offset pass."""
    if not lines:
        return
    H, W = p.H, p.W
    segs = []
    for ln in lines:
        ln = np.asarray(ln, np.float32)
        if len(ln) < 2:
            continue
        # a little overshoot at the ends, as when drawing quickly
        d0 = ln[1] - ln[0]; d1 = ln[-1] - ln[-2]
        ov = s * rng.uniform(1, 5)
        ln = np.vstack([ln[0] - d0 / (np.hypot(*d0) + 1e-6) * ov, ln, ln[-1] + d1 / (np.hypot(*d1) + 1e-6) * ov])
        passes = 2 if rng.uniform() < 0.3 else 1
        for ps in range(passes):
            q = wobble_line(ln + (rng.normal(0, 1.2 * s, 2) if ps else 0), 1.1 * s, rng, step=3 * s, scale=10)
            pr = 0.55 + 0.45 * (fbm1d(len(q), max(3, len(q) / 4), 2, _seed(rng)) * 0.5 + 0.5)
            segs.append((q, pr * (0.7 if ps else 1.0)))
    if not segs:
        return
    allp = np.vstack([q for q, _ in segs])
    pad = int(4 * s) + 3
    x0 = int(max(0, allp[:, 0].min() - pad)); x1 = int(min(W, allp[:, 0].max() + pad))
    y0 = int(max(0, allp[:, 1].min() - pad)); y1 = int(min(H, allp[:, 1].max() + pad))
    if x1 <= x0 or y1 <= y0:
        return
    im = Image.new('L', ((x1 - x0) * ss, (y1 - y0) * ss), 0)
    dr = ImageDraw.Draw(im)
    wpx = max(1, int(round(width * s * ss)))
    for q, pr in segs:
        for i in range(len(q) - 1):
            dr.line([((q[i, 0] - x0) * ss, (q[i, 1] - y0) * ss), ((q[i + 1, 0] - x0) * ss, (q[i + 1, 1] - y0) * ss)],
                    fill=int(255 * pr[i]), width=wpx)
    a = np.asarray(im.resize((x1 - x0, y1 - y0), Image.BOX), np.float32) / 255
    sl = (slice(y0, y1), slice(x0, x1))
    a = a * np.clip(0.35 + 1.3 * p.tooth[sl], 0, 1.2)
    if hasattr(p, 'graphite'):
        g = p.graphite[sl]
        p.graphite[sl] = 1 - (1 - g) * (1 - np.clip(k * a, 0, 0.9))
        p.has_graphite = True
    else:
        p.img[sl] *= 1 - np.clip(k * a, 0, 0.9)[..., None] * (1 - colour)


# ------------------------------------------------------------------ reflections as strokes
def reflect(m, y_w, s, rng, H, W, squash=0.8, band=(2.5, 7.0), gap=0.3, shift=5.0, fade=0.55, gate_px=50, depth=None,
            jit=0.25, vsoft=0.0):
    """reflection of mask `m` (full array or Crop) about the waterline y_w, as broken horizontal strokes.
    Each stroke samples the object at one height (so it reads as a flat brush stroke), is shifted sideways,
    gapped along its length, and the whole thing is shorter (`squash`) and fades with depth."""
    c = crop_of(m) if not isinstance(m, Crop) else m
    if c is None:
        return None
    full = c.full(H, W)
    cols = np.flatnonzero(full[:int(y_w)].max(0) > 0.02) if int(y_w) > 0 else np.array([])
    if cols.size == 0:
        return None
    rows = np.flatnonzero(full[:int(y_w)].max(1) > 0.02)
    top = rows[0]
    ext = (y_w - top) * squash
    if depth is not None:
        ext = min(ext, depth)
    pad = int(shift * s * 2) + 4
    x0, x1 = max(0, cols[0] - pad), min(W, cols[-1] + 1 + pad)
    y0, y1 = int(y_w), int(min(H, y_w + ext + 2))
    if y1 - y0 < 2:
        return None
    out = np.zeros((y1 - y0, x1 - x0), np.float32)
    w = x1 - x0
    y = float(y0)
    while y < y1:
        f = (y - y_w) / max(ext, 1)
        hgt = max(1.0, rng.uniform(*band) * s * (0.7 + 0.9 * f))
        yc = y + hgt / 2
        src = int(np.clip(y_w - (yc - y_w) / squash, 0, H - 1))
        row = full[src, x0:x1]
        dx = int(round(rng.normal(0, shift * s * (0.4 + f))))
        row = np.roll(row, dx)
        g = fbm1d(w, max(4, gate_px * s), 3, _seed(rng))
        th = (min(0.95, gap * (0.3 + 1.6 * f)) - 0.5) * 0.7      # more broken further from the waterline
        gate = smoothstep(th - 0.18, th + 0.18, g) if gap > 0 else 1.0
        val = row * gate * max(0.0, 1 - fade * f) * (1 - jit * rng.uniform(0, 1))
        ya, yb = int(y) - y0, int(min(y1, y + hgt)) - y0
        if yb > ya:
            out[ya:yb] = np.maximum(out[ya:yb], val[None, :])
        y += hgt * rng.uniform(0.85, 1.2)
    if vsoft > 0:                               # wet-in-wet: strokes run into each other vertically
        k = max(1, int(vsoft * s))
        cs = np.cumsum(np.pad(out, ((k + 1, k), (0, 0)), mode='edge'), axis=0)
        out = ((cs[2 * k + 1:] - cs[:-2 * k - 1]) / (2 * k + 1)).astype(np.float32)
    c = Crop(x0, y0, out)
    return soften(c, max(0.8, 1.3 * s), 0.55, rng, H, W)
    return Crop(x0, y0, out)


# ------------------------------------------------------------------ fir tree
def pine(x, root, h, rng, s=1.0, lean=0.0, sparse=0.0, width=1.0):
    """one fir, built from drooping, ragged branch marks on a trunk that wanders and kinks a little.
    Each tree gets its own crown profile (slender, broad, top-heavy), tier count and spacing, its own top
    (straight spire, bent leader, forked or broken top) and a few gaps where branches are missing.
    Returns (polygons, trunk centre-line) in canvas px."""
    top = root - h
    bow = rng.normal(0, h * 0.02)
    bare = h * rng.uniform(0.04, 0.16)                    # bare trunk at the foot
    nW = 14
    wig = fbm1d(nW, 4, 2, _seed(rng)) * h * rng.uniform(0.004, 0.012)
    kink_f, kink = rng.uniform(0.3, 0.8), rng.normal(0, h * 0.012) if rng.uniform() < 0.5 else 0.0

    def tx(y):
        f = np.clip((root - y) / h, 0, 1)
        return (x + lean * h * f + bow * np.sin(np.pi * f) + np.interp(f, np.linspace(0, 1, nW), wig)
                + kink * np.clip((f - kink_f) * 6, 0, 1))

    trunk = [(tx(yy), yy) for yy in np.linspace(root, top + h * 0.04, 12)]
    P = []
    kind = rng.choice(['spire', 'spire', 'bent', 'fork', 'broken'], p=[0.35, 0.15, 0.2, 0.12, 0.18])
    prof_exp = rng.uniform(0.6, 1.25)                      # crown profile: <1 broad shoulders, >1 slender spire
    Lmax = rng.uniform(0.14, 0.26)
    sp_h = h * rng.uniform(0.06, 0.16)
    if kind == 'broken':                                   # top snapped off: a flat, ragged crown top
        top = top + sp_h * 0.8
        sp_h = h * 0.02
    tip = (tx(top) + rng.normal(0, h * 0.008), top)
    if kind == 'broken':
        pass                                               # no spire: the crown starts in a ragged tuft
    elif kind == 'bent':
        bend = rng.choice([-1, 1]) * h * rng.uniform(0.02, 0.05)
        P.append(ribbon([(tip[0] + bend, top + sp_h * 0.15), (tx(top + sp_h * 0.4) + bend * 0.6, top + sp_h * 0.4),
                         (tx(top + sp_h * 1.2), top + sp_h * 1.2)], h * 0.006, h * 0.035 * width, rng, wob=0.35, step=1.5 * s + 0.5))
    else:
        P.append(ribbon([tip, (tx(top + sp_h * 0.5), top + sp_h * 0.5), (tx(top + sp_h), top + sp_h)],
                        h * 0.004, h * 0.035 * width, rng, wob=0.3, step=1.5 * s + 0.5))
    if kind == 'fork':                                     # a second leader beside the first
        sg = rng.choice([-1, 1])
        y2 = top + sp_h * rng.uniform(0.7, 1.4)
        P.append(ribbon([(tx(y2) + sg * h * 0.035, top + sp_h * 0.3), (tx(y2 + sp_h * 0.4) + sg * h * 0.012, y2 + sp_h * 0.4),
                         (tx(y2 + sp_h), y2 + sp_h)], h * 0.004, h * 0.03 * width, rng, wob=0.35, step=1.5 * s + 0.5))
    # tiers: irregular spacing, getting longer and fuller downward, both sides independent
    nt = int(rng.integers(7, 16))
    gaps = rng.uniform(0.5, 1.6, nt)
    pos = np.cumsum(gaps); pos = pos / pos[-1]
    y_a, y_b = (top + sp_h * 0.6) if kind != 'broken' else top + h * 0.01, root - bare
    gap_tier = set(rng.choice(nt, int(rng.integers(0, 3)), replace=False).tolist()) if nt > 4 else set()
    lop = rng.choice([-1, 1]) * rng.uniform(0, 0.35)        # wind-shaped: one side shorter
    for i, f in enumerate(pos):
        ty = y_a + (y_b - y_a) * f
        ff = (ty - top) / h
        for sgn in (-1, 1):
            if rng.uniform() < sparse * (0.3 + ff) or (i in gap_tier and rng.uniform() < 0.75):
                continue                                    # a missing branch here and there
            Lb = h * (0.025 + Lmax * ff ** prof_exp) * rng.uniform(0.55, 1.35) * width * (1 + lop * sgn)
            droop = rng.uniform(0.1, 0.7) * Lb
            th = h * (0.022 + 0.04 * ff) * rng.uniform(0.6, 1.4)
            bx = tx(ty)
            tipx, tipy = bx + sgn * Lb, ty + droop
            # upper edge bows up a little; under side is a fringe of needle tufts
            upper = spline([(bx, ty - th * 0.6), (bx + sgn * Lb * 0.5, ty - th * rng.uniform(0.1, 0.5) + droop * 0.25), (tipx, tipy)], 5)
            nf = max(3, int(Lb / max(2.5 * s, th * 0.5)))
            under = []
            for j in range(nf + 1):
                u = 1 - j / nf
                px_ = bx + sgn * Lb * u
                py_ = ty + droop * u ** 1.4 + th * (0.5 + 0.6 * (1 - u))
                if j % 2 == 1:
                    py_ += th * rng.uniform(0.2, 1.0)
                under.append((px_ + rng.normal(0, th * 0.25), py_))
            under.append((bx, ty + th * 1.2))
            P.append(np.vstack([upper, np.asarray(under, np.float32)]))
        # fill between trunk and branch roots so the crown is not a ladder
        P.append(ribbon([(tx(ty - h * 0.03), ty - h * 0.03), (tx(ty + h * 0.05), ty + h * 0.05)],
                        h * (0.02 + 0.04 * ff) * width, h * (0.03 + 0.05 * ff) * width, rng, wob=0.4, step=2 * s + 0.5))
    return P, trunk


# ------------------------------------------------------------------ wet effects
def bleed(c, px, rng, H, W, amt=0.7, up=False):
    """the wet edge of a mark running into wet paper below it (or above, `up`): irregular fingers of paler
    paint, each column running its own distance. Returns a new Crop: the mark plus its bleed."""
    if c is None:
        return None
    c = c.grow(int(px * 2.2) + 3, H, W)
    a = c.a if not up else c.a[::-1]
    h, w = a.shape
    reach = px * (0.25 + 1.5 * (fbm1d(w, max(3.0, px * 0.7), 3, _seed(rng)) * 0.5 + 0.5) ** 1.6)
    dec = np.exp(-1.0 / np.maximum(reach, 0.5)).astype(np.float32)
    run = a.copy()
    for y in range(1, h):
        np.maximum(run[y], run[y - 1] * dec, out=run[y])
    fr = np.clip(run - a, 0, 1)
    fr = blur(fr, max(0.6, px * 0.12))
    fr = fr * (0.4 + 0.8 * noise(rng, h, w, max(3, px * 0.5), 3))
    out = np.maximum(a, np.clip(fr * amt, 0, 1))
    c.a = (out if not up else out[::-1]).astype(np.float32)
    return c


def drybrush(c, p, rng, s, dry=0.5, scale=30):
    """a mark dragged with a drier brush: it catches the tooth tops and skips the hollows, more at its edges"""
    if c is None:
        return None
    h, w = c.a.shape
    t = p.tooth[c.sl] + (noise(rng, h, w, scale * s, 3) - 0.5) * 0.7
    th = 0.25 + 0.5 * dry
    edge_w = np.clip(1 - c.a, 0, 1)
    gate = smoothstep(th - 0.12, th + 0.12, t + 0.35 * (1 - edge_w) - 0.2)
    return Crop(c.x0, c.y0, (c.a * gate).astype(np.float32))


def backrun(p, S, cx, cy, rx, ry, colour, rng, k=0.12, lift_amt=0.1, edge=2.2, hold=None):
    """a cauliflower back-run (bloom): water crept back into a drying wash, pushed the pigment out and
    left a pale centre inside a frilly, dark, hard rim. Design px."""
    pts_ = blob_pts(S.x(cx), S.y(cy), S(rx), S(ry), rough=rng.uniform(0.25, 0.45), n=140, seed=_seed(rng), rot=rng.normal(0, 0.3))
    m = polys([pts_], p.H, p.W, ss=1, pad=int(S(6)) + 2)
    if m is None:
        return
    m = soften(m, S(rng.uniform(1.5, 3)), 0.9, rng, p.H, p.W)
    h, w = m.a.shape
    inner = Crop(m.x0, m.y0, blur(m.a, S(max(rx, ry) * 0.25)) * m.a)
    lift(p, inner, lift_amt, S.s, rng, rough=0.5, rough_px=max(4, rx * 0.4), tooth=0.3)
    wash(p, m, colour, k, S.s, rng, edge=edge, edge_px=1.3, gran=0.2, var=0.5, var_px=max(4, rx * 0.5), pool=0.3,
         edge_var=0.8, hold=hold, cover=0.0)


def tideline(p, S, x0, x1, y, amp, colour, rng, k=0.06, edge=2.0, depth=70, hold=None):
    """a dried tide line: one pass of a wash dried before the next met it, leaving a long, wandering,
    broken hard line with a faint step in tone above it. Design px; fades out at both ends."""
    H, W = p.H, p.W
    X0c, X1c = int(max(0, S.x(x0))), int(min(W, S.x(x1)))
    Y0c, Y1c = int(max(0, S.y(y - depth - amp * 2))), int(min(H, S.y(y + amp * 2) + 4))
    if X1c - X0c < 4 or Y1c - Y0c < 4:
        return
    w = X1c - X0c
    xd = (np.arange(X0c, X1c, dtype=np.float32) - S.ox) / S.s
    line = y + amp * fbm1d(w, max(4, S(120)), 4, _seed(rng)) + 0.3 * amp * fbm1d(w, max(3, S(14)), 2, _seed(rng))
    yd = (np.arange(Y0c, Y1c, dtype=np.float32)[:, None] - S.oy) / S.s
    m = np.clip((line[None, :] - yd) / 1.2, 0, 1) * np.clip((yd - (line[None, :] - depth)) / depth, 0, 1)
    ends = np.clip((xd - x0) / ((x1 - x0) * 0.25), 0, 1) * np.clip((x1 - xd) / ((x1 - x0) * 0.25), 0, 1)
    m = m * ends[None, :]
    wash(p, Crop(X0c, Y0c, m.astype(np.float32)), colour, k, S.s, rng, edge=edge, edge_px=1.2, gran=0.15, var=0.4, var_px=40,
         pool=0.6, edge_var=0.7, hold=hold, cover=0.0)


# ------------------------------------------------------------------ clouds
def cloud_shape(p, S, cx, cy, ln, th, rng, lobes=None, tilt=0.0, puff=0.5, lost=0.5, hard_bottom=True):
    """one cloud as a Crop: an irregular row of lobes (count, size and spacing differ per cloud), with
    lost-and-found edges -- hard where the wash dried, feathered where it ran into wet sky"""
    H, W = S.H, S.W
    n = int(lobes or rng.integers(3, 8))
    pos = np.sort(rng.uniform(-0.5, 0.5, n))
    pos[0], pos[-1] = -0.5, 0.5
    shapes = []
    for j, t in enumerate(pos):
        env = 1 - 0.75 * (2 * t) ** 2
        rx = ln * rng.uniform(0.09, 0.2) * (0.6 + 0.4 * env)
        ry = th * rng.uniform(0.5, 1.2) * (0.35 + 0.65 * env) * (1 + puff * rng.uniform(0, 1))
        px, py = cx + t * ln * 0.9 + rng.normal(0, ln * 0.03), cy + t * ln * tilt - ry * puff * 0.6 + rng.normal(0, th * 0.2)
        shapes.append(blob_pts(S.x(px), S.y(py), S(rx), S(ry), rough=rng.uniform(0.15, 0.35), n=60, seed=_seed(rng),
                               rot=rng.normal(0, 0.12)))
    # a thin spine joins the lobes and trails off into wisps at both ends
    sx0, sx1 = cx - ln * rng.uniform(0.5, 0.65), cx + ln * rng.uniform(0.5, 0.65)
    spine = spline([(S.x(sx0), S.y(cy - ln * 0.55 * tilt + rng.normal(0, th * 0.2))), (S.x(cx), S.y(cy + rng.normal(0, th * 0.2))),
                    (S.x(sx1), S.y(cy + ln * 0.55 * tilt + rng.normal(0, th * 0.2)))], 10)
    shapes.append(ribbon(spine, S(th * rng.uniform(0.7, 1.1)), S(th * rng.uniform(0.5, 0.9)), rng, wob=0.5, peak=rng.uniform(0.35, 0.65),
                         step=max(1.0, S(4)), ends=0.0))
    base = polys(shapes, H, W, ss=1, pad=int(S(40)) + 4)
    if base is None:
        return None
    base = base.grow(int(S(30)), H, W)
    a = base.a
    h, w = a.shape
    hard = soften(Crop(base.x0, base.y0, a.copy()), S(1.6), 0.35, rng, H, W)
    hard = on_box(hard, base)
    soft = blur(a, S(rng.uniform(7, 14)))
    soft = smoothstep(0.1, 0.8, soft + (noise(rng, h, w, S(25), 3) - 0.5) * 0.35)
    yy = (np.arange(h, dtype=np.float32)[:, None] + base.y0 - S.y(cy)) / max(1.0, S(th))
    bias = np.clip(0.5 - yy * 0.6, 0, 1) if hard_bottom else np.clip(0.5 + yy * 0.6, 0, 1)
    mix = np.clip(lost * 0.6 + 0.6 * bias + (noise(rng, h, w, S(60), 2) - 0.5) * 0.9, 0, 1)
    base.a = (hard * (1 - mix) + soft * mix).astype(np.float32)
    return base


# ------------------------------------------------------------------ clustered marks (water dashes, glitter)
def dash_clusters(rng, n_clusters, box_fn, per=(2, 7), length=(30, 140), width=(1.5, 5), spread=(30, 10), slope=0.0):
    """irregular groups of horizontal marks (design px): returns [(x, y, L, wd), ...].
    box_fn(rng) -> (x, y, f) gives a cluster centre and its depth factor f (0 far .. 1 near)."""
    out = []
    for _ in range(n_clusters):
        cx, cy, f = box_fn(rng)
        k = int(rng.integers(per[0], per[1] + 1))
        Lc = rng.uniform(*length) * (0.5 + f)
        for j in range(k):
            L = Lc * rng.uniform(0.25, 1.0) * (1 - 0.5 * j / k)
            x = cx + rng.normal(0, spread[0] * (0.5 + f)) - L / 2
            y = cy + rng.normal(0, spread[1] * (0.4 + f))
            wd = rng.uniform(*width) * (0.5 + 0.8 * f) * rng.uniform(0.6, 1.3)
            out.append((x, y, L, wd))
    return out


def dash_polys(S, marks, rng, curl=0.25):
    """lens-like, asymmetric tapered marks with a slight curl and a broken edge"""
    P = []
    for (x, y, L, wd) in marks:
        bend = rng.normal(0, wd * curl)
        c = [(S.x(x), S.y(y)), (S.x(x + L * rng.uniform(0.35, 0.65)), S.y(y + bend)), (S.x(x + L), S.y(y + rng.normal(0, wd * 0.4)))]
        P.append(ribbon(spline(c, 6), S(wd), S(wd) * rng.uniform(0.1, 0.6), rng, wob=0.45, peak=rng.uniform(0.2, 0.6),
                        step=max(1.0, S(3)), ends=0.08))
    return P


# ------------------------------------------------------------------ birds / gulls
def bird(p, S, x, y, sc, colour, rng, k=None, span=15.0):
    """a flying bird in two tapered strokes: its own span, wing lift, asymmetry, tilt and weight"""
    s = S.s
    bx, by = S.x(x), S.y(y)
    sp = S(span * sc * rng.uniform(0.75, 1.3))
    up = rng.uniform(-0.6, 0.35)
    asym = rng.uniform(0.75, 1.25)
    wt = S(rng.uniform(2.0, 3.6) * (0.7 + 0.3 * sc))
    tilt = rng.normal(0, 0.12)
    ca, sa = np.cos(tilt), np.sin(tilt)
    rot = lambda dx, dy: (bx + dx * ca - dy * sa, by + dx * sa + dy * ca)
    lw = spline([rot(-sp * asym, sp * (up * 0.6 + 0.05)), rot(-sp * 0.5 * asym, sp * (up * 0.55 - 0.3)), rot(0, 0)], 6)
    rw = spline([rot(0, 0), rot(sp * 0.5, sp * (up * 0.5 - 0.32)), rot(sp, sp * (up * 0.7 + 0.1))], 6)
    P = [ribbon(lw, wt * 0.35, wt, rng, wob=0.3, step=max(0.6, S(1))), ribbon(rw, wt, wt * 0.3, rng, wob=0.3, step=max(0.6, S(1))),
         blob_pts(*rot(S(1), S(1)), wt * 0.7, wt * 0.55, rough=0.2, n=16, seed=_seed(rng))]
    m = soften(polys(P, p.H, p.W, ss=3), S(0.5), 0.3, rng, p.H, p.W)
    wash(p, m, colour, k if k is not None else rng.uniform(0.75, 0.95), s, rng, edge=0.5, edge_px=1, gran=0.2, var=0.3, var_px=8)


def sky(p, S, rng, YD, y_end, top, bot, k, charge=None, blooms=2, bloom_band=(0.65, 0.92), seed=0, ragged=26, gran=0.25,
        apply=True, hold=None, var=0.4, bloom_k=0.5):
    """wet-in-wet sky wash: colour drifting between top and bottom, a third colour charged in, a ragged lower
    boundary (crisp where it dried, lost where it met the next wash) and a couple of back-runs low down"""
    from core import fbm1d as _f
    H, W = p.H, p.W
    n = 160
    grid = np.linspace(-1000, 2920, n)
    v = _f(n, 260 / (grid[1] - grid[0]), 3, seed)
    XD = (np.arange(W, dtype=np.float32) - S.ox) / S.s
    bottom = (y_end + ragged * np.interp(XD, grid, v))[None, :]
    m = np.clip((bottom + 40 - YD) / 80, 0, 1).astype(np.float32)
    t = np.clip(YD / y_end + (noise(rng, H, W, S(260), 4) - 0.5) * 0.35, 0, 1)
    cf = top[None, None] * (1 - t[..., None]) + bot[None, None] * t[..., None]
    if charge is not None:
        ch = smoothstep(0.55, 0.85, noise(rng, H, W, S(220), 3)) * 0.6
        cf = cf * (1 - ch[..., None]) + charge * ch[..., None]
    zone = ((YD > y_end * bloom_band[0]) & (YD < y_end * bloom_band[1])).astype(np.float32)
    return wash(p, m, cf, k, S.s, rng, edge=0.25, edge_px=6, gran=gran, flocc=0.2, var=var, var_px=120, pool=0.6,
                blooms=blooms, bloom_px=(45, 90), bloom_k=bloom_k, bloom_zone=zone, apply=apply, hold=hold, charge_px=100)
