import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { AttackComponent, AttackHitboxOptions } from './AttackComponent';

export interface ComboMove {
    options?: AttackHitboxOptions;

    recovery?: number;

    windup?: number;
}

const DEFAULT_WINDUP = 0.4;

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
