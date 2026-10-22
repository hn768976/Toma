"""Step 1 of the bake: load assets/brain.glb, clean it, normalise it and compute
per-vertex attributes (smooth normal, curvature, sulcal depth / AO, part label).

Normalised frame used everywhere in the project:
  +X = anterior (front), +Y = superior (top), +Z = the brain's left side.
  Centred on the bounding-box centre, longest side = 2.0 (so it fits in [-1, 1]).
"""

import numpy as np
import scipy.sparse as sp
import trimesh

LONGEST = 2.0


def load_raw(path):
    m = trimesh.load(path, force="mesh", process=False)
    info = {
        "file_vertices": int(len(m.vertices)),
        "file_triangles": int(len(m.faces)),
        "file_bounds": np.round(m.bounds, 4).tolist(),
    }
    return m, info


def clean(m):
    report = {}
    m = trimesh.Trimesh(m.vertices.copy(), m.faces.copy(), process=False)
    n0 = len(m.vertices)
    m.merge_vertices(merge_tex=True, merge_norm=True)  # UV seams split the vertices
    report["merged_duplicate_vertices"] = int(n0 - len(m.vertices))
    # Drop tiny disconnected pieces (stray triangles).
    lab = trimesh.graph.connected_component_labels(m.face_adjacency, node_count=len(m.faces))
    u, c = np.unique(lab, return_counts=True)
    keep = u[c == c.max()]
    report["removed_stray_faces"] = int((~np.isin(lab, keep)).sum())
    m.update_faces(np.isin(lab, keep))
    m.remove_unreferenced_vertices()
    # Degenerate and duplicate faces.
    nf = len(m.faces)
    m.update_faces(m.nondegenerate_faces())
    m.update_faces(m.unique_faces())
    m.remove_unreferenced_vertices()
    report["removed_degenerate_faces"] = int(nf - len(m.faces))
    # Consistent outward winding.
    trimesh.repair.fix_winding(m)
    flipped_before = m.volume < 0
    trimesh.repair.fix_inversion(m)
    report["inverted_mesh"] = bool(flipped_before)
    # Close the few small holes (16 boundary edges in the source).
    e = m.edges_sorted
    _, cnt = np.unique(e, axis=0, return_counts=True)
    report["boundary_edges_before"] = int((cnt == 1).sum())
    report["nonmanifold_edges"] = int((cnt > 2).sum())
    trimesh.repair.fill_holes(m)
    e = m.edges_sorted
    _, cnt = np.unique(e, axis=0, return_counts=True)
    report["boundary_edges_after"] = int((cnt == 1).sum())
    # Face normals that disagree with their neighbours after all that.
    report["vertices"] = int(len(m.vertices))
    report["triangles"] = int(len(m.faces))
    return m, report


def normalise(m):
    # Source orientation (found by inspection): +Y up, +Z anterior, X lateral.
    # Rotate +90 deg about Y so that +Z -> +X (front faces +X), keep +Y up.
    R = np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], dtype=np.float64)
    v = m.vertices @ R.T
    lo, hi = v.min(0), v.max(0)
    v = v - (lo + hi) / 2
    s = LONGEST / (hi - lo).max()
    v *= s
    out = trimesh.Trimesh(v, m.faces.copy(), process=False)
    return out, {"rotation": R.tolist(), "scale": float(s), "extents": np.round(out.extents, 4).tolist()}


def laplacian(m):
    n = len(m.vertices)
    e = m.edges_unique
    i = np.concatenate([e[:, 0], e[:, 1]])
    j = np.concatenate([e[:, 1], e[:, 0]])
    A = sp.csr_matrix((np.ones(len(i)), (i, j)), shape=(n, n))
    d = np.asarray(A.sum(1)).ravel()
    return sp.diags(1 / d) @ A  # row-normalised averaging operator


def smooth(W, x, it):
    for _ in range(it):
        x = 0.5 * x + 0.5 * (W @ x)
    return x


def attributes(m):
    W = laplacian(m)
    v = m.vertices
    n = m.vertex_normals.copy()
    # Mean-curvature proxy: positive on gyral crests, negative in sulci.
    curv = ((v - smooth(W, v, 3)) * n).sum(1)
    curv = smooth(W, curv[:, None], 2)[:, 0]
    curv = curv / (np.percentile(np.abs(curv), 98) + 1e-9)
    # Sulcal depth: distance below a heavily smoothed envelope surface.
    vs = smooth(W, v, 250)
    ms = trimesh.Trimesh(vs, m.faces, process=False)
    ns = ms.vertex_normals
    depth = ((vs - v) * ns).sum(1)
    # Remove the large-scale shrinkage bias of the smoothing.
    depth = depth - smooth(W, depth[:, None], 400)[:, 0]
    depth = smooth(W, depth[:, None], 2)[:, 0]
    d01 = np.clip((depth - np.percentile(depth, 5)) / (np.percentile(depth, 97) - np.percentile(depth, 5)), 0, 1)
    ao = 1.0 - 0.85 * d01 ** 0.8
    return n, curv.astype(np.float32), d01.astype(np.float32), ao.astype(np.float32)


# ----------------------------------------------------------------------------- repair
def _ring_relax(m, W, verts, iters, amount=0.6):
    """Move the given vertices toward their 1-ring average (local smoothing)."""
    v = m.vertices.copy()
    sel = np.zeros(len(v), bool)
    sel[verts] = True
    for _ in range(iters):
        avg = W @ v
        v[sel] += amount * (avg[sel] - v[sel])
    return v


