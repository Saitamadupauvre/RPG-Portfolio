import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { AttackComponent, AttackHitboxOptions } from './AttackComponent';

export interface ComboMove {
    // Hitbox/damage for this step. Falls back to the AttackComponent's own defaults for any field omitted.
    options?: AttackHitboxOptions;
    // Seconds after this move ends before the combo can advance to the next one.
    recovery?: number;
    // Telegraph time before the hitbox actually spawns — gives the target a window to dodge.
    windup?: number;
}

const DEFAULT_WINDUP = 0.4;

interface PendingMove {
    aimPoint: THREE.Vector3;
    move: ComboMove;
    timer: number;
}

// Drives an AttackComponent through an ordered move list, advancing one step per trigger()
// call and resetting to the start after resetWindow seconds of inactivity. Extending a
// pattern is just appending to `moves` — no branching logic to touch. Each trigger() first
// faces + telegraphs (windup), then actually fires the hitbox once the windup elapses.
export class ComboComponent implements Component {
    public readonly name = 'combo';

    private attack: AttackComponent;
    private moves: ComboMove[];
    private resetWindow: number;

    private index = 0;
    private idleTime = 0;
    private recoveryTimer = 0;
    private pending: PendingMove | null = null;

    constructor(attack: AttackComponent, moves: ComboMove[], resetWindow = 1.2) {
        this.attack = attack;
        this.moves = moves;
        this.resetWindow = resetWindow;
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
        return true;
    }

    public update(dt: number) {
        if (this.recoveryTimer > 0) this.recoveryTimer -= dt;

        if (this.pending) {
            this.pending.timer -= dt;
            if (this.pending.timer <= 0) {
                const { aimPoint, move } = this.pending;
                this.pending = null;
                this.attack.trigger(aimPoint, move.options ?? {});
                this.recoveryTimer = move.recovery ?? 0;
            }
            return;
        }

        if (this.attack.isAttacking) return;

        this.idleTime += dt;
        if (this.idleTime >= this.resetWindow) this.index = 0;
    }
}
