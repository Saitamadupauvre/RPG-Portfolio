import type * as THREE from 'three';
import type { MapEntityTransform } from '../../data/MapEntity';
import { groundHeight } from '../world/terrainField';

/** Offsets smaller than this are noise from float maths, not an authored sink or lift. */
const HEIGHT_OFFSET_EPSILON = 0.005;

/**
 * Seats a map entity on the terrain. The layout's absolute Y is deliberately
 * ignored: height is derived from the heightfield so resculpting the ground
 * can never leave a chest floating or a statue buried. An authored
 * `heightOffset` (a rock sunk halfway in) rides on top of that, so it survives
 * a resculpt too. `groundOffset` is the entity's own origin-to-feet distance —
 * half its height for a centred box, 0 for a group modelled with its base at
 * the origin.
 */
export function applyTransform(object: THREE.Object3D, transform: MapEntityTransform, groundOffset = 0) {
    const [x, , z] = transform.position;
    object.position.set(x, seatedHeight(x, z, transform.heightOffset, groundOffset), z);
    if (transform.rotation) object.rotation.set(...transform.rotation);
    if (transform.scale) object.scale.set(...transform.scale);
}

/** Origin height of an entity standing at (x, z), raised or sunk by its authored offset. */
export function seatedHeight(x: number, z: number, heightOffset = 0, groundOffset = 0): number {
    return groundHeight(x, z) + groundOffset + heightOffset;
}

export type ReadTransform = Required<Omit<MapEntityTransform, 'heightOffset'>> & Pick<MapEntityTransform, 'heightOffset'>;

/**
 * The layout transform of a placed object, `heightOffset` measured back from
 * the ground under it (undefined when it simply stands on the ground, so the
 * exported layout only carries offsets someone actually authored).
 */
export function readTransform(object: THREE.Object3D, groundOffset = 0): ReadTransform {
    const { x, y, z } = object.position;
    const heightOffset = y - seatedHeight(x, z, 0, groundOffset);
    return {
        position: [x, y, z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z],
        heightOffset: Math.abs(heightOffset) < HEIGHT_OFFSET_EPSILON ? undefined : heightOffset,
    };
}
