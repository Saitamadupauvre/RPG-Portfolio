import * as THREE from 'three';
import type { ItemEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { createToonMaterial } from '../render/toon';

export function createItem(entity: ItemEntity): Entity {
    const geometry = new THREE.SphereGeometry(0.3, 12, 12);
    const material = createToonMaterial({ color: 0x44ccff, emissive: 0x116688, emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity);

    return new Entity(entity.id, mesh);
}
