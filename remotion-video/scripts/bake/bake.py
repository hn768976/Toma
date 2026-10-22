"""Bake every brain asset the looks draw from, once, into public/brain/.

    python3 scripts/bake/bake.py          (from the remotion-video folder)

Inputs:  assets/brain.glb
Outputs: public/brain/brain.json   manifest (counts, byte offsets, scales, report)
         public/brain/mesh.bin     cleaned cortex mesh + per-vertex curvature/AO/label
         public/brain/inner.bin    inner structures mesh (ventricles, callosum, thalamus, hippocampus)
         public/brain/points.bin   surface point samples (cortex denser on gyri, then inner)
         public/brain/fibres.bin   ~6000 fibre curves (surface-following + interior tracts)
         public/brain/thoughts.bin thought-line polylines for the glass look
         public/brain/arcs.bin     forked lightning paths hugging the cortex

Everything is seeded; re-running produces identical files.
"""

import json
import os
import sys
import time

import numpy as np
import trimesh
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import inner as inner_mod  # noqa: E402
import mesh_prep  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "brain")
QPOS = 30000.0  # int16 position quantisation: value / QPOS (range +-1.09)

N_CORTEX_POINTS = 640_000
N_INNER_POINTS = 160_000
N_SURFACE_FIBRES = 4600
N_INNER_FIBRES = 1400
FIBRE_PTS = 32
THOUGHT_PTS = 12
N_THOUGHTS = 420
N_ARCS = 96
ARC_MAIN_PTS = 40
ARC_FORK_PTS = 14
ARC_FORKS = 3


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


# ----------------------------------------------------------------------------- labels
def part_labels(V):
    """0 cerebrum, 1 cerebellum, 2 brainstem (fitted on coloured renders)."""
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    lab = np.zeros(len(V), np.uint8)
    e = ((x + 0.38) / 0.40) ** 2 + ((y + 0.38) / 0.27) ** 2 + (z / 0.95) ** 2
    cb = (e < 1.0) & (y < -0.13 - 0.25 * (x + 0.05)) & (x < -0.02 - 0.30 * np.abs(z))
    lab[cb] = 1
    stem = (np.abs(z) < 0.17) & (y < -0.30) & (x > -0.40) & (x < 0.10) & ~((e < 0.6) & (np.abs(z) > 0.12))
    stem |= (y < -0.55) & (np.abs(z) < 0.2)
    lab[stem] = 2
    return lab


# ----------------------------------------------------------------------------- sampling
def sample_surface(V, F, N, vattrs, n, weights, rng):
    tri = F
    fi = rng.choice(len(tri), n, p=weights / weights.sum())
    r1 = np.sqrt(rng.random(n))
    r2 = rng.random(n)
    bc = np.stack([1 - r1, r1 * (1 - r2), r1 * r2], 1)
    t = tri[fi]
    p = (V[t] * bc[:, :, None]).sum(1)
    nn = (N[t] * bc[:, :, None]).sum(1)
    nn /= np.linalg.norm(nn, axis=1, keepdims=True) + 1e-12
    out = {}
    for k, a in vattrs.items():
        if a.dtype == np.uint8:
            out[k] = a[t[np.arange(n), np.argmax(bc, 1)]]
        else:
            out[k] = (a[t] * bc).sum(1)
    return p, nn, out


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- surface field
class Surface:
    """Dense surface samples + KD-tree: closest point, normal, signed distance."""

    def __init__(self, V, F, N, depth, rng, n=1_500_000):
        m = trimesh.Trimesh(V, F, process=False)
        p, nn, at = sample_surface(V, F, N, {"depth": depth}, n, m.area_faces, rng)
        self.p, self.n, self.depth = p, nn, at["depth"]
        self.tree = cKDTree(p)
        # Per-vertex gradient of sulcal depth (for along-fold directions).
        g = np.zeros_like(V)
        fg = face_gradients(V, F, depth)
        np.add.at(g, F[:, 0], fg)
        np.add.at(g, F[:, 1], fg)
        np.add.at(g, F[:, 2], fg)
        self.vtree = cKDTree(V)
        self.vgrad = g
        self.vnorm = N

    def closest(self, q):
        d, i = self.tree.query(q, workers=-1)
        return self.p[i], self.n[i], i

    def sdf(self, q):
        cp, cn, _ = self.closest(q)
        diff = q - cp
        s = np.sign((diff * cn).sum(1))
        return s * np.linalg.norm(diff, axis=1)

    def fold_dir(self, q):
        _, vi = self.vtree.query(q, k=6, workers=-1)
        g = self.vgrad[vi].mean(1)
        n = self.vnorm[vi].mean(1)
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        d = np.cross(n, g)
        return d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-12), n


