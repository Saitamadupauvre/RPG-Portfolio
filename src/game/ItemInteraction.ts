import * as THREE from 'three';
import type { Experience } from './Experience';
import { stateMachine } from '../core/StateMachine';
import { events } from '../core/events';

export class ItemInteraction {
    private experience: Experience;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();

    constructor(experience: Experience) {
        this.experience = experience;
        this.experience.canvas.addEventListener('click', (event) => this.onClick(event));
    }

    private onClick(event: MouseEvent) {
        if (stateMachine.getState() !== 'GAME') return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.experience.camera);
        const meshes = this.experience.world.items.map(({ entity }) => entity.mesh);
        const hits = this.raycaster.intersectObjects(meshes);
        if (hits.length === 0) return;

        const hit = this.experience.world.items.find(({ entity }) => entity.mesh === hits[0].object);
        if (hit) events.emit('itemCollected', hit.source);
    }
}
