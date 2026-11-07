import * as THREE from 'three';
import type { ItemEntity } from '@data/map/MapEntity';
import { Entity } from '@game/entities/Entity';
import { applyTransform } from '@game/entities/applyTransform';
import { createLitMaterial } from '@game/render/materials/materials';
import { PALETTE } from '@game/render/materials/palette';

const ITEM_RADIUS = 0.3;

export function createItem(entity: ItemEntity): Entity {
    const geometry = new THREE.SphereGeometry(ITEM_RADIUS, 12, 12);
    const material = createLitMaterial({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity, ITEM_RADIUS);

    const item = new Entity(entity.id, mesh);
    // The sphere is centred, so its bottom sits a radius below the origin; the editor reads heights back through this.
    item.groundOffset = ITEM_RADIUS;
    return item;
}
