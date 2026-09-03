import * as THREE from 'three';
import type { PropEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { createToonMaterial } from '../render/toon';

export const PROP_BASE_HEIGHT = { collidable: 2, decor: 0.7 };

export function createProp(entity: PropEntity): Entity {
    const height = entity.collidable ? PROP_BASE_HEIGHT.collidable : PROP_BASE_HEIGHT.decor;
    const geometry = new THREE.BoxGeometry(1, height, 1);
    const material = createToonMaterial({ color: entity.collidable ? 0x7c6f64 : 0xa89984 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity);

    return new Entity(entity.id, mesh);
}
