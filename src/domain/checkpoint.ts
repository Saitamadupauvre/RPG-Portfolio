import type { Vec3 } from '../data/MapEntity';

// Where the player respawns after dying. Plain data with no Three.js types so the
// domain layer stays engine-free; the game layer converts to/from THREE.Vector3.
let checkpoint: Vec3 = [0, 0, 0];

export function setCheckpoint(position: Vec3) {
    checkpoint = [...position];
}

export function getCheckpoint(): Vec3 {
    return checkpoint;
}
