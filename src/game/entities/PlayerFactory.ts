import * as THREE from 'three';
import { Entity } from './Entity';
import { MovementComponent } from './components/MovementComponent';

const PLAYER_SPEED = 4;

export function createPlayer(cameraOffset: THREE.Vector3): Entity {
    const geometry = new THREE.CapsuleGeometry(0.4, 1, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0.9, 0);

    return new Entity('player', mesh).addComponent(
        'movement',
        new MovementComponent(mesh, cameraOffset, PLAYER_SPEED),
    );
}