def face_gradients(V, F, f):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    A2 = np.linalg.norm(n, axis=1, keepdims=True) + 1e-15
    n = n / A2
    fa, fb, fc = f[F[:, 0]][:, None], f[F[:, 1]][:, None], f[F[:, 2]][:, None]
    g = (fa * np.cross(n, c - b) + fb * np.cross(n, a - c) + fc * np.cross(n, b - a)) / A2
    return g


def flow_field(q, seed):
    """Smooth deterministic 3D vector field (sum of random sinusoids)."""
    r = np.random.default_rng(seed)
    v = np.zeros_like(q)
    for _ in range(6):
        k = r.normal(size=3) * r.uniform(1.5, 4.0)
        a = r.normal(size=3)
        ph = r.uniform(0, 2 * np.pi)
        v += np.sin(q @ k + ph)[:, None] * a[None, :]
    return v


def resample(poly, n):
    seg = np.linalg.norm(np.diff(poly, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] <= 1e-9:
        return np.repeat(poly[:1], n, 0), 0.0
    t = np.linspace(0, s[-1], n)
    out = np.stack([np.interp(t, s, poly[:, k]) for k in range(3)], 1)
    return out, float(s[-1])


# ----------------------------------------------------------------------------- fibres
def surface_fibres(S, lab_of, rng, count):
    """Fibres that hug the cortex: walk along the folds (perpendicular to the
    sulcal-depth gradient) mixed with a smooth flow field, re-projected onto
    the surface at a small per-fibre depth below it."""
    # Seeds: surface samples on cerebrum/cerebellum (stem gets a few too).
    idx = rng.choice(len(S.p), count * 2, replace=False)
    seeds = S.p[idx]
    lab = lab_of(seeds)
    keep = np.where((lab != 2) | (rng.random(len(lab)) < 0.25))[0][:count]
    P = seeds[keep].copy()
    n_steps = 56
    step = rng.uniform(0.011, 0.02, len(P))
    depth = rng.uniform(0.0, 0.035, len(P))
    mix = rng.uniform(0.35, 0.85, len(P))  # how much to follow folds vs. flow
    sign = np.where(rng.random(len(P)) < 0.5, -1.0, 1.0)
    paths = np.zeros((n_steps + 1, len(P), 3))
    cp, cn, _ = S.closest(P)
    P = cp - cn * depth[:, None]
    paths[0] = P
    prev = None
    for s in range(n_steps):
        fd, n = S.fold_dir(P)
        fd *= sign[:, None]
        if prev is not None:
            flip = (fd * prev).sum(1) < 0
            fd[flip] *= -1
        fl = flow_field(P, 7)
        fl -= n * (fl * n).sum(1, keepdims=True)
        fl /= np.linalg.norm(fl, axis=1, keepdims=True) + 1e-9
        d = mix[:, None] * fd + (1 - mix[:, None]) * fl
        if prev is not None:
            d = 0.55 * d + 0.45 * prev
        d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        P = P + d * step[:, None]
        cp, cn, _ = S.closest(P)
        P = cp - cn * depth[:, None]
        paths[s + 1] = P
        prev = d
    out = np.zeros((len(keep), FIBRE_PTS, 3), np.float32)
    lengths = np.zeros(len(keep), np.float32)
    for i in range(len(keep)):
        out[i], lengths[i] = resample(smooth_poly(paths[:, i]), FIBRE_PTS)
    return out, lengths, depth.astype(np.float32)


def smooth_poly(p, it=2):
    p = p.copy()
    for _ in range(it):
        p[1:-1] = 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]
    return p


