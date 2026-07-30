import * as THREE from 'three';
import type { PropEntity } from '../../data/MapEntity';
import { Entity } from './Entity';

export function createProp(entity: PropEntity): Entity {
    const [width, depth] = entity.size ?? [0.7, 0.7];
    const height = entity.collidable ? 2 : 0.7;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ color: entity.collidable ? 0x666666 : 0x888888 });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...entity.position);
    if (entity.rotationY) mesh.rotation.y = entity.rotationY;

    return new Entity(entity.id, mesh);
}
