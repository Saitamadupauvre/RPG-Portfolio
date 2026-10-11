"""
Splits the campfire models of tools/blender/source/campfires/campfires.glb into
one glTF each, in public/campfires/*.glb.

Run from the repo root:
    blender --background --python tools/blender/make_campfires.py

The models are logs (and a cooking pot) only: the flames are a particle emitter
in the game (src/game/entities/components/FireComponent.ts), so a model has no fire
of its own. Each export has its world transform baked in, its base on the ground
(z = 0) and its centre over the origin.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "tools", "blender"))

import bpy
from mathutils import Vector

from common import REPO, export

SOURCE = os.path.join(REPO, "tools", "blender", "source", "campfires", "campfires.glb")

# source mesh object -> exported name. The source file also holds two angular-stone
# variants (Campfire_Logs_Smooth.001 / .002); they were dropped, the numbering kept.
MODELS = {
    "Cookingpot_Logs_Smooth_SimplePolygonPalette_0": "campfire-3",    # cooking pot on a tripod, round stones
    "Cookingpot_Logs_Smooth.002_SimplePolygonPalette_0": "campfire-4",  # logs, round stones
}


def extract(source_name, name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes) + list(bpy.data.materials) + list(bpy.data.images):
        block.user_clear()
    bpy.ops.import_scene.gltf(filepath=SOURCE)

    model = bpy.data.objects[source_name]
    world = model.matrix_world.copy()
    model.parent = None
    model.matrix_world = world

    for other in list(bpy.data.objects):
        if other is not model:
            bpy.data.objects.remove(other, do_unlink=True)

    bpy.context.view_layer.objects.active = model
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    corners = [Vector(c) for c in model.bound_box]
    lo = Vector([min(c[i] for c in corners) for i in range(3)])
    hi = Vector([max(c[i] for c in corners) for i in range(3)])
    shift = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in model.data.vertices:
        v.co -= shift
    model.data.update()
    model.name = name

    export(name, "public/campfires", "tools/blender/campfires")


for source_name, name in MODELS.items():
    extract(source_name, name)
