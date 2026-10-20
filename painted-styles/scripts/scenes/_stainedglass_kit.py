"""Shared helpers for the stained-glass scenes (lake / coast / forest).

`Panel` is the vendor `StainedGlass` (vendor/ is not edited; its grisaille brushes trace / matt / shade /
scratch / stain and its mask helpers are used as they are) with the glazier's side rebuilt:

  cut lines  pieces are DESIGNED, not a Voronoi mosaic.  `band()` cuts an area into rows that follow its own
             top and bottom outline (ridge, shoreline, cloud, band of sky) and cuts each row across with short
             staggered cuts, tilted toward a point or along a direction (radiating from a sun, down a slope),
             piece length tied to row height (aspect 1.3 .. 5.5) and to a local `size` factor, so calm areas get
             big pieces and pieces only get small where the subject needs detail.  `columns` are long cuts
             through every row (spurs running down from summits, valleys between cloud lobes); `feature` puts
             cuts where something reflected starts and stops, so a reflection is built of water-row pieces of
             another glass.  `radial()` cuts rings and spokes around a point, `glass()` lays one piece or a few
             pieces split along given lines.  Pieces below the cuttable size are merged into a neighbour.
  occlusion  when a later area is laid over earlier glass, what is left of a cut piece that is too thin to cut
             (a sliver along the new outline, a wedge, a notch between two branches) is given to a neighbour:
             the glazier simplifies the outline instead of cutting a sliver.
  glass      every piece is its own sheet: cathedral (gentle waves), streaky (wisps of a second colour, strong
             reams in its own direction), seedy (pale, full of bubbles), opalescent (milky mottle), reamy
             (wavy cords); own shade, thickness and thickness gradient.
  lead       came width varies a little (structural leads between areas a bit wider than leads inside an area,
             and slowly along each lead), a flat-faced rounded profile, and a solder blob at every joint.
  stages     `workshop()` writes the draw-on in workshop order: the cartoon drawn on paper on the light table,
             cut glass laid on it piece group by piece group with the cut line showing in the gaps, the
             grisaille fired on, the leading worked across the panel, the joints soldered, then the finished
             panel against daylight (the last stage is the final image).

Layer-group safety (Phase 2 contract): every random number of a group comes from the group's own generator;
fields that span the canvas (streak tables, mottle, bubbles, pits, lead width noise) come from fixed seeds; a
piece's look depends only on its own stored properties and the pixel position, never on piece order.
"""
import os

import numpy as np
from PIL import Image

import drawkit
from drawkit import save_png
from stainedglass import StainedGlass, lin, PAINT_T, STAIN
from core import blur, fbm1d, noise2d, smoothstep

TRACK = False      # test hook: record per-group footprints (label / paint changes) on the painter
LAST = {}          # test hook: LAST['g'] is the last painter when TRACK is on

KINDS = ('cathedral', 'streaky', 'seedy', 'opal', 'reamy')
MIX = dict(cathedral=0.38, streaky=0.27, seedy=0.15, reamy=0.2)


def _hexs(c):
    return [c] if isinstance(c, str) else list(c)


