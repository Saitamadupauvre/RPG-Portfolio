import * as THREE from 'three';
import type { PropEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';

// Base box is 1 x height x 1; `scale` in map data does all the sizing, so the scale gizmo
// and the nav grid read the same numbers.
export const PROP_BASE_HEIGHT = { collidable: 2, decor: 0.7 };

export function createProp(entity: PropEntity): Entity {
    const height = entity.collidable ? PROP_BASE_HEIGHT.collidable : PROP_BASE_HEIGHT.decor;
    const geometry = new THREE.BoxGeometry(1, height, 1);
    const material = new THREE.MeshStandardMaterial({ color: entity.collidable ? 0x666666 : 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity);

    return new Entity(entity.id, mesh);
}
