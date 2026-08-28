import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';
import { AttackComponent } from './components/AttackComponent';
import { HitFlashComponent } from './components/HitFlashComponent';
import { HealthComponent } from '../../domain/components/HealthComponent';
import { events } from '../../core/events';

const PLAYER_SPEED = 4;
const VISION_CUBE_OFFSET = 0.9;
const PLAYER_HP = 100;
const PLAYER_RADIUS = 0.4;

export function createPlayer(cameraOffset: THREE.Vector3, entityGroup: THREE.Group): Entity {
    const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.9, 0);

    // Marks the mesh's local forward axis so facing direction is visible at a glance.
    const visionGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const visionMaterial = new THREE.MeshStandardMaterial({ color: 0x2255ff });
    const visionCube = new THREE.Mesh(visionGeometry, visionMaterial);
    visionCube.position.set(0, 0, VISION_CUBE_OFFSET);
    mesh.add(visionCube);

    const movement = new MovementComponent(mesh, cameraOffset, PLAYER_SPEED);
    const attack = new AttackComponent(mesh, entityGroup, {}, {
        onAttackStart: () => movement.setLocked(true),
        onAttackEnd: () => movement.setLocked(false),
    });

    return new Entity('player', mesh, PLAYER_RADIUS)
        .addComponent('movement', movement)
        .addComponent('attack', attack)
        // The game layer is where a pure domain component gets bridged to the UI:
        // HealthComponent stays framework-free, the callback does the publishing.
        .addComponent('health', new HealthComponent(PLAYER_HP, (hp, maxHp) => {
            events.emit('playerHealthChanged', hp, maxHp);
        }))
        .addComponent('hitFlash', new HitFlashComponent(material));
}