class Panel(StainedGlass):
    def __init__(self, S, seed, ambient=0.08, vignette=0.55, sky=('#ffffff', '#f2eee6'), lead=6.0):
        super().__init__(S.W, S.H, seed=seed, record=False, ambient=ambient)
        # stone / iron buffers of the lib are not used by a full-bleed panel
        self.alb = self.relief = self.kind = self.reveal = self.stone_tex = self.bar_rgb = None
        self.S = S
        self.s = S.s
        self.win[:] = 1.0
        self.vig = vignette
        self._sky = sky
        self.lead_w = lead
        self.seed0 = seed
        self.track = TRACK
        self.fp = {}
        self._cur = None
        self.gidx = -1
        self.gnames = []
        self.DX = ((self.XX - S.ox) / S.s).astype(np.float32)
        self.DY = ((self.YY - S.oy) / S.s).astype(np.float32)
        self.pp = {k: [] for k in ('col', 'col2', 'mix', 'thick', 'kind', 'ang', 'amp', 'freq', 'off', 'seeds',
                                   'opal', 'gang', 'gamt', 'pit', 'group', 'region', 'warp', 'cx', 'cy')}
        self.nreg = 0
        self.lead_a = None
        if TRACK:
            LAST['g'] = self

    # ------------------------------------------------------------------ groups
    def group(self, name):
        """start a layer group: fresh generators for it; returns the scene's own generator"""
        self._close()
        self.rng = drawkit.group_rng(self.seed0, name)
        self.gidx = len(self.gnames)
        self.gnames.append(name)
        if self.track:
            self._cur = (name, self.label.copy(), self.trace_a.copy(), self.matt_a.copy(),
                         self.scratch_a.copy(), self.stain_a.copy())
        return drawkit.group_rng(self.seed0, name)

    def _close(self):
        if self._cur is not None:
            name, lab, tr, ma, sc, st = self._cur
            self.fp[name] = ((lab != self.label) | (tr != self.trace_a) | (ma != self.matt_a)
                             | (sc != self.scratch_a) | (st != self.stain_a))
            self._cur = None

    def finish(self, lead=None, grime=0.25, pits=0.25):
        self._close()
        self.rng = drawkit.group_rng(self.seed0, 'finish')
        self.lead(width=(lead or self.lead_w) * self.s)
        self.weather(grime=grime, pits=pits)

    # ================================================================== laying glass
    def _lay(self, b, sub, keys, pal_of_key, flow=0.0, flow_jit=0.35, mix=None, streak=1.0, seeds=1.0,
             thick=1.0, vary=1.0, opal=None, merge=True, amin=700.0, tmin=13.0):
        """write pieces (one per distinct key) into the box b where sub is set; tidy and register them"""
        s = self.s
        uk, inv = np.unique(keys, return_inverse=True)
        n = len(uk)
        L = np.full(sub.shape, -1, np.int64)
        L[sub] = inv.reshape(-1)
        pal = [pal_of_key(k) for k in uk]
        if merge and n > 1:
            L = self._merge_small(L, n, amin * s * s, tmin * s)
        # compact ids
        ids = np.unique(L[L >= 0])
        mp = np.full(n, -1, np.int64)
        mp[ids] = np.arange(len(ids))
        L = np.where(L >= 0, mp[np.maximum(L, 0)], -1)
        pal = [pal[i] for i in ids]
        n = len(ids)
        # wipe earlier paint under the new glass, write labels
        for a in (self.trace_a, self.matt_a, self.scratch_a, self.stain_a):
            a[b][sub] = 0
        base = len(self.pp['col'])
        before = self.label[b].copy()
        lab = self.label[b]
        lab[sub] = (L[sub] + base).astype(np.int32)
        # piece centroids (design) for props
        sel = L >= 0
        cnt = np.bincount(L[sel], minlength=n) + 1e-6
        cx = np.bincount(L[sel], self.DX[b][sel], n) / cnt
        cy = np.bincount(L[sel], self.DY[b][sel], n) / cnt
        self._props(n, pal, cx, cy, flow, flow_jit, mix, streak, seeds, thick, vary, opal)
        self._clean_remnants(b, sub, before, base)
        self._T = None
        return base, n

    def _props(self, n, pal, cx, cy, flow, flow_jit, mix, streak, seeds, thick, vary, opal):
        r = self.rng
        mix = mix or MIX
        kinds = list(mix.keys())
        pr = np.array([mix[k] for k in kinds], float)
        pr /= pr.sum()
        reg = self.nreg
        self.nreg += 1
        P = self.pp
        for i in range(n):
            cols = _hexs(pal[i])
            kind = kinds[int(r.choice(len(kinds), p=pr))]
            c = lin(cols[int(r.integers(0, len(cols)))])
            c = np.clip(c * np.exp(r.normal(0, 0.13 * vary)) * np.exp(r.normal(0, 0.045 * vary, 3)), 1e-4, 1)
            u = r.random()
            if len(cols) > 1 and u < 0.5:
                c2 = lin(cols[int(r.integers(0, len(cols)))]) * np.exp(r.normal(0, 0.1))
            elif u < 0.8:
                c2 = c ** r.uniform(0.35, 0.6)                            # paler wisps
            else:
                c2 = c ** r.uniform(1.4, 1.9)                             # darker cords
            fl = flow(cx[i], cy[i]) if callable(flow) else flow
            ang = (fl + r.normal(0, flow_jit)) if (fl is not None and r.random() < 0.8) else r.uniform(0, np.pi)
            amp = {'cathedral': r.uniform(0.10, 0.28), 'streaky': r.uniform(0.25, 0.55), 'seedy': r.uniform(0.04, 0.14),
                   'opal': r.uniform(0.08, 0.2), 'reamy': r.uniform(0.25, 0.5)}[kind] * streak
            P['mix'].append({'streaky': r.uniform(0.35, 0.8), 'opal': r.uniform(0.1, 0.35)}.get(kind, r.uniform(0, 0.15)))
            P['seeds'].append(seeds * {'seedy': r.uniform(0.5, 1.0), 'reamy': r.uniform(0.08, 0.22),
                                       'cathedral': r.uniform(0.0, 0.08)}.get(kind, r.uniform(0.0, 0.04)))
            op = opal if opal is not None else 0.0
            P['opal'].append(r.uniform(0.35, 0.6) if kind == 'opal' else op * r.uniform(0.6, 1.2))
            P['col'].append(c.astype(np.float32))
            P['col2'].append(np.clip(c2, 1e-4, 1).astype(np.float32))
            P['thick'].append(thick * r.uniform(0.82, 1.25) * (0.75 if kind == 'seedy' else 1.0))
            P['kind'].append(KINDS.index(kind))
            P['ang'].append(float(ang))
            P['amp'].append(float(amp))
            P['freq'].append(float(r.uniform(0.55, 1.7)))
            P['off'].append(float(r.uniform(0, 6000)))
            P['gang'].append(float(r.uniform(0, 2 * np.pi)))
            P['gamt'].append(float(r.uniform(0.05, 0.3)))
            P['pit'].append(float(r.uniform(0.4, 1.0) if r.random() < 0.18 else r.uniform(0, 0.1)))
            P['warp'].append(float({'reamy': r.uniform(1.2, 2.2), 'streaky': r.uniform(0.6, 1.4)}.get(kind, r.uniform(0.2, 0.8))))
            P['group'].append(self.gidx)
            P['region'].append(reg)
            P['cx'].append(float(cx[i]))
            P['cy'].append(float(cy[i]))

    def _merge_small(self, L, n, amin, tmin):
        """merge pieces too small or too thin to cut into the neighbour they share most edge with"""
        for _ in range(4):
            area = np.bincount(L[L >= 0], minlength=n)
            a = np.concatenate([L[:, :-1].ravel(), L[:-1, :].ravel()])
            c = np.concatenate([L[:, 1:].ravel(), L[1:, :].ravel()])
            d = a != c
            a, c = a[d], c[d]
            per = np.bincount(a[a >= 0], minlength=n) + np.bincount(c[c >= 0], minlength=n)
            small = (area > 0) & ((area < amin) | (2 * area < per * tmin))
            if not small.any():
                break
            src = np.concatenate([a, c]); dst = np.concatenate([c, a])
            ok = (src >= 0) & (dst >= 0) & small[np.maximum(src, 0)] & ~small[np.maximum(dst, 0)]
            src, dst = src[ok], dst[ok]
            if len(src) == 0:
                break
            key, cnt = np.unique(src * n + dst, return_counts=True)
            s_, d_ = key // n, key % n
            order = np.lexsort((-cnt, s_))
            s_, d_ = s_[order], d_[order]
            first = np.r_[True, s_[1:] != s_[:-1]]
            mp = np.arange(n, dtype=np.int64)
            mp[s_[first]] = d_[first]
            L = np.where(L >= 0, mp[np.maximum(L, 0)], -1)
        return L

    def _clean_remnants(self, b, sub, before, base):
        """earlier pieces the new glass has cut: thin leftovers (slivers, wedges, notches narrower than a
        cuttable piece) and tiny leftovers are given to the new glass or to a neighbouring piece"""
        s = self.s
        r = max(2, int(round(8 * s)))
        H, W = self.H, self.W
        y0, y1 = max(0, b[0].start - 3 * r), min(H, b[0].stop + 3 * r)
        x0, x1 = max(0, b[1].start - 3 * r), min(W, b[1].stop + 3 * r)
        Z = (slice(y0, y1), slice(x0, x1))
        L = self.label[Z].copy()
        new = L >= base
        old = (L >= 0) & ~new
        if not old.any():
            return
        # which old pieces were cut, and how much of each is left
        bb = before[sub]
        cut_ids = np.unique(bb[bb >= 0])
        if len(cut_ids) == 0:
            return
        is_cut = np.zeros(base + 1, bool)
        is_cut[cut_ids] = True
        Lc = np.where(old, L, base)
        cand = old & is_cut[Lc]
        # near the new glass only
        nb = new.copy()
        for _ in range(2):
            nb = _dilate(nb, r)
        cand &= nb
        if not cand.any():
            return
        # opening of the old labels (square, separable): what survives is at least 2r+1 wide
        E = old.copy()
        for k in range(1, r + 1):
            E &= _eq_shift(L, k, 1) & _eq_shift(L, -k, 1)
        E2 = E.copy()
        for k in range(1, r + 1):
            E2 &= _eq_shift(L, k, 0, E) & _eq_shift(L, -k, 0, E)
        D = E2.copy()
        for k in range(1, r + 1):
            D |= _has_shift(L, k, 1, E2) | _has_shift(L, -k, 1, E2)
        O = D.copy()
        for k in range(1, r + 1):
            O |= _has_shift(L, k, 0, D) | _has_shift(L, -k, 0, D)
        drop = cand & ~O
        # tiny leftovers go whole
        area = np.bincount(self.label[self.label >= 0], minlength=base + 1)[:base + 1]
        tiny = np.zeros(base + 1, bool)
        tiny[cut_ids] = area[cut_ids] < 700 * s * s
        drop |= old & tiny[Lc] & is_cut[Lc]
        if not drop.any():
            return
        # reassign dropped pixels by growing from their neighbours (the new glass first)
        A = np.where(drop, -2, L)
        for _ in range(4 * r + 8):
            todo = A == -2
            if not todo.any():
                break
            best = np.full(A.shape, -2, np.int64)
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                nbv = _shift_fill(A, dx, dy, -2)
                take = todo & (nbv >= 0) & ((best < 0) | ((nbv >= base) & (best < base)))
                best = np.where(take, nbv, best)
            A = np.where(todo & (best >= 0), best, A)
        A = np.where(A == -2, L, A)
        self.label[Z] = A.astype(np.int32)

    # ------------------------------------------------------------------ cut designs
    def glass(self, mask, colour, cuts=(), colour_fn=None, **kw):
        """one piece of glass, or a few pieces split along `cuts`: ('h', f(x)->y), ('v', f(y)->x) or
        ('line', (x0, y0, x1, y1)) in design coordinates. colour: hex or list (random per piece);
        colour_fn(cx, cy) -> hex/list per piece (design centroid)"""
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        sub = m[b]
        X, Y = self.DX[b][sub], self.DY[b][sub]
        keys = np.zeros(len(X), np.int64)
        for i, c in enumerate(cuts):
            keys |= (_side(c, X, Y).astype(np.int64) << i)
        if colour_fn is not None:
            uk, inv = np.unique(keys, return_inverse=True)
            cnt = np.bincount(inv.reshape(-1)) + 1e-6
            cxs = np.bincount(inv.reshape(-1), X) / cnt
            cys = np.bincount(inv.reshape(-1), Y) / cnt
            table = {int(k): colour_fn(cxs[i], cys[i]) for i, k in enumerate(uk)}
            return self._lay(b, sub, keys, lambda k: table[int(k)], **kw)
        return self._lay(b, sub, keys, lambda k: colour, **kw)

    def band(self, mask, colours, top, bot, rows=None, row_h=60.0, levels=None, length=(140, 300), columns=(),
             cut_dir=None, tilt=0.3, bend=0.25, size=None, feature=None, fid_colours=None, run_edit=None,
             row_colours=None, colour_fn=None, wave=(0.12, 260.0), vertical=False, stagger=True, **kw):
        """cut an area into rows following its outline (top(a) .. bot(a), design coordinates; with
        vertical=True `a` is y and the rows run downward, for trunks) and cut every row across.
        rows: fixed row count, else row_h: target row height (count per column from its thickness);
        levels: absolute row boundaries instead (perspective water rows); columns: list of f(c)->a long cuts
        through all rows; cut_dir(a, c): tilt of the cross cuts (radians from square); size(a, c): factor on
        the piece length; feature(a_array, c_array) -> int id: cuts where it changes, colours by id
        (fid_colours), run_edit(runs, row_c, rng) may break/shorten runs; row_colours: palette per row."""
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        sub = m[b]
        r = self.rng
        X, Y = self.DX[b][sub], self.DY[b][sub]
        A, C = (Y, X) if vertical else (X, Y)
        ci = np.zeros(len(A), np.int64)
        for f in columns:
            ci += A > f(C)
        keys = np.zeros(len(A), np.int64)
        pal = {}
        for col in np.unique(ci):
            pc = ci == col
            Ac, Cc = A[pc], C[pc]
            amin, amax = float(Ac.min()), float(Ac.max())
            ga = np.linspace(amin, amax, 200)
            T = np.maximum(bot(ga) - top(ga), 1.0)
            # row boundaries
            if levels is not None:
                bnds = [(lambda a, y=float(y), ph=r.uniform(0, 6.3), lam=r.uniform(0.7, 1.4) * wave[1],
                         am=r.uniform(0.3, 1.0) * wave[0]: y + am * np.sin(a / lam + ph)) for y in levels]
                nrow = len(levels) + 1
            else:
                n = rows if rows is not None else max(1, int(np.floor(np.quantile(T, 0.2) / row_h + 0.35)))
                vs = [(j + r.uniform(-0.12, 0.12)) / n for j in range(1, n)]
                bnds = []
                for v in vs:
                    ph, lam = r.uniform(0, 6.3), r.uniform(0.7, 1.4) * wave[1]
                    am = wave[0] / n * r.uniform(0.3, 1.0)
                    bnds.append(lambda a, v=v, ph=ph, lam=lam, am=am:
                                top(a) + (v + am * np.sin(a / lam + ph)) * np.maximum(bot(a) - top(a), 1.0))
                nrow = n
            ri = np.zeros(len(Ac), np.int64)
            for f in bnds:
                ri += Cc > f(Ac)
            prev_cuts = []
            for row in range(nrow):
                pr = ri == row
                if not pr.any():
                    continue
                Ar, Cr = Ac[pr], Cc[pr]
                a0, a1 = float(Ar.min()), float(Ar.max())
                up = (lambda a: top(a)) if row == 0 else bnds[row - 1]
                dn = (lambda a: bot(a)) if row == nrow - 1 else bnds[row]
                if levels is not None:
                    up = (lambda a: np.full_like(np.asarray(a, float), float(Cr.min()))) if row == 0 else bnds[row - 1]
                    dn = (lambda a: np.full_like(np.asarray(a, float), float(Cr.max()))) if row == nrow - 1 else bnds[row]
                mid = lambda a, up=up, dn=dn: (up(a) + dn(a)) / 2
                hgt = lambda a, up=up, dn=dn: np.maximum(dn(a) - up(a), 8.0)
                # runs of features along the row's centre line
                if feature is not None:
                    xs = np.arange(a0, a1 + 2, 2.0)
                    fid = np.asarray(feature(xs, mid(xs)), np.int64)
                    ch = np.nonzero(np.diff(fid))[0]
                    starts = np.r_[0, ch + 1]
                    ends = np.r_[ch + 1, len(xs)]
                    runs = [[xs[i0], xs[min(i1, len(xs) - 1)], int(fid[i0])] for i0, i1 in zip(starts, ends)]
                    runs[0][0], runs[-1][1] = a0 - 1, a1 + 1
                    if run_edit is not None:
                        runs = run_edit(runs, float(np.median(mid(xs))), r)
                    runs = _merge_runs(runs, 14.0)
                else:
                    runs = [[a0 - 1, a1 + 1, 0]]
                cuts = []          # (position, fid of the run that ends here, mandatory)
                for k, (ra, rb, fd) in enumerate(runs):
                    x = ra
                    while True:
                        h = float(hgt(np.array([x]))[0])
                        sz = float(size(x, float(mid(np.array([x]))[0]))) if size is not None else 1.0
                        ell = np.clip(r.uniform(*length) * sz, 1.3 * h, 4.0 * h)
                        ell = max(ell, 34.0)
                        if rb - x < 1.5 * ell:
                            break
                        nx = x + ell * r.uniform(0.85, 1.15)
                        if stagger and prev_cuts:
                            dmin = min(abs(nx - p) for p in prev_cuts)
                            if dmin < 0.22 * ell:
                                nx += 0.35 * ell
                        if rb - nx < 0.6 * ell:
                            break
                        cuts.append((nx, fd))
                        x = nx
                    if k < len(runs) - 1:
                        cuts.append((rb, fd))
                cuts.sort(key=lambda t: t[0])
                idx = np.zeros(len(Ar), np.int64)
                for (xc, fd) in cuts:
                    cc = float(mid(np.array([xc]))[0])
                    hc = float(hgt(np.array([xc]))[0])
                    th = (cut_dir(xc, cc) if cut_dir is not None else 0.0) + r.normal(0, tilt)
                    th = float(np.clip(th, -0.9, 0.9))
                    ca, sa = np.cos(th), np.sin(th)
                    da, dc = Ar - xc, Cr - cc
                    along = np.clip(da * sa + dc * ca, -0.75 * hc, 0.75 * hc)
                    idx += (da * ca - dc * sa + np.clip(r.normal(0, bend), -1.2, 1.2) * along * along / max(hc, 70.0)) > 0
                prev_cuts = [c[0] for c in cuts]
                fids = [c[1] for c in cuts] + [runs[-1][2]]
                base_key = (int(col) * 64 + row) * 1024
                keys_r = base_key + idx
                sel = np.nonzero(pc)[0][pr]
                keys[sel] = keys_r
                for j in np.unique(idx):
                    fd = fids[min(int(j), len(fids) - 1)]
                    if fid_colours is not None and fd in fid_colours:
                        p_ = fid_colours[fd]
                    elif row_colours is not None:
                        p_ = row_colours[min(row, len(row_colours) - 1)]
                    else:
                        p_ = colours
                    pal[base_key + int(j)] = p_
        if colour_fn is not None:
            uk, inv = np.unique(keys, return_inverse=True)
            cnt = np.bincount(inv.reshape(-1)) + 1e-6
            cxs, cys = np.bincount(inv.reshape(-1), X) / cnt, np.bincount(inv.reshape(-1), Y) / cnt
            for i, k in enumerate(uk):
                p_ = colour_fn(cxs[i], cys[i], pal[int(k)])
                if p_ is not None:
                    pal[int(k)] = p_
        return self._lay(b, sub, keys, lambda k: pal[int(k)], **kw)

    def contour(self, mask, colours, row_h=50.0, vertical=False, **kw):
        """band() whose rows follow the area's own outline (top / bottom of the mask in every column)"""
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        D = self.DY if not vertical else self.DX
        Aa = self.DX if not vertical else self.DY
        mm = m[b] if not vertical else m[b].T
        Dv = D[b] if not vertical else D[b].T
        av = (Aa[b][0, :] if not vertical else Aa[b][:, 0])
        big = np.where(mm, Dv, np.inf).min(0)
        sml = np.where(mm, Dv, -np.inf).max(0)
        ok = np.isfinite(big)
        av, big, sml = av[ok], big[ok], sml[ok]
        k = max(1, int(round(8 * self.s)))
        big = _smooth1(big, k)
        sml = _smooth1(sml, k)
        top = lambda a: np.interp(a, av, big)
        bot = lambda a: np.interp(a, av, sml)
        return self.band(mask, colours, top, bot, row_h=row_h, vertical=vertical, **kw)

    def radial(self, mask, colours, centre, rings, length=(100, 200), tilt=0.06, ring_colours=None,
               colour_fn=None, **kw):
        """rings and spokes around a point (design): rings = radii of the ring boundaries"""
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        sub = m[b]
        r = self.rng
        X, Y = self.DX[b][sub], self.DY[b][sub]
        cx, cy = centre
        R = np.hypot(X - cx, Y - cy)
        TH = np.arctan2(Y - cy, X - cx)
        ri = np.zeros(len(R), np.int64)
        for rr in rings:
            ph, k_, am = r.uniform(0, 6.3), int(r.integers(3, 7)), r.uniform(0.02, 0.05) * rr
            ri += R > rr + am * np.sin(k_ * TH + ph)
        keys = np.zeros(len(R), np.int64)
        pal = {}
        edges = [0.0] + list(rings) + [float(R.max()) + 1]
        for k in np.unique(ri):
            pk = ri == k
            rm = 0.5 * (edges[k] + edges[min(k + 1, len(edges) - 1)])
            ell = r.uniform(*length)
            nsp = max(1, int(round(2 * np.pi * rm / ell))) if k > 0 else 1
            if nsp > 1:
                a = np.sort((r.uniform(0, 2 * np.pi) + np.arange(nsp) * 2 * np.pi / nsp
                             + r.normal(0, 0.18 * np.pi / nsp, nsp)) % (2 * np.pi))
                tw = r.normal(0, tilt, nsp)
                th = (TH[pk] + np.pi) % (2 * np.pi)
                rel = (R[pk] - rm) / max(rm, 1)
                idx = _sector(th, a, tw, rel)
            else:
                idx = np.zeros(pk.sum(), np.int64)
            sel = np.nonzero(pk)[0]
            keys[sel] = k * 4096 + idx
            for j in np.unique(idx):
                pal[int(k * 4096 + j)] = ring_colours[min(k, len(ring_colours) - 1)] if ring_colours else colours
        if colour_fn is not None:
            uk, inv = np.unique(keys, return_inverse=True)
            cnt = np.bincount(inv.reshape(-1)) + 1e-6
            cxs, cys = np.bincount(inv.reshape(-1), X) / cnt, np.bincount(inv.reshape(-1), Y) / cnt
            for i, k in enumerate(uk):
                p_ = colour_fn(cxs[i], cys[i], pal[int(k)])
                if p_ is not None:
                    pal[int(k)] = p_
        return self._lay(b, sub, keys, lambda k: pal[int(k)], **kw)

    # ================================================================== the glass itself
    def _fields(self):
        if hasattr(self, '_thick_n'):
            return
        H, W, s = self.H, self.W, self.s
        L = self._lazy
        self._thick_n = (noise2d(H, W, 90 * s, 3, L[0]) * 2 - 1).astype(np.float32)
        self._warp = (noise2d(H, W, 170 * s, 3, L[1]) - 0.5).astype(np.float32)
        self._mott = noise2d(H, W, 22 * s, 4, L[2]).astype(np.float32)
        self._fine = (noise2d(H, W, 3.5 * s, 2, L[5]) * 2 - 1).astype(np.float32)
        nd = 16000
        self._tab_b = (0.65 * fbm1d(nd, 70, 4, 1001) + 0.35 * fbm1d(nd, 18, 3, 1002)).astype(np.float32)
        self._tab_b /= np.abs(self._tab_b).max() * 0.75
        c = fbm1d(nd, 5, 3, 1003)
        self._tab_c = (np.sign(c) * np.abs(c) ** 0.6).astype(np.float32)
        self._tab_c /= np.abs(self._tab_c).max()

    def _glass_T(self):
        if self._T is not None:
            return self._T
        self._fields()
        H, W = self.H, self.W
        lab = self.label
        m = lab >= 0
        T = np.zeros((H, W, 3), np.float32)
        if not m.any():
            self._T = T
            return T
        P = {k: np.asarray(v, np.float32) for k, v in self.pp.items() if k not in ('col', 'col2')}
        col = np.asarray(self.pp['col'], np.float32)
        col2 = np.asarray(self.pp['col2'], np.float32)
        idx = lab[m]
        Xd, Yd = self.DX[m], self.DY[m]
        a = P['ang'][idx]
        kind = P['kind'][idx].astype(np.int64)
        u = (Xd * np.cos(a) + Yd * np.sin(a)) * P['freq'][idx] + P['off'][idx] + self._warp[m] * 60 * P['warp'][idx] + 600
        u = np.clip(u, 0, len(self._tab_b) - 2)
        sb = np.interp(u, np.arange(len(self._tab_b)), self._tab_b)
        sc = np.interp(u * 1.0, np.arange(len(self._tab_c)), self._tab_c)
        cord = np.where(kind == 1, 0.2, np.where(kind == 4, 0.3, 0.08)).astype(np.float32)
        st = np.clip((1 - cord) * sb + cord * sc, -1.4, 1.4)
        del sb, sc, u
        ga = P['gang'][idx]
        cxp, cyp = P['cx'], P['cy']                                 # stored when the piece was cut
        grad = ((Xd - cxp[idx]) * np.cos(ga) + (Yd - cyp[idx]) * np.sin(ga)) / 100.0
        th = P['thick'][idx] * (1 + 0.14 * self._thick_n[m]) * np.clip(1 + P['gamt'][idx] * grad, 0.6, 1.6)
        th *= np.clip(1 + 0.7 * P['amp'][idx] * st, 0.25, 3)
        c1 = col[idx]
        Tm = c1 ** th[:, None]
        # wisps of the second colour (streaky), following the same reams
        w = (P['mix'][idx] * smoothstep(-0.1, 0.9, st) ** 1.5)[:, None]
        Tm = Tm * (1 - w) + (col2[idx] ** th[:, None]) * w
        # opalescence: a milky, mottled, less transparent glass
        op = P['opal'][idx]
        if (op > 0).any():
            mott = self._mott[m]
            o = np.clip(op * (0.55 + 0.9 * mott), 0, 0.95)[:, None]
            milk = (0.55 * c1 + 0.45) ** (0.8 * th[:, None]) * (0.62 + 0.25 * mott[:, None])
            Tm = Tm * (1 - o) + milk * o
        Tm *= (1 + 0.035 * self._fine[m])[:, None]
        T[m] = Tm
        del Tm, c1, th, st
        T *= (1 + self._bubbles())[..., None]
        self._T = np.clip(T, 0, 1.25).astype(np.float32)
        return self._T

    def _bubbles(self):
        """seeds: fixed candidate spots over the canvas, accepted by the piece's own seed density; drawn out
        along the piece's reams, a bright core in a dark refracting rim, kept inside the piece"""
        H, W, s = self.H, self.W, self.s
        lab = self.label
        r = np.random.default_rng(self._lazy[3])
        n = int((W / s) * (H / s) / 260)
        py = (r.random(n) * H).astype(np.int64)
        px = (r.random(n) * W).astype(np.int64)
        acc = r.random(n)
        Lb, wb, amp = r.uniform(1.0, 4.2, n), r.uniform(0.7, 1.7, n), r.uniform(0.4, 1.0, n)
        big = r.random(n) < 0.12
        Lb = np.where(big, Lb * 1.7, Lb)
        wb = np.where(big, wb * 1.4, wb)
        out = np.zeros(H * W, np.float32)
        l = lab[py, px]
        seeds = np.asarray(self.pp['seeds'] + [0.0], np.float32)
        ang = np.asarray(self.pp['ang'] + [0.0], np.float32)
        keep = (l >= 0) & (acc < seeds[l] * 0.9)
        if not keep.any():
            return out.reshape(H, W)
        py, px, l = py[keep], px[keep], l[keep]
        Lb, wb, amp = Lb[keep] * s, wb[keep] * s, amp[keep]
        a = ang[l]
        R = int(np.ceil(6 * s)) + 1
        ky, kx = np.mgrid[-R:R + 1, -R:R + 1]
        ky, kx = ky.ravel().astype(np.float32), kx.ravel().astype(np.float32)
        for c0 in range(0, len(py), 4000):
            sl = slice(c0, c0 + 4000)
            ca, sa = np.cos(a[sl])[:, None], np.sin(a[sl])[:, None]
            uu = kx[None] * ca + ky[None] * sa
            vv = -kx[None] * sa + ky[None] * ca
            e = np.sqrt((uu / np.maximum(Lb[sl], wb[sl])[:, None]) ** 2 + (vv / wb[sl][:, None]) ** 2)
            k = (0.6 * np.exp(-e * e * 3) - 0.42 * np.exp(-((e - 1.05) ** 2) / 0.06)) * amp[sl][:, None]
            yy = py[sl][:, None] + ky[None].astype(np.int64)
            xx = px[sl][:, None] + kx[None].astype(np.int64)
            ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
            yy, xx = np.clip(yy, 0, H - 1), np.clip(xx, 0, W - 1)
            ok &= lab[yy, xx] == l[sl][:, None]
            out += np.bincount((yy * W + xx)[ok], k[ok], H * W).astype(np.float32)
        return out.reshape(H, W)

    # ================================================================== lead, weather
    def lead(self, width=6.0, solder=True):
        """came on every boundary between pieces: a little wider between areas than inside one and varying
        slowly along its run; flat face, rounded edges; a solder blob at every joint"""
        s = self.s
        lab = self.label
        H, W = self.H, self.W
        reg = np.asarray(self.pp['region'] + [-1], np.int64)[lab]
        B = np.zeros((H, W), bool)
        Bs = np.zeros((H, W), bool)
        dh = lab[:, 1:] != lab[:, :-1]
        dv = lab[1:, :] != lab[:-1, :]
        rh = reg[:, 1:] != reg[:, :-1]
        rv = reg[1:, :] != reg[:-1, :]
        B[:, 1:] |= dh; B[:, :-1] |= dh; B[1:, :] |= dv; B[:-1, :] |= dv
        Bs[:, 1:] |= rh; Bs[:, :-1] |= rh; Bs[1:, :] |= rv; Bs[:-1, :] |= rv
        hw0 = width / 2
        wn = noise2d(H, W, 90 * s, 2, self._lazy[4])
        wfac = (0.86 + 0.26 * wn) * np.where(Bs, 1.2, 0.92)
        sg = max(1.0, hw0)
        wsum = blur((B * wfac).astype(np.float32), sg)
        bsum = blur(B.astype(np.float32), sg)
        hw = (hw0 * np.where(bsum > 1e-4, wsum / np.maximum(bsum, 1e-4), 1.0)).astype(np.float32)
        del wsum, bsum, wn, wfac, reg
        Rm = int(np.ceil(hw0 * 1.4 + 3))
        d = _edt(B, Rm) + 0.5
        self.bd = d.astype(np.float32)                                     # raw distance to the cut line
        cov = smoothstep(hw + 0.7, hw - 0.7, d)
        t = np.clip((hw - d) / (0.55 * hw + 1e-3), 0, 1)
        hgt = np.sqrt(t) * hw * 0.8
        # solder joints where three pieces meet
        sol_a = np.zeros((H, W), np.float32)
        if solder:
            a_, b_, c_, e_ = lab[:-1, :-1], lab[:-1, 1:], lab[1:, :-1], lab[1:, 1:]
            cnt = 1 + (b_ != a_) + ((c_ != a_) & (c_ != b_)) + ((e_ != a_) & (e_ != b_) & (e_ != c_))
            jy, jx = np.nonzero(cnt >= 3)
            if len(jy):
                cell = max(2.0, hw0 * 1.3)
                key = (jy // cell).astype(np.int64) * 100000 + (jx // cell).astype(np.int64)
                _, first = np.unique(key, return_index=True)
                jy, jx = jy[first] + 0.5, jx[first] + 0.5
                n = len(jy)
                u = [_hash01(jy.astype(np.int64), jx.astype(np.int64), self._lazy[5] + k) for k in range(5)]
                cy_ = jy + (u[0] - 0.5) * 0.5 * hw0
                cx_ = jx + (u[1] - 0.5) * 0.5 * hw0
                rb = hw0 * (1.15 + 0.3 * u[2])
                ex = 0.7 + 0.3 * u[3]
                ro = np.pi * u[4]
                R = int(np.ceil(hw0 * 1.7 * 1.25 + 2))
                ky, kx = np.mgrid[-R:R + 1, -R:R + 1]
                ky, kx = ky.ravel(), kx.ravel()
                jd = np.full(H * W, 9.0, np.float32)
                for c0 in range(0, n, 3000):
                    sl = slice(c0, c0 + 3000)
                    yy = np.round(cy_[sl])[:, None].astype(np.int64) + ky[None]
                    xx = np.round(cx_[sl])[:, None].astype(np.int64) + kx[None]
                    dy = yy - cy_[sl][:, None]
                    dx = xx - cx_[sl][:, None]
                    c, si = np.cos(ro[sl])[:, None], np.sin(ro[sl])[:, None]
                    uu = (dx * c + dy * si) * ex[sl][:, None]
                    vv = (-dx * si + dy * c) / ex[sl][:, None]
                    q = (np.hypot(uu, vv) / rb[sl][:, None]).astype(np.float32)
                    ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W) & (q < 1.6)
                    np.minimum.at(jd, (yy * W + xx)[ok], q[ok])
                jd = jd.reshape(H, W)
                lump = noise2d(H, W, 4 * s, 2, self._lazy[5] + 3)
                jd = jd * (0.92 + 0.16 * lump)
                sol_a = smoothstep(1.0 + 0.6 / hw0, 1.0 - 0.6 / hw0, jd).astype(np.float32)
                hs = np.sqrt(np.clip(1 - jd * jd, 0, 1)) * hw0 * 0.95
                hgt = np.maximum(hgt, hs)
                del jd, lump, hs
        cov_all = np.maximum(cov, sol_a)
        gy, gx = np.gradient(blur(hgt, 0.6 * s + 0.3))
        nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1)
        nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        Ld = np.array([-0.35, -0.6, 0.72], np.float32); Ld /= np.linalg.norm(Ld)
        diff = np.clip(nrm @ Ld, 0, 1)
        hv = Ld + np.array([0, 0, 1], np.float32); hv /= np.linalg.norm(hv)
        spec = np.clip(nrm @ hv, 0, 1)
        del nrm
        pat = noise2d(H, W, 12 * s, 3, self._lazy[4] + 11)
        alb = lin('#2c2d31') * (0.8 + 0.5 * pat)[..., None]
        alb = alb * (1 - sol_a[..., None]) + lin('#4a4c4f') * (0.75 + 0.5 * pat)[..., None] * sol_a[..., None]
        rgb = alb * (0.28 + 0.9 * diff)[..., None] + ((0.03 + 0.05 * sol_a) * spec ** (30 - 10 * sol_a))[..., None]
        self.came_a = cov.astype(np.float32)
        self.sol_a = sol_a
        self.lead_a = cov_all.astype(np.float32)
        self.lead_rgb = (rgb * 0.55).astype(np.float32)
        self.lead_d = (d - hw).astype(np.float32) + hw0
        self._T = None

    def weather(self, grime=0.25, pits=0.25):
        H, W, s = self.H, self.W, self.s
        nz = noise2d(H, W, 70 * s, 4, self._lazy[4] + 21)
        near = smoothstep(7 * s, 2 * s, self.lead_d) if self.lead_d is not None else 0
        g = grime * np.clip(0.25 * nz + 0.45 * near * nz, 0, 1)
        Tm = 1 - g[..., None] * (1 - lin('#d8c6a2'))[None, None, :] * 1.3
        out = np.ones(H * W, np.float32)
        lab = self.label
        if pits and len(self.pp['col']):
            r = np.random.default_rng(self._lazy[4] + 33)
            level = np.asarray(self.pp['pit'] + [0.0], np.float32) * pits
            n = int((W / s) * (H / s) / 200)
            py, px, acc, rad = (r.random(n) * H).astype(np.int64), (r.random(n) * W).astype(np.int64), r.random(n), r.uniform(0.6, 1.9, n)
            l = lab[py, px]
            keep = (l >= 0) & (acc < level[l])
            py, px, rad = py[keep], px[keep], rad[keep] * s
            R = int(np.ceil(3 * s)) + 1
            ky, kx = np.mgrid[-R:R + 1, -R:R + 1]
            ky, kx = ky.ravel(), kx.ravel()
            yy, xx = py[:, None] + ky[None], px[:, None] + kx[None]
            ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
            e = np.hypot(kx, ky)[None].astype(np.float32) / rad[:, None]
            k = np.log(np.clip(1 - 0.55 * np.exp(-e * e * 1.5) + 0.12 * np.exp(-((e - 1.6) ** 2) / 0.3), 0.05, 2))
            out = np.exp(np.bincount((yy * W + xx)[ok], k[ok], H * W)).astype(np.float32)
        self.weather_T = (Tm * out.reshape(H, W)[..., None]).astype(np.float32)

    # ================================================================== compositing
    def _daylight(self):
        H, W, s = self.H, self.W, self.s
        top, bot = self._sky
        if not hasattr(self, '_cloud'):
            self._cloud = noise2d(H, W, 340 * s, 3, self._lazy[4] + 5)
        t = (self.YY / H)[..., None]
        return (lin(top) * (1 - t) + lin(bot) * t) * (0.88 + 0.2 * self._cloud)[..., None]

    def _paint_T(self, pmask=None):
        """transmission of the fired paint and stain (H, W, 3)"""
        tr, ma, sc = self.trace_a, self.matt_a, self.scratch_a
        P = 1 - (1 - tr * (1 - sc)) * (1 - ma * (1 - sc))
        if pmask is not None:
            P = P * pmask
        out = (1 - P)[..., None] + P[..., None] * PAINT_T
        if self.stain_a.any():
            Sx = np.clip(self.stain_a, 0, 1.6)
            if pmask is not None:
                Sx = Sx * pmask
            Sx = Sx[..., None]
            out = out * ((1 - np.minimum(Sx, 1)) + np.minimum(Sx, 1) * lin(STAIN) ** np.maximum(Sx, 1))
        return out.astype(np.float32)

    def _finish_img(self, img, glass_k=0.6):
        H, W, S = self.H, self.W, self.S
        Wv, Hv = S.W - 2 * S.ox, S.H - 2 * S.oy
        k = self.vig
        vx = ((self.XX - S.ox) / Wv - 0.5) * 1.6 * k
        vy = ((self.YY - S.oy) / Hv - 0.48) * 1.5 * k
        img *= (1 - 0.42 * smoothstep(0.35, 1.25, np.hypot(vx, vy)))[..., None]
        hi = img > 0.75
        img[hi] = 0.75 + 0.25 * (1 - np.exp(-(img[hi] - 0.75) / 0.25))
        np.clip(img, 0, 1, out=img)
        img **= 1 / 2.2
        img += (self.grain * 0.018 * (1 - glass_k))[..., None]
        return Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8))

    def composite(self, cartoon=False):
        """the finished panel against daylight"""
        s = self.s
        Eg = self._glass_T().copy()
        Eg[self.label < 0] = (0.92, 0.95, 1.0)
        Eg *= self._paint_T()
        if self.lead_d is not None:
            Eg *= (1 - 0.25 * smoothstep(4.5 * s, 0, self.lead_d - 2.5 * s))[..., None]
        if self.weather_T is not None:
            Eg *= self.weather_T
        Eg *= self._daylight()
        if self.lead_a is not None:
            la = self.lead_a[..., None]
            halo = np.stack([0.07 * blur(Eg[..., c], 1.3 * s) + 0.04 * blur(Eg[..., c], 3.2 * s) for c in range(3)], -1)
            Eg = Eg * (1 - la) + self.lead_rgb * la + halo * la * 0.9
        return self._finish_img(Eg)

    # ================================================================== the workshop (draw-on stages)
    def workshop(self, final, stages_dir, dense):
        """write the draw-on in workshop order; the last stage is `final`"""
        if not stages_dir:
            return
        os.makedirs(stages_dir, exist_ok=True)
        s = self.s
        H, W = self.H, self.W
        lab = self.label
        n_p = len(self.pp['col'])
        grp = np.asarray(self.pp['group'] + [-1], np.int64)
        G = grp[lab]
        ng = len(self.gnames)
        cnt = np.bincount(lab[lab >= 0], minlength=n_p) + 1e-6
        ys, xs = np.nonzero(lab >= 0)
        pcx = np.bincount(lab[ys, xs], xs, n_p) / cnt
        pcy = np.bincount(lab[ys, xs], ys, n_p) / cnt
        vis = cnt > 1
        hw = self.lead_w * s / 2
        bd = self.bd
        n = [0]

        def save(img, name):
            save_png(img, os.path.join(stages_dir, f"{n[0]:03d}_{name}.png"))
            n[0] += 1

        # paper on the light table, the cartoon lines
        paper = lin('#f3eee2') * (0.93 + 0.07 * (noise2d(H, W, 9 * s, 3, self._lazy[0] + 9))[..., None])
        paper = (paper * (1 + 0.06 * self.grain[..., None])).astype(np.float32)
        line = smoothstep(0.55 * hw + 0.6, 0.55 * hw - 0.6, bd).astype(np.float32)
        pencil = np.clip(self.trace_a * 0.5, 0, 1).astype(np.float32)
        table = np.array([1.0, 0.99, 0.95], np.float32) * 0.98
        Tg = self._glass_T()
        PT = self._paint_T()
        gap = hw * 0.9
        edge = (1 - 0.45 * smoothstep(gap + 1.6 * s, gap, bd))[..., None]
        pieces_mask = (bd > gap)[..., None]

        def cartoon(upto):
            mk = (G <= upto) & (G >= 0)
            ln = line * _dilate(mk, max(1, int(hw * 2)))
            img = paper * (1 - 0.86 * ln[..., None]) * (1 - 0.35 * (pencil * mk)[..., None])
            return img

        def bench(laid, painted, leaded, soldered):
            """laid / painted / leaded: per-piece bools; soldered: per-pixel 0..1"""
            Lp = np.append(laid, False)[lab]
            Lp_ = np.append(leaded, False)[lab]
            Pp = np.append(painted, False)[lab].astype(np.float32)
            img = cartoon(ng)
            glass = Tg * (1 + (PT - 1) * Pp[..., None]) * table
            show = (Lp[..., None] & pieces_mask) | Lp_[..., None]
            glass_e = np.where(Lp_[..., None], glass, glass * edge)
            img = np.where(show, glass_e, img)
            if leaded.any():
                lmask = _dilate(Lp_, max(1, int(hw + 1)))
                ca = (self.came_a * lmask)[..., None]
                sa = (self.sol_a * soldered * lmask)[..., None]
                la = np.maximum(ca, sa)
                img = img * (1 - la) + self.lead_rgb * la
                del ca, sa, la
            return self._finish_img(img.astype(np.float32), glass_k=0.0)

        # 1 cartoon, area by area
        cs = range(ng) if dense else [ng - 1]
        for k in cs:
            save(self._finish_img(cartoon(k).astype(np.float32), glass_k=0.0), 'cartoon_' + self.gnames[k])
        # 2 cut glass laid on the cartoon, a section at a time
        laid = np.zeros(n_p, bool)
        none = np.zeros(n_p, bool)
        area = np.array([cnt[(grp[:-1] == k) & vis].sum() for k in range(ng)])
        tot = max(area.sum(), 1)
        for k in range(ng):
            ids = np.nonzero((grp[:-1] == k) & vis)[0]
            if len(ids) == 0:
                continue
            nch = int(np.clip(round(area[k] / tot * 22), 1, 6)) if dense else 1
            order = ids[np.argsort(pcx[ids] + 0.15 * pcy[ids])]
            for c in range(nch):
                laid[order[: int(round(len(order) * (c + 1) / nch))]] = True
                save(bench(laid, none, none, 0), 'cut_%s_%d' % (self.gnames[k], c))
        laid[:] = True
        # 3 the grisaille fired on, section by section
        painted = np.zeros(n_p, bool)
        has_paint = (self.trace_a + self.matt_a + self.stain_a) > 0.05
        pg = [k for k in range(ng) if (has_paint & (G == k)).any()]
        if dense:
            chunks = [pg[i:i + 2] for i in range(0, len(pg), 2)]
        else:
            chunks = [pg]
        for ch in chunks:
            for k in ch:
                painted[grp[:-1] == k] = True
            save(bench(laid, painted, none, 0), 'painted_' + '_'.join(self.gnames[k] for k in ch))
        painted[:] = True
        # 4 leading up, from the bottom-left corner across the panel
        key = pcx / W * 0.8 + (1 - pcy / H)
        order = np.argsort(key)
        nl = 10 if dense else 1
        leaded = np.zeros(n_p, bool)
        for c in range(nl):
            leaded[order[: int(round(n_p * (c + 1) / nl))]] = True
            save(bench(laid, painted, leaded, 0), 'leading_%d' % c)
        # 5 soldering the joints
        nsol = 3 if dense else 1
        front = (self.XX / W * 0.8 + (1 - self.YY / H)).astype(np.float32)
        lo, hi = float(front.min()), float(front.max())
        for c in range(nsol):
            th = lo + (hi - lo) * (c + 1) / nsol
            save(bench(laid, painted, leaded, (front <= th + 1e-6).astype(np.float32)), 'solder_%d' % c)
        # 6 the finished panel against daylight
        save(final, 'final')