def catmull(points, n):
    P = np.asarray(points, float)
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


def inner_fibres(S, rng, count):
    """Tracts inside the white matter: commissural (through the callosum),
    association arcs (within a hemisphere) and projection fibres (cortex ->
    internal capsule -> brainstem). Rejected if any point leaves the brain."""
    # Interior candidate points: cerebrum, 0.06..0.3 below the surface.
    cand = rng.uniform([-0.95, -0.3, -0.8], [0.95, 0.78, 0.8], (400_000, 3))
    sd = S.sdf(cand)
    cand = cand[(sd < -0.06) & (sd > -0.32) & (cand[:, 1] > -0.25 + 0.0 * cand[:, 0])]
    cand = cand[~((cand[:, 0] < -0.25) & (cand[:, 1] < -0.1))]  # keep out of cerebellum
    cand = cand[np.abs(cand[:, 2]) > 0.06]  # not in the fissure
    out, lengths, kinds = [], [], []
    tries = 0
    while len(out) < count and tries < count * 20:
        tries += 1
        k = rng.random()
        if k < 0.35:  # commissural
            a = cand[rng.integers(len(cand))]
            if abs(a[2]) < 0.2:
                continue
            b = a * np.array([1, 1, -1]) + rng.normal(0, 0.12, 3) * np.array([1, 0.6, 0.3])
            mid = np.array([np.clip((a[0] + b[0]) / 2, -0.25, 0.45), 0.33 + rng.uniform(-0.02, 0.02), 0])
            ctrl = [a, (a + mid) / 2 + np.array([0, 0.05, 0]), mid, (b + mid) / 2 + np.array([0, 0.05, 0]), b]
            kind = 1
        elif k < 0.75:  # association
            a = cand[rng.integers(len(cand))]
            near = cand[(np.sign(cand[:, 2]) == np.sign(a[2]))]
            dd = np.linalg.norm(near - a, axis=1)
            sel = near[(dd > 0.25) & (dd < 0.9)]
            if len(sel) == 0:
                continue
            b = sel[rng.integers(len(sel))]
            mid = (a + b) / 2
            # bow inward (toward the hemisphere centre)
            c = np.array([0.0, 0.15, np.sign(a[2]) * 0.35])
            mid = mid + (c - mid) * rng.uniform(0.2, 0.5)
            ctrl = [a, mid, b]
            kind = 2
        else:  # projection
            a = cand[(cand[:, 1] > 0.3)][rng.integers((cand[:, 1] > 0.3).sum())]
            s = np.sign(a[2]) if a[2] != 0 else 1
            cap = np.array([rng.uniform(-0.12, 0.12), 0.02, s * rng.uniform(0.14, 0.2)])
            ped = np.array([-0.18, -0.25, s * 0.07])
            stem = np.array([-0.30 + rng.uniform(-0.03, 0.03), -0.55 - rng.uniform(0, 0.12), s * 0.03])
            ctrl = [a, (a + cap) / 2, cap, ped, stem]
            kind = 3
        poly = catmull(ctrl, 12)
        poly += rng.normal(0, 0.006, poly.shape)
        poly = smooth_poly(poly, 3)
        pts, L = resample(poly, FIBRE_PTS)
        if (S.sdf(pts) > -0.008).any():
            continue
        out.append(pts)
        lengths.append(L)
        kinds.append(kind)
    log(f"inner fibres: {len(out)} accepted out of {tries} tries")
    return np.array(out, np.float32), np.array(lengths, np.float32), np.array(kinds, np.uint8)


