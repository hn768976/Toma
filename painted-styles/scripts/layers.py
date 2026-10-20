"""Paint a lake scene as separate layers.

The skill can't paint onto transparency, so each style is painted cumulatively:
P_0 = sky only, P_1 = sky+clouds, ... P_n = everything (same seed, per-group RNG, so a group's
pixels never change other groups). Layer i is cut out by difference against P_{i-1}:
  * opaque groups: alpha = smoothstep on the colour difference, holes closed, and the colour is
    un-mixed against the known background (F = B + (C-B)/a), so soft edges carry no halo;
  * mist / soft clouds: colour-key matte, a single key colour with per-pixel alpha, so the layer can
    slide over moving water without dragging baked-in background along;
  * the boat is split at its waterline into hull and reflection (they bob in opposite directions);
  * mist and clouds are made horizontally seamless so they can drift and wrap.
Because every layer below i is itself a complete painting (P_{i-1}), moving layer i reveals real
painted content, never a hole.
"""
import json, os, sys, time
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drawkit
from drawkit import save_png, ROOT

W4, H4, BLEED = 3840, 2160, 0.1
# translucent haze is cut with a colour-key matte; in glass and lino the mist is opaque material
KEY_GROUPS = {'watercolour': {'mist'}, 'artdeco': {'mist'}, 'inkwash': {'mist'}, 'stainedglass': set(), 'linocut': set()}


def load(p):
    return np.asarray(Image.open(p).convert('RGB'), np.float32) / 255


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def close_holes(a, r):
    """morphological closing on a soft mask via max/min filters (Pillow)"""
    from PIL import ImageFilter
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    k = 2 * r + 1
    closed = im.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    return np.maximum(a, np.asarray(closed, np.float32) / 255)


def extract_opaque(B, C):
    D = np.abs(C - B).max(-1)
    a = smoothstep(0.012, 0.07, D)
    a = close_holes(a, 3)
    a = np.where(a < 0.02, 0, a)
    F = np.where(a[..., None] > 0, B + (C - B) / np.maximum(a, 1e-3)[..., None], C)
    return np.clip(F, 0, 1), a


SMOOTH_KEY = {'watercolour', 'inkwash'}   # mist painted on textured paper: smooth veil instead of exact matte


def extract_key(B, C, sigma=60, smooth=True):
    """C = B*(1-a) + K*a with a smooth key colour K(x, y): start from one global key, then refine K
    as an alpha-weighted local average of the un-mixed colour, and re-solve a against it."""
    from core import blur
    d = C - B
    D = np.abs(d).max(-1)
    m = D > np.quantile(D[D > 0.004], 0.98) if (D > 0.004).any() else D > 1
    K = np.broadcast_to(C[m].mean(0), C.shape).astype(np.float32)
    for _ in range(3):
        v = K - B
        a = np.clip((d * v).sum(-1) / np.maximum((v * v).sum(-1), 1e-4), 0, 1)
        a = np.where(D < 0.004, 0, a)
        Fe = np.clip(B + d / np.maximum(a, 0.08)[..., None], 0, 1)
        wsum = blur(a, sigma) + 1e-4
        K = np.stack([blur(Fe[..., c] * a, sigma) / wsum for c in range(3)], -1)
        K = np.where((wsum > 2e-3)[..., None], K, Fe)
    v = K - B
    a = np.clip((d * v).sum(-1) / np.maximum((v * v).sum(-1), 1e-4), 0, 1)
    a = np.where(D < 0.004, 0, a)
    if smooth:
        # paper grain makes a per-pixel alpha speckle; mist is a soft veil, so smooth it (about 8 px at 4K)
        a = np.clip(blur(a, 8), 0, 1)
        a = np.where(a < 0.01, 0, a)
        F = K
    else:
        # grain-free media: put what the smooth key misses back into the colour, exact at rest
        r = C - (B * (1 - a[..., None]) + K * a[..., None])
        w = smoothstep(0.05, 0.15, a)[..., None]
        F = K + w * r / np.maximum(a, 0.05)[..., None]
    return np.clip(F, 0, 1), a


