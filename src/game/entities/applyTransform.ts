import type * as THREE from 'three';
import type { MapEntityTransform } from '../../data/MapEntity';

// Single place where map-data transforms are pushed onto a mesh, so every factory
// (and the editor's live rebuilds) treat position/rotation/scale identically.
export function applyTransform(object: THREE.Object3D, transform: MapEntityTransform) {
    object.position.set(...transform.position);
    if (transform.rotation) object.rotation.set(...transform.rotation);
    if (transform.scale) object.scale.set(...transform.scale);
}

// Inverse direction: read a mesh the editor's gizmo just moved back into map data.
export function readTransform(object: THREE.Object3D): Required<MapEntityTransform> {
    return {
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z],
    };
}
