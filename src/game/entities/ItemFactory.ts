import * as THREE from 'three';
import type { ItemEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';
import { createLitMaterial } from '../render/materials';
import { PALETTE } from '../render/palette';

const ITEM_RADIUS = 0.3;

export function createItem(entity: ItemEntity): Entity {
    const geometry = new THREE.SphereGeometry(ITEM_RADIUS, 12, 12);
    const material = createLitMaterial({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity, ITEM_RADIUS);

    return new Entity(entity.id, mesh);
}