# ----------------------------------------------------------------------------- thought lines
def thought_lines(S, rng):
    """Polylines of straight segments between nodes inside the cerebrum, kept
    well inside (>= 0.07 below the surface) so the side view stays inside the
    outline. Ordered: the first lines are the 'early' few."""
    cand = rng.uniform([-0.9, -0.25, -0.55], [0.9, 0.72, 0.55], (300_000, 3))
    sd = S.sdf(cand)
    ok = (sd < -0.07) & ~((cand[:, 0] < -0.3) & (cand[:, 1] < -0.05))
    nodes = cand[ok]
    nodes = nodes[rng.choice(len(nodes), 3000, replace=False)]
    tree = cKDTree(nodes)
    lines = np.zeros((N_THOUGHTS, THOUGHT_PTS, 3), np.float32)
    counts = np.zeros(N_THOUGHTS, np.uint8)
    for i in range(N_THOUGHTS):
        cur = nodes[rng.integers(len(nodes))]
        n_seg = rng.integers(3, THOUGHT_PTS)
        pts = [cur]
        heading = rng.normal(size=3)
        heading[2] *= 0.4
        heading /= np.linalg.norm(heading)
        for _ in range(n_seg):
            nb = tree.query_ball_point(cur, 0.32)
            cands = nodes[nb]
            dv = cands - cur
            dist = np.linalg.norm(dv, axis=1)
            good = (dist > 0.1)
            if not good.any():
                break
            cands, dv, dist = cands[good], dv[good], dist[good]
            score = (dv / dist[:, None]) @ heading + rng.uniform(0, 0.9, len(dist))
            nxt = cands[np.argmax(score)]
            # straight segment must stay inside
            seg = cur + (nxt - cur) * np.linspace(0, 1, 8)[:, None]
            if (S.sdf(seg) > -0.04).any():
                heading = -heading + rng.normal(0, 0.5, 3)
                heading /= np.linalg.norm(heading)
                continue
            heading = 0.6 * heading + 0.4 * (nxt - cur) / np.linalg.norm(nxt - cur) + rng.normal(0, 0.35, 3)
            heading /= np.linalg.norm(heading)
            pts.append(nxt)
            cur = nxt
        pts = np.array(pts)
        counts[i] = len(pts)
        lines[i, : len(pts)] = pts
        lines[i, len(pts):] = pts[-1]
    return lines, counts


# ----------------------------------------------------------------------------- arcs
def lightning(a, b, rng, n, rough):
    """Midpoint-displacement polyline from a to b with n points."""
    pts = np.array([a, b], float)
    amp = np.linalg.norm(b - a) * rough
    while len(pts) < n:
        mids = (pts[:-1] + pts[1:]) / 2 + rng.normal(0, amp, (len(pts) - 1, 3))
        new = np.empty((len(pts) * 2 - 1, 3))
        new[0::2] = pts
        new[1::2] = mids
        pts = new
        amp *= 0.55
    out, _ = resample(pts, n)
    return out


