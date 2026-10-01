import * as THREE from 'three';
import { createToonMaterial } from '../render/toon';

/**
 * Laid out along the sword's own +Z with the origin at the grip — the point the hand closes
 * around, halfway up the handle. That convention is what lets any weapon drop into the wrist
 * node unchanged: the pommel sits behind the fist, the guard just in front of it.
 *
 * The handle is longer than the hand is wide (radius 0.08) on purpose: with the fist at its
 * middle, pommel and guard both poke out, which is what sells "held" rather than "stuck in".
 */
const POMMEL_LENGTH = 0.045;
const HANDLE_LENGTH = 0.22;
const HANDLE_RADIUS = 0.03;
const GUARD_WIDTH = 0.2;
const GUARD_HEIGHT = 0.05;
const GUARD_THICKNESS = 0.035;
const BLADE_LENGTH = 0.56;
const BLADE_WIDTH = 0.075;
const BLADE_THICKNESS = 0.025;

const GUARD_Z = HANDLE_LENGTH / 2;
/** Distance from the grip to the blade tip, along the sword's +Z. */
const SWORD_TIP_Z = GUARD_Z + GUARD_THICKNESS / 2 + BLADE_LENGTH;

/** Placeholder sword: separate primitives grouped together so a real model can drop in later. */
export function createSwordMesh(): THREE.Group {
    const sword = new THREE.Group();

    const leather = createToonMaterial({ color: 0x5a3a1e });
    const brass = createToonMaterial({ color: 0xe8c65a });
    const steel = createToonMaterial({ color: 0xeef2ff });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 8), leather);
    handle.rotation.x = Math.PI / 2;
    sword.add(handle);

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(HANDLE_RADIUS * 1.4, 8, 8), brass);
    pommel.position.z = -HANDLE_LENGTH / 2 - POMMEL_LENGTH / 2;
    sword.add(pommel);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(GUARD_WIDTH, GUARD_HEIGHT, GUARD_THICKNESS), brass);
    guard.position.z = GUARD_Z;
    sword.add(guard);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(BLADE_WIDTH, BLADE_THICKNESS, BLADE_LENGTH), steel);
    blade.position.z = SWORD_TIP_Z - BLADE_LENGTH / 2;
    sword.add(blade);

    sword.traverse((child) => {
        child.castShadow = true;
    });

    return sword;
}

/** World position of the blade tip, from the sword's own transform. */
export function getSwordTipWorldPosition(sword: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
    target.set(0, 0, SWORD_TIP_Z);
    return sword.localToWorld(target);
}
