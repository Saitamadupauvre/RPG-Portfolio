import * as THREE from 'three';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';
import { disposeObject3D } from './disposeObject3D';
import { loadModel } from './loadModel';

/**
 * Laid out along the sword's own +Z with the origin at the grip — the point the hand closes
 * around, halfway up the handle. That convention is what lets any weapon drop into the wrist
 * node unchanged: the pommel sits behind the fist, the guard just in front of it.
 *
 * The handle is longer than the hand is wide (radius 0.08) on purpose: with the fist at its
 * middle, pommel and guard both poke out, which is what sells "held" rather than "stuck in".
 */
const MODEL_URL = 'models/sword.glb';

/** Where the blade leaves the guard and where it ends, along +Z from the grip: the model's SWORD_BLADE[0] and SWORD_TIP. */
const BLADE_BASE_Z = 0.14;
const SWORD_TIP_Z = 0.7;

const POMMEL_LENGTH = 0.045;
const HANDLE_LENGTH = 0.22;
const HANDLE_RADIUS = 0.03;
const GUARD_WIDTH = 0.2;
const GUARD_HEIGHT = 0.05;
const GUARD_THICKNESS = BLADE_BASE_Z - HANDLE_LENGTH / 2;
const BLADE_LENGTH = SWORD_TIP_Z - BLADE_BASE_Z;
const BLADE_WIDTH = 0.075;
const BLADE_THICKNESS = 0.025;

/**
 * The sword, built by tools/blender/make_world.py in game units with its origin at the grip, so it
 * loads unfitted. Primitives stand in until it arrives (and stay if it never does).
 */
export function createSwordMesh(): THREE.Group {
    const sword = new THREE.Group();
    const placeholder = createPlaceholder();
    sword.add(placeholder);

    loadModel(MODEL_URL)
        .then(({ object }) => {
            sword.remove(placeholder);
            disposeObject3D(placeholder);
            sword.add(object);
        })
        .catch((error) => console.error('[sword] model failed to load, keeping placeholder', error));

    return sword;
}

function createPlaceholder(): THREE.Group {
    const placeholder = new THREE.Group();

    const leather = createLitMaterial({ color: PALETTE.bark });
    const brass = createLitMaterial({ color: PALETTE.gold });
    const steel = createLitMaterial({ color: PALETTE.cream });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 8), leather);
    handle.rotation.x = Math.PI / 2;
    placeholder.add(handle);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(HANDLE_RADIUS * 1.4, 8, 8), brass);
    pommel.position.z = -HANDLE_LENGTH / 2 - POMMEL_LENGTH / 2;
    placeholder.add(pommel);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(GUARD_WIDTH, GUARD_HEIGHT, GUARD_THICKNESS), brass);
    guard.position.z = HANDLE_LENGTH / 2 + GUARD_THICKNESS / 2;
    placeholder.add(guard);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(BLADE_WIDTH, BLADE_THICKNESS, BLADE_LENGTH), steel);
    blade.position.z = BLADE_BASE_Z + BLADE_LENGTH / 2;
    placeholder.add(blade);

    placeholder.traverse((child) => {
        child.castShadow = true;
    });

    return placeholder;
}

/** World position of the blade's root, just past the guard, from the sword's own transform. */
export function getSwordBladeBaseWorldPosition(sword: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
    target.set(0, 0, BLADE_BASE_Z);
    return sword.localToWorld(target);
}

/** World position of the blade tip, from the sword's own transform. */
export function getSwordTipWorldPosition(sword: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
    target.set(0, 0, SWORD_TIP_Z);
    return sword.localToWorld(target);
}
