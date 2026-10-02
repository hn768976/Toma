"""
Procedural fallback colon (used because Meshy outputs could not be downloaded
from this build environment -- see public/models/SOURCE.md).

Builds the outer shell of the colon as a single continuous tube with haustra
and a closed caecum, exports it as public/models/colon.glb, then extracts the
centreline the same way we would for a Meshy mesh: slice the mesh at evenly
spaced stations, take the centroid of each cross-section, record the radii,
and check a centripetal Catmull-Rom through the centroids stays centred.

Run:  python3 scripts/build_colon.py
"""
import json
import os

import numpy as np
import trimesh

from catmull import cr_point, sample_by_arclength

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB = os.path.join(ROOT, "public", "models", "colon.glb")
OUT_JSON = os.path.join(ROOT, "public", "models", "centreline.json")

# Model space: x right, y up, z toward the camera (the cut side).
# Caecum bottom-left, ascending up the left, sagging transverse across the top,
# descending down the right, sigmoid looping toward the bottom centre.
DESIGN = np.array(
    [
        [-3.70, -2.75, -0.10],  # caecum
        [-3.80, -1.70, -0.05],
        [-3.85, -0.30, 0.00],  # ascending
        [-3.70, 1.20, 0.10],
        [-3.25, 2.45, 0.25],  # hepatic flexure
        [-2.25, 2.95, 0.40],
        [-1.00, 2.40, 0.55],  # transverse, sagging
        [0.40, 2.15, 0.60],
        [1.85, 2.55, 0.45],
        [3.05, 3.25, 0.20],  # splenic flexure (higher)
        [3.85, 2.70, 0.00],
        [4.00, 1.10, -0.10],  # descending
        [3.90, -0.70, -0.10],
        [3.55, -2.05, 0.05],
        [2.65, -2.85, 0.35],  # sigmoid
        [1.45, -2.60, 0.70],
        [0.45, -1.95, 0.85],
        [-0.55, -2.25, 0.70],
        [-0.70, -3.25, 0.40],
        [-0.15, -4.05, 0.10],  # rectal end (open)
    ]
)

R_BASE = 0.58  # outer radius of the tube
R_CAECUM = 0.80
N_AROUND = 64
N_ALONG = 820
N_DOME = 18
HAUSTRA_SPACING = 0.92
WALL_FRAC = 0.09
N_STATIONS = int(os.environ.get('N_STATIONS', 24))  # wall thickness as a fraction of the local tube radius


def frames(P):
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    # parallel transport
    N = np.zeros_like(P)
    ref = np.array([0.0, 0.0, 1.0])
    n0 = ref - T[0] * np.dot(ref, T[0])
    N[0] = n0 / np.linalg.norm(n0)
    for i in range(1, len(P)):
        v = np.cross(T[i - 1], T[i])
        s = np.linalg.norm(v)
        n = N[i - 1]
        if s > 1e-9:
            axis = v / s
            ang = np.arctan2(s, np.dot(T[i - 1], T[i]))
            n = (
                n * np.cos(ang)
                + np.cross(axis, n) * np.sin(ang)
                + axis * np.dot(axis, n) * (1 - np.cos(ang))
            )
        n = n - T[i] * np.dot(n, T[i])
        N[i] = n / np.linalg.norm(n)
    B = np.cross(T, N)
    return T, N, B


def radius_profile(s, L):
    r = np.full_like(s, R_BASE)
    # wide caecum easing into the ascending colon
    r += (R_CAECUM - R_BASE) * np.exp(-((s / 1.5) ** 2))
    # slight taper toward the rectal end
    r -= 0.05 * np.clip((s - (L - 4.0)) / 4.0, 0, 1)
    # haustra: shallow creases between rounded pouches
    phase = s / HAUSTRA_SPACING
    d = np.abs(phase - np.round(phase))
    crease = np.exp(-((d / 0.13) ** 2))
    amp = np.ones_like(s)
    amp *= np.clip(s / 1.2, 0, 1)  # none on the caecum dome
    amp *= 1.0 - 0.6 * np.clip((s - (L - 7.0)) / 3.0, 0, 1)  # gentler sigmoid
    amp *= np.clip((L - s) / 0.8, 0, 1)
    r *= 1.0 + amp * (0.035 - 0.085 * crease)
    return r


