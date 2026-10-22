"""Simplified inner structures (the GLB has none): lateral ventricles, corpus
callosum, thalamus and hippocampus, as smooth tubes/blobs built from signed
distance fields and meshed with marching cubes.

Positions are in the normalised frame (+X front, +Y up, +Z left, cerebrum
length 2.0, so 1 unit ~ 8.5 cm). Landmarks follow mid-sagittal proportions of
an adult brain: genu ~3.3 cm behind the frontal pole, splenium ~6 cm in front
of the occipital pole, callosal body ~4.5 cm below the vertex.
"""

import numpy as np
from skimage.measure import marching_cubes
import trimesh


def catmull(points, n=24):
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


def tube_sdf(q, ctrl, squash=(1, 1, 1)):
    """ctrl rows: x, y, z, r. Signed distance to a variable-radius tube.
    squash scales space per-axis before measuring (flattened cross-sections)."""
    C = catmull(ctrl, 16)
    pts, rad = C[:, :3], C[:, 3]
    s = np.asarray(squash, float)
    qs = q / s
    ps = pts / s
    d = np.full(len(q), 1e9)
    for i in range(len(ps) - 1):
        a, b = ps[i], ps[i + 1]
        ab = b - a
        t = np.clip(((qs - a) @ ab) / (ab @ ab + 1e-12), 0, 1)
        dist = np.linalg.norm(qs - (a + t[:, None] * ab), axis=1)
        r = rad[i] + (rad[i + 1] - rad[i]) * t
        d = np.minimum(d, dist - r)
    return d * s.min()


def smin(a, b, k=0.03):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def mirror(ctrl):
    c = np.array(ctrl, float)
    c[:, 2] *= -1
    return c


# --- structure definitions (left side, +Z; mirrored for the right) -------------
VENTRICLE_L = [  # frontal horn -> body -> atrium -> temporal horn (C shape)
    [0.50, 0.17, 0.07, 0.035],
    [0.40, 0.23, 0.08, 0.050],
    [0.20, 0.26, 0.08, 0.050],
    [0.00, 0.25, 0.09, 0.045],
    [-0.20, 0.21, 0.12, 0.045],
    [-0.32, 0.12, 0.19, 0.055],   # atrium
    [-0.30, -0.02, 0.26, 0.045],
    [-0.18, -0.12, 0.31, 0.035],
    [0.00, -0.17, 0.33, 0.028],
    [0.12, -0.19, 0.33, 0.020],   # temporal horn tip
]
OCCIPITAL_HORN_L = [
    [-0.32, 0.12, 0.19, 0.045],
    [-0.45, 0.10, 0.17, 0.030],
    [-0.56, 0.08, 0.14, 0.012],
]
CALLOSUM = [  # mid-sagittal arch, rostrum -> genu -> body -> splenium
    [0.42, 0.03, 0.0, 0.025],
    [0.55, 0.13, 0.0, 0.045],
    [0.48, 0.28, 0.0, 0.045],
    [0.28, 0.34, 0.0, 0.036],
    [0.02, 0.35, 0.0, 0.034],
    [-0.20, 0.31, 0.0, 0.040],
    [-0.33, 0.21, 0.0, 0.062],   # splenium (thick)
    [-0.28, 0.15, 0.0, 0.035],
]
THALAMUS_L = [
    [0.10, 0.10, 0.06, 0.055],
    [0.00, 0.12, 0.09, 0.090],
    [-0.12, 0.11, 0.11, 0.095],
    [-0.22, 0.08, 0.14, 0.060],   # pulvinar
]
HIPPOCAMPUS_L = [
    [0.13, -0.21, 0.30, 0.045],   # head
    [0.02, -0.18, 0.31, 0.040],
    [-0.12, -0.13, 0.29, 0.034],
    [-0.24, -0.05, 0.25, 0.028],
    [-0.30, 0.04, 0.19, 0.020],   # tail curving up toward the splenium
]

STRUCTURES = {
    # name: (sdf builder, label id)
    "ventricles": 3,
    "corpus_callosum": 4,
    "thalamus": 5,
    "hippocampus": 6,
}


def sdf_of(name, q):
    if name == "ventricles":
        sq = (1.0, 0.75, 1.0)  # slit-like, flattened vertically
        d = tube_sdf(q, VENTRICLE_L, sq)
        d = smin(d, tube_sdf(q, OCCIPITAL_HORN_L, sq))
        d = np.minimum(d, smin(tube_sdf(q, mirror(VENTRICLE_L), sq), tube_sdf(q, mirror(OCCIPITAL_HORN_L), sq)))
        return d
    if name == "corpus_callosum":
        # a sheet: thin vertically, wide laterally (fans into both hemispheres)
        return tube_sdf(q, CALLOSUM, (1.0, 1.0, 3.2))
    if name == "thalamus":
        return np.minimum(tube_sdf(q, THALAMUS_L, (1, 0.9, 1)), tube_sdf(q, mirror(THALAMUS_L), (1, 0.9, 1)))
    if name == "hippocampus":
        return np.minimum(tube_sdf(q, HIPPOCAMPUS_L), tube_sdf(q, mirror(HIPPOCAMPUS_L)))
    raise KeyError(name)


def build(step=0.008):
    lo = np.array([-0.70, -0.32, -0.48])
    hi = np.array([0.72, 0.46, 0.48])
    nx, ny, nz = np.ceil((hi - lo) / step).astype(int) + 1
    gx = lo[0] + np.arange(nx) * step
    gy = lo[1] + np.arange(ny) * step
    gz = lo[2] + np.arange(nz) * step
    Q = np.stack(np.meshgrid(gx, gy, gz, indexing="ij"), -1).reshape(-1, 3)
    meshes = {}
    for name, lab in STRUCTURES.items():
        d = np.empty(len(Q))
        for s in range(0, len(Q), 400_000):
            d[s:s + 400_000] = sdf_of(name, Q[s:s + 400_000])
        vol = d.reshape(nx, ny, nz)
        v, f, n, _ = marching_cubes(vol, 0.0, spacing=(step, step, step))
        v += lo
        m = trimesh.Trimesh(v, f[:, ::-1], process=True)
        if m.volume < 0:
            m.invert()
        trimesh.smoothing.filter_taubin(m, iterations=10)
        meshes[name] = (m, lab)
    return meshes
