"""Glowing holographic brain — a procedural Blender scene.

Builds a wireframe/x-ray brain of light on a dark navy background, ringed by
radiating light streaks and red synapse sparks, standing on a low-poly crystal.

Run with a normal Blender install:

    blender -b -P blender/neural_brain.py -- --out render/neural_brain.png

or with the `bpy` PyPI module (no Blender app needed):

    python blender/neural_brain.py --out render/neural_brain.png

Everything is generated from code: no external meshes, textures or add-ons.
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys

import bpy  # noqa: I001  (bpy must be imported before bmesh/mathutils)
import bmesh
from mathutils import Matrix, Vector, noise

# --------------------------------------------------------------------------
# palette (linear-ish RGB, values above 1.0 drive the bloom)
# --------------------------------------------------------------------------
SULCUS_BLUE = (0.04, 0.30, 0.85)   # deep in the folds
CREST_BLUE = (0.55, 0.86, 1.00)    # on the ridges
ICE = (0.45, 0.85, 1.00)           # wire net
WHITE_BLUE = (0.85, 0.96, 1.00)    # hottest sparks and needles
RED = (1.00, 0.06, 0.16)
BG_INNER = (0.014, 0.052, 0.205)
BG_OUTER = (0.002, 0.008, 0.045)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", default="render/neural_brain.png", help="output PNG path")
    p.add_argument("--width", type=int, default=1920)
    p.add_argument("--height", type=int, default=1080)
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--streaks", type=int, default=900)
    p.add_argument("--sparks", type=int, default=170)
    p.add_argument("--voxel", type=float, default=0.022, help="remesh voxel size")
    p.add_argument("--fold-scale", type=float, default=1.15,
                   help="size of the noise field that lays out the gyri")
    p.add_argument("--fold-freq", type=float, default=26.0,
                   help="how many ridges that field is cut into")
    p.add_argument("--fold-amp", type=float, default=0.09, help="fold depth")
    p.add_argument("--wire-ratio", type=float, default=0.030,
                   help="decimation ratio for the wireframe shell (0 disables it)")
    p.add_argument("--blend", default="", help="also save the .blend here")
    p.add_argument("--no-render", action="store_true", help="build the scene only")
    return p.parse_args(argv)


# --------------------------------------------------------------------------
# scene helpers
# --------------------------------------------------------------------------
def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj: bpy.types.Object) -> None:
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def new_material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    return mat


def emission_material(name: str, color, strength: float) -> bpy.types.Material:
    """Plain emitter."""
    mat = new_material(name)
    nt = mat.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*color, 1.0)
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def vertex_color_emission(name: str, strength: float) -> bpy.types.Material:
    """Emitter driven by the mesh's "Col" colour attribute (per-element tint
    and, through alpha, per-element brightness)."""
    mat = new_material(name)
    nt = mat.node_tree
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    mult = nt.nodes.new("ShaderNodeMath")
    mult.operation = "MULTIPLY"
    mult.inputs[1].default_value = strength
    nt.links.new(attr.outputs["Color"], emit.inputs["Color"])
    nt.links.new(attr.outputs["Alpha"], mult.inputs[0])
    nt.links.new(mult.outputs["Value"], emit.inputs["Strength"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def hologram_material() -> bpy.types.Material:
    """X-ray shell: mostly transparent, so the far side of the cortex shows
    through, with the emission riding the baked fold field — deep blue in the
    sulci, near-white on the crests — plus a fresnel rim."""
    mat = new_material("brain_hologram")
    nt, lk = mat.node_tree, mat.node_tree.links.new
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")

    # A constant mix keeps the shell evenly translucent; a wrinkled surface
    # under a fresnel-driven mix just turns into white noise.
    mix.inputs["Fac"].default_value = 0.19

    # rim: a gentle fresnel term added to the *energy*, not the mix
    layer = nt.nodes.new("ShaderNodeLayerWeight")
    layer.inputs["Blend"].default_value = 0.35
    rim = nt.nodes.new("ShaderNodeMath")
    rim.operation = "MULTIPLY"
    rim.inputs[1].default_value = 0.70
    boost = nt.nodes.new("ShaderNodeMath")
    boost.operation = "ADD"

    # "Fold" is baked by sculpt_gyri(): 1 on the crest of a gyrus, 0 in a sulcus
    fold = nt.nodes.new("ShaderNodeAttribute")
    fold.attribute_name = "Fold"

    crest = nt.nodes.new("ShaderNodeValToRGB")
    crest.color_ramp.elements[0].position = 0.52
    crest.color_ramp.elements[0].color = (*SULCUS_BLUE, 1.0)
    crest.color_ramp.elements[1].position = 0.93
    crest.color_ramp.elements[1].color = (*CREST_BLUE, 1.0)

    energy = nt.nodes.new("ShaderNodeMapRange")
    energy.inputs["From Min"].default_value = 0.0
    energy.inputs["From Max"].default_value = 1.0
    energy.inputs["To Min"].default_value = 0.18
    energy.inputs["To Max"].default_value = 2.00

    lk(fold.outputs["Color"], crest.inputs["Fac"])
    lk(fold.outputs["Fac"], energy.inputs["Value"])
    lk(crest.outputs["Color"], emit.inputs["Color"])
    lk(layer.outputs["Facing"], rim.inputs[0])
    lk(energy.outputs["Result"], boost.inputs[0])
    lk(rim.outputs["Value"], boost.inputs[1])
    lk(boost.outputs["Value"], emit.inputs["Strength"])
    lk(transp.outputs["BSDF"], mix.inputs[1])
    lk(emit.outputs["Emission"], mix.inputs[2])
    lk(mix.outputs["Shader"], out.inputs["Surface"])
    return mat


# --------------------------------------------------------------------------
# brain geometry
# --------------------------------------------------------------------------
def ellipsoid(name, location, scale, rotation=(0, 0, 0), segments=64, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def build_brain_blob(voxel_size: float) -> bpy.types.Object:
    """Rough anatomy first: cerebrum + temporal lobes + cerebellum + stem,
    fused into one skin by a voxel remesh."""
    parts = [
        ellipsoid("cerebrum", (0, 0, 0), (1.34, 0.92, 0.84)),
        ellipsoid("temporal_l", (0.24, 0.52, -0.54), (0.74, 0.37, 0.34), (0, 0.20, 0)),
        ellipsoid("temporal_r", (0.24, -0.52, -0.54), (0.74, 0.37, 0.34), (0, 0.20, 0)),
        ellipsoid("cerebellum", (-0.95, 0, -0.52), (0.44, 0.58, 0.36)),
        ellipsoid("stem_top", (-0.56, 0, -0.62), (0.21, 0.21, 0.26)),
    ]

    # brain stem, tapering down out of the underside
    bpy.ops.mesh.primitive_cone_add(
        vertices=32, radius1=0.155, radius2=0.075, depth=0.95,
        location=(-0.46, 0, -1.10),
    )
    stem = bpy.context.active_object
    stem.name = "stem"
    stem.rotation_euler = (0, -0.12, 0)
    bpy.ops.object.transform_apply(rotation=True)
    parts.append(stem)

    activate(parts[0])
    for p in parts[1:]:
        p.select_set(True)
    bpy.ops.object.join()

    brain = bpy.context.active_object
    brain.name = "brain"
    brain.data.remesh_voxel_size = voxel_size
    brain.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    return brain


def sculpt_gyri(obj: bpy.types.Object, seed: int, scale: float, freq: float, depth: float) -> None:
    """Displace the fused skin into gyri/sulci: winding ridges on the cerebrum,
    fine parallel folia on the cerebellum, smooth stem."""
    rng = random.Random(seed)
    jitter = Vector((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))

    me = obj.data
    verts = me.vertices
    # the shader reads the same field that shapes the mesh, so the glow follows
    # the crests of the gyri exactly instead of guessing from noisy curvature
    fold = me.color_attributes.new(name="Fold", type="FLOAT_COLOR", domain="POINT")

    for v in verts:
        co = v.co.copy()
        n = v.normal.copy()
        if n.length_squared == 0.0:
            continue
        n.normalize()

        # fade the folds out over the stem and the underside
        stem_fade = smoothstep(-1.05, -0.55, co.z)
        cerebellum = smoothstep(-0.55, -0.85, co.x) * smoothstep(-0.15, -0.45, co.z)

        # anisotropic sampling stretches the noise front-to-back, so the
        # ridges wind like gyri instead of pebbling the surface
        p = Vector((co.x * scale, co.y * scale * 1.85, co.z * scale * 1.55)) + jitter
        t = noise.noise(p, noise_basis="PERLIN_ORIGINAL")
        detail = noise.noise(p * 3.3, noise_basis="PERLIN_ORIGINAL")
        ridges = math.sin(t * freq + detail * 0.45)
        amp = depth * stem_fade * (1.0 - 0.45 * cerebellum)

        # cerebellum: tight horizontal folia instead of winding gyri
        folia = math.sin(co.z * 66.0 + t * 1.4) * 0.020 * cerebellum * stem_fade

        # longitudinal fissure down the midline of the top half
        fissure = (
            0.085
            * math.exp(-(co.y / 0.115) ** 2)
            * smoothstep(0.02, 0.42, co.z)
            * smoothstep(-1.15, -0.6, -abs(co.x) + 0.25)
        )

        v.co = co + n * (amp * ridges + 0.012 * detail + folia - fissure)

        crest = min(max(ridges * 0.5 + 0.5, 0.0), 1.0) * stem_fade
        fold.data[v.index].color = (crest, crest, crest, 1.0)

    obj.data.update()
    activate(obj)

    # the voxel skin is faceted; a light relax keeps the folds but removes the
    # per-voxel noise that would otherwise break up the curvature shading
    smooth = obj.modifiers.new("relax", "SMOOTH")
    smooth.factor = 0.32
    smooth.iterations = 2
    bpy.ops.object.modifier_apply(modifier="relax")
    bpy.ops.object.shade_smooth()


def smoothstep(a: float, b: float, x: float) -> float:
    if a == b:
        return 0.0
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def add_wire_shell(brain: bpy.types.Object, ratio: float) -> bpy.types.Object:
    """Decimated copy wearing a Wireframe modifier — the visible mesh lines."""
    wire = brain.copy()
    wire.data = brain.data.copy()
    wire.name = "brain_wire"
    link(wire)

    dec = wire.modifiers.new("dec", "DECIMATE")
    dec.ratio = ratio
    activate(wire)
    bpy.ops.object.modifier_apply(modifier="dec")

    # strip the stem: the net belongs on the cortex, the stem stays glassy
    bm = bmesh.new()
    bm.from_mesh(wire.data)
    doomed = [f for f in bm.faces if f.calc_center_median().z < -0.72]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(wire.data)
    bm.free()

    wf = wire.modifiers.new("wire", "WIREFRAME")
    wf.thickness = 0.0034
    wf.use_replace = True
    wf.use_even_offset = False
    bpy.ops.object.modifier_apply(modifier="wire")
    wire.data.materials.clear()
    wire.data.materials.append(emission_material("wire_glow", ICE, 1.9))
    wire.scale = (1.004, 1.004, 1.004)
    return wire


# --------------------------------------------------------------------------
# light streaks and sparks
# --------------------------------------------------------------------------
def tube(bm, col_layer, p0: Vector, p1: Vector, radius: float, color):
    """Three-sided tapered tube from p0 to p1, tinted via the colour layer."""
    d = p1 - p0
    length = d.length
    if length < 1e-6:
        return
    d = d / length
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    a = d.cross(ref).normalized()
    b = d.cross(a).normalized()

    ring0, ring1 = [], []
    for k in range(3):
        ang = 2.0 * math.pi * k / 3.0
        off = (a * math.cos(ang) + b * math.sin(ang)) * radius
        ring0.append(bm.verts.new(p0 + off))
        ring1.append(bm.verts.new(p1 + off * 0.12))

    for k in range(3):
        f = bm.faces.new((ring0[k], ring0[(k + 1) % 3], ring1[(k + 1) % 3], ring1[k]))
        for loop in f.loops:
            loop[col_layer] = color


def build_streaks(count: int, seed: int) -> bpy.types.Object:
    """Needles of light shooting radially out of the brain."""
    rng = random.Random(seed + 11)
    me = bpy.data.meshes.new("streaks")
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Col")

    for _ in range(count):
        # random direction, biased away from straight down
        while True:
            d = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
            if d.length > 1e-3:
                d.normalize()
                if d.z > -0.55:
                    break

        # thin out the needles fired straight at the camera so they do not
        # curtain the cortex
        if d.y > 0.55 and rng.random() < 0.62:
            continue

        shell = Vector((d.x * 1.34, d.y * 0.98, d.z * 0.94))  # follow the ellipsoid
        start = rng.uniform(1.00, 1.92)
        length = rng.uniform(0.15, 1.05) * (1.0 + 0.5 * max(d.z, 0.0))
        p0 = shell * start
        p1 = p0 + d * length

        radius = rng.uniform(0.0018, 0.0042)
        heat = rng.uniform(0.35, 1.0) ** 1.6
        if rng.random() < 0.06:
            color = (*RED, heat * 0.9)
        else:
            tint = rng.uniform(0.0, 1.0)
            color = (
                ICE[0] + (WHITE_BLUE[0] - ICE[0]) * tint,
                ICE[1] + (WHITE_BLUE[1] - ICE[1]) * tint,
                ICE[2],
                heat,
            )
        tube(bm, col, p0, p1, radius, color)

    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new("streaks", me))
    obj.data.materials.append(vertex_color_emission("streak_glow", 9.0))
    return obj


def build_sparks(brain: bpy.types.Object, count: int, seed: int) -> bpy.types.Object:
    """Synapse dots: mostly red, sitting on and just off the cortex."""
    rng = random.Random(seed + 23)
    verts = brain.data.vertices
    me = bpy.data.meshes.new("sparks")
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Col")

    for _ in range(count):
        src = verts[rng.randrange(len(verts))]
        n = src.normal.copy()
        n.normalize()
        pos = src.co + n * rng.uniform(0.005, 0.06)
        if rng.random() < 0.25:  # a few floating further out
            pos = pos + n * rng.uniform(0.1, 0.7)

        radius = rng.uniform(0.006, 0.013)
        res = bmesh.ops.create_icosphere(
            bm, subdivisions=1, radius=radius, matrix=Matrix.Translation(pos)
        )
        red = rng.random() < 0.72
        color = (*RED, rng.uniform(0.7, 1.0)) if red else (*WHITE_BLUE, rng.uniform(0.5, 0.9))
        for v in res["verts"]:
            for loop_face in v.link_faces:
                for loop in loop_face.loops:
                    loop[col] = color

    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new("sparks", me))
    obj.data.materials.append(vertex_color_emission("spark_glow", 30.0))
    return obj


def build_pedestal(seed: int) -> bpy.types.Object:
    """Low-poly crystal the stem plants itself in — wireframe only."""
    rng = random.Random(seed + 41)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(0, 0, 0))
    rock = bpy.context.active_object
    rock.name = "pedestal"
    for v in rock.data.vertices:
        v.co *= rng.uniform(0.72, 1.28)
        v.co.z *= 0.55

    wf = rock.modifiers.new("wire", "WIREFRAME")
    wf.thickness = 0.012
    wf.use_replace = True
    activate(rock)
    bpy.ops.object.modifier_apply(modifier="wire")

    rock.location = (-0.28, 0, -2.62)
    rock.scale = (1.12, 1.12, 1.00)
    rock.data.materials.clear()
    rock.data.materials.append(emission_material("pedestal_glow", (0.08, 0.36, 0.92), 0.6))
    return rock


# --------------------------------------------------------------------------
# world, camera, render
# --------------------------------------------------------------------------
def setup_world() -> None:
    world = bpy.data.worlds.new("space")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Location"].default_value = (-0.5, -0.5, 0.0)
    mapping.inputs["Scale"].default_value = (1.0, 1.55, 1.0)
    tex_co = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.10
    ramp.color_ramp.elements[0].color = (*BG_OUTER, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (*BG_INNER, 1.0)

    lk = nt.links.new
    lk(tex_co.outputs["Window"], mapping.inputs["Vector"])
    lk(mapping.outputs["Vector"], grad.inputs["Vector"])
    lk(grad.outputs["Fac"], ramp.inputs["Fac"])
    lk(ramp.outputs["Color"], bg.inputs["Color"])
    lk(bg.outputs["Background"], out.inputs["Surface"])


def setup_camera() -> bpy.types.Object:
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = 62.0
    cam = link(bpy.data.objects.new("camera", cam_data))
    cam.location = (1.70, 10.20, 0.95)
    target = Vector((0.0, 0.0, -0.22))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def setup_compositor() -> None:
    """Render Layers -> two Glare passes -> group output (Blender 4.5/5.x
    compositor node group API, with a fallback for older scene.node_tree)."""
    scene = bpy.context.scene

    if hasattr(scene, "compositing_node_group"):
        ng = bpy.data.node_groups.new("compositor", "CompositorNodeTree")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        scene.compositing_node_group = ng
        nodes, lk = ng.nodes, ng.links.new
        out_node = nodes.new("NodeGroupOutput")
        out_socket = out_node.inputs[0]
    else:  # Blender <= 4.4
        scene.use_nodes = True
        ng = scene.node_tree
        nodes, lk = ng.nodes, ng.links.new
        nodes.clear()
        out_node = nodes.new("CompositorNodeComposite")
        out_socket = out_node.inputs["Image"]

    rl = nodes.new("CompositorNodeRLayers")
    bloom = nodes.new("CompositorNodeGlare")
    streak = nodes.new("CompositorNodeGlare")

    def set_socket(node, name, value):
        sock = node.inputs.get(name)
        if sock is None:
            return False
        try:
            sock.default_value = value
            return True
        except (TypeError, ValueError):
            return False

    def set_glare(node, kind, **kwargs):
        # 5.x exposes settings as menu/value sockets, 4.x as RNA properties
        if not set_socket(node, "Type", kind):
            node.glare_type = kind.upper().replace(" ", "_")
        for key, value in kwargs.items():
            if not set_socket(node, key.replace("_", " ").title(), value):
                setattr(node, key.lower().replace(" ", "_"), value)

    set_glare(bloom, "Bloom", threshold=0.75, size=9.0, strength=0.60, smoothness=0.35)
    set_glare(streak, "Streaks", threshold=2.2, strength=0.16, streaks=6,
              fade=0.88, iterations=3, color_modulation=0.18)

    lk(rl.outputs["Image"], bloom.inputs["Image"])
    lk(bloom.outputs["Image"], streak.inputs["Image"])
    lk(streak.outputs["Image"], out_socket)


def setup_render(args: argparse.Namespace) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"

    def try_set(owner, attr, value):
        """Cycles moves settings between releases; skip what this build lacks."""
        if hasattr(owner, attr):
            try:
                setattr(owner, attr, value)
            except (TypeError, ValueError, AttributeError):
                pass

    cy = scene.cycles
    try_set(cy, "device", "CPU")
    try_set(cy, "samples", args.samples)
    try_set(cy, "use_denoising", True)
    try_set(cy, "max_bounces", 6)
    try_set(cy, "diffuse_bounces", 1)
    try_set(cy, "glossy_bounces", 1)
    try_set(cy, "transmission_bounces", 2)
    try_set(cy, "transparent_max_bounces", 48)
    try_set(cy, "caustics_reflective", False)
    try_set(cy, "caustics_refractive", False)
    try_set(scene.render, "use_persistent_data", True)

    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 15
    scene.render.filepath = os.path.abspath(args.out)

    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    scene.view_settings.exposure = -0.5
    scene.view_settings.gamma = 1.0


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    reset_scene()
    setup_world()
    setup_camera()

    brain = build_brain_blob(args.voxel)
    sculpt_gyri(brain, args.seed, args.fold_scale, args.fold_freq, args.fold_amp)
    brain.data.materials.clear()
    brain.data.materials.append(hologram_material())

    if args.wire_ratio > 0:
        add_wire_shell(brain, args.wire_ratio)
    build_streaks(args.streaks, args.seed)
    build_sparks(brain, args.sparks, args.seed)
    build_pedestal(args.seed)

    setup_render(args)
    setup_compositor()

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))

    if not args.no_render:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        bpy.ops.render.render(write_still=True)
        print("wrote", os.path.abspath(args.out))


if __name__ == "__main__":
    main()
