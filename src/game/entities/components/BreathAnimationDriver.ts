import * as THREE from 'three';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { BreathComponent, BreathState } from './BreathComponent';
import { GroundSpeed, type AnimationDriver } from './AnimationDriver';
import { RUN_CLIP_SPEED } from '../dragonAnimation';

const LAYER = 'base';
/** Ground speed above which the dragon counts as running rather than standing. */
const MOVING_SPEED = 0.3;
/** Bounds on the run's playback rate: a shove from the player can make one frame's speed read anything. */
const MIN_RUN_RATE = 0.4;
const MAX_RUN_RATE = 1.6;

/**
 * The fox dragon's bridge from gameplay to its animator, like ArcherAnimationDriver for the
 * archer. Running is read off how far the body really moved, and played at that speed
 * (`runRate`); Breath is scrubbed to BreathComponent's progress (see dragonAnimation.ts), so
 * the jaw opens exactly when the fire starts.
 *
 * Must update after the AI, which moves and breathes, and before the animator.
 */
export class BreathAnimationDriver implements AnimationDriver {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private breath: BreathComponent;
    private groundSpeed: GroundSpeed;

    constructor(animator: AnimatorComponent, body: THREE.Object3D, breath: BreathComponent) {
        this.animator = animator;
        this.breath = breath;
        this.groundSpeed = new GroundSpeed(body);
    }

    /** Snaps back to standing: a pooled or rested dragon must not come back mid-breath. */
    public reset() {
        this.groundSpeed.reset();
        this.animator.play('idle', { crossfade: 0 });
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const speed = this.groundSpeed.sample(dt);
        const state = this.breath.state;
        const moving = state === 'idle' && speed > MOVING_SPEED;
        this.animator.setBool('moving', moving);
        // Kept as it was while it stops, so the last stride does not lurch as it blends out.
        if (moving) this.animator.setFloat('runRate', THREE.MathUtils.clamp(speed / RUN_CLIP_SPEED, MIN_RUN_RATE, MAX_RUN_RATE));
        this.animator.setBool('breathing', state !== 'idle');
        this.scrub(state);
    }

    /** Sets the clip time of Breath; nothing to scrub until the layer has entered it. */
    private scrub(state: BreathState) {
        if (state === 'idle' || this.animator.getState(LAYER) !== 'breath') return;
        const duration = this.animator.getClipDuration(LAYER);
        if (duration == null) return;

        const markers = this.animator.getStateDefinition(LAYER).markers;
        const fire = markers?.fire ?? duration / 3;
        const stop = markers?.stop ?? (2 * duration) / 3;
        const [start, end] = state === 'windup' ? [0, fire] : state === 'breathe' ? [fire, stop] : [stop, duration];
        this.animator.setTime(LAYER, THREE.MathUtils.lerp(start, end, this.breath.progress));
    }
}
