import * as THREE from 'three';
import type { Experience } from './Experience';
import { stateMachine } from '../core/StateMachine';
import type { DoorTarget } from './world/Menu';

export class MenuInteraction {
    private experience: Experience;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();

    constructor(experience: Experience) {
        this.experience = experience;
        this.experience.canvas.addEventListener('click', (event) => this.onClick(event));
    }

    private onClick(event: MouseEvent) {
        if (stateMachine.getState() !== 'MENU') return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.experience.camera);
        const hits = this.raycaster.intersectObjects(this.experience.world.menu.doors);
        if (hits.length === 0) return;

        const target = hits[0].object.userData.doorTarget as DoorTarget;
        stateMachine.changeState(target);
    }
}
