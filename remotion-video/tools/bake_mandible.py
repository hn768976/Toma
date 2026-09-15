#!/usr/bin/env python3
"""Turn a raw mandibular scan into the render-ready buffer the video uses.

The source GLB (a Meshy reconstruction of a lower dental cast) is a single
fused shell: one mesh, no materials, no textures, no per-tooth grouping.
Everything the shader needs to tell enamel from gingiva has to be derived
here, once, offline -- doing it per frame would be hopeless.

Pipeline
--------
1.  Read positions, normals and indices out of the GLB, and apply the node
    rotation so +Y is up and the arch sits in a predictable pose.
2.  Weld coincident vertices, then measure per-edge concavity. The gingival
    sulcus -- the crease where a crown leaves the gum -- is the strongest
    concave feature on the model.
3.  Recover the gum line as a curve rather than a plane. Vertices are binned
    by arch angle; in each bin the crease height and the tooth-band radius
    are read off, then smoothed around the arch. That yields the scalloped
    margin a flat height threshold cannot represent.
4.  Loop-subdivide once. The scan is low-poly enough that the macro shots
    show facets, and Loop both quadruples the triangles and smooths the
    limit surface.
5.  Recompute every attribute on the subdivided mesh from the curves in
    step 3, so the segmentation follows the new geometry exactly instead of
    being interpolated.
6.  Bake ambient occlusion by voxel ray-marching. This is what makes stain
    and plaque settle into fissures and interproximal spaces at render time.
7.  Split the tooth band into individual tooth islands, by finding the
    interproximal dips in the crown-height profile.
8.  Write a flat little-endian buffer; see mandible.ts for the layout.

Usage:  python3 tools/bake_mandible.py <source.glb> public/models/mandible.bin
"""

from __future__ import annotations

import json
import struct
import sys

import numpy as np

# --- tuning -----------------------------------------------------------------

ARCH_BINS = 240          # angular resolution of the gum-line curve
SUBDIVISIONS = 1         # Loop subdivision levels

# Half-width of the radial band a tooth can occupy, as a fraction of the
# arch width. Wide enough to cover buccal and lingual surfaces, tight
# enough to exclude the lingual floor of the cast.
TOOTH_BAND_HALF = 0.092
TOOTH_BAND_FEATHER = 0.018

# Occlusion is gathered over a short radius: the point is to darken
# fissures and interproximal contacts, not to shade the whole arch.
AO_RAYS = 28
AO_STEPS = 16
AO_DISTANCE = 0.053
AO_VOXEL = 0.0037

COMPONENT_TYPES = {
    5120: ("i1", 1), 5121: ("u1", 1), 5122: ("i2", 2),
    5123: ("u2", 2), 5125: ("u4", 4), 5126: ("f4", 4),
}
TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


# --- glb --------------------------------------------------------------------

def read_glb(path: str):
    with open(path, "rb") as fh:
        magic, _version, _length = struct.unpack("<III", fh.read(12))
        if magic != 0x46546C67:
            raise SystemExit(f"{path} is not a GLB file")
        json_len, _ = struct.unpack("<II", fh.read(8))
        gltf = json.loads(fh.read(json_len))
        bin_len, _ = struct.unpack("<II", fh.read(8))
        blob = fh.read(bin_len)

    def accessor(i):
        acc = gltf["accessors"][i]
        view = gltf["bufferViews"][acc["bufferView"]]
        dtype, size = COMPONENT_TYPES[acc["componentType"]]
        n = TYPE_COUNTS[acc["type"]]
        offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        stride = view.get("byteStride") or size * n
        if stride == size * n:
            flat = np.frombuffer(blob, dtype=dtype, count=acc["count"] * n, offset=offset)
        else:
            raw = np.frombuffer(blob, dtype="u1", count=acc["count"] * stride,
                                offset=offset).reshape(acc["count"], stride)
            flat = np.frombuffer(raw[:, : size * n].tobytes(), dtype=dtype)
        return flat.reshape(acc["count"], n)

    prim = gltf["meshes"][0]["primitives"][0]
    pos = accessor(prim["attributes"]["POSITION"]).astype(np.float64)
    nrm = accessor(prim["attributes"]["NORMAL"]).astype(np.float64)
    idx = accessor(prim["indices"]).reshape(-1).astype(np.int64)

    # The export carries a +90 deg rotation about X on the node. Bake it in
    # so the arch arrives Y-up: (x, y, z) -> (x, -z, y).
    rot = gltf["nodes"][0].get("rotation")
    if rot and abs(rot[0] - 0.7071068) < 1e-3:
        pos = np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], 1)
        nrm = np.stack([nrm[:, 0], -nrm[:, 2], nrm[:, 1]], 1)
    return pos, nrm, idx


