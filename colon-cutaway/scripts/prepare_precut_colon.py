"""
Prepare a Meshy colon that is ALREADY cut open (front half removed, wall
thickness modelled) -- the model supplied for this project:

  python3 scripts/prepare_precut_colon.py <meshy.glb>

1. weld vertices, keep the main piece (drops tiny stray fragments), drop the texture
2. keep Meshy's orientation (open side already faces +z, caecum on the left);
   centre it and scale it so its largest dimension is 10 units
3. light Taubin smoothing + smooth normals (removes faceting)
4. centreline: track the tube slice by slice (smallest cross-section around the
   current point = perpendicular to the tube); each U-shaped (or, in the closed
   caecum, ring-shaped) section gets a least-squares circle fit -> centre and
   radii. Resample to N stations, fit a centripetal Catmull-Rom, check centring.
Writes public/models/colon.glb and public/models/centreline.json (precut: true).
"""
import json
import os
import sys

import numpy as np
import trimesh

from catmull import sample_by_arclength

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "public", "models", "colon.glb")
OUT_JSON = os.path.join(ROOT, "public", "models", "centreline.json")
N_STATIONS = int(os.environ.get("N_STATIONS", 24))
TARGET_SIZE = 10.0
TARGET_TRIS = int(os.environ.get('TARGET_TRIS', 120000))
RIM_CONV = float(os.environ.get('RIM_CONV', -0.012))
RIM_DILATE = int(os.environ.get('RIM_DILATE', 1))


