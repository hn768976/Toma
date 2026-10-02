"""
Prepare a Meshy colon GLB for the cutaway renderer.

  python3 scripts/prepare_meshy_colon.py <meshy.glb> [--flip]

1. weld vertices, keep the largest connected piece, drop Meshy's texture
2. orient: the colon's plane faces +z (camera), transverse colon on top,
   caecum bottom-left (rotate 180 deg about y if the caecum lands on the right)
3. centre, scale to 10 units across, light Taubin smoothing, smooth normals
4. decimate if over 150k triangles
5. centreline: geodesic skeleton from one tube end to the other, then slice
   the mesh with planes at N stations, take each section's centroid, record
   radii, fit a centripetal Catmull-Rom and report how centred it stays
Writes public/models/colon.glb and public/models/centreline.json.
"""
import json
import os
import sys

import numpy as np
import scipy.sparse as sp
import scipy.sparse.csgraph as csg
import trimesh

from catmull import sample_by_arclength

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "public", "models", "colon.glb")
OUT_JSON = os.path.join(ROOT, "public", "models", "centreline.json")
WALL_FRAC = 0.12
N_STATIONS = int(os.environ.get("N_STATIONS", 24))
TARGET_WIDTH = 10.0


def load(path):
    s = trimesh.load(path)
    m = s.to_geometry() if hasattr(s, "to_geometry") else s.dump(concatenate=True)
    m = trimesh.Trimesh(m.vertices, m.faces, process=True)  # welds seams
    parts = m.split(only_watertight=False)
    parts = sorted(parts, key=lambda p: len(p.faces), reverse=True)
    print("pieces:", [len(p.faces) for p in parts])
    m = parts[0]
    m.remove_unreferenced_vertices()
    return m


def geodesic(m, src):
    e = m.edges_unique
    w = m.edges_unique_length
    n = len(m.vertices)
    G = sp.coo_matrix((w, (e[:, 0], e[:, 1])), shape=(n, n)).tocsr()
    return csg.dijkstra(G, directed=False, indices=src)


def skeleton(m, bins=240):
    d0 = geodesic(m, 0)
    a = int(np.argmax(d0))
    da = geodesic(m, a)
    b = int(np.argmax(da))
    L = da[b]
    edges = np.linspace(0, L, bins + 1)
    cs = []
    for i in range(bins):
        sel = (da >= edges[i]) & (da < edges[i + 1])
        if sel.sum() > 3:
            cs.append(m.vertices[sel].mean(axis=0))
    cs = np.array(cs)
    # light smoothing of the skeleton
    k = np.array([1, 2, 3, 2, 1], float)
    k /= k.sum()
    sm = cs.copy()
    for j in range(3):
        sm[2:-2, j] = np.convolve(cs[:, j], k, mode="valid")
    return sm, a, b


def end_radius(m, sk, at_start):
    """Mean radius of the tube a little way in from one end of the skeleton."""
    n = len(sk)
    i = int(0.025 * n) if at_start else int(0.975 * n)
    t = sk[min(n - 1, i + 2)] - sk[max(0, i - 2)]
    t /= np.linalg.norm(t)
    d = m.vertices - sk[i]
    along = d @ t
    sel = np.abs(along) < 0.03 * np.ptp(m.vertices[:, 0])
    radial = np.linalg.norm(d[sel] - np.outer(along[sel], t), axis=1)
    radial = radial[radial < np.percentile(radial, 50) * 2]
    return radial.mean()