# --- geometry helpers -------------------------------------------------------

def weld(pos: np.ndarray, decimals: int = 5):
    _, unique_index, inverse = np.unique(
        np.round(pos, decimals), axis=0, return_index=True, return_inverse=True)
    return pos[unique_index], inverse.astype(np.int64)


def circular_smooth(values: np.ndarray, sigma: float, interpolate_nan: bool = True):
    out = values.astype(np.float64).copy()
    idx = np.arange(len(out))
    good = ~np.isnan(out)
    if interpolate_nan and not good.all():
        out = np.interp(idx, idx[good], out[good], period=len(out))
    half = int(max(3, sigma * 4))
    kernel = np.exp(-0.5 * (np.arange(-half, half + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    padded = np.r_[out[-half:], out, out[:half]]
    return np.convolve(padded, kernel, "same")[half:-half]


def vertex_normals(verts: np.ndarray, faces: np.ndarray, reference: np.ndarray | None = None):
    """Area-weighted smooth normals. Cross products are already area-scaled."""
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    face_n = np.cross(b - a, c - a)
    out = np.zeros_like(verts)
    for col in range(3):
        np.add.at(out, faces[:, col], face_n)
    lengths = np.linalg.norm(out, axis=1, keepdims=True)
    out /= np.maximum(lengths, 1e-12)
    if reference is not None and float((out * reference).sum()) < 0:
        out = -out
    return out


def loop_subdivide(verts: np.ndarray, faces: np.ndarray):
    """One level of Loop subdivision. Handles open boundaries."""
    nv, nf = len(verts), len(faces)

    half_edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    opposite = np.concatenate([faces[:, 2], faces[:, 0], faces[:, 1]])
    keys = np.sort(half_edges, axis=1)
    edges, edge_of_halfedge = np.unique(keys, axis=0, return_inverse=True)
    edge_of_halfedge = edge_of_halfedge.astype(np.int64)
    ne = len(edges)

    order = np.argsort(edge_of_halfedge, kind="stable")
    grouped_edge = edge_of_halfedge[order]
    grouped_opp = opposite[order]
    counts = np.bincount(edge_of_halfedge, minlength=ne)
    starts = np.searchsorted(grouped_edge, np.arange(ne))
    opp_a = grouped_opp[starts]
    opp_b = grouped_opp[np.minimum(starts + 1, len(grouped_opp) - 1)]
    interior = counts >= 2

    va, vb = edges[:, 0], edges[:, 1]
    edge_points = np.where(
        interior[:, None],
        0.375 * (verts[va] + verts[vb]) + 0.125 * (verts[opp_a] + verts[opp_b]),
        0.5 * (verts[va] + verts[vb]))

    # Reposition the original vertices with the Loop mask.
    neighbour_sum = np.zeros_like(verts)
    np.add.at(neighbour_sum, va, verts[vb])
    np.add.at(neighbour_sum, vb, verts[va])
    valence = np.zeros(nv)
    np.add.at(valence, va, 1.0)
    np.add.at(valence, vb, 1.0)
    valence = np.maximum(valence, 3.0)
    beta = (1.0 / valence) * (0.625 - (0.375 + 0.25 * np.cos(2 * np.pi / valence)) ** 2)
    moved = (1.0 - valence * beta)[:, None] * verts + beta[:, None] * neighbour_sum

    # Boundary vertices follow the curve of the boundary only.
    boundary_edges = ~interior
    if boundary_edges.any():
        boundary_sum = np.zeros_like(verts)
        boundary_count = np.zeros(nv)
        for x, y in ((va, vb), (vb, va)):
            np.add.at(boundary_sum, x[boundary_edges], verts[y[boundary_edges]])
            np.add.at(boundary_count, x[boundary_edges], 1.0)
        on_boundary = boundary_count > 0
        moved[on_boundary] = (0.75 * verts[on_boundary]
                              + 0.125 * boundary_sum[on_boundary])

    e01 = nv + edge_of_halfedge[0:nf]
    e12 = nv + edge_of_halfedge[nf:2 * nf]
    e20 = nv + edge_of_halfedge[2 * nf:3 * nf]
    new_faces = np.concatenate([
        np.stack([faces[:, 0], e01, e20], 1),
        np.stack([faces[:, 1], e12, e01], 1),
        np.stack([faces[:, 2], e20, e12], 1),
        np.stack([e01, e12, e20], 1)])
    return np.concatenate([moved, edge_points]), new_faces


# --- analysis ---------------------------------------------------------------

def edge_concavity(verts, normals, faces):
    """Per-vertex concavity. Positive where the surface folds inwards."""
    e = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    e = np.unique(np.sort(e, axis=1), axis=0)
    a, b = e[:, 0], e[:, 1]
    delta = verts[b] - verts[a]
    delta /= np.linalg.norm(delta, axis=1, keepdims=True) + 1e-12
    # A neighbour sitting on the +normal side of the tangent plane is concave.
    conc = 0.5 * ((delta * normals[a]).sum(1) + (-delta * normals[b]).sum(1))
    total = np.zeros(len(verts))
    count = np.zeros(len(verts))
    for x in (a, b):
        np.add.at(total, x, conc)
        np.add.at(count, x, 1.0)
    return total / np.maximum(count, 1.0)


def extract_gum_line(verts, concavity, band_half):
    """Recover the scalloped gum margin as curves over the arch angle.

    Returns the arch centre plus, per angular bin: the crease height, the
    radius of the tooth ridge, and how confidently that bin carries a tooth
    at all (the arch is open at the back, where there is nothing to find).
    """
    x, y, z = verts[:, 0], verts[:, 1], verts[:, 2]
    upper = y > np.percentile(y, 55)
    cx, cz = x[upper].mean(), z[upper].mean()
    theta = np.arctan2(x - cx, z - cz)
    radius = np.hypot(x - cx, z - cz)
    bins = np.clip(((theta + np.pi) / (2 * np.pi) * ARCH_BINS).astype(int), 0, ARCH_BINS - 1)

    weight = np.clip(concavity, 0, None) ** 1.5
    ridge = np.full(ARCH_BINS, np.nan)
    crown = np.full(ARCH_BINS, np.nan)
    crease = np.full(ARCH_BINS, np.nan)
    strength = np.zeros(ARCH_BINS)

    for k in range(ARCH_BINS):
        members = np.where(bins == k)[0]
        if len(members) < 40:
            continue
        rm, ym, wm = radius[members], y[members], weight[members]
        top = ym > np.percentile(ym, 97)
        ridge[k] = np.median(rm[top])
        crown[k] = np.percentile(ym, 99.5)
        # Only look for the crease inside the tooth band, or the flat floor
        # of the cast drags the estimate down.
        band = np.abs(rm - ridge[k]) < band_half
        if band.sum() < 20:
            continue
        wb, yb = wm[band], ym[band]
        sel = wb > np.percentile(wb, 90)
        if sel.sum() < 6:
            continue
        crease[k] = np.average(yb[sel], weights=wb[sel])
        strength[k] = wb[sel].mean()

    ridge_s = circular_smooth(ridge, 3.0)
    crown_s = circular_smooth(crown, 2.0)
    crease_s = circular_smooth(crease, 2.0)
    strength_s = circular_smooth(strength, 3.0)
    # A bin holds a tooth when a crown stands clearly above a real crease.
    has_tooth = (crown_s - crease_s > 0.05) & (strength_s > np.percentile(strength_s, 25))
    return (cx, cz), crease_s, ridge_s, circular_smooth(has_tooth.astype(float), 2.0)


def attributes_for(verts, centre, crease, ridge, has_tooth,
                   band_half=TOOTH_BAND_HALF, feather=TOOTH_BAND_FEATHER):
    cx, cz = centre
    x, y, z = verts[:, 0], verts[:, 1], verts[:, 2]
    theta = np.arctan2(x - cx, z - cz)
    radius = np.hypot(x - cx, z - cz)
    bins = np.clip(((theta + np.pi) / (2 * np.pi) * ARCH_BINS).astype(int), 0, ARCH_BINS - 1)
    gum_t = y - crease[bins]
    band = (np.clip((band_half - np.abs(radius - ridge[bins])) / feather, 0, 1)
            * np.clip((has_tooth[bins] - 0.25) / 0.35, 0, 1))
    return gum_t, theta / np.pi, band, bins


def bake_occlusion(verts, normals, faces):
    """Voxelised ray-marched AO. The scan is dense enough that seeding the
    grid from vertices plus a scatter of barycentric samples closes it."""
    lo = verts.min(0) - 0.02
    hi = verts.max(0) + 0.02
    dims = np.ceil((hi - lo) / AO_VOXEL).astype(int)
    occupancy = np.zeros(int(dims.prod()), bool)

    def mark(points):
        cell = np.floor((points - lo) / AO_VOXEL).astype(int)
        np.clip(cell, 0, dims - 1, out=cell)
        occupancy[(cell[:, 0] * dims[1] + cell[:, 1]) * dims[2] + cell[:, 2]] = True

    mark(verts)
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    for u, v in ((1 / 3, 1 / 3), (0.5, 0.25), (0.25, 0.5), (0.25, 0.25), (0.5, 0.0),
                 (0.0, 0.5), (0.5, 0.5), (0.75, 0.125), (0.125, 0.75), (0.125, 0.125)):
        mark(a + (b - a) * u + (c - a) * v)

    rng = np.random.default_rng(3)
    cos_z = np.sqrt(rng.random(AO_RAYS))
    radial = np.sqrt(1 - cos_z * cos_z)
    phi = rng.random(AO_RAYS) * 2 * np.pi
    local = np.stack([radial * np.cos(phi), radial * np.sin(phi), cos_z], 1)

    up = np.where(np.abs(normals[:, 1:2]) < 0.9,
                  np.array([[0.0, 1.0, 0.0]]), np.array([[1.0, 0.0, 0.0]]))
    tangent = np.cross(up, normals)
    tangent /= np.linalg.norm(tangent, axis=1, keepdims=True) + 1e-9
    bitangent = np.cross(normals, tangent)

    visibility = np.zeros(len(verts), np.float32)
    chunk = 6000
    for start in range(0, len(verts), chunk):
        end = min(start + chunk, len(verts))
        origin = verts[start:end] + normals[start:end] * 0.004
        direction = (tangent[start:end, None, :] * local[None, :, 0:1]
                     + bitangent[start:end, None, :] * local[None, :, 1:2]
                     + normals[start:end, None, :] * local[None, :, 2:3])
        blocked = np.zeros((end - start, AO_RAYS), bool)
        for step in range(1, AO_STEPS + 1):
            probe = origin[:, None, :] + direction * (AO_DISTANCE * step / AO_STEPS)
            cell = np.floor((probe - lo) / AO_VOXEL).astype(np.int32)
            inside = np.all((cell >= 0) & (cell < dims), axis=2)
            np.clip(cell, 0, dims - 1, out=cell)
            flat = (cell[..., 0] * dims[1] + cell[..., 1]) * dims[2] + cell[..., 2]
            blocked |= occupancy[flat] & inside
        visibility[start:end] = 1.0 - blocked.mean(1)
    return visibility


def tooth_islands(verts, bins, band, has_tooth):
    """Split the tooth band into individual teeth.

    Crown height dips at every interproximal contact, so the local minima of
    the height-versus-arch-angle profile are the tooth boundaries.
    """
    y = verts[:, 1]
    profile = np.full(ARCH_BINS, np.nan)
    for k in range(ARCH_BINS):
        members = (bins == k) & (band > 0.5)
        if members.sum() < 12:
            continue
        profile[k] = np.percentile(y[members], 98)
    smooth = circular_smooth(profile, 1.2)

    toothed = np.where(has_tooth > 0.6)[0]
    lo, hi = toothed.min(), toothed.max()
    span = np.arange(lo, hi + 1)
    values = smooth[span]
    minima = []
    for i in range(2, len(values) - 2):
        if (values[i] <= values[i - 1] and values[i] <= values[i + 1]
                and values[i] < values[i - 2] and values[i] < values[i + 2]):
            minima.append(int(span[i]))
    merged: list[int] = []
    for m in minima:
        if merged and m - merged[-1] < 6:
            if smooth[m] < smooth[merged[-1]]:
                merged[-1] = m
        else:
            merged.append(m)

    bounds = [lo - 1] + merged + [hi + 1]
    ids = np.full(len(verts), 255, np.uint8)
    for i in range(len(bounds) - 1):
        members = (bins > bounds[i]) & (bins <= bounds[i + 1]) & (band > 0.35)
        ids[members] = i
    return ids, len(bounds) - 1


# --- main -------------------------------------------------------------------

def main(src: str, dst: str) -> None:
    pos, nrm, idx = read_glb(src)
    print(f"source: {len(pos)} verts, {len(idx) // 3} tris")

    verts, inverse = weld(pos)
    faces = inverse[idx].reshape(-1, 3)
    normals = vertex_normals(verts, faces, reference=nrm[:len(verts)])
    print(f"welded: {len(verts)} verts")

    concavity = edge_concavity(verts, normals, faces)
    source_width = verts[:, 0].max() - verts[:, 0].min()
    centre, crease, ridge, has_tooth = extract_gum_line(
        verts, concavity, TOOTH_BAND_HALF * source_width)
    print(f"gum line: centre=({centre[0]:.3f}, {centre[1]:.3f}), "
          f"height {np.nanmin(crease):.3f}..{np.nanmax(crease):.3f}, "
          f"{int((has_tooth > 0.6).sum())}/{ARCH_BINS} bins carry teeth")

    for level in range(SUBDIVISIONS):
        verts, faces = loop_subdivide(verts, faces)
        print(f"subdivision {level + 1}: {len(verts)} verts, {len(faces)} tris")
    normals = vertex_normals(verts, faces, reference=normals[:1])

    # Re-centre and normalise so the arch is exactly 1.0 unit wide. Every
    # camera distance in the project is expressed in those units.
    centre_xyz = (verts.min(0) + verts.max(0)) / 2
    verts -= centre_xyz
    scale = 1.0 / (verts[:, 0].max() - verts[:, 0].min())
    verts *= scale
    crease = (crease - centre_xyz[1]) * scale
    ridge = ridge * scale
    centre = ((centre[0] - centre_xyz[0]) * scale, (centre[1] - centre_xyz[2]) * scale)

    gum_t, theta, band, bins = attributes_for(verts, centre, crease, ridge, has_tooth)
    print(f"tooth band covers {(band > 0.5).mean():.1%} of the surface")

    occlusion = bake_occlusion(verts, normals, faces)
    print(f"ambient occlusion: median {np.median(occlusion):.3f}")

    ids, tooth_count = tooth_islands(verts, bins, band, has_tooth)
    print(f"tooth islands: {tooth_count}")

    index = faces.reshape(-1).astype(np.uint32)
    payload = bytearray()
    payload += b"TOMA" + struct.pack("<IIII", 1, len(verts), len(index), tooth_count)
    payload += verts.astype(np.float32).tobytes()
    payload += normals.astype(np.float32).tobytes()
    payload += gum_t.astype(np.float32).tobytes()
    payload += theta.astype(np.float32).tobytes()
    payload += np.round(np.clip(band, 0, 1) * 255).astype(np.uint8).tobytes()
    payload += np.round(np.clip(occlusion, 0, 1) * 255).astype(np.uint8).tobytes()
    payload += ids.tobytes()
    while len(payload) % 4:
        payload += b"\0"
    payload += index.tobytes()

    with open(dst, "wb") as fh:
        fh.write(bytes(payload))
    print(f"wrote {dst} ({len(payload) / 1e6:.2f} MB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