# ---------------------------------------------------------------------- helpers
def _hash01(i, j, seed):
    """position-hashed uniform numbers in [0, 1): the same pixel always draws the same value"""
    h = (i * 73856093) ^ (j * 19349663) ^ np.int64(seed * 83492791 & 0x7FFFFFFF)
    h &= 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(1 << 24)


def _side(c, X, Y):
    kind, f = c[0], c[1]
    if kind == 'h':
        return Y > f(X)
    if kind == 'v':
        return X > f(Y)
    x0, y0, x1, y1 = f
    return (X - x0) * (y1 - y0) - (Y - y0) * (x1 - x0) > 0


def _sector(th, a, tw, rel):
    """index of the angular sector (cuts at angles a, each tilted by tw * rel) containing th (0..2pi)"""
    idx = np.zeros(len(th), np.int64)
    for j in range(len(a)):
        idx += ((th - tw[j] * rel) % (2 * np.pi)) >= a[j]
    return idx % len(a)


def _merge_runs(runs, minlen):
    out = []
    for ra, rb, fd in runs:
        if out and (rb - ra < minlen or out[-1][2] == fd):
            out[-1][1] = rb
        else:
            out.append([ra, rb, fd])
    if len(out) > 1 and out[0][1] - out[0][0] < minlen:
        out[1][0] = out[0][0]
        out = out[1:]
    return out