def build_mesh():
    P, s, L, _ = sample_by_arclength(DESIGN, N_ALONG)
    T, N, B = frames(P)
    r = radius_profile(s, L)
    ang = np.linspace(0, 2 * np.pi, N_AROUND, endpoint=False)
    ca, sa = np.cos(ang), np.sin(ang)

    rings = []
    # caecum dome (closed), rings from the pole up to s=0
    for j in range(N_DOME, 0, -1):
        a = (j / N_DOME) * (np.pi / 2)
        back = r[0] * np.sin(a)
        rr = r[0] * np.cos(a)
        c = P[0] - T[0] * back
        rings.append(c + rr * (ca[:, None] * N[0] + sa[:, None] * B[0]))
    for i in range(N_ALONG):
        rings.append(P[i] + r[i] * (ca[:, None] * N[i] + sa[:, None] * B[i]))
    rings = np.array(rings)  # (nr, N_AROUND, 3)
    nr = rings.shape[0]

    pole = P[0] - T[0] * r[0]
    verts = np.concatenate([[pole], rings.reshape(-1, 3)])
    faces = []
    # pole fan (ring 0 is the tiny ring next to the pole)
    for k in range(N_AROUND):
        a = 1 + k
        b = 1 + (k + 1) % N_AROUND
        faces.append([0, b, a])
    for i in range(nr - 1):
        for k in range(N_AROUND):
            a = 1 + i * N_AROUND + k
            b = 1 + i * N_AROUND + (k + 1) % N_AROUND
            c = a + N_AROUND
            d = b + N_AROUND
            faces.append([a, b, d])
            faces.append([a, d, c])
    faces = np.array(faces)
    mesh = trimesh.Trimesh(verts, faces, process=False)
    # make normals point outward
    test = mesh.vertices[1 + (N_DOME + 300) * N_AROUND] - P[300]
    mesh.fix_normals()
    if np.dot(mesh.vertex_normals[1 + (N_DOME + 300) * N_AROUND], test) < 0:
        mesh.invert()
    return mesh, P, s, L


def extract_centreline(mesh, P_design, s_design, L, n_stations=N_STATIONS):
    """Slice the mesh at n stations along its length, take section centroids."""
    stations = np.linspace(0.0, L - 0.03, n_stations)
    T_design = np.gradient(P_design, axis=0)
    T_design /= np.linalg.norm(T_design, axis=1)[:, None]
    centres, outer_r, min_r = [], [], []
    for st in stations:
        i = int(np.argmin(np.abs(s_design - st)))
        o, n = P_design[i], T_design[i]
        sec = mesh.section(plane_origin=o, plane_normal=n)
        best = None
        for ent_pts in sec.discrete:
            d = np.linalg.norm(ent_pts.mean(axis=0) - o)
            if best is None or d < best[0]:
                best = (d, ent_pts)
        pts = best[1]
        # polygon centroid (area-weighted) in the slice plane
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
        cx = ((x + x1) * cr).sum() / (6 * A)
        cy = ((y + y1) * cr).sum() / (6 * A)
        c = o + cx * u + cy * v
        dist = np.linalg.norm(pts - c, axis=1)
        centres.append(c)
        outer_r.append(dist.mean())
        min_r.append(dist.min())
    return np.array(centres), np.array(outer_r), np.array(min_r)