def repair(m, labels_fn, report):
    """Fixes found by the model check (round 1):
    - close the remaining hole (one 13-edge loop) with a fan
    - relax folded triangles (face normal opposite its vertex normals) and
      needle pits (vertex sunk far below its 1-ring): the 'specks and pits'
    - calm the noisy occipital pole (local Taubin smoothing weighted by roughness)
    - brainstem: thicker, with a pons bulge on its anterior face
    - longitudinal fissure: medial walls drawn slightly together
    """
    # 1. hole fill (fan to centroid)
    e = m.edges_sorted
    u, c = np.unique(e, axis=0, return_counts=True)
    bnd = u[c == 1]
    if len(bnd):
        # order loop
        adj = {}
        for a, b in bnd:
            adj.setdefault(a, []).append(b)
            adj.setdefault(b, []).append(a)
        start = bnd[0][0]
        loop = [start]
        prev, cur = None, start
        while True:
            nx = [x for x in adj[cur] if x != prev]
            if not nx or nx[0] == start:
                break
            prev, cur = cur, nx[0]
            loop.append(cur)
        cidx = len(m.vertices)
        cen = m.vertices[loop].mean(0)
        V = np.vstack([m.vertices, cen])
        newf = [[loop[i], loop[(i + 1) % len(loop)], cidx] for i in range(len(loop))]
        F = np.vstack([m.faces, newf])
        m2 = trimesh.Trimesh(V, F, process=False)
        trimesh.repair.fix_winding(m2)
        m = m2
        report["hole_filled_edges"] = int(len(loop))
    W = laplacian(m)
    # 2. folded faces + pits, iterate
    fixed_faces = fixed_pits = 0
    for _ in range(4):
        n = m.vertex_normals
        fn = m.face_normals
        dot = (fn * n[m.faces].mean(1)).sum(1)
        bad_f = np.where(dot < 0.2)[0]
        L = (W @ m.vertices) - m.vertices
        r = (L * n).sum(1) / m.edges_unique_length.mean()
        pits = np.where(np.abs(r) > 0.5)[0]
        fixed_faces = max(fixed_faces, len(bad_f))
        fixed_pits = max(fixed_pits, len(pits))
        if len(bad_f) == 0 and len(pits) == 0:
            break
        verts = np.unique(np.concatenate([m.faces[bad_f].ravel(), pits]))
        # include 1-ring
        ring = np.unique(m.edges_unique[np.isin(m.edges_unique, verts).any(1)].ravel())
        m = trimesh.Trimesh(_ring_relax(m, W, ring, 3, 0.5), m.faces, process=False)
    report["relaxed_folded_faces"] = int(fixed_faces)
    report["relaxed_pits"] = int(fixed_pits)
    # 3. occipital roughness
    v = m.vertices
    n = m.vertex_normals
    L = (W @ v) - v
    r = np.abs((L * n).sum(1)) / m.edges_unique_length.mean()
    rough = r.copy()
    for _ in range(6):
        rough = 0.5 * rough + 0.5 * (W @ rough)
    occ = smooth01(-0.62, -0.85, v[:, 0])
    wgt = occ * np.clip((rough - 0.18) / 0.12, 0, 1)
    vs = v.copy()
    for _ in range(8):  # Taubin lambda/mu
        vs = vs + 0.5 * wgt[:, None] * ((W @ vs) - vs)
        vs = vs - 0.53 * wgt[:, None] * ((W @ vs) - vs)
    report["occipital_smoothed_vertices"] = int((wgt > 0.05).sum())
    v = vs
    # 4. brainstem: thicken about its axis + pons bulge
    lab = labels_fn(v)
    st = lab == 2
    if st.any():
        ys = v[st, 1]
        # axis: per-height centre of the stem cross-section
        bins = np.linspace(ys.min(), ys.max(), 12)
        cx = np.interp(v[:, 1], (bins[:-1] + bins[1:]) / 2, [v[st & (v[:, 1] >= a) & (v[:, 1] < b), 0].mean() if (st & (v[:, 1] >= a) & (v[:, 1] < b)).any() else np.nan for a, b in zip(bins[:-1], bins[1:])])
        cx = np.where(np.isnan(cx), np.nanmean(cx), cx)
        # blend weight: 1 on the stem, fading into neighbours over ~0.04
        w = st.astype(float)
        for _ in range(10):
            w = 0.5 * w + 0.5 * (W @ w)
            w[st] = 1.0
        w *= smooth01(-0.24, -0.34, v[:, 1])  # never move the cerebrum
        radial = np.stack([v[:, 0] - cx, np.zeros(len(v)), v[:, 2]], 1)
        thick = 0.22 * w
        pons_y = ys.max() - 0.11
        pons = 0.065 * np.exp(-((v[:, 1] - pons_y) / 0.065) ** 2) * w
        ant = np.clip((v[:, 0] - cx) / 0.06, 0, 1)  # anterior side only
        rlen = np.linalg.norm(radial, axis=1) + 1e-9
        v = v + radial * thick[:, None] + (radial / rlen[:, None]) * (pons * (0.35 + 0.65 * ant))[:, None]
        report["brainstem"] = f"thickened 22 percent, pons bulge 0.065 (anterior) at y={pons_y:.3f}"
    # 5. longitudinal fissure: pull medial walls of the cerebrum toward midline
    az = np.abs(v[:, 2])
    pull = 0.012 * np.exp(-((az - 0.0) / 0.07) ** 2) * smooth01(0.0, 0.15, v[:, 1] + 0.1) * (labels_fn(v) == 0)
    v[:, 2] -= np.sign(v[:, 2]) * np.minimum(pull, az * 0.6)
    report["fissure_pull_max"] = 0.012
    return trimesh.Trimesh(v, m.faces, process=False)


def smooth01(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
