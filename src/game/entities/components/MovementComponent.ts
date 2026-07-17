import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

export class MovementComponent implements Component {
    public readonly name = 'movement';

    private keys = new Set<string>();
    private forward: THREE.Vector3;
    private right: THREE.Vector3;
    private mesh: THREE.Object3D;
    private speed: number;

    constructor(mesh: THREE.Object3D, cameraOffset: THREE.Vector3, speed: number) {
        this.mesh = mesh;
        this.speed = speed;
        this.forward = new THREE.Vector3(-cameraOffset.x, 0, -cameraOffset.z).normalize();
        this.right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);

        window.addEventListener('keydown', (e) => this.keys.add(e.code));
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    }

    public update(dt: number) {
        const move = new THREE.Vector3();
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(this.forward);
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(this.forward);
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(this.right);
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(this.right);

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.speed * dt);
            this.mesh.position.add(move);
        }
    }
}
