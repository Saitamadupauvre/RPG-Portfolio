"""
Generates the statue and enemies and exports them to public/models/*.glb.

Run from the repo root:
    blender --background --python tools/blender/make_world.py

Each print line gives the model's height in Blender units; the game's fit heights
(src/game/entities/modelProps.ts and the factories) are copied from it.
See tools/blender/common.py for the conventions (Z up, faces -Y, named materials).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "tools", "blender"))

import bpy
from mathutils import Vector, noise

from common import PALETTE, blob, box, clear_scene, cylinder, export, flat, join, limb, make_material, paint

OUT = "public/models"
BLEND = "tools/blender/models"


def materials(**roles):
    """{"Rock": "stone"} -> {"Rock": <material coloured with PALETTE["stone"]>}"""
    return {name: make_material(name, PALETTE[colour]) for name, colour in roles.items()}


def assemble(parts_by_material, mats, name="Model"):
    """parts_by_material: {"Body": [objects]}. One mesh per material, each flat shaded."""
    for role, objects in parts_by_material.items():
        merged = join(objects, role) if len(objects) > 1 else objects[0]
        merged.name = role
        paint(merged, mats[role])
        flat(merged)


# ------------------------------------------------------------------------- statue


def build_statue():
    """A knight on a plinth, carved from one block: ONE mesh, ONE material ("Statue"). Faces -Y."""
    clear_scene()
    rng = random.Random(2)

    plinth = [
        cylinder((0, 0, 0.1), 0.85, 0.2, verts=8),
        cylinder((0, 0, 0.45), 0.62, 0.5, verts=8),
        cylinder((0, 0, 0.74), 0.7, 0.08, verts=8),
    ]

    z = 0.78  # top of the plinth: everything below stands on it
    figure = [
        # legs and boots
        limb((-0.17, 0, z), (-0.16, 0, z + 0.62), 0.17, 0.14, verts=6),
        limb((0.17, 0, z), (0.16, 0, z + 0.62), 0.17, 0.14, verts=6),
        box((-0.17, -0.08, z + 0.07), (0.3, 0.42, 0.16)),
        box((0.17, -0.08, z + 0.07), (0.3, 0.42, 0.16)),
        # torso: narrow waist, wide shoulders, belt
        limb((0, 0, z + 0.55), (0, 0, z + 1.15), 0.28, 0.4, verts=8),
        limb((0, 0, z + 0.55), (0, 0, z + 0.65), 0.31, 0.31, verts=8),
        # round helm with a plume
        blob((0, 0, z + 1.42), 0.25, (1, 1, 1.05), rng, subdivisions=2, jitter=0.03),
        limb((0, 0.05, z + 1.6), (0, 0.22, z + 1.9), 0.07, 0.02, verts=4),
        # cape hanging behind
        box((0, 0.3, z + 0.78), (0.7, 0.07, 0.95), rotation=(math.radians(-10), 0, 0)),
        # shield arm (left, low) and sword arm (right, raised)
        limb((-0.42, 0, z + 1.05), (-0.52, -0.1, z + 0.62), 0.12, 0.1, verts=5),
        limb((0.42, 0, z + 1.05), (0.55, -0.14, z + 1.45), 0.12, 0.1, verts=5),
        # sword: blade and crossguard
        limb((0.55, -0.14, z + 1.32), (0.55, -0.14, z + 2.2), 0.06, 0.015, verts=4),
        limb((0.4, -0.14, z + 1.42), (0.7, -0.14, z + 1.42), 0.045, 0.045, verts=4),
    ]
    shield = [box((-0.6, -0.2, z + 0.78), (0.1, 0.42, 0.58), rotation=(0, 0, math.radians(-25)))]

    statue = join(plinth + figure + shield, "Statue")
    paint(statue, make_material("Statue", PALETTE["cream"]))
    flat(statue)
    export("statue", OUT, BLEND)


# ------------------------------------------------------------------------ enemies


def eyes(spread, y, z, white_radius, pupil_radius, rng):
    """A pair of eyes plus angry brows. Returns (whites, pupils, brows)."""
    whites, pupils, brows = [], [], []
    for side in (-1, 1):
        whites.append(blob((side * spread, y, z), white_radius, rng=rng, subdivisions=1, jitter=0))
        pupils.append(blob((side * spread, y - white_radius * 0.8, z - 0.01), pupil_radius, rng=rng, subdivisions=1, jitter=0))
        brows.append(limb(
            (side * (spread + white_radius * 1.3), y - white_radius * 0.3, z + white_radius * 1.4),
            (side * (spread - white_radius * 1.1), y - white_radius * 0.5, z + white_radius * 0.8),
            0.03, 0.03, verts=4,
        ))
    return whites, pupils, brows


def build_grunt():
    """A squat, round imp with horns: small, readable, a little silly."""
    clear_scene()
    rng = random.Random(6)
    mats = materials(Body="berry", Horn="cream", Foot="bark", Eye="cream", Pupil="ink")

    body = [
        blob((0, 0, 0.48), 0.4, (1.0, 0.9, 1.1), rng, jitter=0.05),
        limb((-0.36, 0, 0.5), (-0.5, -0.16, 0.34), 0.07, 0.055, verts=5),
        limb((0.36, 0, 0.5), (0.5, -0.16, 0.34), 0.07, 0.055, verts=5),
        blob((0, 0.34, 0.2), 0.12, (1, 1, 1), rng, subdivisions=1, jitter=0.05),  # tail stub
    ]
    horns = [
        limb((-0.2, -0.02, 0.8), (-0.33, -0.02, 1.07), 0.075, 0.0, verts=5),
        limb((0.2, -0.02, 0.8), (0.33, -0.02, 1.07), 0.075, 0.0, verts=5),
    ]
    feet = [
        blob((-0.17, -0.1, 0.08), 0.12, (1, 1.3, 0.7), rng, subdivisions=1, jitter=0.05),
        blob((0.17, -0.1, 0.08), 0.12, (1, 1.3, 0.7), rng, subdivisions=1, jitter=0.05),
    ]
    whites, pupils, brows = eyes(0.15, -0.31, 0.62, 0.09, 0.045, rng)

    assemble({"Body": body, "Horn": horns, "Foot": feet, "Eye": whites, "Pupil": pupils + brows}, mats)
    export("enemy-grunt", OUT, BLEND)


def build_elite():
    """A broad brute: bark pads, cream horns and tusks, a club in the right fist."""
    clear_scene()
    rng = random.Random(8)
    mats = materials(Body="autumn", Horn="cream", Gear="bark", Eye="gold", Pupil="ink")

    body = [
        limb((0, 0, 0.55), (0, 0, 1.2), 0.34, 0.48, verts=8),  # torso: narrow hips, big chest
        blob((0, 0, 0.55), 0.32, (1.1, 1.0, 0.9), rng, jitter=0.05),
        blob((0, -0.04, 1.42), 0.27, (1, 1, 0.95), rng, jitter=0.05),  # head
        limb((-0.6, 0, 1.1), (-0.68, -0.08, 0.55), 0.13, 0.11, verts=6),  # left arm
        limb((0.6, 0, 1.1), (0.68, -0.1, 0.55), 0.13, 0.11, verts=6),  # right arm
        blob((-0.68, -0.08, 0.48), 0.14, (1, 1, 1), rng, subdivisions=1, jitter=0.05),
        blob((0.68, -0.1, 0.48), 0.14, (1, 1, 1), rng, subdivisions=1, jitter=0.05),
    ]
    horns = []
    for side in (-1, 1):
        horns.append(limb((side * 0.16, 0, 1.6), (side * 0.34, 0, 1.78), 0.065, 0.05, verts=5))
        horns.append(limb((side * 0.34, 0, 1.78), (side * 0.27, 0, 2.02), 0.05, 0.0, verts=5))
        horns.append(limb((side * 0.1, -0.24, 1.3), (side * 0.13, -0.32, 1.48), 0.045, 0.0, verts=4))  # tusk
    gear = [
        limb((-0.2, 0, 0.0), (-0.2, 0, 0.55), 0.15, 0.13, verts=6),  # legs
        limb((0.2, 0, 0.0), (0.2, 0, 0.55), 0.15, 0.13, verts=6),
        box((-0.2, -0.08, 0.06), (0.3, 0.42, 0.12)),
        box((0.2, -0.08, 0.06), (0.3, 0.42, 0.12)),
        blob((-0.58, 0, 1.22), 0.22, (1, 1, 0.7), rng, jitter=0.08),  # shoulder pads
        blob((0.58, 0, 1.22), 0.22, (1, 1, 0.7), rng, jitter=0.08),
        box((0, -0.01, 0.88), (0.5, 0.05, 0.09)),  # belt across the chest
        limb((0.68, -0.1, 0.5), (0.68, -0.55, 1.15), 0.05, 0.065, verts=5),  # club handle
        blob((0.68, -0.62, 1.28), 0.2, (1, 1, 1.25), rng, subdivisions=1, jitter=0.1),  # club head
    ]
    whites, pupils, brows = eyes(0.11, -0.28, 1.44, 0.055, 0.04, rng)

    assemble({"Body": body, "Horn": horns, "Gear": gear, "Eye": whites, "Pupil": pupils + brows}, mats)
    export("enemy-elite", OUT, BLEND)


build_statue()
build_grunt()
build_elite()