def _smooth1(v, k):
    if len(v) < 3:
        return v
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    p = np.pad(v, k, mode='edge')
    return np.convolve(p, ker, mode='valid')


def _dilate(m, r):
    m = np.asarray(m, bool)
    out = m.copy()
    for k in range(1, r + 1):
        out[:, k:] |= m[:, :-k]; out[:, :-k] |= m[:, k:]
    m2 = out.copy()
    for k in range(1, r + 1):
        out[k:, :] |= m2[:-k, :]; out[:-k, :] |= m2[k:, :]
    return out


def _shift_fill(a, dx, dy, fill):
    out = np.full_like(a, fill)
    H, W = a.shape
    out[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = a[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return out


def _eq_shift(L, k, axis, cond=None):
    """True where the pixel k steps along `axis` has the same label (and `cond` there); out of range: True"""
    out = np.ones(L.shape, bool)
    if axis == 1:
        if k > 0:
            out[:, :-k] = L[:, k:] == L[:, :-k]
            if cond is not None: out[:, :-k] &= cond[:, k:]
        else:
            k = -k
            out[:, k:] = L[:, :-k] == L[:, k:]
            if cond is not None: out[:, k:] &= cond[:, :-k]
    else:
        if k > 0:
            out[:-k] = L[k:] == L[:-k]
            if cond is not None: out[:-k] &= cond[k:]
        else:
            k = -k
            out[k:] = L[:-k] == L[k:]
            if cond is not None: out[k:] &= cond[:-k]
    return out


def _has_shift(L, k, axis, cond):
    """True where the pixel k steps along `axis` has the same label and `cond`; out of range: False"""
    out = np.zeros(L.shape, bool)
    if axis == 1:
        if k > 0:
            out[:, :-k] = (L[:, k:] == L[:, :-k]) & cond[:, k:]
        else:
            k = -k
            out[:, k:] = (L[:, :-k] == L[:, k:]) & cond[:, :-k]
    else:
        if k > 0:
            out[:-k] = (L[k:] == L[:-k]) & cond[k:]
        else:
            k = -k
            out[k:] = (L[:-k] == L[k:]) & cond[:-k]
    return out


def _edt(B, R):
    """exact Euclidean distance (px) to the nearest True pixel of B, capped near R"""
    H, W = B.shape
    big = np.float32(R + 2)
    gv = np.where(B, 0, big).astype(np.float32)
    for y in range(1, H):
        np.minimum(gv[y], gv[y - 1] + 1, out=gv[y])
    for y in range(H - 2, -1, -1):
        np.minimum(gv[y], gv[y + 1] + 1, out=gv[y])
    g2 = gv * gv
    d2 = g2.copy()
    for k in range(1, R + 2):
        np.minimum(d2[:, k:], g2[:, :-k] + k * k, out=d2[:, k:])
        np.minimum(d2[:, :-k], g2[:, k:] + k * k, out=d2[:, :-k])
    return np.sqrt(d2)


class Stager:
    """kept for the scene scripts' calls during painting; the stages themselves are written by
    Panel.workshop() at the end (workshop order)"""
    def __init__(self, g, stages_dir, dense):
        self.g, self.dir, self.dense = g, stages_dir, dense

    def __call__(self, name, major=False):
        pass

    def save(self, img, name):
        self.g.workshop(img, self.dir, self.dense)


def shade(cols, k):
    out = []
    for c in cols:
        v = [int(c[i:i + 2], 16) for i in (1, 3, 5)]
        out.append('#%02x%02x%02x' % tuple(int(np.clip(t * k, 0, 255)) for t in v))
    return out


def cloud_shape(cx, cy, L, h, r):
    """a cloud: lobes of different size and height, the tallest off centre, a long low tail to one side, a
    gently tilted base; returns outline arrays and the valleys between the lobes / the tail cut"""
    nl = int(r.integers(2, 4)) + (1 if L > 380 else 0)
    tail = 1 if r.random() < 0.5 else -1
    w = r.uniform(0.6, 1.4, nl)
    span = 0.68
    edges = -span + 2 * span * np.r_[0, np.cumsum(w)] / w.sum()
    edges = edges + tail * (1 - span) * 0.9
    hts = r.uniform(0.45, 0.85, nl)
    hts[int(r.integers(0, nl))] = 1.0
    t = np.linspace(-1, 1, 200)
    top = np.zeros_like(t)
    for i in range(nl):
        c, hw_ = (edges[i] + edges[i + 1]) / 2, (edges[i + 1] - edges[i]) / 2 * r.uniform(1.15, 1.45)
        top = np.maximum(top, hts[i] * np.clip(1 - ((t - c) / hw_) ** 2, 0, 1) ** r.uniform(0.45, 0.7))
    ends = np.clip(1 - t ** 2, 0, 1) ** 0.28
    top = np.maximum(top, 0.48 * ends)                        # the tail and the blunt ends
    xs = cx + t * L / 2
    tilt = r.uniform(-0.03, 0.03)
    ty = cy - h * 0.75 * top * ends + tilt * (xs - cx)
    by = cy + h * 0.25 * ends * (1 + 0.2 * np.sin(t * 4 + r.uniform(0, 6))) + tilt * (xs - cx)
    valleys = [cx + e * L / 2 for e in edges[1:-1]]
    caps = [cx + edges[0] * L / 2 - 6, cx + edges[-1] * L / 2 + 6]
    return xs, ty, by, valleys, caps


def bird_pts(bx, by, sc, fl, r):
    """a gull in flight, every one a little different: span, wing lift on each side, a stout body"""
    w_ = 46 * sc * r.uniform(0.9, 1.1)
    a, b_ = r.uniform(0.85, 1.15), r.uniform(0.85, 1.15)
    tl, tr = -0.42 * w_ * fl * a, -0.42 * w_ * fl * b_
    up = [(-w_ * a, tl), (-0.55 * w_ * a, -0.36 * w_ * fl * a - 0.04 * w_), (-0.18 * w_, -0.12 * w_), (0, -0.04 * w_),
          (0.18 * w_, -0.12 * w_), (0.55 * w_ * b_, -0.36 * w_ * fl * b_ - 0.04 * w_), (w_ * b_, tr)]
    lo = [(0.92 * w_ * b_, tr + 0.13 * w_), (0.5 * w_ * b_, -0.14 * w_ * fl * b_ + 0.12 * w_), (0.14 * w_, 0.2 * w_),
          (0.0, 0.3 * w_), (-0.14 * w_, 0.2 * w_), (-0.5 * w_ * a, -0.14 * w_ * fl * a + 0.12 * w_),
          (-0.92 * w_ * a, tl + 0.13 * w_)]
    return [(bx + x, by + y) for x, y in up + lo]


def lay_cloud(g, S, cx, cy, L, h, cols, lit, rng):
    """a cloud cut as glass: lobes split at the valleys, a shade row and a lit row (opalescent)"""
    xs, ty, by, valleys, caps = cloud_shape(cx, cy, L, h, rng)
    m = g.poly(S.pts(list(zip(xs, ty)) + list(zip(xs[::-1], by[::-1]))))
    top = lambda a, xs=xs, ty=ty: np.interp(a, xs, ty)
    bot = lambda a, xs=xs, by=by: np.interp(a, xs, by)
    colf = [polyfn([(v + rng.uniform(-6, 6), cy - h), (v + rng.uniform(-8, 8), cy + h)]) for v in sorted(valleys + caps)]
    dark, light = cols
    rc = [dark, light] if lit == 'below' else [light, dark]
    g.band(m, light, top, bot, row_h=h * 0.42, columns=colf, length=(500, 900), row_colours=rc,
           flow=0.0, flow_jit=0.15, mix=dict(opal=0.55, streaky=0.3, cathedral=0.15))
    return m


def hband(S, ytop, ybot, n=80, pad=30):
    """full-bleed horizontal band between two y(x) functions of DESIGN x (or constants); design coords"""
    xs = np.linspace(S.X0 - pad, S.X1 + pad, n)
    t = ytop(xs) if callable(ytop) else np.full(n, float(ytop))
    b = ybot(xs) if callable(ybot) else np.full(n, float(ybot))
    return list(zip(xs, t)) + list(zip(xs[::-1], b[::-1]))


def design_xy(g):
    """design-space coordinate grids (x, y) of the canvas"""
    return g.DX, g.DY


def const(v):
    return lambda a: np.full(np.shape(a), float(v))


def polyfn(pts):
    """f(y) -> x along a polyline given top to bottom (design) -- a column cut (spur, valley)"""
    P = np.asarray(pts, float)
    o = np.argsort(P[:, 1])
    return lambda c: np.interp(c, P[o, 1], P[o, 0])
