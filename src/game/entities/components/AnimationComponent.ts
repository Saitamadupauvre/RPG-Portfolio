import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { MovementComponent } from './MovementComponent';

const IDLE_BREATHE_SPEED = 2.2;
const IDLE_BREATHE_AMOUNT = 0.04;
const WALK_BOB_SPEED = 10;
const WALK_BOB_AMOUNT = 0.08;
const WALK_SQUASH_AMOUNT = 0.05;

/** Idle breathing / walk bob, applied to a visual child group so it never distorts collision or hitboxes on the root. */
export class AnimationComponent implements Component {
    public readonly name = 'animation';

    private visual: THREE.Object3D;
    private movement: MovementComponent;
    private time = 0;

    constructor(visual: THREE.Object3D, movement: MovementComponent) {
        this.visual = visual;
        this.movement = movement;
    }

    public update(dt: number) {
        this.time += dt;

        if (this.movement.isMoving()) {
            const bob = Math.sin(this.time * WALK_BOB_SPEED);
            this.visual.position.y = bob * WALK_BOB_AMOUNT;
            this.visual.scale.y = 1 - Math.abs(bob) * WALK_SQUASH_AMOUNT;
        } else {
            this.visual.position.y = 0;
            this.visual.scale.y = 1 + Math.sin(this.time * IDLE_BREATHE_SPEED) * IDLE_BREATHE_AMOUNT;
        }
    }
}
