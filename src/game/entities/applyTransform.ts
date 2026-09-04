import type * as THREE from 'three';
import type { MapEntityTransform } from '../../data/MapEntity';
import { groundHeight } from '../world/terrainField';

/**
 * Seats a map entity on the terrain. The layout's Y is deliberately ignored:
 * height is derived from the heightfield so resculpting the ground can never
 * leave a chest floating or a statue buried. `groundOffset` is the entity's own
 * origin-to-feet distance — half its height for a centred box, 0 for a group
 * modelled with its base at the origin.
 */
export function applyTransform(object: THREE.Object3D, transform: MapEntityTransform, groundOffset = 0) {
    const [x, , z] = transform.position;
    object.position.set(x, groundHeight(x, z) + groundOffset, z);
    if (transform.rotation) object.rotation.set(...transform.rotation);
    if (transform.scale) object.scale.set(...transform.scale);
}

export function readTransform(object: THREE.Object3D): Required<MapEntityTransform> {
    return {
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z],
    };
}
