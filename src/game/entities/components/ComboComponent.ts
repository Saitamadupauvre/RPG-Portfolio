import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { AttackComponent, AttackHitboxOptions } from './AttackComponent';

export interface ComboMove {
    options?: AttackHitboxOptions;

    recovery?: number;

    windup?: number;
}

const DEFAULT_WINDUP = 0.4;

export interface ComboHooks {
    /** Fires when the combo starts occupying the body (windup, swing, recovery) and again when it is free. */
    onBusyChanged?: (busy: boolean) => void;
}

interface PendingMove {
    aimPoint: THREE.Vector3;
    move: ComboMove;
    timer: number;
}

export class ComboComponent implements Component {
    public readonly name = 'combo';

    private attack: AttackComponent;
    private moves: ComboMove[];
    private resetWindow: number;
    private hooks: ComboHooks;
    private wasBusy = false;

    private index = 0;
    /** Bumped on every accepted trigger, so a listener polling once per frame cannot miss a move that started and finished between two polls. */
    private triggeredMoves = 0;
    private idleTime = 0;
    private recoveryTimer = 0;
    /** Recovery left once the swing itself has ended — the part the animation can show as a settle. */
    private recoveryTail = 0;
    private pending: PendingMove | null = null;

    constructor(attack: AttackComponent, moves: ComboMove[], hooks: ComboHooks = {}, resetWindow = 1.2) {
        this.attack = attack;
        this.moves = moves;
        this.hooks = hooks;
        this.resetWindow = resetWindow;
    }

    /** 0..1 progress through the current windup, or null when no swing is charging. */
    public get windupProgress(): number | null {
        if (!this.pending) return null;
        const total = this.pending.move.windup ?? DEFAULT_WINDUP;
        return total <= 0 ? 1 : 1 - Math.max(0, this.pending.timer) / total;
    }

    /**
     * 0..1 through the post-swing recovery, or null outside it. Recovery starts counting when the
     * swing starts, so only the slice that outlasts the hitbox is reported — a move whose recovery
     * is shorter than its swing never reports one.
     */
    public get recoveryProgress(): number | null {
        if (this.pending || this.attack.isAttacking || this.recoveryTimer <= 0 || this.recoveryTail <= 0) return null;
        return 1 - Math.min(1, this.recoveryTimer / this.recoveryTail);
    }

    /** Number of moves triggered so far; compare against the last value seen to detect a new one. */
    public get moveCount(): number {
        return this.triggeredMoves;
    }

    /** Index of the move currently charging or last fired — lets the animator mirror alternating swings. */
    public get moveIndex(): number {
        return (this.index - 1 + this.moves.length) % this.moves.length;
    }

    public get canTrigger(): boolean {
        return this.recoveryTimer <= 0 && !this.pending && !this.attack.isAttacking;
    }

    public trigger(aimPoint: THREE.Vector3): boolean {
        if (!this.canTrigger) return false;

        const move = this.moves[this.index];
        this.attack.face(aimPoint);
        this.pending = { aimPoint: aimPoint.clone(), move, timer: move.windup ?? DEFAULT_WINDUP };
        this.idleTime = 0;
        this.index = (this.index + 1) % this.moves.length;
        this.triggeredMoves++;
        return true;
    }

    public update(dt: number) {
        if (this.recoveryTimer > 0) this.recoveryTimer -= dt;
        this.step(dt);

        const busy = !this.canTrigger;
        if (busy !== this.wasBusy) {
            this.wasBusy = busy;
            this.hooks.onBusyChanged?.(busy);
        }
    }

    private step(dt: number) {
        if (this.pending) {
            this.pending.timer -= dt;
            if (this.pending.timer <= 0) {
                const { aimPoint, move } = this.pending;
                this.pending = null;
                this.attack.trigger(aimPoint, move.options ?? {});
                this.recoveryTimer = move.recovery ?? 0;
                this.recoveryTail = Math.max(0, this.recoveryTimer - this.attack.swingDuration);
            }
            return;
        }

        if (this.attack.isAttacking) return;

        this.idleTime += dt;
        if (this.idleTime >= this.resetWindow) this.index = 0;
    }
}
