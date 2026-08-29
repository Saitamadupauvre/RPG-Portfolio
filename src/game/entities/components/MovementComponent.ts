import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { slideMove } from '../movement';

export class MovementComponent implements Component {
    public readonly name = 'movement';

    private keys = new Set<string>();
    private forward: THREE.Vector3;
    private right: THREE.Vector3;
    private mesh: THREE.Object3D;
    private speed: number;
    private facingAngle = 0;
    private locked = false;
    private frozen = false;
    private turnSpeed: number;

    constructor(mesh: THREE.Object3D, cameraOffset: THREE.Vector3, speed: number, turnSpeed = Math.PI * 10) {
        this.mesh = mesh;
        this.speed = speed;
        this.turnSpeed = turnSpeed;
        this.forward = new THREE.Vector3(-cameraOffset.x, 0, -cameraOffset.z).normalize();
        this.right = new THREE.Vector3(-this.forward.z, 0, this.forward.x);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);

        window.addEventListener('blur', this.clearInput);
    }

    private onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
    private onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);

    public setSpeed(speed: number) {
        this.speed = speed;
    }

    public clearInput = () => {
        this.keys.clear();
    };

    public dispose() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.clearInput);
    }

    public setLocked(locked: boolean) {
        this.locked = locked;
    }

    public setFrozen(frozen: boolean) {
        this.frozen = frozen;
    }

    public getInputDirection(): THREE.Vector3 | null {
        const move = new THREE.Vector3();
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(this.forward);
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(this.forward);
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(this.right);
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(this.right);

        return move.lengthSq() > 0 ? move.normalize() : null;
    }

    public isMoving(): boolean {
        return this.getInputDirection() !== null;
    }

    public update(dt: number) {
        const move = this.getInputDirection();
        if (!move) return;

        this.facingAngle = Math.atan2(move.x, move.z);
        if (!this.frozen) slideMove(this.mesh, move, this.speed * dt);
        if (!this.locked) this.rotateTowards(this.facingAngle, dt);
    }

    private rotateTowards(targetAngle: number, dt: number) {
        let delta = targetAngle - this.mesh.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));

        const maxStep = this.turnSpeed * dt;
        if (Math.abs(delta) <= maxStep) {
            this.mesh.rotation.y = targetAngle;
        } else {
            this.mesh.rotation.y += Math.sign(delta) * maxStep;
        }
    }
}
