import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { ShootComponent, ShootState } from './ShootComponent';

const LAYER = 'base';
/** Ground speed above which the archer counts as walking rather than standing. */
const WALKING_SPEED = 0.3;

/**
 * The archer's bridge from gameplay to its animator, like PlayerAnimationDriver for the player.
 * Walking is read off how far the body really moved, so a path blocked by a wall does not
 * leave the skeleton waddling on the spot. Shoot and Hop are scrubbed to ShootComponent's
 * progress (see archerAnimation.ts), so the clips can never drift from the gameplay timings.
 *
 * Must update after the AI, which moves and shoots, and before the animator.
 */
export class ArcherAnimationDriver implements Component {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private body: THREE.Object3D;
    private shooter: ShootComponent;
    private last = new THREE.Vector3();
    private hasLast = false;

    constructor(animator: AnimatorComponent, body: THREE.Object3D, shooter: ShootComponent) {
        this.animator = animator;
        this.body = body;
        this.shooter = shooter;
    }

    /** Snaps back to standing: a pooled or rested archer must not come back mid-shot. */
    public reset() {
        this.hasLast = false;
        this.animator.play('idle', { crossfade: 0 });
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const { x, z } = this.body.position;
        const speed = this.hasLast ? Math.hypot(x - this.last.x, z - this.last.z) / dt : 0;
        this.last.copy(this.body.position);
        this.hasLast = true;

        const state = this.shooter.state;
        this.animator.setBool('moving', state === 'idle' && speed > WALKING_SPEED);
        this.animator.setBool('shooting', state === 'draw' || state === 'recover');
        this.animator.setBool('hopping', state === 'hop');
        this.scrub(state);
    }

    /**
     * Sets the clip time of the state being scrubbed. On the frame a flag first goes up the
     * layer is still in idle or walk (the transition happens in the animator's update),
     * so there is nothing to scrub until the next one.
     */
    private scrub(state: ShootState) {
        const duration = this.animator.getClipDuration(LAYER);
        if (duration == null) return;

        const current = this.animator.getState(LAYER);
        const progress = this.shooter.progress;
        if (current === 'shoot' && (state === 'draw' || state === 'recover')) {
            const release = this.animator.getStateDefinition(LAYER).markers?.release ?? duration / 2;
            this.animator.setTime(LAYER, state === 'draw'
                ? THREE.MathUtils.lerp(0, release, progress)
                : THREE.MathUtils.lerp(release, duration, progress));
        } else if (current === 'hop' && state === 'hop') {
            this.animator.setTime(LAYER, progress * duration);
        }
    }
}
