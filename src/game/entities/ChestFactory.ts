import * as THREE from 'three';
import type { ChestEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { applyTransform } from './applyTransform';

const chestColor: Record<ChestEntity['chestTier'], number> = {
    wood: 0x8b5a2b,
    silver: 0xc0c0c0,
    gold: 0xffd700,
};

export function createChest(entity: ChestEntity): Entity {
    const geometry = new THREE.BoxGeometry(0.8, 0.6, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: chestColor[entity.chestTier] });
    const mesh = new THREE.Mesh(geometry, material);

    applyTransform(mesh, entity);

    return new Entity(entity.id, mesh);
}
