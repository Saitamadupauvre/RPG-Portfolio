import type * as THREE from 'three';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { AttackComponent } from './AttackComponent';
import type { ComboComponent } from './ComboComponent';
import { GroundSpeed, type AnimationDriver } from './AnimationDriver';
import { ComboPlayback } from './ComboPlayback';

/** Ground speed above which the enemy counts as walking rather than standing. */
const WALKING_SPEED = 0.3;

/**
 * The bridge for an enemy that fights with a ComboComponent (the soldier): walks on measured
 * ground speed, and swings through ComboPlayback exactly like the player, so its attack clips
 * are scrubbed to the combo's windup, hitbox and recovery.
 *
 * Must update after the AI, which moves and triggers the combo, and before the animator.
 */
export class ComboAnimationDriver implements AnimationDriver {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private groundSpeed: GroundSpeed;
    private playback: ComboPlayback;

    constructor(animator: AnimatorComponent, body: THREE.Object3D, combo: ComboComponent, attack: AttackComponent) {
        this.animator = animator;
        this.groundSpeed = new GroundSpeed(body);
        this.playback = new ComboPlayback(animator, combo, attack);
    }

    public reset() {
        this.groundSpeed.reset();
        this.playback.reset();
        this.animator.play('idle', { crossfade: 0 });
    }

    public update(dt: number) {
        if (dt <= 0) return;

        // Sampled every frame, attacking or not, so the next sample measures one frame only.
        const speed = this.groundSpeed.sample(dt);
        const attacking = this.playback.update();
        this.animator.setBool('moving', !attacking && speed > WALKING_SPEED);
    }
}