def orient(m):
    # PCA: smallest-variance axis -> z (the colon's plane faces the camera)
    c = m.vertices.mean(axis=0)
    X = m.vertices - c
    w, V = np.linalg.eigh(np.cov(X.T))
    R = np.stack([V[:, 2], V[:, 1], V[:, 0]])
    if np.linalg.det(R) < 0:
        R[2] *= -1
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = -R @ c
    m.apply_transform(T)
    # in-plane: the rotation with the smallest bounding box squares the frame up
    xy = m.vertices[:, :2]
    best = None
    for deg in np.arange(0, 90, 0.5):
        a = np.radians(deg)
        rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
        q = xy @ rot.T
        area = np.ptp(q[:, 0]) * np.ptp(q[:, 1])
        if best is None or area < best[0]:
            best = (area, a)
    sk, a_end, b_end = skeleton(m)
    # of the four 90-degree variants, pick the one with both tube ends lowest
    choices = []
    for k in range(4):
        ang = best[1] + k * np.pi / 2
        Rz = trimesh.transformations.rotation_matrix(ang, [0, 0, 1])
        v = trimesh.transform_points(m.vertices, Rz)
        e = trimesh.transform_points(np.array([sk[0], sk[-1]]), Rz)
        cy = (v[:, 1].max() + v[:, 1].min()) / 2
        h = np.ptp(v[:, 1])
        choices.append(((e[:, 1].mean() - cy) / h, ang))
    ang = min(choices)[1]
    Rz = trimesh.transformations.rotation_matrix(ang, [0, 0, 1])
    m.apply_transform(Rz)
    sk = trimesh.transform_points(sk, Rz)
    # caecum = the wider end (the rectal end tapers); it must sit on the left
    r0, r1 = end_radius(m, sk, True), end_radius(m, sk, False)
    print(f"end radii: start {r0:.4f} end {r1:.4f}")
    if r1 > r0:
        sk = sk[::-1]
    cx = (m.bounds[0, 0] + m.bounds[1, 0]) / 2
    if sk[0][0] > cx or "--flip" in sys.argv:
        Ry = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0])
        m.apply_transform(Ry)
        sk = trimesh.transform_points(sk, Ry)
    return m, sk


