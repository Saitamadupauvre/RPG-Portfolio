import * as THREE from 'three';
import type { AnimatorComponent } from '../../animation/AnimatorComponent';
import type { AttackComponent } from './AttackComponent';
import type { ComboComponent } from './ComboComponent';

/**
 * Plays a ComboComponent's moves on an animator whose graph follows the combo convention:
 * a `move` float picking the attack state, an `attack` trigger entering it, an `attacking` bool
 * held while the body is busy, and attack states with `swingStart`/`swingEnd` markers.
 * Shared by the player and the soldier, so both swing by the same rules.
 *
 * Combat owns the timings, so the attack clip is scrubbed onto them rather than played:
 * windup onto 0..swingStart, the live hitbox onto swingStart..swingEnd, recovery onto the
 * rest. Blade and hitbox cannot drift apart however a move is tuned.
 */
export class ComboPlayback {
    private animator: AnimatorComponent;
    private combo: ComboComponent;
    private attack: AttackComponent;
    private layer: string;
    private seenMoves: number;

    constructor(animator: AnimatorComponent, combo: ComboComponent, attack: AttackComponent, layer = 'base') {
        this.animator = animator;
        this.combo = combo;
        this.attack = attack;
        this.layer = layer;
        this.seenMoves = combo.moveCount;
    }

    /** Forgets the moves seen so far, so a reset combo does not replay its last one. */
    public reset() {
        this.seenMoves = this.combo.moveCount;
    }

    /** Sets the attack parameters and scrubs the clip. Returns whether an attack occupies the body. */
    public update(): boolean {
        // A new move is the "attack pressed" edge the trigger stands for. Counted rather than
        // read off the windup phase: on a long frame the whole windup can elapse between two
        // updates, and a phase edge would miss it.
        if (this.combo.moveCount !== this.seenMoves) {
            this.seenMoves = this.combo.moveCount;
            this.animator.setFloat('move', this.combo.moveIndex);
            this.animator.setTrigger('attack');
        }

        const windup = this.combo.windupProgress;
        const swing = this.attack.swingProgress;
        const recovery = this.combo.recoveryProgress;
        const attacking = windup != null || swing != null || recovery != null;
        this.animator.setBool('attacking', attacking);
        if (attacking) this.scrub(windup, swing, recovery);
        return attacking;
    }

    /** Maps the combat phase onto the current attack clip's markers. */
    private scrub(windup: number | null, swing: number | null, recovery: number | null) {
        const markers = this.animator.getStateDefinition(this.layer).markers;
        const duration = this.animator.getClipDuration(this.layer);
        // No markers = the layer is still in idle/walk (the trigger frame) — not ours to scrub.
        // No duration = the model has not loaded yet.
        if (!markers || duration == null) return;

        const start = markers.swingStart ?? duration / 3;
        const end = markers.swingEnd ?? (duration * 2) / 3;

        let time: number;
        if (windup != null) time = THREE.MathUtils.lerp(0, start, windup);
        else if (swing != null) time = THREE.MathUtils.lerp(start, end, swing);
        else time = THREE.MathUtils.lerp(end, duration, recovery ?? 1);

        this.animator.setTime(this.layer, time);
    }
}
