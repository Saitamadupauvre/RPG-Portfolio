import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { MovementComponent } from './MovementComponent';
import type { DashComponent } from './DashComponent';
import type { AttackComponent } from './AttackComponent';
import type { ComboComponent } from './ComboComponent';

const LAYER = 'base';

/** Lean into turns: how much roll per radian/s of yaw change, and the cap. */
const BANK_STRENGTH = 0.055;
const BANK_MAX = 0.35;
const BANK_BLEND_RATE = 9;

export interface PlayerAnimationSources {
    dash: DashComponent;
    attack: AttackComponent;
    combo: ComboComponent;
}

/**
 * The bridge between gameplay and the animator — what a Unity script does when it calls
 * `animator.SetBool("moving", ...)` every frame. It reads the movement, dash and combat
 * components and turns them into parameters; the controller decides what that means.
 *
 * Attacks are the one place it does more than set flags: combat owns the timings, so the
 * driver scrubs the attack clip to match — windup onto 0..swingStart, hitbox onto
 * swingStart..swingEnd, recovery onto the tail. Blade and hitbox cannot drift apart.
 *
 * Must update before the animator (component order) so its parameters land the same frame.
 */
export class PlayerAnimationDriver implements Component {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private visual: THREE.Object3D;
    private movement: MovementComponent;
    private sources: PlayerAnimationSources;

    private seenMoves = 0;
    private bank = 0;
    private previousYaw: number;

    constructor(animator: AnimatorComponent, visual: THREE.Object3D, movement: MovementComponent, sources: PlayerAnimationSources) {
        this.animator = animator;
        this.visual = visual;
        this.movement = movement;
        this.sources = sources;
        this.previousYaw = visual.parent?.rotation.y ?? 0;
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const { dash, attack, combo } = this.sources;
        const moving = this.movement.isMoving();

        this.animator.setBool('moving', moving);
        this.animator.setBool('dashing', dash.isDashing);

        const windup = combo.windupProgress;
        const swing = attack.swingProgress;
        const recovery = combo.recoveryProgress;

        // A new move is the "attack pressed" edge the trigger stands for. Counted rather than
        // read off the windup phase: on a long frame the whole windup can elapse between two
        // updates, and a phase edge would miss it.
        if (combo.moveCount !== this.seenMoves) {
            this.seenMoves = combo.moveCount;
            this.animator.setFloat('move', combo.moveIndex);
            this.animator.setTrigger('attack');
        }

        const attacking = windup != null || swing != null || recovery != null;
        this.animator.setBool('attacking', attacking);
        if (attacking) this.scrubAttack(windup, swing, recovery);

        this.updateBank(dt, moving);
    }

    /** Maps the combat phase onto the current attack clip's markers. */
    private scrubAttack(windup: number | null, swing: number | null, recovery: number | null) {
        const markers = this.animator.getStateDefinition(LAYER).markers;
        const duration = this.animator.getClipDuration(LAYER);
        // No markers = the layer is still in idle/walk (the trigger frame) — not ours to scrub.
        // No duration = the model has not loaded yet.
        if (!markers || duration == null) return;

        const start = markers.swingStart ?? duration / 3;
        const end = markers.swingEnd ?? (duration * 2) / 3;

        let time: number;
        if (windup != null) time = THREE.MathUtils.lerp(0, start, windup);
        else if (swing != null) time = THREE.MathUtils.lerp(start, end, swing);
        else time = THREE.MathUtils.lerp(end, duration, recovery ?? 1);

        this.animator.setTime(LAYER, time);
    }

    /**
     * Procedural roll from how fast the root is actually turning. Written to `visual`, which no
     * clip targets, so it stacks on top of whatever the animator wrote below it this frame.
     */
    private updateBank(dt: number, moving: boolean) {
        const yaw = this.visual.parent?.rotation.y ?? 0;
        const raw = yaw - this.previousYaw;
        const delta = Math.atan2(Math.sin(raw), Math.cos(raw));
        this.previousYaw = yaw;

        const target = moving ? THREE.MathUtils.clamp((delta / dt) * BANK_STRENGTH, -BANK_MAX, BANK_MAX) : 0;
        this.bank += (target - this.bank) * (1 - Math.exp(-BANK_BLEND_RATE * dt));
        this.visual.rotation.z = this.bank;
    }
}