def surface_arcs(S, lab_of, rng):
    """Forked discharge paths lying on the cortex (projected onto it and lifted
    by a hair along the normal). Each arc: a main channel + ARC_FORKS forks."""
    main = np.zeros((N_ARCS, ARC_MAIN_PTS, 3), np.float32)
    forks = np.zeros((N_ARCS, ARC_FORKS, ARC_FORK_PTS, 3), np.float32)
    fork_at = np.zeros((N_ARCS, ARC_FORKS), np.float32)
    centres = np.zeros((N_ARCS, 3), np.float32)
    i = 0
    while i < N_ARCS:
        a = S.p[rng.integers(len(S.p))]
        if lab_of(a[None])[0] != 0 or a[1] < -0.2:
            continue
        # walk ~0.3-0.55 along the surface for the end point
        cp, cn, _ = S.closest(a[None])
        t = np.cross(cn[0], rng.normal(size=3))
        t /= np.linalg.norm(t)
        L = rng.uniform(0.28, 0.55)
        b = a + t * L
        b = S.closest(b[None])[0][0]
        path = lightning(a, b, rng, ARC_MAIN_PTS, 0.22)
        cp, cn, _ = S.closest(path)
        path = cp + cn * 0.006
        main[i] = path
        centres[i] = path[ARC_MAIN_PTS // 2]
        for f in range(ARC_FORKS):
            u = rng.uniform(0.15, 0.8)
            j = int(u * (ARC_MAIN_PTS - 1))
            start = path[j]
            nrm = cn[j]
            side = np.cross(nrm, path[min(j + 1, ARC_MAIN_PTS - 1)] - path[max(j - 1, 0)])
            side /= np.linalg.norm(side) + 1e-9
            fwd = path[-1] - path[0]
            fwd /= np.linalg.norm(fwd) + 1e-9
            end = start + (side * rng.choice([-1, 1]) * 0.7 + fwd * 0.6) * rng.uniform(0.06, 0.16)
            fp = lightning(start, end, rng, ARC_FORK_PTS, 0.3)
            fcp, fcn, _ = S.closest(fp)
            forks[i, f] = fcp + fcn * 0.006
            fork_at[i, f] = u
        i += 1
    return main, forks, fork_at, centres


# ----------------------------------------------------------------------------- writing
class Blob:
    def __init__(self):
        self.parts = []
        self.off = 0
        self.index = {}

    def add(self, name, arr):
        arr = np.ascontiguousarray(arr)
        pad = (-self.off) % 4
        if pad:
            self.parts.append(b"\0" * pad)
            self.off += pad
        self.index[name] = {"offset": self.off, "dtype": str(arr.dtype), "shape": list(arr.shape)}
        b = arr.tobytes()
        self.parts.append(b)
        self.off += len(b)

    def write(self, path):
        with open(path, "wb") as f:
            for p in self.parts:
                f.write(p)
        return os.path.getsize(path)


def q16(p):
    return np.clip(np.round(p * QPOS), -32767, 32767).astype(np.int16)


def q8n(n):
    return np.clip(np.round(n * 127), -127, 127).astype(np.int8)


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(20261021)
    glb = os.path.join(ROOT, "assets", "brain.glb")
    raw, info = mesh_prep.load_raw(glb)
    info["file_name"] = "brain.glb"
    info["file_bytes"] = os.path.getsize(glb)
    log("loaded", info)
    m, clean = mesh_prep.clean(raw)
    log("cleaned", clean)
    m, norm = mesh_prep.normalise(m)
    log("normalised", norm)
    pre = m.vertices.copy()
    m = mesh_prep.repair(m, part_labels, clean)
    log("repaired", clean)
    N, curv, depth, ao = mesh_prep.attributes(m)
    V, F = m.vertices, m.faces
    # Labels from the pre-repair positions (the repair thickens the brainstem,
    # which would push it outside the position-based classifier).
    lab = part_labels(np.vstack([pre, V[len(pre):]]))
    log("labels", np.bincount(lab).tolist())

    manifest = {"source": info, "clean": clean, "normalise": norm, "qpos": QPOS, "files": {}}

    # mesh.bin
    b = Blob()
    b.add("position", V.astype(np.float32))
    b.add("normal", N.astype(np.float32))
    b.add("curv", curv.astype(np.float32))
    b.add("ao", ao.astype(np.float32))
    b.add("depth", depth.astype(np.float32))
    b.add("label", lab)
    b.add("index", F.astype(np.uint32))
    manifest["files"]["mesh"] = {"bytes": b.write(os.path.join(OUT, "mesh.bin")), "arrays": b.index}

    # inner.bin
    log("building inner structures")
    inner = inner_mod.build()
    iv, inn, il, ifc = [], [], [], []
    base = 0
    for name, (im, l) in inner.items():
        iv.append(im.vertices)
        inn.append(im.vertex_normals)
        il.append(np.full(len(im.vertices), l, np.uint8))
        ifc.append(im.faces + base)
        base += len(im.vertices)
    IV, IN, IL, IF = np.vstack(iv), np.vstack(inn), np.concatenate(il), np.vstack(ifc)
    b = Blob()
    b.add("position", IV.astype(np.float32))
    b.add("normal", IN.astype(np.float32))
    b.add("label", IL)
    b.add("index", IF.astype(np.uint32))
    manifest["files"]["inner"] = {
        "bytes": b.write(os.path.join(OUT, "inner.bin")),
        "arrays": b.index,
        "parts": {k: {"label": int(l), "vertices": int(len(im.vertices)), "triangles": int(len(im.faces))} for k, (im, l) in inner.items()},
    }

    # points.bin: cortex (denser on gyri) then inner structures
    log("sampling points")
    mm = trimesh.Trimesh(V, F, process=False)
    fcurv = curv[F].mean(1)
    w = mm.area_faces * (0.35 + 1.3 * smoothstep(-0.3, 0.6, fcurv))
    cp_, cn_, cat = sample_surface(V, F, N, {"curv": curv, "ao": ao, "label": lab}, N_CORTEX_POINTS, w, rng)
    imm = trimesh.Trimesh(IV, IF, process=False)
    ip_, in_, iat = sample_surface(IV, IF, IN, {"label": IL}, N_INNER_POINTS, imm.area_faces, rng)
    # Shuffle each block so any prefix is an even subsample.
    pc = rng.permutation(N_CORTEX_POINTS)
    pi = rng.permutation(N_INNER_POINTS)
    P = np.vstack([cp_[pc], ip_[pi]])
    PN = np.vstack([cn_[pc], in_[pi]])
    PC = np.concatenate([cat["curv"][pc], np.zeros(N_INNER_POINTS)])
    PA = np.concatenate([cat["ao"][pc], np.ones(N_INNER_POINTS)])
    PL = np.concatenate([cat["label"][pc], iat["label"][pi]])
    b = Blob()
    b.add("position", q16(P))
    b.add("normal", q8n(PN))
    b.add("curv", np.clip(np.round(PC * 100), -127, 127).astype(np.int8))
    b.add("ao", np.clip(np.round(PA * 255), 0, 255).astype(np.uint8))
    b.add("label", PL.astype(np.uint8))
    manifest["files"]["points"] = {"bytes": b.write(os.path.join(OUT, "points.bin")), "arrays": b.index, "cortex": N_CORTEX_POINTS, "inner": N_INNER_POINTS}

    # fibres
    log("surface field")
    S = Surface(V, F, N, depth, rng)
    vtree = cKDTree(V)

    def lab_of(q):
        return lab[vtree.query(q, workers=-1)[1]]

    log("surface fibres")
    sf, sl, sd = surface_fibres(S, lab_of, rng, N_SURFACE_FIBRES)
    log("inner fibres")
    inf, inl, ink = inner_fibres(S, rng, N_INNER_FIBRES)
    fib = np.vstack([sf, inf])
    kinds = np.concatenate([np.zeros(len(sf), np.uint8), ink])
    flab = lab_of(fib[:, FIBRE_PTS // 2])
    order = rng.permutation(len(fib))
    b = Blob()
    b.add("position", q16(fib[order].reshape(-1, 3)))
    b.add("kind", kinds[order])
    b.add("label", flab[order].astype(np.uint8))
    b.add("length", np.concatenate([sl, inl])[order].astype(np.float32))
    manifest["files"]["fibres"] = {"bytes": b.write(os.path.join(OUT, "fibres.bin")), "arrays": b.index, "count": int(len(fib)), "pointsPerFibre": FIBRE_PTS}

    log("thought lines")
    tl, tc = thought_lines(S, rng)
    b = Blob()
    b.add("position", tl.reshape(-1, 3).astype(np.float32))
    b.add("count", tc)
    manifest["files"]["thoughts"] = {"bytes": b.write(os.path.join(OUT, "thoughts.bin")), "arrays": b.index, "count": N_THOUGHTS, "pointsPerLine": THOUGHT_PTS}

    log("arcs")
    am, af, afa, ac = surface_arcs(S, lab_of, rng)
    b = Blob()
    b.add("main", am.reshape(-1, 3))
    b.add("forks", af.reshape(-1, 3))
    b.add("forkAt", afa)
    b.add("centre", ac)
    manifest["files"]["arcs"] = {
        "bytes": b.write(os.path.join(OUT, "arcs.bin")),
        "arrays": b.index,
        "count": N_ARCS,
        "mainPts": ARC_MAIN_PTS,
        "forkPts": ARC_FORK_PTS,
        "forks": ARC_FORKS,
    }

    manifest["parts"] = {
        "cortex_mesh": {"vertices": int(len(V)), "triangles": int(len(F))},
        "labels": {"cerebrum": int((lab == 0).sum()), "cerebellum": int((lab == 1).sum()), "brainstem": int((lab == 2).sum())},
    }
    with open(os.path.join(OUT, "brain.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    log("done", {k: v["bytes"] for k, v in manifest["files"].items()})


if __name__ == "__main__":
    main()
