import * as THREE from 'three';
import type { ItemEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { createToonMaterial } from '../render/toon';

const ITEM_RADIUS = 0.3;

export function createItem(entity: ItemEntity): Entity {
    const geometry = new THREE.SphereGeometry(ITEM_RADIUS, 12, 12);
    const material = createToonMaterial({ color: 0x44ccff, emissive: 0x116688, emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity, ITEM_RADIUS);

    return new Entity(entity.id, mesh);
}
