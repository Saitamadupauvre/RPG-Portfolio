import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { slideMove } from '../movement';
import type { MoveAction } from '../../../data/settings';
import { ARROW_KEYS } from '../../../domain/input';
import { keyFor } from '../../../domain/settings';

export class MovementComponent implements Component {
    public readonly name = 'movement';

    private keys = new Set<string>();
    private forward: THREE.Vector3;
    private right: THREE.Vector3;
    private mesh: THREE.Object3D;
    private speed: number;
    private facingAngle = 0;
    private locked = false;
    /** Who is holding the body still right now. A set, so a dash ending mid-attack cannot unfreeze the attack. */
    private frozenBy = new Set<string>();
    private turnSpeed: number;
    /** Scratch vector: getInputDirection runs every frame, so it must not allocate. */
    private moveDirection = new THREE.Vector3();

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

    /** Walking speed in units/s (Agility), whether or not the body is moving right now. */
    public get moveSpeed(): number {
        return this.speed;
    }

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

    /** Stops translation (input and facing still update) until every reason has been lifted. */
    public freeze(reason: string) {
        this.frozenBy.add(reason);
    }

    public unfreeze(reason: string) {
        this.frozenBy.delete(reason);
    }

    /** The move's bound key, read every frame so a rebind applies at once, or its arrow. */
    private isDown(move: MoveAction): boolean {
        return this.keys.has(keyFor(move)) || this.keys.has(ARROW_KEYS[move]);
    }

    /**
     * Returns a shared vector, not a fresh one — copy it if you need to keep it.
     * The next call overwrites it.
     */
    public getInputDirection(): THREE.Vector3 | null {
        this.moveDirection.set(0, 0, 0);
        if (this.isDown('up')) this.moveDirection.add(this.forward);
        if (this.isDown('down')) this.moveDirection.sub(this.forward);
        if (this.isDown('right')) this.moveDirection.add(this.right);
        if (this.isDown('left')) this.moveDirection.sub(this.right);

        return this.moveDirection.lengthSq() > 0 ? this.moveDirection.normalize() : null;
    }

    public isMoving(): boolean {
        return this.getInputDirection() !== null;
    }

    public update(dt: number) {
        const move = this.getInputDirection();
        if (!move) return;

        this.facingAngle = Math.atan2(move.x, move.z);
        if (this.frozenBy.size === 0) slideMove(this.mesh, move, this.speed * dt);
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
