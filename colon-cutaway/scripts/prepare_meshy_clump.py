"""
Prepare the Meshy stool-clump GLB:  python3 scripts/prepare_meshy_clump.py <meshy.glb>
weld, keep the main piece, centre, scale to bounding radius 1, decimate under
5k triangles, light smoothing, drop Meshy's texture. Writes public/models/clump.glb.
"""
import os
import sys

import fast_simplification
import numpy as np
import trimesh

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "models", "clump.glb")
TARGET = int(os.environ.get("CLUMP_TRIS", 4600))

s = trimesh.load(sys.argv[1])
m = s.to_geometry() if hasattr(s, "to_geometry") else s.dump(concatenate=True)
m = trimesh.Trimesh(m.vertices, m.faces, process=True)
parts = sorted(m.split(only_watertight=False), key=lambda p: len(p.faces), reverse=True)
print("pieces:", [len(p.faces) for p in parts])
m = trimesh.util.concatenate([p for p in parts if len(p.faces) > 0.05 * len(parts[0].faces)])
if len(m.faces) > TARGET:
    v, f = fast_simplification.simplify(m.vertices, m.faces, target_count=TARGET)
    m = trimesh.Trimesh(v, f, process=True)
trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=3)
m.apply_translation(-m.bounding_box.centroid)
m.apply_scale(1.0 / np.linalg.norm(m.vertices, axis=1).max())
trimesh.repair.fix_normals(m)
print("triangles", len(m.faces), "watertight", m.is_watertight, "extent", np.round(m.extents, 3).tolist())
m.visual = trimesh.visual.TextureVisuals(
    material=trimesh.visual.material.PBRMaterial(name="clump", baseColorFactor=[74, 50, 38, 255], roughnessFactor=0.8)
)
sc = trimesh.Scene()
sc.add_geometry(m, node_name="clump", geom_name="clump")
open(OUT, "wb").write(trimesh.exchange.gltf.export_glb(sc, include_normals=True))
print("wrote", OUT)