def main():
    mesh, P, s, L = build_mesh()
    # centre the model on its bounding box (z: centre the centreline instead,
    # so the cut sits around z=0)
    c = mesh.bounds.mean(axis=0)
    c[2] = P[:, 2].mean()
    mesh.apply_translation(-c)
    P = P - c
    # scale to 10 units across (x)
    k = 10.0 / (mesh.bounds[1, 0] - mesh.bounds[0, 0])
    mesh.apply_scale(k)
    P, s, L = P * k, s * k, L * k
    print("scale factor", round(k, 4), "outer radius", round(R_BASE * k, 4))
    print("triangles", len(mesh.faces), "vertices", len(mesh.vertices))
    print("watertight-ish (one open end expected):", mesh.is_watertight)
    print("bodies:", len(mesh.split(only_watertight=False)))

    centres, outer_r, min_r = extract_centreline(mesh, P, s, L)

    # conservative inner radius around each station: min radial distance of
    # the mesh to the fitted curve within +/- half a station spacing, minus wall
    fitted, fs, FL, _ = sample_by_arclength(centres, 2400)
    V = mesh.vertices
    # nearest fitted sample per vertex (chunked)
    idx = np.empty(len(V), int)
    dmin = np.empty(len(V))
    for a in range(0, len(V), 4000):
        d = np.linalg.norm(V[a : a + 4000, None, :] - fitted[None, :, :], axis=2)
        idx[a : a + 4000] = d.argmin(1)
        dmin[a : a + 4000] = d.min(1)
    fu = fs[idx] / FL
    # station u along the fitted curve
    st_u = []
    for c in centres:
        st_u.append(fs[np.argmin(np.linalg.norm(fitted - c, axis=1))] / FL)
    st_u = np.array(st_u)
    half = 0.5 / (len(centres) - 1)
    inner = []
    for k, uu in enumerate(st_u):
        m = np.abs(fu - uu) <= half
        if k == 0:
            m &= fu > 0.002  # skip the dome itself
        rmin = dmin[m].min() if m.any() else min_r[k]
        inner.append(rmin * (1 - WALL_FRAC) if k > 0 else outer_r[k] * (1 - WALL_FRAC))
    inner = np.array(inner)

    # how well does the fitted curve stay centred? distance to design curve
    dev = []
    for p in fitted[::4]:
        dev.append(np.min(np.linalg.norm(P - p, axis=1)))
    dev = np.array(dev)
    print(
        f"fitted centreline deviation from true axis: max {dev.max():.4f}  "
        f"mean {dev.mean():.4f}  (tube radius {np.median(outer_r):.3f}, {100*dev.max()/np.median(outer_r):.1f}% of R)"
    )
    print("length", round(L, 3), "fitted length", round(FL, 3))

    data = {
        "source": "procedural-fallback",
        "units": "model units; colon is ~10 units across",
        "curveType": "centripetal",
        "points": np.round(centres, 5).tolist(),
        "u": np.round(st_u, 5).tolist(),
        "outerRadius": np.round(outer_r, 5).tolist(),
        "innerRadius": np.round(inner, 5).tolist(),
        "wallFraction": WALL_FRAC,
        "length": round(float(FL), 4),
        "centrelineDeviationMax": round(float(dev.max()), 5),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(data, f, indent=1)

    bb = mesh.bounds
    print("bounds", np.round(bb, 3), "size", np.round(bb[1] - bb[0], 3))
    mesh.visual = trimesh.visual.ColorVisuals(mesh, vertex_colors=None)
    mat = trimesh.visual.material.PBRMaterial(
        name="colon", baseColorFactor=[232, 131, 124, 255], roughnessFactor=0.45, metallicFactor=0.0
    )
    mesh.visual = trimesh.visual.TextureVisuals(material=mat)
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name="colon", geom_name="colon")
    glb = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
    with open(OUT_GLB, "wb") as f:
        f.write(glb)
    print("wrote", OUT_GLB, len(glb) // 1024, "KB")


if __name__ == "__main__":
    main()
