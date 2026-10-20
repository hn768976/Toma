"""Shared helpers for the stained-glass scenes (lake / coast / forest).

`Panel` is the vendor `StainedGlass` (vendor/ is not edited; its grisaille brushes trace / matt / shade /
scratch / stain and its mask helpers are used as they are) with the glazier's side rebuilt:

  cut lines  pieces are DESIGNED, not a Voronoi mosaic.  `band()` cuts an area into rows that follow its own
             outline and cuts each row across with short staggered cuts; `waves()` cuts water the way a glazier
             does: long wave-shaped pieces whose rows swell and pinch to a point, staggered, with long slanting
             cuts; `radial()` cuts rings and spokes; `glass()` lays one piece or a few pieces split along lines.
  cuttable   glass cannot be cut with deep inside curves, sharp inside corners or holes.  After every laying,
             each touched piece is checked: parts that came apart become pieces of their own, a piece with a
             hole (something laid inside it) is cut through the hole, and a sharp or deep inside corner gets a
             lead running from it across the piece (the shortest way) -- the glazier's relief cut.
  glass      every piece is its own sheet: its own kind (cathedral, streaky, seedy, opalescent, reamy), grain
             direction, grain scale, warp, ream density, shade, thickness and thickness gradient.  All texture
             fields are sampled in the piece's own rotated / scaled / shifted frame from periodic tiles, so the
             texture breaks at every lead.  Some pieces carry a tonal grisaille matt (badgered, stippled).
  lead       came width differs from lead to lead (each came its own width) and drifts along the run; flat face
             with rounded edges, dark grey with a soft sheen and a whitish oxide bloom here and there; solder
             joints are flattened, irregular puddles running a little way along each came.
  weather    dirt in the corners of the panel and in the corners of pieces, along the came edges; pits.
  stages     `workshop()` writes the draw-on in workshop order: the full-size cartoon drawn on paper (cut lines,
             then piece numbers), cut glass laid on it sheet colour by sheet colour with gaps and missing pieces,
             the grisaille, the leading worked across from a corner (unsoldered), the joints soldered, the panel
             cemented, then the finished panel against daylight (the last stage is the final image).

Layer-group safety (Phase 2 contract): every random number of a group comes from the group's own generator;
fields that span the canvas (tiles, bubbles, pits, lead noise) come from fixed seeds; a piece's look depends only
on its own stored properties and the pixel position, never on piece order or on piece ids.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import drawkit
from drawkit import save_png
from stainedglass import StainedGlass, lin, PAINT_T, STAIN
from core import blur, fbm1d, noise2d, smoothstep

TRACK = False      # test hook: record per-group footprints (label / paint changes) on the painter
LAST = {}          # test hook: LAST['g'] is the last painter when TRACK is on

KINDS = ('cathedral', 'streaky', 'seedy', 'opal', 'reamy')
MIX = dict(cathedral=0.38, streaky=0.27, seedy=0.15, reamy=0.2)
TILE = 512
NUM_KEYS = ('mix', 'thick', 'kind', 'ang', 'amp', 'freq', 'off', 'seeds', 'opal', 'gang', 'gamt', 'pit', 'group',
            'region', 'warp', 'cx', 'cy', 'tsc', 'ox', 'oy', 'mk', 'mang', 'mext', 'dirt', 'uid', 'size')


def _hexs(c):
    return [c] if isinstance(c, str) else list(c)


def _tile(scale, seed, beta=1.15):
    """periodic smooth noise (TILE x TILE, unit std): features about `scale` tile px with finer detail"""
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(TILE)
    k = np.hypot(*np.meshgrid(f, f)) * scale
    amp = 1.0 / (1.0 + k * k) ** beta
    amp[0, 0] = 0
    z = np.fft.ifft2(np.fft.fft2(r.normal(size=(TILE, TILE))) * amp).real
    return ((z - z.mean()) / (z.std() + 1e-9)).astype(np.float32)


def _samp(t, u, v):
    """bilinear periodic sample of tile t at (u, v) (float arrays, any shape)"""
    u = np.mod(u, TILE).astype(np.float32)
    v = np.mod(v, TILE).astype(np.float32)
    i0 = u.astype(np.int32); j0 = v.astype(np.int32)
    fu = u - i0; fv = v - j0
    i0 %= TILE; j0 %= TILE
    i1 = (i0 + 1) % TILE; j1 = (j0 + 1) % TILE
    a = t[j0, i0] * (1 - fu) + t[j0, i1] * fu
    b = t[j1, i0] * (1 - fu) + t[j1, i1] * fu
    return a * (1 - fv) + b * fv


class Panel(StainedGlass):
    def __init__(self, S, seed, ambient=0.08, vignette=0.0, sky=('#ffffff', '#f6f3ec'), lead=6.0):
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
        self.pp = {k: [] for k in ('col', 'col2') + NUM_KEYS}
        self.meta = []                 # per piece: (palette, laying kwargs) -- for pieces split off later
        self.bb = []                   # per piece: conservative pixel bbox [y0, y1, x0, x1)
        self.nreg = 0
        self.lead_a = None
        self.lead_d = None
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

    def finish(self, lead=None, grime=0.3, pits=0.25, sweep=False):
        """lead and weather; sweep=True (single-group scenes only) first merges any piece still too small or
        too thin to cut into the neighbour it shares most edge with"""
        self._close()
        self.rng = drawkit.group_rng(self.seed0, 'finish')
        if sweep and len(self.pp['col']):
            s = self.s
            self.label = self._merge_small(self.label.astype(np.int64), len(self.pp['col']), 450 * s * s,
                                           10 * s).astype(np.int32)
            self._T = None
        self.lead(width=(lead or self.lead_w) * self.s)
        self.weather(grime=grime, pits=pits)

    # ================================================================== laying glass
    def _lay(self, b, sub, keys, pal_of_key, merge=True, amin=700.0, tmin=13.0, fix=True, fix_old=True, kw_of_key=None,
             **kw):
        """write pieces (one per distinct key) into the box b where sub is set; tidy, make cuttable, register"""
        s = self.s
        uk, inv = np.unique(keys, return_inverse=True)
        n = len(uk)
        L = np.full(sub.shape, -1, np.int64)
        L[sub] = inv.reshape(-1)
        pal = [pal_of_key(k) for k in uk]
        kws = [dict(kw, **kw_of_key(k)) if kw_of_key is not None else kw for k in uk]
        if merge and n > 1:
            L = self._merge_small(L, n, amin * s * s, tmin * s)
        ids = np.unique(L[L >= 0])
        mp = np.full(n, -1, np.int64)
        mp[ids] = np.arange(len(ids))
        L = np.where(L >= 0, mp[np.maximum(L, 0)], -1)
        pal = [pal[i] for i in ids]
        kws = [kws[i] for i in ids]
        n = len(ids)
        for a in (self.trace_a, self.matt_a, self.scratch_a, self.stain_a):
            a[b][sub] = 0
        base = len(self.pp['col'])
        before = self.label[b].copy()
        lab = self.label[b]
        lab[sub] = (L[sub] + base).astype(np.int32)
        # per-piece centroid (design), area, bbox
        yy, xx = np.nonzero(L >= 0)
        lj = L[yy, xx]
        cnt = np.bincount(lj, minlength=n) + 1e-6
        cx = np.bincount(lj, self.DX[b][yy, xx], n) / cnt
        cy = np.bincount(lj, self.DY[b][yy, xx], n) / cnt
        y0 = np.full(n, 1 << 30); y1 = np.zeros(n, np.int64); x0 = np.full(n, 1 << 30); x1 = np.zeros(n, np.int64)
        np.minimum.at(y0, lj, yy); np.maximum.at(y1, lj, yy); np.minimum.at(x0, lj, xx); np.maximum.at(x1, lj, xx)
        reg = self.nreg
        self.nreg += 1
        for i in range(n):
            self._one_prop(pal[i], cx[i], cy[i], cnt[i] / (s * s), kws[i], self.gidx, reg)
            self.bb.append([int(y0[i] + b[0].start), int(y1[i] + b[0].start + 1),
                            int(x0[i] + b[1].start), int(x1[i] + b[1].start + 1)])
        bb_ = before[sub]
        cut_ids = np.unique(bb_[bb_ >= 0])
        self._clean_remnants(b, sub, before, base, cut_ids)
        if fix:
            # earlier glass is re-cut too (relief cuts) -- unless this group moves on its own in the animation,
            # then only its own group's glass
            old = [int(c) for c in cut_ids if fix_old or self.pp['group'][int(c)] == self.gidx]
            self._fix_shapes(list(range(base, base + n)) + old, amin * s * s, tmin * s)
        self._T = None
        return base, n

    def _one_prop(self, pal, cx, cy, area, kw, group, region):
        """one sheet of glass: kind, colour, grain, texture frame, density -- all its own"""
        r = self.rng
        P = self.pp
        mix = kw.get('mix') or MIX
        kinds = list(mix.keys())
        pr = np.array([mix[k] for k in kinds], float)
        pr /= pr.sum()
        vary = kw.get('vary', 1.0)
        flow, flow_jit = kw.get('flow', 0.0), kw.get('flow_jit', 0.35)
        cols = _hexs(pal)
        kind = kinds[int(r.choice(len(kinds), p=pr))]
        c = lin(cols[int(r.integers(0, len(cols)))])
        c = np.clip(c * np.exp(r.normal(0, 0.15 * vary)) * np.exp(r.normal(0, 0.05 * vary, 3)), 1e-4, 1)
        u = r.random()
        if len(cols) > 1 and u < 0.5:
            c2 = lin(cols[int(r.integers(0, len(cols)))]) * np.exp(r.normal(0, 0.1))
        elif u < 0.8:
            c2 = c ** r.uniform(0.35, 0.6)                            # paler wisps
        else:
            c2 = c ** r.uniform(1.4, 1.9)                             # darker cords
        fl = flow(cx, cy) if callable(flow) else flow
        if fl is None or r.random() < 0.7:
            ang = r.uniform(0, np.pi)                                  # this sheet's grain, whatever its neighbours do
        else:
            ang = fl + r.normal(0, max(flow_jit, 0.5))                 # now and then laid along the form
        streak = kw.get('streak', 1.0)
        amp = {'cathedral': r.uniform(0.03, 0.12), 'streaky': r.uniform(0.18, 0.45), 'seedy': r.uniform(0.02, 0.08),
               'opal': r.uniform(0.05, 0.15), 'reamy': r.uniform(0.15, 0.35)}[kind] * streak
        P['mix'].append({'streaky': r.uniform(0.35, 0.8), 'opal': r.uniform(0.1, 0.35)}.get(kind, r.uniform(0, 0.15)))
        P['seeds'].append(kw.get('seeds', 1.0) * {'seedy': r.uniform(0.5, 1.0), 'reamy': r.uniform(0.08, 0.22),
                                                  'cathedral': r.uniform(0.0, 0.08)}.get(kind, r.uniform(0.0, 0.04)))
        op = kw.get('opal') or 0.0
        P['opal'].append(r.uniform(0.35, 0.6) if kind == 'opal' else op * r.uniform(0.6, 1.2))
        P['col'].append(c.astype(np.float32))
        P['col2'].append(np.clip(c2, 1e-4, 1).astype(np.float32))
        P['thick'].append(kw.get('thick', 1.0) * r.uniform(0.72, 1.42) * (0.75 if kind == 'seedy' else 1.0))
        P['kind'].append(KINDS.index(kind))
        P['ang'].append(float(ang))
        P['amp'].append(float(amp))
        P['freq'].append(float(r.uniform(0.45, 2.0)))
        P['off'].append(float(r.uniform(0, 6000)))
        P['gang'].append(float(r.uniform(0, 2 * np.pi)))
        P['gamt'].append(float(r.uniform(0.08, 0.42)))
        P['pit'].append(float(r.uniform(0.4, 1.0) if r.random() < 0.18 else r.uniform(0, 0.1)))
        P['warp'].append(float({'reamy': r.uniform(0.8, 1.7), 'streaky': r.uniform(0.25, 0.9)}.get(kind, r.uniform(0.1, 0.5))))
        P['tsc'].append(float(np.exp(r.uniform(np.log(0.5), np.log(1.9)))))
        P['ox'].append(float(r.uniform(0, TILE)))
        P['oy'].append(float(r.uniform(0, TILE)))
        mt = kw.get('matting', 0.28)
        P['mk'].append(float(r.uniform(0.1, 0.34)) if r.random() < mt else 0.0)
        P['mang'].append(float(r.uniform(0, 2 * np.pi)))
        P['mext'].append(float(max(np.sqrt(area), 12.0) * r.uniform(0.55, 0.95)))
        P['dirt'].append(float(r.random()))
        P['uid'].append(int(r.integers(1, 1 << 30)))
        P['size'].append(float(np.sqrt(max(area, 1.0))))
        P['group'].append(group)
        P['region'].append(region)
        P['cx'].append(float(cx))
        P['cy'].append(float(cy))
        self.meta.append((pal, kw))

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
            if len(self.bb) >= n:                                   # global sweep: keep the bboxes conservative
                for a_, b_ in zip(s_[first], d_[first]):
                    self._bb_union(int(b_), self.bb[int(a_)])
        return L

    def _bb_union(self, i, box):
        bi = self.bb[i]
        self.bb[i] = [min(bi[0], box[0]), max(bi[1], box[1]), min(bi[2], box[2]), max(bi[3], box[3])]

    def _clean_remnants(self, b, sub, before, base, cut_ids):
        """earlier pieces the new glass has cut: thin leftovers (slivers, wedges, notches narrower than a
        cuttable piece) and tiny leftovers are given to the new glass or to a neighbouring piece"""
        s = self.s
        r = max(2, int(round(6 * s)))
        H, W = self.H, self.W
        y0, y1 = max(0, b[0].start - 3 * r), min(H, b[0].stop + 3 * r)
        x0, x1 = max(0, b[1].start - 3 * r), min(W, b[1].stop + 3 * r)
        Z = (slice(y0, y1), slice(x0, x1))
        L = self.label[Z].copy()
        new = L >= base
        old = (L >= 0) & ~new
        if not old.any() or len(cut_ids) == 0:
            return
        is_cut = np.zeros(base + 1, bool)
        is_cut[cut_ids] = True
        Lc = np.where(old, L, base)
        cand = old & is_cut[Lc]
        nb = new.copy()
        for _ in range(2):
            nb = _dilate(nb, r)
        cand &= nb
        if not cand.any():
            return
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
        area = np.bincount(self.label[self.label >= 0], minlength=base + 1)[:base + 1]
        tiny = np.zeros(base + 1, bool)
        tiny[cut_ids] = area[cut_ids] < 700 * s * s
        drop |= old & tiny[Lc] & is_cut[Lc]
        if not drop.any():
            return
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
        ch = A != L
        for rcv in np.unique(A[ch]):
            if rcv >= 0:
                self._bb_union(int(rcv), [y0, y1, x0, x1])
        self.label[Z] = A.astype(np.int32)

    # ------------------------------------------------------------------ cuttable pieces
    def _split_off(self, parent, cm, oy, ox):
        """pixels cm (crop mask at oy, ox) of `parent` become a new piece cut from a sheet of their own"""
        ys, xs = np.nonzero(cm)
        Y, X = ys + oy, xs + ox
        cx = float(self.DX[Y, X].mean()); cy = float(self.DY[Y, X].mean())
        pal, kw = self.meta[parent]
        self._one_prop(pal, cx, cy, len(ys) / (self.s * self.s), kw, self.pp['group'][parent],
                       self.pp['region'][parent])
        nid = len(self.pp['col']) - 1
        self.bb.append([int(Y.min()), int(Y.max()) + 1, int(X.min()), int(X.max()) + 1])
        return nid

    def _fix_shapes(self, ids, amin, tmin):
        """make every touched piece cuttable: parts that came apart become separate pieces (tiny ones go to a
        neighbour); a piece with a hole is cut through the hole; a sharp or deep inside corner gets a relief
        cut, the shortest way across the piece"""
        s = self.s
        H, W = self.H, self.W
        rad = max(2, int(round(7 * s)))
        todo = [(int(i), 0) for i in dict.fromkeys(ids)]
        guard = 0
        while todo and guard < 4000:
            guard += 1
            i, dep = todo.pop()
            y0, y1, x0, x1 = self.bb[i]
            if y1 <= y0 or x1 <= x0:
                continue
            crop = self.label[y0:y1, x0:x1]
            m = crop == i
            area = int(m.sum())
            if area == 0:
                self.bb[i] = [0, 0, 0, 0]
                continue
            ys, xs = np.nonzero(m)
            if ys.min() > 0 or ys.max() < m.shape[0] - 1 or xs.min() > 0 or xs.max() < m.shape[1] - 1:
                y0, y1, x0, x1 = y0 + ys.min(), y0 + ys.max() + 1, x0 + xs.min(), x0 + xs.max() + 1
                self.bb[i] = [int(y0), int(y1), int(x0), int(x1)]
                crop = self.label[y0:y1, x0:x1]
                m = crop == i
            # 1 parts that came apart
            comp, nc = _cc(m)
            if nc > 1:
                sizes = np.bincount(comp[comp >= 0], minlength=nc)
                keep = int(np.argmax(sizes))
                for c in range(nc):
                    if c == keep:
                        continue
                    cm = comp == c
                    if sizes[c] >= amin:
                        nid = self._split_off(i, cm, y0, x0)
                        crop[cm] = nid
                        todo.append((nid, dep))
                    else:
                        self._absorb(crop, cm, i, y0, x0)
                todo.append((i, dep))
                continue
            if dep >= 5 or area < 2 * amin:
                continue
            # 2 a hole: something lies inside the piece -- cut through it
            hole = _largest_hole(m)
            if hole is not None:
                hy, hx = hole
                cut = self._best_line(m, hy, hx, None)
                if cut is not None and self._cut(i, crop, m, hy, hx, cut, amin, tmin, y0, x0, todo, dep):
                    continue
            # 3 a sharp or deep inside corner: a relief cut from it
            nt = _notch(m, rad, self._edge_flags(y0, y1, x0, x1), 8 * s)
            if nt is not None:
                py, px, dy, dx = nt
                cut = self._best_line(m, py, px, (dy, dx))
                if cut is not None:
                    self._cut(i, crop, m, py, px, cut, amin, tmin, y0, x0, todo, dep)

    def _edge_flags(self, y0, y1, x0, x1):
        return (y0 == 0, y1 >= self.H, x0 == 0, x1 >= self.W)

    def _absorb(self, crop, cm, i, oy, ox):
        ring = _dilate(cm, 1) & ~cm
        nb = crop[ring]
        nb = nb[(nb >= 0) & (nb != i)]
        if len(nb) == 0:
            return
        v, c = np.unique(nb, return_counts=True)
        t = int(v[np.argmax(c)])
        crop[cm] = t
        ys, xs = np.nonzero(cm)
        self._bb_union(t, [int(ys.min() + oy), int(ys.max() + oy + 1), int(xs.min() + ox), int(xs.max() + ox + 1)])

    def _best_line(self, m, py, px, d):
        """direction of the shortest cut through (py, px): across the whole piece for a hole (d None), else
        from the corner into the piece around the bisector d"""
        h, w = m.shape
        Lmax = int(np.hypot(h, w)) + 2
        t = np.arange(1, Lmax, dtype=np.float32)
        best, bl = None, 1e9
        if d is None:
            angs = np.linspace(0, np.pi, 12, endpoint=False)
        else:
            a0 = np.arctan2(d[0], d[1])
            angs = a0 + np.radians([0, -15, 15, -30, 30, -45, 45])
        for k, a in enumerate(angs):
            cy, cx = np.sin(a), np.cos(a)
            tot = 0.0
            ok = True
            for sg in ((1, -1) if d is None else (1,)):
                yy = np.round(py + sg * t * cy).astype(np.int64)
                xx = np.round(px + sg * t * cx).astype(np.int64)
                inb = (yy >= 0) & (yy < h) & (xx >= 0) & (xx < w)
                inside = np.zeros(len(t), bool)
                inside[inb] = m[yy[inb], xx[inb]]
                if d is None:
                    # walk out of the hole, then across the material to the far side
                    st = np.argmax(inside) if inside.any() else -1
                    if st < 0:
                        ok = False; break
                    out = np.nonzero(~inside[st:])[0]
                    tot += (out[0] if len(out) else len(t) - st)
                else:
                    out = np.nonzero(~inside[1:])[0]
                    if len(out) == 0:
                        ok = False; break
                    tot += out[0] + 1
            if not ok:
                continue
            tot += 0.8 * ((k + 1) // 2)                              # a little preference for the bisector
            if tot < bl:
                bl, best = tot, a
        return best

    def _cut(self, i, crop, m, py, px, a, amin, tmin, oy, ox, todo, dep):
        h, w = m.shape
        Yg, Xg = np.mgrid[0:h, 0:w]
        side = ((Xg - px) * np.sin(a) - (Yg - py) * np.cos(a)) > 0
        A_ = m & side
        B_ = m & ~side
        aa, ab = int(A_.sum()), int(B_.sum())
        if min(aa, ab) < amin:
            return False
        for part, ar in ((A_, aa), (B_, ab)):
            per = (part[:, 1:] != part[:, :-1]).sum() + (part[1:, :] != part[:-1, :]).sum()
            if 2 * ar < per * tmin * 0.8:
                return False
        nid = self._split_off(i, B_, oy, ox)
        crop[B_] = nid
        todo.append((i, dep + 1))
        todo.append((nid, dep + 1))
        return True

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

    def pieces(self, parts, **kw):
        """several pieces laid together (one object): parts = [(mask, colour[, kw overrides]), ...]; where they
        overlap the later one wins; no part is treated as a remnant of another"""
        ms = [np.asarray(p[0]) > 0.5 for p in parts]
        tot = np.zeros_like(ms[0])
        for m in ms:
            tot |= m
        b = self._box(tot, 1)
        if b is None:
            return None
        key = np.full(tot[b].shape, -1, np.int64)
        for i, m in enumerate(ms):
            key[m[b]] = i
        sub = tot[b]
        cols = {i: p[1] for i, p in enumerate(parts)}
        kwk = {i: (p[2] if len(p) > 2 else {}) for i, p in enumerate(parts)}
        return self._lay(b, sub, key[sub], lambda k: cols[int(k)], kw_of_key=lambda k: kwk[int(k)], **kw)

    def band(self, mask, colours, top, bot, rows=None, row_h=60.0, levels=None, length=(140, 300), columns=(),
             cut_dir=None, tilt=0.3, bend=0.25, size=None, feature=None, fid_colours=None, run_edit=None,
             row_colours=None, colour_fn=None, wave=(0.12, 260.0), vertical=False, stagger=True, **kw):
        """cut an area into rows following its outline (top(a) .. bot(a), design coordinates; with
        vertical=True `a` is y and the rows run downward, for trunks) and cut every row across.
        rows: fixed row count, else row_h: target row height; levels: absolute row boundaries; columns: list of
        f(c)->a long cuts through all rows; cut_dir(a, c): tilt of the cross cuts; size(a, c): factor on the
        piece length; feature(a, c) -> int id: cuts where it changes, colours by id (fid_colours)"""
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
                cuts = []
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
                        cuts.append((nx, fd, False))
                        x = nx
                    if k < len(runs) - 1:
                        cuts.append((rb, fd, True))
                cuts.sort(key=lambda t: t[0])
                idx = np.zeros(len(Ar), np.int64)
                for (xc, fd, feat) in cuts:
                    cc = float(mid(np.array([xc]))[0])
                    hc = float(hgt(np.array([xc]))[0])
                    th = (cut_dir(xc, cc) if cut_dir is not None else 0.0) + r.normal(0, tilt * (0.45 if feat else 1.0))
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
                tw = np.zeros(nsp)
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

    def waves(self, mask, top, row_h, colour_fn, run=(5.0, 11.0), feature=None, wl=(55.0, 120.0), pinch=0.7,
              slant=(0.55, 1.0), fslant=(0.15, 0.55), depth=None, size=None, **kw):
        """glazier's water: rows of long wave-shaped pieces.  Each row's lower edge is the upper edge plus a
        thickness that swells and dies away (where it dies the row pinches to a point: two leads meet and a
        piece ends in a taper), so the leads flow like wave lines and the piece ends are staggered at random.
        Long runs are cut with long slanting cuts (the pieces end in tapers, never square).  row_h(y): row
        height at depth y; run: piece length in row heights; feature(a, c) -> id: an extra slanting cut where it
        changes along a row (reflection edges, glints); colour_fn(cx, cy, fid, row) -> palette; depth(y) -> 0..1
        perspective factor for the wave length"""
        m = np.asarray(mask) > 0.5
        b = self._box(m, 1)
        if b is None:
            return None
        sub = m[b]
        r = self.rng
        X, Y = self.DX[b][sub], self.DY[b][sub]
        xs = np.arange(float(X.min()) - 60, float(X.max()) + 64, 3.0)
        dep = depth or (lambda y: 1.0)
        # wave lines: each its own level (perspective spacing) and its own undulation; where a line would cross
        # the one above it, the two meet and the row between them pinches to a point
        f = [np.full(len(xs), float(top))]
        ymax = float(Y.max())
        y = float(top)
        while y < ymax + 2:
            t = row_h(y) * r.uniform(0.85, 1.2)
            y += t
            k = 0.45 + 0.8 * dep(y)
            l1, l2, l3 = r.uniform(*wl) * k, r.uniform(*wl) * k * 0.5, r.uniform(*wl) * k * 0.23
            n = (0.58 * np.sin(xs / l1 + r.uniform(0, 6.3)) + 0.3 * np.sin(xs / l2 + r.uniform(0, 6.3))
                 + 0.12 * np.sin(xs / l3 + r.uniform(0, 6.3)))
            line = y + t * pinch * r.uniform(0.8, 1.2) * n
            f.append(np.maximum(line, f[-1]))
        F = np.stack(f)                                                   # (nb, len(xs))
        ri = np.zeros(len(X), np.int64)
        for j in range(1, len(F)):
            ri += Y > np.interp(X, xs, F[j])
        keys = np.zeros(len(X), np.int64)
        pal = {}
        fids = {}
        for j in np.unique(ri):
            pr = ri == j
            up, dn = F[j], F[min(j + 1, len(F) - 1)]
            hh = dn - up
            mid = (up + dn) / 2
            # pinches: where the row's thickness dies away
            z = hh < 0.6
            zc = []
            if z.any():
                d = np.diff(np.r_[0, z.astype(np.int8), 0])
                for a0, a1 in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
                    zc.append(xs[min((a0 + a1) // 2, len(xs) - 1)])
            Xr, Yr = X[pr], Y[pr]
            seg = np.searchsorted(np.asarray(zc, float), Xr) if zc else np.zeros(len(Xr), np.int64)
            # slanting cuts: at feature changes and along long runs
            bnd = [xs[0]] + zc + [xs[-1]]
            cuts = []
            fid_line = np.asarray(feature(xs, mid), np.int64) if feature is not None else np.zeros(len(xs), np.int64)
            for a0, a1 in zip(bnd[:-1], bnd[1:]):
                sel = (xs > a0) & (xs < a1)
                if sel.sum() < 2:
                    continue
                hs = float(np.median(hh[sel]))
                fl = fid_line[sel]
                ch = np.nonzero(np.diff(fl))[0]
                fpts = [float(xs[sel][c] + 1.5 + r.uniform(-8, 8)) for c in ch]
                cuts += [(x_, True) for x_ in fpts]
                # long runs between the feature cuts
                edges_ = [a0] + fpts + [a1]
                for e0, e1 in zip(edges_[:-1], edges_[1:]):
                    sz = float(size((e0 + e1) / 2, float(np.interp((e0 + e1) / 2, xs, mid)))) if size is not None else 1.0
                    L = r.uniform(*run) * max(hs, 14.0) * sz
                    x = e0 + L * r.uniform(0.6, 1.0)
                    while x < e1 - 0.55 * L:
                        cuts.append((x, False))
                        x += r.uniform(*run) * max(hs, 14.0) * sz
            idx = np.zeros(len(Xr), np.int64)
            for xc, ft in sorted(cuts):
                yc = float(np.interp(xc, xs, mid))
                th = r.uniform(*(fslant if ft else slant)) * (1 if r.random() < 0.5 else -1)
                idx += ((Xr - xc) * np.cos(th) - (Yr - yc) * np.sin(th)) > 0
            kk = (j * 4096 + seg * 256 + idx).astype(np.int64)
            keys[np.nonzero(pr)[0]] = kk
        uk, inv = np.unique(keys, return_inverse=True)
        inv = inv.reshape(-1)
        cnt = np.bincount(inv) + 1e-6
        cxs, cys = np.bincount(inv, X) / cnt, np.bincount(inv, Y) / cnt
        for i, k in enumerate(uk):
            fd = int(feature(np.array([cxs[i]]), np.array([cys[i]]))[0]) if feature is not None else 0
            pal[int(k)] = colour_fn(cxs[i], cys[i], fd, int(k) // 4096)
        kw.setdefault('flow', 0.0)
        kw.setdefault('flow_jit', 0.3)
        return self._lay(b, sub, keys, lambda k: pal[int(k)], **kw)

    # ================================================================== the glass itself
    def _fields(self):
        if hasattr(self, '_tw'):
            return
        L = self._lazy
        self._tw = _tile(70.0, L[1])          # warp of the reams
        self._tt = _tile(55.0, L[0])          # thickness
        self._tm = _tile(12.0, L[2], 1.0)     # opal mottle
        self._tf = _tile(2.2, L[5], 0.8)      # fine surface
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
        P = {k: np.asarray(self.pp[k], np.float32) for k in NUM_KEYS if k != 'uid'}
        col = np.asarray(self.pp['col'], np.float32)
        col2 = np.asarray(self.pp['col2'], np.float32)
        idx = lab[m]
        lx = self.DX[m] - P['cx'][idx]
        ly = self.DY[m] - P['cy'][idx]
        a = P['ang'][idx]
        ca, sa = np.cos(a), np.sin(a)
        u = lx * ca + ly * sa                       # along this sheet's grain
        v = ly * ca - lx * sa                       # across it
        del ca, sa, a
        k = P['tsc'][idx]
        ox, oy = P['ox'][idx], P['oy'][idx]
        kind = P['kind'][idx].astype(np.int64)
        wv = _samp(self._tw, u * k * 0.35 + ox, v * k + oy)
        q = v * P['freq'][idx] + P['off'][idx] + wv * 38 * P['warp'][idx] + 600
        del wv, u, v
        q = np.clip(q, 0, len(self._tab_b) - 2)
        sb = np.interp(q, np.arange(len(self._tab_b)), self._tab_b)
        sc = np.interp(q, np.arange(len(self._tab_c)), self._tab_c)
        cord = np.where(kind == 1, 0.2, np.where(kind == 4, 0.3, 0.08)).astype(np.float32)
        st = np.clip((1 - cord) * sb + cord * sc, -1.4, 1.4).astype(np.float32)
        del sb, sc, q, cord
        ga = P['gang'][idx]
        grad = (lx * np.cos(ga) + ly * np.sin(ga)) / 100.0
        tn = _samp(self._tt, lx * k + ox + 211.0, ly * k + oy + 97.0)
        th = P['thick'][idx] * (1 + 0.07 * tn) * np.clip(1 + P['gamt'][idx] * grad, 0.55, 1.7)
        th *= np.clip(1 + 0.7 * P['amp'][idx] * st, 0.25, 3)
        del grad, tn, ga
        c1 = col[idx]
        Tm = c1 ** th[:, None]
        w = (P['mix'][idx] * smoothstep(-0.1, 0.9, st) ** 1.5)[:, None]
        Tm = Tm * (1 - w) + (col2[idx] ** th[:, None]) * w
        del w, st
        op = P['opal'][idx]
        sel = op > 0
        if sel.any():
            a_ = P['ang'][idx][sel]
            uu = lx[sel] * np.cos(a_) + ly[sel] * np.sin(a_)
            vv = ly[sel] * np.cos(a_) - lx[sel] * np.sin(a_)
            mott = np.clip(0.5 + 0.3 * _samp(self._tm, uu * k[sel] * 0.45 + ox[sel] * 1.7, vv * k[sel] * 1.4 + oy[sel] * 1.3), 0, 1)
            del a_, uu, vv
            o = np.clip(op[sel] * (0.55 + 0.9 * mott), 0, 0.95)[:, None]
            milk = (0.55 * c1[sel] + 0.45) ** (0.8 * th[sel][:, None]) * (0.62 + 0.25 * mott[:, None])
            Tm[sel] = Tm[sel] * (1 - o) + milk * o
        fine = _samp(self._tf, lx + ox * 2.3, ly + oy * 2.9)
        Tm *= (1 + 0.03 * fine)[:, None]
        # tonal grisaille: a matt badgered across some pieces, heavier toward one side, stippled
        mk = P['mk'][idx]
        sel = mk > 0
        if sel.any():
            mg = P['mang'][idx][sel]
            g_ = np.clip(0.5 + (lx[sel] * np.cos(mg) + ly[sel] * np.sin(mg)) / P['mext'][idx][sel], 0, 1) ** 1.7
            stp = np.clip(1 + 0.6 * fine[sel] + 0.08 * _samp(self._tm, lx[sel] * 2.1 + oy[sel], ly[sel] * 2.1 + ox[sel]), 0.2, 2)
            ma = np.clip(mk[sel] * g_ * stp, 0, 0.9)[:, None]
            Tm[sel] = Tm[sel] * (1 - ma + ma * PAINT_T)
        T[m] = Tm
        del Tm, c1, th
        T *= (1 + self._bubbles())[..., None]
        self._T = np.clip(T, 0, 1.25).astype(np.float32)
        return self._T

    def _bubbles(self):
        """seeds: fixed candidate spots over the canvas, accepted by the piece's own seed density; drawn out
        along the piece's grain, a bright core in a dark refracting rim, kept inside the piece"""
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
        """came on every boundary between pieces: each came its own width (a little wider between areas than
        inside one), drifting along the run; flat face, rounded edges, dark grey with a soft sheen and a whitish
        oxide bloom here and there; flattened, irregular solder puddles at the joints, running along the cames"""
        s = self.s
        lab = self.label
        H, W = self.H, self.W
        uid = np.asarray(self.pp['uid'] + [7], np.int64)[lab]
        psz = np.asarray(self.pp['size'] + [1e3], np.float32)[lab]
        reg = np.asarray(self.pp['region'] + [-1], np.int64)[lab]
        B = np.zeros((H, W), bool)
        ws = np.zeros((H, W), np.float32)
        wc = np.zeros((H, W), np.float32)
        for ax in (0, 1):
            if ax == 1:
                la, lb, ua, ub, ra, rb = lab[:, :-1], lab[:, 1:], uid[:, :-1], uid[:, 1:], reg[:, :-1], reg[:, 1:]
                sa_, sb_ = psz[:, :-1], psz[:, 1:]
            else:
                la, lb, ua, ub, ra, rb = lab[:-1], lab[1:], uid[:-1], uid[1:], reg[:-1], reg[1:]
                sa_, sb_ = psz[:-1], psz[1:]
            d = la != lb
            hsh = _hash01(np.minimum(ua, ub), np.maximum(ua, ub), 41)
            fine = np.clip(np.minimum(sa_, sb_) / 60.0, 0.5, 1.0)          # narrow came round small detail pieces
            wv = ((0.72 + 0.6 * hsh) * np.where(ra != rb, 1.14, 1.0) * fine * d).astype(np.float32)
            if ax == 1:
                B[:, :-1] |= d; B[:, 1:] |= d
                ws[:, :-1] += wv; ws[:, 1:] += wv; wc[:, :-1] += d; wc[:, 1:] += d
            else:
                B[:-1] |= d; B[1:] |= d
                ws[:-1] += wv; ws[1:] += wv; wc[:-1] += d; wc[1:] += d
        del uid, reg, psz
        hw0 = width / 2
        wf = np.where(wc > 0, ws / np.maximum(wc, 1), 0).astype(np.float32)
        wn = noise2d(H, W, 70 * s, 2, self._lazy[4])
        wf = wf * (0.9 + 0.2 * wn)
        sg = max(0.5, hw0 * 0.35)                         # each came keeps its own width up to the joint
        wsum = blur(wf, sg)
        bsum = blur(B.astype(np.float32), sg)
        hw = (hw0 * np.where(bsum > 1e-4, wsum / np.maximum(bsum, 1e-4), 1.0)).astype(np.float32)
        del wsum, bsum, wn, ws, wc, wf
        Rm = int(np.ceil(hw0 * 2.2 + 3))
        d = _edt(B, Rm) + 0.5
        self.bd = d.astype(np.float32)                                     # raw distance to the cut line
        cov = smoothstep(hw + 0.7, hw - 0.7, d)
        t = np.clip((hw - d) / (0.5 * hw + 1e-3), 0, 1)
        hgt = np.sqrt(t) * hw * 0.7
        sol_a = np.zeros((H, W), np.float32)
        self._jq = np.full((H, W), 9.0, np.float32)
        if solder:
            a_, b_, c_, e_ = lab[:-1, :-1], lab[:-1, 1:], lab[1:, :-1], lab[1:, 1:]
            cnt = 1 + (b_ != a_) + ((c_ != a_) & (c_ != b_)) + ((e_ != a_) & (e_ != b_) & (e_ != c_))
            jy, jx = np.nonzero(cnt >= 3)
            if len(jy):
                cell = max(2.0, hw0 * 1.6)
                key = (jy // cell).astype(np.int64) * 100000 + (jx // cell).astype(np.int64)
                _, first = np.unique(key, return_index=True)
                jy, jx = jy[first] + 0.5, jx[first] + 0.5
                n = len(jy)
                u = [_hash01(jy.astype(np.int64), jx.astype(np.int64), self._lazy[5] + k) for k in range(4)]
                rj = hw0 * (1.8 + 1.2 * u[0])                  # how far the puddle runs along the cames
                R = int(np.ceil(hw0 * 3.0 + 2))
                ky, kx = np.mgrid[-R:R + 1, -R:R + 1]
                ky, kx = ky.ravel(), kx.ravel()
                jd = np.full(H * W, 9.0, np.float32)
                for c0 in range(0, n, 3000):
                    sl = slice(c0, c0 + 3000)
                    yy = np.round(jy[sl])[:, None].astype(np.int64) + ky[None]
                    xx = np.round(jx[sl])[:, None].astype(np.int64) + kx[None]
                    q = (np.hypot(yy - jy[sl][:, None], xx - jx[sl][:, None]) / rj[sl][:, None]).astype(np.float32)
                    ok = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W) & (q < 1.3)
                    np.minimum.at(jd, (yy * W + xx)[ok], q[ok])
                jd = jd.reshape(H, W)
                lump = noise2d(H, W, 3.2 * s, 2, self._lazy[5] + 3)
                wob = noise2d(H, W, 9 * s, 2, self._lazy[5] + 7)
                jq = jd * (0.9 + 0.2 * wob)
                self._jq = jq.astype(np.float32)
                sw = hw * (1.1 + 0.07 * lump) + hw0 * 0.32 * np.clip(1 - jq / 0.5, 0, 1) ** 1.5   # wider at the joint
                sol_a = (smoothstep(sw + 0.7, sw - 0.7, d) * smoothstep(1.0, 0.78, jq)).astype(np.float32)
                hs = (hw0 * (0.62 + 0.04 * lump) * np.sqrt(np.clip(1 - (d / np.maximum(sw, 0.5)) ** 4, 0, 1))
                      * smoothstep(1.0, 0.7, jq))
                hgt = np.where(sol_a > 0.02, np.maximum(hgt * (1 - sol_a), hs), hgt)
                del jd, lump, wob, hs, sw
        cov_all = np.maximum(cov, sol_a)
        gy, gx = np.gradient(blur(hgt, 0.7 * s + 0.3))
        nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1)
        nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        Ld = np.array([-0.35, -0.6, 0.72], np.float32); Ld /= np.linalg.norm(Ld)
        diff = np.clip(nrm @ Ld, 0, 1).astype(np.float32)
        # sheen: only where the rounded flank turns toward the light (the flat face stays dark)
        spec = (np.clip((diff - Ld[2]) / (1 - Ld[2]), 0, 1) ** 1.3).astype(np.float32)
        del nrm, gx, gy
        pat = noise2d(H, W, 9 * s, 3, self._lazy[4] + 11)
        oxd = smoothstep(0.66, 0.84, noise2d(H, W, 5 * s, 3, self._lazy[4] + 13)) * (0.3 + 0.7 * pat)
        self._lead_shade = (diff, spec, pat, oxd)
        self.came_a = cov.astype(np.float32)
        self.sol_a = sol_a
        self.lead_a = cov_all.astype(np.float32)
        self.lead_rgb = self._lead_colour(aged=True)
        self.lead_d = (d - hw).astype(np.float32)                          # distance from the came's edge
        self._T = None

    def _lead_colour(self, aged=True):
        diff, spec, pat, oxd = self._lead_shade
        sol = self.sol_a[..., None]
        if aged:          # weathered came: dark grey, soft sheen, whitish oxide bloom; dull grey solder
            alb_c = lin('#202125') * (0.8 + 0.4 * pat)[..., None]
            alb_c = alb_c * (1 - 0.3 * oxd[..., None]) + lin('#5a5c5c') * 0.3 * oxd[..., None]
            alb_s = lin('#33353a') * (0.85 + 0.3 * pat)[..., None]
            sheen = 0.045 * spec * (1 - 0.6 * oxd)
        else:             # fresh from the box: bright silvery lead and shiny solder
            alb_c = lin('#3c3f44') * (0.9 + 0.2 * pat)[..., None]
            alb_s = lin('#7a7d83') * (0.92 + 0.16 * pat)[..., None]
            sheen = 0.09 * spec + 0.03 * spec ** 2
        alb = alb_c * (1 - sol) + alb_s * sol
        rgb = alb * (0.35 + 0.75 * diff)[..., None] + (sheen * (1 + 0.4 * self.sol_a))[..., None]
        return rgb.astype(np.float32)

    def weather(self, grime=0.3, pits=0.25):
        """dirt: a film on each piece (heavier toward the corners and the foot of the panel, each piece its
        own), caught along the came edges and packed into the corners of the pieces; pitted glass"""
        H, W, s = self.H, self.W, self.s
        lab = self.label
        P = self.pp
        n = len(P['col'])
        Tm = np.ones((H, W, 3), np.float32)
        if n:
            cx = np.asarray(P['cx']) / 1920.0
            cy = np.asarray(P['cy']) / 1080.0
            ex = np.clip(np.minimum(cx, 1 - cx) * 4.0, 0, 1)
            ey = np.clip(np.minimum(cy, 1 - cy) * 4.0, 0, 1)
            corner = np.clip(1 - np.hypot(1 - ex, 1 - ey) * 0, 0, 1) * (1 - ex) * (1 - ey)
            film = grime * (0.15 + 0.6 * np.asarray(P['dirt'])) * (0.5 + 0.9 * corner + 0.35 * (1 - ex * ey) + 0.3 * cy)
            film = np.append(film, 0.0).astype(np.float32)[lab]
            fine = noise2d(H, W, 4 * s, 3, self._lazy[4] + 21)
            ld = self.lead_d if self.lead_d is not None else np.full((H, W), 99, np.float32)
            near = smoothstep(5.5 * s, 0.5 * s, ld)
            acc = blur(self.came_a if self.lead_a is not None else np.zeros((H, W), np.float32), 2.0 * s)
            pack = smoothstep(0.32, 0.6, acc) * smoothstep(5 * s, 0, ld)
            g = (film * (0.55 + 0.7 * fine) + grime * near * (0.25 + 1.1 * fine) * 0.8 + grime * pack * 1.4)
            g *= (lab >= 0)
            Tm = 1 - np.clip(g, 0, 0.8)[..., None] * (1 - lin('#cbb48c'))[None, None, :] * 1.25
        out = np.ones(H * W, np.float32)
        if pits and n:
            r = np.random.default_rng(self._lazy[4] + 33)
            level = np.asarray(P['pit'] + [0.0], np.float32) * pits
            nn = int((W / s) * (H / s) / 200)
            py, px, acc, rad = (r.random(nn) * H).astype(np.int64), (r.random(nn) * W).astype(np.int64), r.random(nn), r.uniform(0.6, 1.9, nn)
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
        """flat, even daylight behind the panel (a soft vertical fall-off only): brightness differences come
        from the glass itself, not from glows"""
        H = self.H
        top, bot = self._sky
        t = (self.YY / H)[..., None]
        return (lin(top) * (1 - t) + lin(bot) * t).astype(np.float32)

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
        if self.vig:
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
            Eg *= (1 - 0.2 * smoothstep(3.0 * s, 0, self.lead_d))[..., None]      # cement line along the came
        if self.weather_T is not None:
            Eg *= self.weather_T
        Eg *= self._daylight()
        if self.lead_a is not None:
            la = self.lead_a[..., None]
            halo = np.stack([0.035 * blur(Eg[..., c], 1.0 * s) for c in range(3)], -1)
            Eg = Eg * (1 - la) + self.lead_rgb * la + halo * la
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
        reg = np.asarray(self.pp['region'] + [-1], np.int64)
        cnt = np.bincount(lab[lab >= 0], minlength=n_p).astype(np.float64)
        ys, xs = np.nonzero(lab >= 0)
        cw = cnt + 1e-6
        pcx = np.bincount(lab[ys, xs], xs, n_p) / cw
        pcy = np.bincount(lab[ys, xs], ys, n_p) / cw
        del ys, xs
        vis = cnt > 0
        hw = self.lead_w * s / 2
        bd = self.bd
        n = [0]

        def save(img, name):
            save_png(img, os.path.join(stages_dir, f"{n[0]:03d}_{name}.png"))
            n[0] += 1

        # ---- the cartoon: cut lines in soft pencil / charcoal on cartridge paper on the light table
        paper = lin('#f1ebdc') * (0.95 + 0.05 * noise2d(H, W, 7 * s, 3, self._lazy[0] + 9))[..., None]
        paper = (paper * (1 + 0.05 * self.grain[..., None])).astype(np.float32)
        wob = noise2d(H, W, 16 * s, 2, self._lazy[0] + 4)
        press = 0.6 + 0.4 * noise2d(H, W, 45 * s, 2, self._lazy[0] + 5)
        lw = hw * (0.62 + 0.4 * wob)
        tooth = np.clip(0.75 + 0.5 * self.grain * 2.5, 0, 1)
        line = (smoothstep(lw + 0.9, lw - 0.9, bd) * press * tooth).astype(np.float32)
        del wob, press, lw
        detail = np.clip(self.trace_a * 0.55 + self.matt_a * 0.12, 0, 1).astype(np.float32)
        numbers = self._piece_numbers(pcx, pcy, cnt)
        rmap = reg[lab]
        nreg = max(int(reg.max()) + 1, 1)
        rcnt = np.bincount(reg[:-1][vis], cnt[vis], nreg)

        def cartoon(r_upto, det=0.0, num=0.0):
            ln = line * (rmap <= r_upto)
            ink = 1 - (1 - 0.95 * ln) * (1 - 0.7 * detail * det * (rmap <= r_upto)) * (1 - 0.8 * numbers * num)
            return paper * (1 - ink)[..., None] + lin('#2a2624') * ink[..., None] * 0.6

        Tg = self._glass_T()
        PT = self._paint_T()
        table = np.array([1.0, 0.985, 0.95], np.float32) * 0.97
        gap_k = 0.85 + 0.75 * _hash01(np.arange(n_p + 1, dtype=np.int64), np.full(n_p + 1, 3, np.int64), self._lazy[2])
        gap = (hw * gap_k[lab]).astype(np.float32)
        edge = (1 - 0.4 * smoothstep(gap + 1.8 * s, gap, bd))[..., None]
        inside = (bd > gap)
        full_paper = cartoon(nreg, 1.0, 1.0)
        thin = smoothstep(hw * 0.32 + 0.7, hw * 0.32 - 0.7, bd) * 0.9
        bench_paper = paper * (1 - thin)[..., None] + lin('#2a2624') * 0.6 * thin[..., None]   # the line between pieces
        fresh = self._lead_colour(aged=False)

        def bench(laid, painted, leaded, soldered, aged=0.0):
            Lp = np.append(laid, False)[lab]
            Ld = np.append(leaded, False)[lab]
            Pp = np.append(painted, False)[lab].astype(np.float32)
            glass = Tg * (1 + (PT - 1) * Pp[..., None]) * table
            show = (Lp & inside) | Ld
            img = np.where(show[..., None], np.where(Ld[..., None], glass, glass * edge),
                           np.where(Lp[..., None], bench_paper, full_paper))
            if leaded.any():
                lm = _dilate(Ld, max(1, int(hw + 1)))
                ca = self.came_a * lm
                sa = self.sol_a * soldered * lm
                la = np.maximum(ca, sa)[..., None]
                col = fresh * (1 - aged) + self.lead_rgb * aged
                img = img * (1 - la) + col * la
            return self._finish_img(img.astype(np.float32), glass_k=0.0)

        if dense:
            # 1 cartoon: cut lines area by area, the paint lines, then the piece numbers
            acc = np.cumsum(rcnt) / max(rcnt.sum(), 1)
            for c in range(5):
                ru = int(np.searchsorted(acc, (c + 1) / 5 - 1e-6))
                save(self._finish_img(cartoon(ru).astype(np.float32), 0.0), 'cartoon_lines_%d' % c)
            save(self._finish_img(cartoon(nreg, 1.0).astype(np.float32), 0.0), 'cartoon_paint')
            half = self._piece_numbers(pcx, pcy, cnt, part=0.5)
            img = cartoon(nreg, 1.0)
            ink = 0.7 * half
            img = img * (1 - ink)[..., None] + lin('#2e2a28') * ink[..., None] * 0.9
            save(self._finish_img(img.astype(np.float32), 0.0), 'cartoon_numbers_0')
            save(self._finish_img(full_paper.astype(np.float32), 0.0), 'cartoon_numbers_1')
            # 2 glass cut and laid on the cartoon, sheet colour by sheet colour
            col = np.asarray(self.pp['col'], np.float32)
            hue = _hue(col) + 0.04 * _hash01(np.arange(n_p, dtype=np.int64), np.full(n_p, 5, np.int64), self._lazy[1])
            order = np.argsort(hue + 0.002 * pcx / W)
            laid = np.zeros(n_p, bool)
            nl = 11
            for c in range(nl):
                laid[order[: int(round(n_p * ((c + 1) / nl) ** 1.15))]] = True
                save(bench(laid, laid & False, laid & False, 0.0), 'laid_%d' % c)
            laid[:] = True
            none = np.zeros(n_p, bool)
            # 3 the grisaille traced and matted, fired
            haspaint = np.bincount(lab[lab >= 0], ((self.trace_a + self.matt_a + self.stain_a) > 0.05)[lab >= 0], n_p) > 0
            painted = np.zeros(n_p, bool)
            preg = np.unique(reg[:-1][haspaint]) if haspaint.any() else np.array([0])
            for c in range(3):
                upto = preg[min(len(preg) - 1, int(np.ceil(len(preg) * (c + 1) / 3)) - 1)]
                painted = haspaint & (reg[:-1] <= upto)
                save(bench(laid, painted, none, 0.0), 'painted_%d' % c)
            painted[:] = True
            # 4 leading up from the bottom-left corner, piece by piece (not yet soldered)
            key = pcx / W * 0.85 + (1 - pcy / H)
            order = np.argsort(key)
            nlead = 14
            leaded = np.zeros(n_p, bool)
            for c in range(nlead):
                leaded[order[: int(round(n_p * (c + 1) / nlead))]] = True
                save(bench(laid, painted, leaded, 0.0), 'leading_%d' % c)
            # 5 soldering the joints, one side of the panel then the other
            nsol = 7
            front = (self.XX / W * 0.85 + (1 - self.YY / H)).astype(np.float32)
            lo, hi = float(front.min()), float(front.max())
            for c in range(nsol):
                th = lo + (hi - lo) * (c + 1) / nsol
                save(bench(laid, painted, leaded, (front <= th + 1e-6).astype(np.float32)), 'solder_%d' % c)
            # 6 cemented and blackened
            save(bench(laid, painted, leaded, np.ones((H, W), np.float32), aged=1.0), 'cemented')
        else:
            save(self._finish_img(full_paper.astype(np.float32), 0.0), 'cartoon')
            allp = np.ones(n_p, bool)
            half = np.zeros(n_p, bool)
            half[np.argsort(_hue(np.asarray(self.pp['col'], np.float32)))[: n_p // 2]] = True
            save(bench(half, half & False, half & False, 0.0), 'laid')
            save(bench(allp, allp, allp & False, 0.0), 'painted')
            save(bench(allp, allp, allp, 0.0), 'leaded')
            save(bench(allp, allp, allp, np.ones((H, W), np.float32)), 'soldered')
        save(final, 'final')

    def _piece_numbers(self, pcx, pcy, cnt, part=1.0):
        """the glazier's piece numbers written on the cartoon, in pencil"""
        s = self.s
        H, W = self.H, self.W
        im = Image.new('L', (W, H), 0)
        d = ImageDraw.Draw(im)
        fs = max(7, int(round(13 * s)))
        font = _font(fs)
        big = np.nonzero(cnt > (34 * s) ** 2)[0]
        order = big[np.argsort(pcy[big] * 3 + pcx[big] / W)]
        if part < 1:
            order = order[: int(len(order) * part)]
        for k, i in enumerate(order):
            txt = str(int(np.searchsorted(np.sort(big), i)) + 1)
            x = pcx[i] + (_hash01(np.int64(i), np.int64(1), 9) - 0.5) * 8 * s
            y = pcy[i] + (_hash01(np.int64(i), np.int64(2), 9) - 0.5) * 6 * s
            d.text((float(x), float(y)), txt, fill=200, font=font, anchor='mm')
        a = np.asarray(im, np.float32) / 255
        lab = self.label
        return (a * (self.bd > self.lead_w * s * 0.6)).astype(np.float32)


# ---------------------------------------------------------------------- helpers
_FONT_CACHE = {}


def _font(size):
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]
    f = None
    for p in ('/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            f = ImageFont.truetype(p, size)
            break
        except OSError:
            pass
    if f is None:
        try:
            f = ImageFont.load_default(size=size)
        except TypeError:
            f = ImageFont.load_default()
    _FONT_CACHE[size] = f
    return f


def _hue(col):
    c = np.asarray(col, np.float32) ** (1 / 2.2)
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    mx, mn = c.max(1), c.min(1)
    dlt = mx - mn + 1e-6
    h = np.where(mx == r, (g - b) / dlt % 6, np.where(mx == g, (b - r) / dlt + 2, (r - g) / dlt + 4)) / 6
    h = np.where(dlt < 0.08, 1.2 + mx * 0.1, h)                 # greys and near-whites last
    return h


def _hash01(i, j, seed):
    """position-hashed uniform numbers in [0, 1): the same input always draws the same value"""
    i = np.asarray(i, np.int64); j = np.asarray(j, np.int64)
    h = (i * 73856093) ^ (j * 19349663) ^ np.int64(seed * 83492791 & 0x7FFFFFFF)
    h &= 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(1 << 24)


def _cc(m):
    """4-connected components of a bool array by run-length union-find: (labels, -1 background; count)"""
    h, w = m.shape
    p = np.zeros((h, w + 2), np.int8)
    p[:, 1:-1] = m
    d = np.diff(p, axis=1)
    rs, cs = np.nonzero(d == 1)
    _, ce = np.nonzero(d == -1)
    nr = len(rs)
    out = np.full((h, w), -1, np.int32)
    if nr == 0:
        return out, 0
    parent = np.arange(nr)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    rowst = np.searchsorted(rs, np.arange(h + 1))
    for y in range(1, h):
        a0, a1, b0, b1 = rowst[y - 1], rowst[y], rowst[y], rowst[y + 1]
        if a0 == a1 or b0 == b1:
            continue
        i, j = a0, b0
        while i < a1 and j < b1:
            if cs[i] < ce[j] and cs[j] < ce[i]:
                ra, rb = find(i), find(j)
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
            if ce[i] < ce[j]:
                i += 1
            else:
                j += 1
    roots = np.array([find(a) for a in range(nr)])
    _, lab = np.unique(roots, return_inverse=True)
    lens = ce - cs
    off = np.repeat(np.cumsum(lens) - lens, lens)
    flat = np.repeat(rs * w + cs, lens) + np.arange(lens.sum()) - off
    out.flat[flat] = np.repeat(lab.astype(np.int32), lens)
    return out, int(lab.max()) + 1


def _largest_hole(m):
    """centre (y, x) of the largest region enclosed by the piece (crop coords), or None"""
    h, w = m.shape
    c = np.ones((h + 2, w + 2), bool)
    c[1:-1, 1:-1] = ~m
    lab, n = _cc(c)
    if n <= 1:
        return None
    outer = lab[0, 0]
    sizes = np.bincount(lab[lab >= 0], minlength=n)
    sizes[outer] = 0
    k = int(np.argmax(sizes))
    if sizes[k] < 3:
        return None
    ys, xs = np.nonzero(lab == k)
    return float(ys.mean() - 1), float(xs.mean() - 1)


def _notch(m, r, edges, min_depth):
    """the sharpest inside corner of the piece (crop mask m), or the deepest inside curve: (y, x, dy, dx)
    with (dy, dx) pointing into the piece, or None.  edges: which crop sides lie on the canvas edge (the
    panel goes on there, so they count as glass)"""
    h, w = m.shape
    pad = np.zeros((h + 2 * r + 2, w + 2 * r + 2), np.float32)
    pad[r + 1:r + 1 + h, r + 1:r + 1 + w] = m
    top, bot, left, right = edges
    if top: pad[:r + 1, :] = pad[r + 1:r + 2, :]
    if bot: pad[r + 1 + h:, :] = pad[r + h:r + 1 + h, :]
    if left: pad[:, :r + 1] = pad[:, r + 1:r + 2]
    if right: pad[:, r + 1 + w:] = pad[:, r + w:r + 1 + w]
    ii = np.pad(np.cumsum(np.cumsum(pad, 0), 1), ((1, 0), (1, 0)))
    k = 2 * r + 1
    box = (ii[k:, k:] - ii[:-k, k:] - ii[k:, :-k] + ii[:-k, :-k]) / (k * k)    # mean over (2r+1)^2 window
    frac = box[1:1 + h, 1:1 + w]
    er = m.copy()
    er[1:, :] &= m[:-1, :]; er[:-1, :] &= m[1:, :]; er[:, 1:] &= m[:, :-1]; er[:, :-1] &= m[:, 1:]
    Bd = m & ~er
    if top: Bd[0, :] = False
    if bot: Bd[-1, :] = False
    if left: Bd[:, 0] = False
    if right: Bd[:, -1] = False
    ys, xs = np.nonzero(Bd)
    if len(ys) == 0:
        return None
    fr = frac[ys, xs]
    j = int(np.argmax(fr))
    py, px = int(ys[j]), int(xs[j])
    if fr[j] < 0.655:
        # a deep inside curve: a boundary point far inside the convex hull, relative to the hull edge
        hull = _hull(np.c_[np.r_[xs, xs], np.r_[ys, ys]].astype(np.float64))
        if hull is None or len(hull) < 3:
            return None
        A = hull; Bv = np.roll(hull, -1, 0)
        e = Bv - A
        el = np.hypot(e[:, 0], e[:, 1]) + 1e-9
        nx, ny = -e[:, 1] / el, e[:, 0] / el
        if ((hull.mean(0)[0] - A[:, 0]) * nx + (hull.mean(0)[1] - A[:, 1]) * ny).mean() < 0:
            nx, ny = -nx, -ny
        dd = (xs[:, None] - A[None, :, 0]) * nx[None] + (ys[:, None] - A[None, :, 1]) * ny[None]
        ei = np.argmin(dd, 1)
        dep = dd[np.arange(len(ys)), ei]
        ratio = dep / el[ei]
        score = np.where((dep > max(min_depth * 1.6, 4)) & (ratio > 0.42), dep, -1)
        j = int(np.argmax(score))
        if score[j] <= 0:
            return None
        py, px = int(ys[j]), int(xs[j])
    # into the material: from the corner toward the mass of glass around it
    y0, y1, x0, x1 = max(0, py - 2 * r), min(h, py + 2 * r + 1), max(0, px - 2 * r), min(w, px + 2 * r + 1)
    yy, xx = np.nonzero(m[y0:y1, x0:x1])
    if len(yy) == 0:
        return None
    dy, dx = (yy + y0).mean() - py, (xx + x0).mean() - px
    nrm = np.hypot(dy, dx)
    if nrm < 1e-6:
        return None
    return py, px, dy / nrm, dx / nrm


def _hull(P):
    """convex hull (monotone chain) of points P (n, 2) -> (k, 2), counter-clockwise"""
    P = np.unique(P, axis=0)
    if len(P) < 3:
        return None
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in P:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(tuple(p))
    for p in P[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(tuple(p))
    return np.array(lower[:-1] + upper[:-1], np.float64)


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
    for c in _hexs(cols):
        v = [int(c[i:i + 2], 16) for i in (1, 3, 5)]
        out.append('#%02x%02x%02x' % tuple(int(np.clip(t * k, 0, 255)) for t in v))
    return out


def cloud_shape(cx, cy, L, h, r):
    """a cloud as a glazier draws it: one smooth swelling top (a broad crown off centre, perhaps a gentler
    second swell -- no cusps), a long tapering tail to one side, a nearly flat, gently curved base; returns
    outline arrays and the x of the cuts across it"""
    t = np.linspace(-1, 1, 240)
    tail = 1 if r.random() < 0.5 else -1
    base = np.clip(1 - t ** 2, 0, 1) ** 0.55
    p1 = -tail * r.uniform(0.1, 0.35)
    top = base * (0.62 + 0.42 * np.exp(-((t - p1) / r.uniform(0.3, 0.45)) ** 2))
    if r.random() < 0.6:
        p2 = p1 + tail * r.uniform(0.45, 0.7)
        top += base * 0.2 * np.exp(-((t - p2) / r.uniform(0.25, 0.4)) ** 2)
    top *= (1 - 0.25 * np.clip(t * tail, 0, 1))                    # the tail runs out low
    top /= top.max()
    xs = cx + t * L / 2
    tilt = r.uniform(-0.025, 0.025)
    ty = cy - h * 0.78 * top + tilt * (xs - cx)
    by = cy + h * 0.22 * np.clip(1 - t ** 2, 0, 1) ** 0.35 * (1 + 0.12 * np.sin(t * 2.2 + r.uniform(0, 6))) + tilt * (xs - cx)
    ncut = 1 + int(L > 300) + int(L > 420)
    pos = np.sort(r.uniform(-0.45, 0.45, ncut) + np.linspace(-0.3, 0.3, ncut) * (ncut > 1))
    cuts = [cx + p * L / 2 for p in pos]
    return xs, ty, by, cuts


def bird_pieces(bx, by, sc, fl, r):
    """a gull in flight as three pieces of glass: two gently curved wing blades and a small body -- every
    gull its own span, lift and wing breadth"""
    w_ = 46 * sc * r.uniform(0.9, 1.1)
    out = []
    for sgn in (-1, 1):
        k = r.uniform(0.85, 1.15)
        tip = (sgn * w_ * k, -0.38 * w_ * fl * k)
        root_t = (sgn * 0.1 * w_, -0.1 * w_)
        root_b = (sgn * 0.12 * w_, 0.1 * w_)
        br = r.uniform(0.16, 0.24) * w_
        tt = np.linspace(0, 1, 14)
        # upper edge bows up (convex), lower edge runs back nearly straight
        ux = root_t[0] + (tip[0] - root_t[0]) * tt
        uy = root_t[1] + (tip[1] - root_t[1]) * tt - br * 0.9 * np.sin(np.pi * tt) ** 0.9
        lx = tip[0] + (root_b[0] - tip[0]) * tt
        ly = tip[1] + (root_b[1] - tip[1]) * tt - br * 0.25 * np.sin(np.pi * tt)
        pts = list(zip(ux, uy)) + list(zip(lx[1:], ly[1:]))
        out.append([(bx + x, by + y) for x, y in pts])
    a = np.linspace(0, 2 * np.pi, 16, endpoint=False)
    bw, bh = 0.13 * w_ * r.uniform(0.9, 1.1), 0.17 * w_ * r.uniform(0.9, 1.1)
    out.append([(bx + bw * np.cos(t), by + 0.02 * w_ + bh * np.sin(t)) for t in a])
    return out


def lay_cloud(g, S, cx, cy, L, h, cols, lit, rng):
    """a cloud cut as glass: smooth outline, split across at a few gently curved cuts, a shade row and a lit
    row (opalescent) when it is deep enough"""
    xs, ty, by, cuts = cloud_shape(cx, cy, L, h, rng)
    m = g.poly(S.pts(list(zip(xs, ty)) + list(zip(xs[::-1], by[::-1]))))
    top = lambda a, xs=xs, ty=ty: np.interp(a, xs, ty)
    bot = lambda a, xs=xs, by=by: np.interp(a, xs, by)
    colf = [polyfn([(v + rng.uniform(-10, 10), cy - h * 1.2), (v + rng.uniform(-6, 6), cy), (v + rng.uniform(-10, 10), cy + h)])
            for v in cuts]
    dark, light = cols
    rc = [dark, light] if lit == 'below' else [light, dark]
    g.band(m, light, top, bot, rows=2 if h >= 40 else 1, columns=colf, length=(900, 1400), row_colours=rc,
           flow=0.0, flow_jit=0.2, wave=(0.05, 300.0), mix=dict(opal=0.55, streaky=0.3, cathedral=0.15), matting=0.15)
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
