import * as THREE from 'three';
import type { EnemyEntity } from '../../data/MapEntity';
import { Entity } from './Entity';
import { HealthComponent } from '../../domain/components/HealthComponent';

const enemyLook: Record<EnemyEntity['enemyType'], { size: number; color: number; hp: number }> = {
    grunt: { size: 0.6, color: 0x33aa33, hp: 20 },
    elite: { size: 0.9, color: 0xdd8822, hp: 50 },
    boss: { size: 1.4, color: 0xcc2222, hp: 200 },
};

export function createEnemy(entity: EnemyEntity): Entity {
    const { size, color, hp } = enemyLook[entity.enemyType];
    const geometry = new THREE.BoxGeometry(size, size * 1.6, size);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(...entity.position);
    if (entity.rotationY) mesh.rotation.y = entity.rotationY;

    return new Entity(entity.id, mesh).addComponent('health', new HealthComponent(hp));
}
