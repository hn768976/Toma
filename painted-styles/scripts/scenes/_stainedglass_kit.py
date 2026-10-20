"""Shared helpers for the stained-glass scenes (lake / coast / forest).

`Panel` is the vendor `StainedGlass` (vendor/ is not edited) made layer-group safe, so that skipping a
group never changes a pixel outside that group's own glass and paint:
  * the whole frame is one leaded panel (no wall, no arch);
  * each `glass()` area is cut and tidied (slivers merged) on its OWN outline when it is laid, never
    re-cut later because a front group covers part of it (the lib's global `_tidy` is disabled);
  * per-piece glass properties (shade, thickness gradient, ream phase, corrosion level) are drawn from the
    current group's generator and stored with the piece, not indexed by global piece order or by the
    visible part of a piece; ream strength is normalised by a fixed constant, not by the visible glass;
  * bubbles and pits are scattered from a fixed candidate set over the canvas and stay inside their piece;
  * new glass wipes earlier groups' paint under it (paint is on the glass it was fired on);
  * halation (a wide blur) is off, and the built-in vignette is weakened by handing `composite()` compressed
    pixel coordinates (it reads `self.XX / self.YY`), referenced to the visible frame so bleed does not move it.
"""
import os

import numpy as np

import drawkit
from drawkit import save_png
from stainedglass import StainedGlass, NANG, lin
from core import fbm1d, noise2d, smoothstep

TRACK = False      # test hook: record per-group footprints (label / paint changes) on the painter
LAST = {}          # test hook: LAST['g'] is the last painter when TRACK is on


