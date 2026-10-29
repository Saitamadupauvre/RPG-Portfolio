import * as THREE from 'three';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { LungeComponent } from './LungeComponent';
import { GroundSpeed, type AnimationDriver } from './AnimationDriver';

const LAYER = 'base';
/** Ground speed above which the goblin counts as walking rather than standing. */
const WALKING_SPEED = 0.3;

/**
 * The goblin's bridge from gameplay to its animator. Walks on measured ground speed; the Lunge
 * clip is scrubbed to LungeComponent's phases (see goblinAnimation.ts), so the leap leaves the
 * ground on the very frame the dash starts however prepare, speed or distance are tuned.
 *
 * Must update after the AI, which moves and lunges, and before the animator.
 */
export class LungeAnimationDriver implements AnimationDriver {
    public readonly name = 'animationDriver';

    private animator: AnimatorComponent;
    private lunge: LungeComponent;
    private groundSpeed: GroundSpeed;

    constructor(animator: AnimatorComponent, body: THREE.Object3D, lunge: LungeComponent) {
        this.animator = animator;
        this.lunge = lunge;
        this.groundSpeed = new GroundSpeed(body);
    }

    public reset() {
        this.groundSpeed.reset();
        this.animator.play('idle', { crossfade: 0 });
    }

    public update(dt: number) {
        if (dt <= 0) return;

        const speed = this.groundSpeed.sample(dt);
        const state = this.lunge.state;
        this.animator.setBool('moving', state === 'idle' && speed > WALKING_SPEED);
        this.animator.setBool('lunging', state !== 'idle');
        this.scrub();
    }

    /** On the frame `lunging` first goes up the layer is still in idle or walk: nothing to scrub yet. */
    private scrub() {
        const duration = this.animator.getClipDuration(LAYER);
        if (duration == null || this.animator.getState(LAYER) !== 'lunge') return;

        const markers = this.animator.getStateDefinition(LAYER).markers;
        const dash = markers?.dash ?? duration / 3;
        const recover = markers?.recover ?? duration / 2;
        const progress = this.lunge.progress;
        const { lerp } = THREE.MathUtils;

        switch (this.lunge.state) {
            case 'prepare':
                this.animator.setTime(LAYER, lerp(0, dash, progress));
                return;
            case 'dash':
                this.animator.setTime(LAYER, lerp(dash, recover, progress));
                return;
            case 'recover':
                this.animator.setTime(LAYER, lerp(recover, duration, progress));
                return;
            case 'idle':
                return;
        }
    }
}
