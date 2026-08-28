import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { slideMove } from '../movement';
import type { MovementComponent } from './MovementComponent';

const DASH_KEY = 'Space';
const DASH_SPEED = 14;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 0.8;

export class DashComponent implements Component {
    public readonly name = 'dash';

    private mesh: THREE.Object3D;
    private movement: MovementComponent;

    private direction = new THREE.Vector3();
    private remaining = 0;
    private cooldown = 0;

    constructor(mesh: THREE.Object3D, movement: MovementComponent) {
        this.mesh = mesh;
        this.movement = movement;
        window.addEventListener('keydown', this.onKeyDown);
    }

    public get isDashing(): boolean {
        return this.remaining > 0;
    }

    private onKeyDown = (event: KeyboardEvent) => {
        if (event.code !== DASH_KEY || event.repeat) return;
        this.trigger();
    };

    public trigger() {
        if (this.cooldown > 0 || this.isDashing) return;

        const input = this.movement.getInputDirection();
        if (!input) return;

        this.direction.copy(input);
        this.remaining = DASH_DURATION;
        this.cooldown = DASH_COOLDOWN;

        this.movement.setFrozen(true);
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
        if (!this.isDashing) return;

        const step = Math.min(dt, this.remaining);
        this.remaining -= step;

        slideMove(this.mesh, this.direction, DASH_SPEED * step);

        if (!this.isDashing) this.movement.setFrozen(false);
    }

    public cancel() {
        this.remaining = 0;
        this.movement.setFrozen(false);
    }

    public dispose() {
        window.removeEventListener('keydown', this.onKeyDown);
    }
}