def seamless_x(F, a, keep):
    """blend the layer with itself rolled by half a width so the wrap seam disappears; the blend
    lives only in the outer `keep` px (the bleed), so the visible frame is untouched at rest"""
    Wc = a.shape[1]
    x = np.arange(Wc, dtype=np.float32)
    dist = np.abs(x - Wc / 2)
    r = smoothstep(Wc / 2 - keep, Wc / 2, dist)[None, :]   # 0 inside the frame, 1 at both edges
    P = F * a[..., None]
    P2 = np.roll(P, Wc // 2, axis=1); a2 = np.roll(a, Wc // 2, axis=1)
    Pn = P * (1 - r[..., None]) + P2 * r[..., None]
    an = a * (1 - r) + a2 * r
    return np.where(an[..., None] > 1e-4, Pn / np.maximum(an, 1e-4)[..., None], 0), an


def save_rgba(F, a, path):
    im = np.dstack([F, a[..., None]])
    save_png(Image.fromarray((np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA'), path)


def paint_prefixes(key, colourway, seed, cache, jobs=3, dense_dir=None):
    """paint P_0..P_n (cached), in parallel worker processes"""
    import concurrent.futures as cf
    mod = __import__(f'scenes.{key}_lake', fromlist=['x'])
    G = list(mod.GROUPS)
    os.makedirs(cache, exist_ok=True)
    todo = [i for i in range(len(G)) if not os.path.exists(os.path.join(cache, f'{i:02d}_{G[i]}.png'))]
    times = {}
    with cf.ProcessPoolExecutor(jobs) as ex:
        futs = {ex.submit(_paint_one, key, colourway, seed, G[:i + 1], os.path.join(cache, f'{i:02d}_{G[i]}.png'),
                          dense_dir if i == len(G) - 1 else None): i for i in todo}
        for f in cf.as_completed(futs):
            i = futs[f]; times[G[i]] = f.result(); print(key, 'prefix', i, G[i], f'{times[G[i]]:.0f}s', flush=True)
    return G, times


def _paint_one(key, colourway, seed, include, out, dense_dir):
    mod = __import__(f'scenes.{key}_lake', fromlist=['x'])
    t = time.perf_counter()
    img = mod.paint(W4, H4, seed=seed, colourway=colourway, bleed=BLEED, include=set(include),
                    stages_dir=dense_dir, dense_stages=dense_dir is not None)
    dt = time.perf_counter() - t
    save_png(drawkit.to_image(img).convert('RGB'), out)
    return dt


def extract(key, G, cache, outdir, boat_y_design=806):
    os.makedirs(outdir, exist_ok=True)
    S = drawkit.Scaler(W4, H4, BLEED)
    prev = None; layers = []; stats = {}
    for i, g in enumerate(G):
        C = load(os.path.join(cache, f'{i:02d}_{g}.png'))
        if prev is None:
            F, a = C, np.ones(C.shape[:2], np.float32)
        elif g in KEY_GROUPS.get(key, {'mist'}):
            F, a = extract_key(prev, C, smooth=key in SMOOTH_KEY)
        else:
            F, a = extract_opaque(prev, C)
        if g in ('mist', 'clouds'):
            F, a = seamless_x(F, a, S.ox)
        if g == 'boat':
            cut = int(round(S.y(boat_y_design)))
            top = a.copy(); top[cut:] = 0
            bot = a.copy(); bot[:cut] = 0
            ys, xs = np.nonzero(top > 0.5)
            stats['boatPivot'] = [float(xs.mean() - S.ox), float(cut - S.oy)]
            for name, aa in (('boat', top), ('boat_refl', bot)):
                p = os.path.join(outdir, f'{len(layers):02d}_{name}.png'); save_rgba(F, aa, p); layers.append((name, p))
        else:
            p = os.path.join(outdir, f'{len(layers):02d}_{g}.png'); save_rgba(F, a, p); layers.append((g, p))
        prev = C
    # verification: recomposite at rest and compare with the full painting
    acc = np.zeros_like(prev)
    for name, p in layers:
        L = np.asarray(Image.open(p), np.float32) / 255
        acc = acc * (1 - L[..., 3:]) + L[..., :3] * L[..., 3:]
    err = np.abs(acc - prev)
    stats['recomposite_mean_err_255'] = float(err.mean() * 255)
    stats['recomposite_p999_err_255'] = float(np.quantile(err.max(-1), 0.999) * 255)
    stats['horizon'] = 640 * S.s
    return layers, stats


def crop_drawon(dense_dir, outdir):
    """dense stage snapshots are painted on the bleed canvas: crop to the 3840x2160 frame"""
    S = drawkit.Scaler(W4, H4, BLEED)
    os.makedirs(outdir, exist_ok=True)
    names = sorted(f for f in os.listdir(dense_dir) if f.endswith('.png'))
    out = []
    for j, f in enumerate(names):
        im = Image.open(os.path.join(dense_dir, f)).convert('RGB')
        if im.size != (W4, H4):
            im = im.crop((S.ox, S.oy, S.ox + W4, S.oy + H4))
        p = os.path.join(outdir, f'{j:03d}.png'); save_png(im, p); out.append(p)
    return out