class Panel(StainedGlass):
    def __init__(self, S, seed, ambient=0.08, vignette=0.55, sky=('#ffffff', '#f2eee6')):
        super().__init__(S.W, S.H, seed=seed, record=False, ambient=ambient)
        self.S = S
        self.win[:] = 1.0
        self.vig = vignette
        self.p_cx, self.p_cy, self.p_ga, self.p_pit = [], [], [], []
        self.seed0 = seed
        self.track = TRACK
        self.fp = {}
        self._cur = None
        self.daylight(strength=1.0, spill=1.0, halation=0.0, sky=sky)
        if TRACK:
            LAST['g'] = self

    # ------------------------------------------------------------------ groups
    def group(self, name):
        """start a layer group: fresh generators for it; returns the scene's own generator"""
        self._close()
        self.rng = drawkit.group_rng(self.seed0, name)
        if self.track:
            self._cur = (name, self.label.copy(), self.trace_a.copy(), self.matt_a.copy(),
                         self.scratch_a.copy(), self.stain_a.copy(), self.cuts.copy())
        return drawkit.group_rng(self.seed0, name)

    def _close(self):
        if self._cur is not None:
            name, lab, tr, ma, sc, st, cu = self._cur
            fp = ((lab != self.label) | (tr != self.trace_a) | (ma != self.matt_a) | (sc != self.scratch_a)
                  | (st != self.stain_a) | (cu != self.cuts))
            self.fp[name] = fp
            self._cur = None

    def finish(self, lead=6.0, grime=0.35, pits=0.3):
        self._close()
        self.rng = drawkit.group_rng(self.seed0, 'finish')
        self.lead(width=lead * self.S.s, rim=0.0)
        self.weather(grime=grime, pits=pits)

    # ------------------------------------------------------------------ glass
    def glass(self, mask, colour, **kw):
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        mb = m[b]
        for a in (self.trace_a, self.matt_a, self.scratch_a, self.stain_a):
            a[b][mb] = 0
        base = len(self.p_col)
        if 'cell' in kw and kw['cell'] is not None:
            kw['cell'] = max(4.0, kw['cell'])
        rid = super().glass(mask, colour, **kw)
        if rid is None:
            return None
        n = len(self.p_col) - base
        lab = self.label[b]
        if n > 1:
            self._tidy_local(lab, base, n)
        L = np.where(lab >= base, lab - base, -1)
        sel = L >= 0
        ys, xs = np.nonzero(sel)
        cnt = np.bincount(L[sel], minlength=n) + 1e-6
        self.p_cx += list(np.bincount(L[sel], xs + b[1].start, n) / cnt)
        self.p_cy += list(np.bincount(L[sel], ys + b[0].start, n) / cnt)
        r = self.rng
        self.p_ga += list(r.uniform(0, 2 * np.pi, n))
        self.p_pit += list(np.where(r.random(n) < 0.22, r.uniform(0.4, 1.0, n), r.uniform(0, 0.12, n)))
        return rid

    def _tidy_local(self, lab, base, n):
        """the lib's sliver merge, restricted to the pieces of the area just laid (its own outline)"""
        s = self.S.s
        for _ in range(3):
            L = np.where(lab >= base, lab - base, -1)
            area = np.bincount(L[L >= 0], minlength=n)
            a = np.concatenate([L[:, :-1].ravel(), L[:-1, :].ravel()])
            c = np.concatenate([L[:, 1:].ravel(), L[1:, :].ravel()])
            d = a != c
            a, c = a[d], c[d]
            per = np.bincount(a[a >= 0], minlength=n) + np.bincount(c[c >= 0], minlength=n)
            small = (area > 0) & ((area < 170 * s * s) | (area < per * 2.6 * s))
            if not small.any():
                return
            src = np.concatenate([a, c]); dst = np.concatenate([c, a])
            ok = (src >= 0) & (dst >= 0)
            src, dst = src[ok], dst[ok]
            ok = small[src] & ~small[dst]
            src, dst = src[ok], dst[ok]
            if len(src) == 0:
                return
            key, cnt = np.unique(src * n + dst, return_counts=True)
            s_, d_ = key // n, key % n
            order = np.lexsort((-cnt, s_))
            s_, d_ = s_[order], d_[order]
            first = np.r_[True, s_[1:] != s_[:-1]]
            mp = np.arange(n, dtype=np.int64)
            mp[s_[first]] = d_[first]
            inr = lab >= base
            lab[inr] = (mp[lab[inr] - base] + base).astype(np.int32)
        self._T = None

    def _tidy(self):
        pass

    def _glass_T(self):
        if self._T is not None:
            return self._T
        H, W = self.H, self.W
        lab = self.label
        m = lab >= 0
        T = np.zeros((H, W, 3), np.float32)
        if not m.any():
            self._T = T
            return T
        idx = lab[m]
        if not hasattr(self, '_thick_n'):
            self._thick_n = (noise2d(H, W, 80, 3, self._lazy[0]) * 2 - 1).astype(np.float32)
            self._warp = (noise2d(H, W, 240, 3, self._lazy[1]) - 0.5).astype(np.float32)
            self._sheen = (noise2d(H, W, 30, 3, self._lazy[2]) * 2 - 1).astype(np.float32)
        nd = int(np.hypot(W, H)) + 4600
        if not hasattr(self, '_tabs'):
            self._tabs = [0.7 * fbm1d(nd, 4, 4, 1000 + k) + 0.3 * fbm1d(nd, 30, 3, 2000 + k) for k in range(NANG)]
            self._tabn = max(float(np.abs(t).max()) for t in self._tabs) * 0.8
        pang = np.array(self.p_ang, np.int64)
        ang = np.full((H, W), -1, np.int64)
        ang[m] = pang[idx]
        off = np.zeros((H, W), np.float32)
        off[m] = np.array(self.p_off, np.float32)[idx]
        st = np.zeros((H, W), np.float32)
        for k in range(NANG):
            sel = ang == k
            if not sel.any():
                continue
            a = np.pi * k / NANG
            ys_, xs_ = np.nonzero(sel)
            dd = xs_ * np.cos(a) + ys_ * np.sin(a) + self._warp[sel] * 40 + H + 200 + off[sel]
            st[sel] = np.interp(dd, np.arange(nd), self._tabs[k])
        st = np.clip(st / self._tabn, -1, 1)
        pc = np.array(self.p_col, np.float32)[idx]
        ys_m, xs_m = np.nonzero(m)
        cxp, cyp = np.array(self.p_cx, np.float32), np.array(self.p_cy, np.float32)
        ga = np.array(self.p_ga, np.float32)
        grad = ((xs_m - cxp[idx]) * np.cos(ga[idx]) + (ys_m - cyp[idx]) * np.sin(ga[idx])) / (45.0 * self.S.s)
        th = np.array(self.p_thick, np.float32)[idx] * (1 + 0.18 * self._thick_n[m]) * np.clip(1 + 0.22 * grad, 0.6, 1.5)
        amp = np.array(self.p_streak, np.float32)[idx]
        th = th * np.clip(1 + 0.55 * amp * st[m], 0.2, 3)
        Tm = pc ** th[:, None]
        Tm *= (1 + 0.05 * self._sheen[m])[:, None]
        T[m] = Tm
        T *= (1 + self._bubbles(ang))[..., None]
        self._T = np.clip(T, 0, 1.2).astype(np.float32)
        return self._T

    def _bubbles(self, ang):
        """seeds (air bubbles): fixed candidate spots over the canvas; each bubble stays inside its own piece"""
        H, W = self.H, self.W
        out = np.zeros((H, W), np.float32)
        lab = self.label
        r = np.random.default_rng(self._lazy[3])
        n = H * W // 520
        py, px = r.integers(0, H, n), r.integers(0, W, n)
        acc, Lb, wb, big, amp = r.random(n), r.uniform(1.2, 5.5, n), r.uniform(0.9, 2.0, n), r.random(n), r.uniform(0.5, 1.0, n)
        seeds = np.array([g['seeds'] for g in self.regions] + [0.0], np.float32)
        reg = np.array(self.p_region + [-1], np.int64)
        R = 6
        ky, kx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
        for i in range(n):
            y, x = int(py[i]), int(px[i])
            if y < R or x < R or y >= H - R or x >= W - R:
                continue
            l = lab[y, x]
            if l < 0 or acc[i] > seeds[reg[l]] * 0.6:
                continue
            a = np.pi * ang[y, x] / NANG
            lb = Lb[i] * (1.6 if big[i] < 0.15 else 1)
            u = kx * np.cos(a) + ky * np.sin(a)
            v = -kx * np.sin(a) + ky * np.cos(a)
            e = np.sqrt((u / max(lb, wb[i])) ** 2 + (v / wb[i]) ** 2)
            k = 0.55 * np.exp(-e * e * 3) - 0.45 * np.exp(-((e - 1.05) ** 2) / 0.06)
            same = lab[y - R:y + R + 1, x - R:x + R + 1] == l
            out[y - R:y + R + 1, x - R:x + R + 1] += k * amp[i] * same
        return out

    def weather(self, grime=0.5, pits=0.5):
        H, W = self.H, self.W
        nz = noise2d(H, W, 70, 4, self._seed())
        near = smoothstep(16, 3, self.lead_d) if self.lead_d is not None else 0
        g = grime * np.clip(0.25 * nz + 0.45 * near * nz, 0, 1)
        Tm = 1 - g[..., None] * (1 - lin('#d8c6a2'))[None, None, :] * 1.3
        out = np.ones((H, W), np.float32)
        lab = self.label
        if pits and len(self.p_col):
            r = np.random.default_rng(self._seed())
            level = np.array(self.p_pit, np.float32) * pits
            n = H * W // 260
            py, px, acc, rad = r.integers(0, H, n), r.integers(0, W, n), r.random(n), r.uniform(0.6, 1.9, n)
            R = 4
            ky, kx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
            for i in range(n):
                y, x = int(py[i]), int(px[i])
                if y < R or x < R or y >= H - R or x >= W - R:
                    continue
                l = lab[y, x]
                if l < 0 or acc[i] > level[l]:
                    continue
                e = np.hypot(kx, ky) / rad[i]
                k = 1 - 0.55 * np.exp(-e * e * 1.5) + 0.12 * np.exp(-((e - 1.6) ** 2) / 0.3)
                out[y - R:y + R + 1, x - R:x + R + 1] *= k
        self.weather_T = (Tm * out[..., None]).astype(np.float32)

    # ------------------------------------------------------------------ compositing
    def composite(self, cartoon=False):
        """the lib's composite, with the vignette weakened (factor self.vig on its radius) and centred on the
        visible frame, by handing it compressed coordinates"""
        S = self.S
        XX, YY = self.XX, self.YY
        Wv, Hv = S.W - 2 * S.ox, S.H - 2 * S.oy
        k = self.vig
        self.XX = (S.W * (0.5 + k * ((XX - S.ox) / Wv - 0.5))).astype(np.float32)
        self.YY = (S.H * (0.48 + k * ((YY - S.oy) / Hv - 0.48))).astype(np.float32)
        try:
            return super().composite(cartoon)
        finally:
            self.XX, self.YY = XX, YY


class Stager:
    """Snapshots in painting order (NNN_name.png): one per group normally, many with dense=True."""
    def __init__(self, g, stages_dir, dense):
        self.g, self.dir, self.dense, self.n = g, stages_dir, dense, 0

    def __call__(self, name, major=False):
        if not self.dir or not (self.dense or major):
            return
        self.save(self.g.composite(), name)

    def save(self, img, name):
        if not self.dir:
            return
        save_png(img, os.path.join(self.dir, f"{self.n:03d}_{name.replace(' ', '_')}.png"))
        self.n += 1


def hband(S, ytop, ybot, n=80, pad=30):
    """full-bleed horizontal band between two y(x) functions of DESIGN x (or constants); design coords"""
    xs = np.linspace(S.X0 - pad, S.X1 + pad, n)
    t = ytop(xs) if callable(ytop) else np.full(n, float(ytop))
    b = ybot(xs) if callable(ybot) else np.full(n, float(ybot))
    return list(zip(xs, t)) + list(zip(xs[::-1], b[::-1]))


def design_xy(g):
    """design-space coordinate grids (x, y) of the canvas"""
    S = g.S
    return (g.XX - S.ox) / S.s, (g.YY - S.oy) / S.s
