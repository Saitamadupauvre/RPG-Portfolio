import * as THREE from 'three';
import type { ItemEntity } from '../../data/MapEntity';
import { Entity } from './Entity';

export function createItem(entity: ItemEntity): Entity {
    const geometry = new THREE.SphereGeometry(0.3, 12, 12);
    const material = new THREE.MeshStandardMaterial({ color: 0x44ccff });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...entity.position);

    return new Entity(entity.id, mesh);
}
