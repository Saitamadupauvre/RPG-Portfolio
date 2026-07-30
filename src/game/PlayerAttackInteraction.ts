import * as THREE from 'three';
import type { Experience } from './Experience';
import { stateMachine } from '../core/StateMachine';
import type { AttackComponent } from './entities/components/AttackComponent';

// Left-click aims + attacks toward the mouse position, raycast onto the ground plane at player height.
export class PlayerAttackInteraction {
    private experience: Experience;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    constructor(experience: Experience) {
        this.experience = experience;
        this.experience.canvas.addEventListener('click', (event) => this.onAttack(event));
    }

    private onAttack(event: MouseEvent) {
        if (stateMachine.getState() !== 'GAME') return;

        const player = this.experience.world.player;
        const attack = player.getComponent<AttackComponent>('attack');
        if (!attack) return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.experience.camera);
        this.groundPlane.constant = -player.mesh.position.y;

        const target = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, target)) return;

        attack.trigger(target);
    }
}
