"""
Converts the KayKit Forest Nature Pack models (CC0, tools/blender/source/kaykit/)
into the same kind of glTF the rest of the game's props use, in public/nature/*.glb.

Run from the repo root:
    blender --background --python tools/blender/make_nature.py

KayKit paints every model with one gradient atlas texture. That texture is dropped:
each face is sorted by WHERE it samples the atlas (green band, orange band, grey
band) and given a plain, named material instead, which the game then colours itself:
    Canopy - leaves        (re-tinted per tree, sways in the wind)
    Trunk  - wood          (bare trees are only this)
    Rock   - stone         (replaced by the terrain's ground shader in the game)
See tools/blender/common.py for the conventions.
"""
import glob
import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "tools", "blender"))

import bpy

from common import PALETTE, clear_scene, export, join, make_material

SOURCE = os.path.join("tools", "blender", "source", "kaykit")

# Atlas rows, as the v coordinate of a face's UVs (v = 1 is the top of the image).
BANDS = [
    (0.75, "Canopy"),  # top row: green
    (0.50, "Trunk"),   # second row: orange
    (0.00, "Rock"),    # third row: grey
]

COLORS = {"Canopy": PALETTE["leaf"], "Trunk": PALETTE["bark"], "Rock": PALETTE["stone"]}


def role_of(v):
    for floor, role in BANDS:
        if v >= floor:
            return role
    return "Rock"


def convert(path):
    # "Tree_Bare_1_B_Color1.obj" -> "tree-bare-1-b"
    name = os.path.basename(path).replace("_Color1.obj", "").lower().replace("_", "-")

    clear_scene()
    bpy.ops.wm.obj_import(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    model = join(meshes, name) if len(meshes) > 1 else meshes[0]
    mesh = model.data

    # Which role does each face have? Read it off the atlas row its UVs sit in.
    uv = mesh.uv_layers.active.data
    roles = []
    for polygon in mesh.polygons:
        v = sum(uv[i].uv[1] for i in polygon.loop_indices) / polygon.loop_total
        roles.append(role_of(v))

    used = [role for role in ("Canopy", "Trunk", "Rock") if role in roles]
    mesh.materials.clear()
    for role in used:
        mesh.materials.append(make_material(role, COLORS[role]))
    for polygon, role in zip(mesh.polygons, roles):
        polygon.material_index = used.index(role)

    # The atlas is no longer referenced; drop the UVs and any leftover image/material.
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)

    export(name, "public/nature", "tools/blender/nature")
    print(f"[nature] {name}: {', '.join(used)}")


for obj_path in sorted(glob.glob(os.path.join(SOURCE, "*.obj"))):
    convert(os.path.abspath(obj_path))
