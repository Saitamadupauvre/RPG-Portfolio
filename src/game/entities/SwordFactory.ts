import * as THREE from 'three';
import { createToonMaterial } from '../render/toon';

export const SWORD_LENGTH = 0.9;
const HILT_LENGTH = 0.18;
const HILT_RADIUS = 0.035;
const GUARD_WIDTH = 0.22;
const GUARD_HEIGHT = 0.06;
const BLADE_WIDTH = 0.08;
const BLADE_THICKNESS = 0.03;

/** Placeholder sword: separate primitives grouped together so a real model can drop in later. */
export function createSwordMesh(): THREE.Group {
    const sword = new THREE.Group();

    const hilt = new THREE.Mesh(
        new THREE.CylinderGeometry(HILT_RADIUS, HILT_RADIUS, HILT_LENGTH, 8),
        createToonMaterial({ color: 0x5a3a1e }),
    );
    hilt.rotation.x = Math.PI / 2;
    hilt.position.z = HILT_LENGTH / 2;
    sword.add(hilt);

    const guard = new THREE.Mesh(
        new THREE.BoxGeometry(GUARD_WIDTH, GUARD_HEIGHT, 0.04),
        createToonMaterial({ color: 0xe8c65a }),
    );
    guard.position.z = HILT_LENGTH;
    sword.add(guard);

    const bladeLength = SWORD_LENGTH - HILT_LENGTH;
    const blade = new THREE.Mesh(
        new THREE.BoxGeometry(BLADE_WIDTH, BLADE_THICKNESS, bladeLength),
        createToonMaterial({ color: 0xeef2ff }),
    );
    blade.position.z = HILT_LENGTH + bladeLength / 2;
    sword.add(blade);

    return sword;
}

/** World position of the blade tip, derived from the hand's transform (sword hangs at local +z off the hand). */
export function getSwordTipWorldPosition(hand: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
    target.set(0, 0, SWORD_LENGTH);
    return hand.localToWorld(target);
}
