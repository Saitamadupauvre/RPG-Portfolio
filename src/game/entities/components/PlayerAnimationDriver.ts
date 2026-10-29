import * as THREE from 'three';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { MovementComponent } from './MovementComponent';
import type { DashComponent } from './DashComponent';
import type { AttackComponent } from './AttackComponent';
import type { ComboComponent } from './ComboComponent';
import type { AnimationDriver } from './AnimationDriver';
import { ComboPlayback } from './ComboPlayback';

/** Ground speed the Walk clip was animated for (the base Agility): faster than that, it plays faster. */
const WALK_CLIP_SPEED = 4;

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
 * The player's bridge from gameplay to its animator. Reads the movement, dash and combat
 * components and turns them into parameters; attacks go through ComboPlayback, which scrubs
 * the attack clip to the combo's own timings.
 *
 * Must update before the animator (component order) so its parameters land the same frame.
 */
export class PlayerAnimationDriver implements AnimationDriver {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private visual: THREE.Object3D;
    private movement: MovementComponent;
    private sources: PlayerAnimationSources;
    private playback: ComboPlayback;

    private bank = 0;
    private previousYaw: number;

    constructor(animator: AnimatorComponent, visual: THREE.Object3D, movement: MovementComponent, sources: PlayerAnimationSources) {
        this.animator = animator;
        this.visual = visual;
        this.movement = movement;
        this.sources = sources;
        this.playback = new ComboPlayback(animator, sources.combo, sources.attack);
        this.previousYaw = visual.parent?.rotation.y ?? 0;
    }

    public reset() {
        this.playback.reset();
        this.bank = 0;
        this.visual.rotation.z = 0;
        this.previousYaw = this.visual.parent?.rotation.y ?? 0;
        this.animator.play('idle', { crossfade: 0 });
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const moving = this.movement.isMoving();
        this.animator.setBool('moving', moving);
        this.animator.setBool('dashing', this.sources.dash.isDashing);
        // Agility makes the knight faster; the waddle quickens with it instead of skating.
        this.animator.setFloat('walkRate', this.movement.moveSpeed / WALK_CLIP_SPEED);
        this.playback.update();

        this.updateBank(dt, moving);
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
