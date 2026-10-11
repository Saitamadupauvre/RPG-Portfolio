"""
Shared helpers for the model scripts (make_world.py, make_nature.py, make_campfires.py).

Conventions every model follows, so the game can load them without special cases:
  * Z is up in Blender (glTF export turns it into Y-up). Origin = where the model
    touches the ground, so the game seats it by dropping the origin on the terrain.
  * The model FACES -Y in Blender, which becomes +Z in the game: the way
    `AttackComponent` and the enemy AI point things.
  * Materials are named by role ("Rock", "Body", "Flame"...). The game finds the
    ones it recolours or makes glow by that name, so a role keeps its name.
  * Flat shading and a handful of polygons: the low-poly look is the point.
"""
import os

import bpy
import bmesh
from mathutils import Vector

REPO = os.getcwd()

# Mirrors src/game/render/palette.ts. Change a colour there first, then here.
PALETTE = {
    "meadow": 0x9DBF58,
    "leaf": 0x52834A,
    "leafBright": 0x7FB050,
    "autumn": 0xD4945A,
    "wheat": 0xDCC89E,
    "rock": 0x8F735C,
    "bark": 0x6B4F3F,
    "stone": 0x8F8C99,
    "berry": 0xC65364,
    "gold": 0xE8C068,
    "cream": 0xFFF4DC,
    # Not in the shared palette: only the darkest detail (pupils, brows).
    "ink": 0x3A2E44,
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_material(name, hex_color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r, g, b = [((hex_color >> s) & 0xFF) / 255 for s in (16, 8, 0)]
    bsdf.inputs["Base Color"].default_value = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1)
    bsdf.inputs["Roughness"].default_value = 1.0
    return mat


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    # Orphan materials from the previous model would turn new ones into "Name.001",
    # which the game could no longer recognise by name.
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined


def limb(start, end, base_radius, tip_radius, verts=6):
    """A tapered prism from `start` to `end` (tuples or Vectors)."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts,
        radius1=base_radius,
        radius2=tip_radius,
        depth=direction.length,
        location=(start + end) / 2,
    )
    obj = bpy.context.active_object
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def blob(center, radius, scale=(1, 1, 1), rng=None, subdivisions=2, jitter=0.12):
    """Icosphere with its vertices nudged, so no two blobs look alike."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=center)
    obj = bpy.context.active_object
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)

    if rng is not None and jitter > 0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for v in bm.verts:
            v.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * radius * jitter
        bm.to_mesh(obj.data)
        bm.free()
    return obj


def box(center, size, rotation=(0, 0, 0)):
    """Cuboid `size` = (x, y, z) in full extents."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rotation)
    obj = bpy.context.active_object
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return obj


def cylinder(center, radius, depth, verts=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=center)
    return bpy.context.active_object


def paint(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def flat(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.shade_flat()


def export(name, glb_dir, blend_dir):
    """Writes the .glb the game loads and an editable .blend beside the scripts."""
    out_dir = os.path.join(REPO, glb_dir)
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_normals=True,
        export_yup=True,
    )

    # Keep an editable copy: open it in Blender to hand-tweak, then re-export.
    blend_path = os.path.join(REPO, blend_dir)
    os.makedirs(blend_path, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(blend_path, f"{name}.blend"))

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    faces = sum(len(o.data.polygons) for o in meshes)
    lo = Vector((min(v[i] for o in meshes for v in (o.matrix_world @ Vector(c) for c in o.bound_box)) for i in range(3)))
    hi = Vector((max(v[i] for o in meshes for v in (o.matrix_world @ Vector(c) for c in o.bound_box)) for i in range(3)))
    size = hi - lo
    print(f"[models] {name}: {faces} faces, size x={size.x:.2f} y={size.y:.2f} height={size.z:.2f}")