def plane_basis(n):
    u = np.cross(n, [0, 0, 1.0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(n, [1.0, 0, 0])
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)


def circle_fit(q):
    """Kasa least-squares circle through 2D points."""
    A = np.c_[2 * q, np.ones(len(q))]
    b = (q**2).sum(1)
    (cx, cy, k), *_ = np.linalg.lstsq(A, b, rcond=None)
    r = np.sqrt(max(k + cx * cx + cy * cy, 1e-12))
    return np.array([cx, cy]), r


def section(m, o, n, max_off):
    sec = m.section(plane_origin=o, plane_normal=n)
    if sec is None:
        return None
    u, v = plane_basis(n)
    best = None
    for pts in sec.discrete:
        if len(pts) < 12:
            continue
        q = np.stack([(pts - o) @ u, (pts - o) @ v], axis=1)
        c2, r = circle_fit(q)
        if np.linalg.norm(c2) > max_off:
            continue
        d = np.linalg.norm(q - c2, axis=1)
        # spread of the radial distances: a clean perpendicular cut of a tube
        # gives a tight band (wall thickness); oblique cuts smear it out
        score = np.percentile(d, 95) * (1 + 3 * (np.percentile(d, 95) - np.percentile(d, 5)) / max(r, 1e-6))
        cand = (score, o + c2[0] * u + c2[1] * v, np.percentile(d, 92), np.percentile(d, 8), n)
        if best is None or np.percentile(d, 92) > best[2]:  # outermost loop (caecum: outer ring)
            best = cand
    return best


def best_section(m, o, t, max_off, spans=((10, 2), (4, 2))):
    best = None
    for step_deg, span in spans:
        base = t if best is None else best[4]
        step = np.radians(step_deg)
        for a in range(-span, span + 1):
            for b in range(-span, span + 1):
                n = _tilt(base, a * step, b * step)
                r = section(m, o, n, max_off)
                if r is not None and (best is None or r[0] < best[0]):
                    best = r
    return best


def silhouette_path(m, px=0.012):
    """Medial axis of the colon's front-view silhouette, caecum -> rectum."""
    from PIL import Image, ImageDraw
    from scipy import ndimage
    from skimage.morphology import skeletonize
    import networkx as nx

    lo = m.bounds[0, :2] - 0.2
    hi = m.bounds[1, :2] + 0.2
    W, H = (np.ceil((hi - lo) / px)).astype(int)
    img = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(img)
    P = (m.vertices[:, :2] - lo) / px
    for f in m.faces:
        dr.polygon([tuple(P[i]) for i in f], fill=255)
    mask = np.array(img) > 0
    mask = ndimage.binary_closing(mask, iterations=2)
    dist = ndimage.distance_transform_edt(mask) * px
    sk = skeletonize(mask)
    ys, xs = np.nonzero(sk)
    idx = {(y, x): i for i, (y, x) in enumerate(zip(ys, xs))}
    g = nx.Graph()
    for (y, x), i in idx.items():
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                j = idx.get((y + dy, x + dx))
                if j is not None and j != i:
                    g.add_edge(i, j, weight=np.hypot(dy, dx))
    g = g.subgraph(max(nx.connected_components(g), key=len))
    a = next(iter(g.nodes))
    d1 = nx.single_source_dijkstra_path_length(g, a)
    e1 = max(d1, key=d1.get)
    d2, paths = nx.single_source_dijkstra(g, e1)
    e2 = max(d2, key=d2.get)
    path = paths[e2]
    xy = np.stack([xs[path] * px + lo[0], ys[path] * px + lo[1]], axis=1)
    r = dist[ys[path], xs[path]]
    # caecum (bulb) is on the left: start from the end with smaller x
    if xy[0, 0] > xy[-1, 0]:
        xy, r = xy[::-1], r[::-1]
    # trim skeleton spurs into the rounded ends (they run to the silhouette tip)
    return xy, r


def build_centre(m, xy, rproj):
    """Depth of the centre: back wall + projected radius (round tube)."""
    V = m.vertices
    from scipy.spatial import cKDTree

    tree = cKDTree(V[:, :2])
    z = np.empty(len(xy))
    for i, (p, r) in enumerate(zip(xy, rproj)):
        ids = tree.query_ball_point(p, max(0.25 * r, 0.05))
        z[i] = V[ids, 2].min() + r if ids else np.nan
    z = np.where(np.isnan(z), np.nanmedian(z), z)
    C = np.c_[xy, z]
    # smooth along the path
    k = np.ones(15) / 15
    Cs = C.copy()
    for j in range(3):
        Cs[7:-7, j] = np.convolve(C[:, j], k, "valid")
    rs = rproj.copy()
    rs[7:-7] = np.convolve(rproj, k, "valid")
    return Cs, rs


def refine_by_slices(m, C, rproj, n):
    """Slice the mesh at n stations, circle-fit each section."""
    seg = np.linalg.norm(np.diff(C, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    stations = np.linspace(0.0, 0.985 * cum[-1], n)
    T = np.gradient(C, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    out_c, out_ro, out_ri, ok = [], [], [], []
    for st in stations:
        i = int(np.argmin(np.abs(cum - st)))
        o, t, r0 = C[i], T[i], rproj[i]
        near = np.linalg.norm(m.triangles_center - o, axis=1) < 2.5 * r0
        local = m.submesh([np.where(near)[0]], append=True)
        sec = local.section(plane_origin=o, plane_normal=t)
        best = None
        if sec is not None:
            u, v = plane_basis(t)
            pts = np.concatenate(sec.discrete) if len(sec.discrete) else np.zeros((0, 3))
            q = np.stack([(pts - o) @ u, (pts - o) @ v], axis=1)
            q = q[np.linalg.norm(q, axis=1) < 1.6 * r0]
            if len(q) > 20:
                d0 = np.linalg.norm(q, axis=1)
                outer = q[d0 >= np.median(d0)]
                c2, ro = circle_fit(outer)
                d = np.linalg.norm(q - c2, axis=1)
                if np.linalg.norm(c2) < 0.5 * r0 and 0.6 * r0 < ro < 1.5 * r0:
                    ri = np.percentile(d, 8)
                    best = (o + c2[0] * u + c2[1] * v, np.percentile(d, 92), ri)
        if best is None:
            best = (o, r0, r0 * 0.8)
            ok.append(False)
        else:
            ok.append(True)
        out_c.append(best[0])
        out_ro.append(best[1])
        out_ri.append(best[2])
    print("clean circle fits at", sum(ok), "of", n, "stations")
    return np.array(out_c), np.array(out_ro), np.array(out_ri)


def classify(m, fitted, fs, FL, st_u, outer_r, wall_in):
    """Per-vertex surface class for a pre-cut wall, baked as vertex colours:
    R = class (0 lining, 0.5 cut rim, 1 outer wall), G = distance across the
    cut rim from the lining edge (0..1), used for the cream line."""
    from scipy.spatial import cKDTree
    import scipy.sparse as sp
    import scipy.sparse.csgraph as csg

    V, N = m.vertices, m.vertex_normals
    tree = cKDTree(V)
    # local convexity: mean height of same-sheet neighbours above the tangent plane
    conv = np.zeros(len(V))
    nbrs = tree.query_ball_point(V, 0.16)
    for i, ids in enumerate(nbrs):
        ids = np.asarray(ids)
        same = (N[ids] @ N[i]) > 0.3
        d = V[ids[same]] - V[i]
        conv[i] = (d @ N[i]).mean() if len(d) else 0.0
    # radial test against the centreline
    ct = cKDTree(fitted)
    _, k = ct.query(V)
    T = np.gradient(fitted, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    d = V - fitted[k]
    d -= T[k] * (d * T[k]).sum(1)[:, None]
    dl = np.linalg.norm(d, axis=1) + 1e-9
    s_c = (N * d).sum(1) / dl

    e = m.edges_unique
    A = sp.coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(V), len(V)))
    A = (A + A.T).tocsr()
    deg = np.asarray(A.sum(1)).ravel() + 1
    # 1) the cut rim: where the wall turns round tightly (strongly convex)
    rim = conv < RIM_CONV
    for _ in range(RIM_DILATE):
        rim = rim | ((A @ rim.astype(float)) > 0)
    # 2) everything else falls into connected regions separated by the rim;
    #    each region is lining or outer wall by majority vote of local concavity
    keep = np.where(~rim)[0]
    sub = A[keep][:, keep]
    ncomp, lab = csg.connected_components(sub, directed=False)
    sizes = sorted(((np.sum(lab == c), c) for c in range(ncomp)), reverse=True)
    W = sp.coo_matrix((m.edges_unique_length, (e[:, 0], e[:, 1])), shape=(len(V), len(V))).tocsr()
    W = W + W.T
    # the two big regions are the lining and the outer wall
    big = [keep[lab == c] for _, c in sizes[:2]]
    score = [0.7 * np.mean(conv[ids] > 0) + 0.3 * np.mean(s_c[ids] < 0) for ids in big]
    lining_ids, outer_ids = (big[0], big[1]) if score[0] > score[1] else (big[1], big[0])
    print(f"lining region {len(lining_ids)} verts (score {max(score):.2f}), outer {len(outer_ids)} (score {min(score):.2f}); {ncomp - 2} small regions folded in")
    # distance (along the surface) to each region; small islands simply end up
    # deep inside whichever region surrounds them
    dL = csg.dijkstra(W, directed=False, indices=lining_ids, min_only=True)
    dO = csg.dijkstra(W, directed=False, indices=outer_ids, min_only=True)
    dL = np.where(np.isfinite(dL), dL, 10.0)
    dO = np.where(np.isfinite(dO), dO, 10.0)
    sf = (dL - dO) / (dL + dO + 1e-6)  # -1 lining ... 0 middle of the cut rim ... +1 outer
    # smooth the field so its iso-lines (the lining edge, the cream line) are clean curves
    for _ in range(10):
        sf = (A @ sf + sf) / deg
    rim_w = float(np.median((dL + dO)[(dL > 0) & (dO > 0)]))
    w = np.clip(dL / max(rim_w, 1e-3), 0, 1)
    print(f"classes: lining {np.mean(sf < -0.6):.2f} rim {np.mean(np.abs(sf) <= 0.6):.2f} outer {np.mean(sf > 0.6):.2f}; rim width ~{rim_w:.3f}")
    return np.clip((sf + 1) / 2, 0, 1), w



def remesh(m, target_tris):
    """Isotropic remesh (pymeshlab): removes Meshy's thin folded triangle
    strips and gives an even triangulation for smooth shading/classification."""
    import pymeshlab

    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(vertex_matrix=m.vertices, face_matrix=m.faces))
    ms.meshing_remove_duplicate_vertices()
    ms.meshing_remove_duplicate_faces()
    ms.meshing_remove_null_faces()
    ms.meshing_repair_non_manifold_edges()
    ms.meshing_repair_non_manifold_vertices()
    # equilateral area sqrt(3)/4 L^2 -> L for the target triangle count
    L = np.sqrt(m.area / target_tris / (np.sqrt(3) / 4))
    ms.meshing_isotropic_explicit_remeshing(targetlen=pymeshlab.PureValue(L), iterations=8, adaptive=False)
    ms.apply_coord_taubin_smoothing(stepsmoothnum=6)
    out = ms.current_mesh()
    r = trimesh.Trimesh(out.vertex_matrix(), out.face_matrix(), process=True)
    r = sorted(r.split(only_watertight=False), key=lambda p: len(p.faces), reverse=True)[0]
    print(f"remeshed: edge {L:.4f}, {len(r.faces)} triangles, watertight {r.is_watertight}")
    return r


def main():
    s = trimesh.load(sys.argv[1])
    m = s.to_geometry() if hasattr(s, "to_geometry") else s.dump(concatenate=True)
    m = trimesh.Trimesh(m.vertices, m.faces, process=True)
    parts = sorted(m.split(only_watertight=False), key=lambda p: len(p.faces), reverse=True)
    print("pieces:", [len(p.faces) for p in parts[:6]], "...")
    m = parts[0]
    m.apply_translation(-m.bounds.mean(axis=0))
    m.apply_scale(TARGET_SIZE / np.ptp(m.vertices, axis=0).max())
    if "--no-remesh" not in sys.argv:
        m = remesh(m, TARGET_TRIS)
    m.fix_normals()
    print("triangles", len(m.faces), "bounds", np.round(m.bounds, 3).tolist())

    xy, rproj = silhouette_path(m)
    C, rs = build_centre(m, xy, rproj)
    print("silhouette path:", len(C), "points, length", round(float(np.linalg.norm(np.diff(C, axis=0), axis=1).sum()), 3))
    centres, outer_r, wall_in = refine_by_slices(m, C, rs, N_STATIONS)
    # light smoothing of the radii (sections are noisy at the U tips)
    k = np.array([0.25, 0.5, 0.25])
    outer_r = np.r_[outer_r[0], np.convolve(outer_r, k, "valid"), outer_r[-1]]
    wall_in = np.r_[wall_in[0], np.convolve(wall_in, k, "valid"), wall_in[-1]]

    fitted, fs, FL, _ = sample_by_arclength(centres, 2400)
    st_u = np.array([fs[np.argmin(np.linalg.norm(fitted - c, axis=1))] / FL for c in centres])
    # safe lumen radius: the inner wall surface, a little conservative
    inner = wall_in * 0.95

    # centring check: closest wall vs the measured inner radius along the curve
    _, dsurf, _ = trimesh.proximity.closest_point(m, fitted[::8])
    ri = np.interp(fs[::8] / FL, st_u, wall_in)
    ratio = dsurf / ri
    keep = (fs[::8] / FL > 0.03) & (fs[::8] / FL < 0.97)
    print(
        f"centring: nearest-wall / inner radius  min {ratio[keep].min():.3f}  "
        f"5th pct {np.percentile(ratio[keep], 5):.3f}  mean {ratio[keep].mean():.3f}"
    )
    print("outer r", np.round(outer_r, 3).tolist())
    print("wall inner r", np.round(wall_in, 3).tolist())
    wall_frac = float(np.median((outer_r - wall_in) / outer_r))
    print("median wall thickness / outer radius:", round(wall_frac, 3))

    data = {
        "source": os.path.basename(sys.argv[1]),
        "precut": True,
        "units": "model units; largest dimension 10",
        "curveType": "centripetal",
        "points": np.round(centres, 5).tolist(),
        "u": np.round(st_u, 5).tolist(),
        "outerRadius": np.round(outer_r, 5).tolist(),
        "wallInnerRadius": np.round(wall_in, 5).tolist(),
        "innerRadius": np.round(inner, 5).tolist(),
        "wallFraction": round(wall_frac, 4),
        "length": round(float(FL), 4),
        "centringMinRatio": round(float(ratio[keep].min()), 4),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(data, f, indent=1)
    cls, w = classify(m, fitted, fs, FL, st_u, outer_r, wall_in)
    cols = np.zeros((len(m.vertices), 4), np.uint8)
    cols[:, 0] = np.round(cls * 255)
    cols[:, 1] = np.round(w * 255)
    cols[:, 3] = 255
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=cols)
    sc = trimesh.Scene()
    sc.add_geometry(m, node_name="colon", geom_name="colon")
    glb = trimesh.exchange.gltf.export_glb(sc, include_normals=True)
    open(OUT_GLB, "wb").write(glb)
    print("wrote", OUT_GLB, len(glb) // 1024, "KB")


if __name__ == "__main__":
    main()