def close_caecum(m, sk, trim_frac=0.03, rings=14):
    """Trim the (folded) caecum end and close it with a rounded dome."""
    seg = np.linalg.norm(np.diff(sk, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    L = cum[-1]
    st = trim_frac * L
    i = int(np.argmin(np.abs(cum - st)))
    o = sk[i]
    t = sk[i + 3] - sk[max(0, i - 3)]
    t /= np.linalg.norm(t)
    # only cut faces geodesically near the caecum end (a plane would also
    # cross other loops of the colon)
    v0 = int(np.argmin(np.linalg.norm(m.vertices - sk[0], axis=1)))
    gd = geodesic(m, v0)
    fd = gd[m.faces].max(axis=1)
    near = fd < st * 3.0
    local = m.submesh([np.where(near)[0]], append=True)
    rest = m.submesh([np.where(~near)[0]], append=True)
    kept = trimesh.intersections.slice_mesh_plane(local, plane_normal=t, plane_origin=o, cap=False)
    m2 = trimesh.util.concatenate([rest, kept])
    m2.merge_vertices(digits_vertex=6)
    parts = sorted(m2.split(only_watertight=False), key=lambda p: len(p.faces), reverse=True)
    m2 = parts[0]
    # boundary loop nearest to the cut point
    edges = m2.edges_sorted[trimesh.grouping.group_rows(m2.edges_sorted, require_count=1)]
    import networkx as nx

    g = nx.Graph()
    g.add_edges_from(edges)
    loops = [list(cc) for cc in nx.connected_components(g)]
    loops.sort(key=lambda lp: np.linalg.norm(m2.vertices[lp].mean(axis=0) - o))
    lp = loops[0]
    cyc = nx.cycle_basis(g.subgraph(lp))
    order = max(cyc, key=len)
    P = m2.vertices[order]
    c = P.mean(axis=0)
    rad = np.linalg.norm(P - c, axis=1).mean()
    out = -t  # the caecum is behind the trimmed station (toward s=0)
    verts = list(m2.vertices)
    faces = list(m2.faces)
    prev = order
    n = len(order)
    for k in range(1, rings + 1):
        a = (k / (rings + 1)) * (np.pi / 2)
        ringv = c + (P - c) * np.cos(a) + out * rad * 1.05 * np.sin(a)
        ids = list(range(len(verts), len(verts) + n))
        verts.extend(ringv)
        for j in range(n):
            a0, a1 = prev[j], prev[(j + 1) % n]
            b0, b1 = ids[j], ids[(j + 1) % n]
            faces.append([a0, a1, b1])
            faces.append([a0, b1, b0])
        prev = ids
    pole = len(verts)
    verts.append(c + out * rad * 1.05)
    for j in range(n):
        faces.append([prev[j], prev[(j + 1) % n], pole])
    m3 = trimesh.Trimesh(np.array(verts), np.array(faces), process=True)
    trimesh.repair.fix_winding(m3)
    trimesh.repair.fix_normals(m3)
    print("caecum closed: loop", n, "verts, radius", round(rad, 4), "watertight", m3.is_watertight)
    return m3


def taubin(m, iters=30, lam=0.5, mu=-0.53):
    trimesh.smoothing.filter_taubin(m, lamb=lam, nu=mu, iterations=iters)
    return m


def _section(m, o, n):
    sec = m.section(plane_origin=o, plane_normal=n)
    if sec is None:
        return None
    best = None
    for pts in sec.discrete:
        if len(pts) < 8 or np.linalg.norm(pts[0] - pts[-1]) > 1e-4:
            continue  # want closed loops only
        u = np.cross(n, [0, 0, 1.0])
        if np.linalg.norm(u) < 1e-6:
            u = np.cross(n, [1.0, 0, 0])
        u /= np.linalg.norm(u)
        v = np.cross(n, u)
        q = np.stack([(pts - o) @ u, (pts - o) @ v], axis=1)
        x, y = q[:, 0], q[:, 1]
        x1, y1 = np.roll(x, -1), np.roll(y, -1)
        cr = x * y1 - x1 * y
        A = cr.sum() / 2
        if abs(A) < 1e-9:
            continue
        c = o + ((x + x1) * cr).sum() / (6 * A) * u + ((y + y1) * cr).sum() / (6 * A) * v
        # the loop must surround the station point
        if np.linalg.norm(c - o) > 0.5 * np.linalg.norm(pts - c, axis=1).mean():
            continue
        if best is None or abs(A) < best[0]:
            best = (abs(A), c, pts)
    return best


def _tilt(n, a, b):
    u = np.cross(n, [0, 0, 1.0])
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(n, [1.0, 0, 0])
    u /= np.linalg.norm(u)
    v = np.cross(n, u)
    d = n + np.tan(a) * u + np.tan(b) * v
    return d / np.linalg.norm(d)


def best_section(m, o, t, spans=((12, 2), (4, 2))):
    """Smallest closed cross-section around o, searching plane tilts about t."""
    best = None
    for step_deg, span in spans:
        base = t if best is None else best[3]
        step = np.radians(step_deg)
        for a in range(-span, span + 1):
            for b in range(-span, span + 1):
                n = _tilt(base, a * step, b * step)
                r = _section(m, o, n)
                if r is not None and (best is None or r[0] < best[0]):
                    best = (r[0], r[1], r[2], n)
    return best


def march(m, sk):
    """Track the tube slice by slice from the middle toward both ends."""
    i0 = len(sk) // 2
    c0 = sk[i0]
    t0 = sk[i0 + 2] - sk[i0 - 2]
    t0 /= np.linalg.norm(t0)
    first = best_section(m, c0, t0)
    R = np.sqrt(first[0] / np.pi)
    step = 0.3 * R
    out = {}
    for sign in (1, -1):
        c, t, area = first[1], first[3] * sign, first[0]
        pts = []
        while True:
            o = c + t * step
            near = np.linalg.norm(m.triangles_center - o, axis=1) < 3 * R
            if near.sum() < 10:
                break
            local = m.submesh([np.where(near)[0]], append=True)
            r = best_section(local, o, t, spans=((8, 2), (3, 1)))
            ok = r is not None and 0.5 * area < r[0] < 2.0 * area
            if not ok:
                # sharp flexure: widen the tilt search before giving up
                r = best_section(local, o, t, spans=((15, 3), (5, 2), (2, 1)))
                ok = r is not None and 0.5 * area < r[0] < 2.0 * area
            if not ok:
                why = "none" if r is None else f"area ratio {r[0] / area:.2f}"
                print(f"  march {'+' if sign > 0 else '-'} stops after {len(pts)} slices at {np.round(o, 2)}: {why}")
                break
            n = r[3] if np.dot(r[3], t) > 0 else -r[3]
            nc = r[1]
            nt = (nc - c) / np.linalg.norm(nc - c)
            t = n * 0.6 + nt * 0.4
            t /= np.linalg.norm(t)
            c, area = nc, r[0]
            pts.append((c, np.sqrt(area / np.pi), t))
            if len(pts) > 4000:
                break
        out[sign] = pts
    back = out[-1][::-1]
    fwd = out[1]
    seq = [(p, r, -t) for p, r, t in back] + [(first[1], R, first[3])] + fwd
    C = np.array([p for p, _, _ in seq])
    Rr = np.array([r for _, r, _ in seq])
    Tt = np.array([t for _, _, t in seq])
    return C, Rr, Tt, R


def close_caecum(m, C, Rr, Tt, R, back_steps=2):
    """Trim the caecum end just before the clean sections stop, add a dome."""
    c = C[back_steps]
    t = Tt[back_steps]  # points along the colon, away from the caecum
    d = m.triangles_center - c
    beyond = (d @ t) < 0.15 * R
    near = beyond & (np.linalg.norm(d, axis=1) < 2.4 * R)
    local = m.submesh([np.where(near)[0]], append=True)
    rest = m.submesh([np.where(~near)[0]], append=True)
    kept = trimesh.intersections.slice_mesh_plane(local, plane_normal=t, plane_origin=c, cap=False)
    m2 = trimesh.util.concatenate([rest, kept]) if len(kept.faces) else rest
    m2.merge_vertices(digits_vertex=6)
    parts = sorted(m2.split(only_watertight=False), key=lambda p: len(p.faces), reverse=True)
    print("after trim pieces:", [len(p.faces) for p in parts[:4]])
    m2 = parts[0]
    edges = m2.edges_sorted[trimesh.grouping.group_rows(m2.edges_sorted, require_count=1)]
    import networkx as nx

    g = nx.Graph()
    g.add_edges_from(edges)
    loops = [list(cc) for cc in nx.connected_components(g)]
    loops.sort(key=lambda lp: np.linalg.norm(m2.vertices[lp].mean(axis=0) - c))
    cyc = nx.cycle_basis(g.subgraph(loops[0]))
    order = max(cyc, key=len)
    P = m2.vertices[order]
    cc = P.mean(axis=0)
    rad = np.linalg.norm(P - cc, axis=1).mean()
    outd = -t
    verts = list(m2.vertices)
    faces = list(m2.faces)
    prev = order
    n = len(order)
    rings = 14
    for k in range(1, rings + 1):
        a = (k / (rings + 1)) * (np.pi / 2)
        ringv = cc + (P - cc) * np.cos(a) + outd * rad * 1.1 * np.sin(a)
        ids = list(range(len(verts), len(verts) + n))
        verts.extend(ringv)
        for j in range(n):
            a0, a1 = prev[j], prev[(j + 1) % n]
            b0, b1 = ids[j], ids[(j + 1) % n]
            faces.append([a0, a1, b1])
            faces.append([a0, b1, b0])
        prev = ids
    pole = len(verts)
    verts.append(cc + outd * rad * 1.1)
    for j in range(n):
        faces.append([prev[j], prev[(j + 1) % n], pole])
    m3 = trimesh.Trimesh(np.array(verts), np.array(faces), process=True)
    trimesh.repair.fix_winding(m3)
    trimesh.repair.fix_normals(m3)
    print("caecum closed: loop", n, "verts, radius", round(rad, 4), "watertight", m3.is_watertight)
    # extend the centreline into the dome so u=0 sits inside the caecum
    return m3, cc, outd, rad


def stations_from_march(C, Rr, n):
    seg = np.linalg.norm(np.diff(C, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    s = np.linspace(0, cum[-1], n)
    idx = [int(np.argmin(np.abs(cum - x))) for x in s]
    return C[idx], Rr[idx]


def main():
    src = sys.argv[1]
    m = load(src)
    m, sk = orient(m)
    c = m.bounds.mean(axis=0)
    m.apply_translation(-c)
    sk = sk - c
    k = TARGET_WIDTH / (m.bounds[1, 0] - m.bounds[0, 0])
    m.apply_scale(k)
    sk = sk * k
    if len(m.faces) > 150000:
        import fast_simplification

        v, f = fast_simplification.simplify(m.vertices, m.faces, target_count=140000)
        m = trimesh.Trimesh(v, f, process=True)
    taubin(m)
    C, Rr, Tt, R = march(m, sk)
    # make sure the march runs caecum -> rectum (caecum is on the left)
    if C[0][0] > C[-1][0] and np.linalg.norm(C[0] - sk[0]) > np.linalg.norm(C[-1] - sk[0]):
        C, Rr, Tt = C[::-1], Rr[::-1], -Tt[::-1]
    print("march:", len(C), "slices, typical radius", round(R, 4))
    if "--keep-caecum" not in sys.argv:
        m, dome_c, dome_out, dome_r = close_caecum(m, C, Rr, Tt, R)
        # restart the centreline in the dome
        C = np.concatenate([[dome_c + dome_out * dome_r * 0.25], C[2:]])
        Rr = np.concatenate([[dome_r], Rr[2:]])
        taubin(m, iters=4)
    # depth: centreline mean at z=0
    dz = C[:, 2].mean()
    m.apply_translation([0, 0, -dz])
    C[:, 2] -= dz
    m.fix_normals()
    print("triangles", len(m.faces), "vertices", len(m.vertices), "bounds", np.round(m.bounds, 3).tolist())
    centres, outer_r = stations_from_march(C, Rr, N_STATIONS)

    fitted, fs, FL, _ = sample_by_arclength(centres, 2400)
    V = m.vertices
    idx = np.empty(len(V), int)
    dmin = np.empty(len(V))
    for a in range(0, len(V), 4000):
        d = np.linalg.norm(V[a : a + 4000, None, :] - fitted[None, :, :], axis=2)
        idx[a : a + 4000] = d.argmin(1)
        dmin[a : a + 4000] = d.min(1)
    fu = fs[idx] / FL
    st_u = np.array([fs[np.argmin(np.linalg.norm(fitted - cc, axis=1))] / FL for cc in centres])
    half = 0.5 / (len(centres) - 1)
    inner = []
    for kk, uu in enumerate(st_u):
        msk = (np.abs(fu - uu) <= half) & (fu > 0.003) & (fu < 0.997)
        rmin = np.percentile(dmin[msk], 2) if msk.sum() > 20 else outer_r[kk] * 0.8
        inner.append(rmin * (1 - WALL_FRAC))
    inner = np.array(inner)

    # centring check: along the fitted curve, nearest-surface distance vs the
    # local mean radius (1.0 = perfectly centred in a round tube; a curve that
    # drifts toward one wall drops well below 1)
    _, dsurf, _ = trimesh.proximity.closest_point(m, fitted[::8])
    ru = np.interp(fs[::8] / FL, st_u, outer_r)
    ratio = dsurf / ru
    keep = (fs[::8] / FL > 0.02) & (fs[::8] / FL < 0.95)  # dome / taper tip
    off = 1 - ratio[keep]
    print(
        f"centring: nearest-wall / radius  min {ratio[keep].min():.3f}  "
        f"5th pct {np.percentile(ratio[keep], 5):.3f}  mean {ratio[keep].mean():.3f}"
    )
    print("stations", len(centres), "length", round(FL, 3))
    print("outer r", np.round(outer_r, 3).tolist())
    print("inner r", np.round(inner, 3).tolist())

    data = {
        "source": os.path.basename(src),
        "units": "model units; colon is ~10 units across",
        "curveType": "centripetal",
        "points": np.round(centres, 5).tolist(),
        "u": np.round(st_u, 5).tolist(),
        "outerRadius": np.round(outer_r, 5).tolist(),
        "innerRadius": np.round(inner, 5).tolist(),
        "wallFraction": WALL_FRAC,
        "length": round(float(FL), 4),
        "centringMinRatio": round(float(1 - off.max()), 4),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(data, f, indent=1)
    mat = trimesh.visual.material.PBRMaterial(
        name="colon", baseColorFactor=[232, 131, 124, 255], roughnessFactor=0.45, metallicFactor=0.0
    )
    m.visual = trimesh.visual.TextureVisuals(material=mat)
    scene = trimesh.Scene()
    scene.add_geometry(m, node_name="colon", geom_name="colon")
    glb = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
    with open(OUT_GLB, "wb") as f:
        f.write(glb)
    print("wrote", OUT_GLB, len(glb) // 1024, "KB")


if __name__ == "__main__":
    main()
