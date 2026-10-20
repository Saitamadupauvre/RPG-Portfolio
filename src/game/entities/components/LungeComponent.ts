import * as THREE from 'three';
import type { AttackComponent, AttackHitboxOptions } from './AttackComponent';
import type { EnemyAttacker } from './EnemyAttacker';
import { hasClearLine, slideMove } from '../movement';

export interface LungeOptions {
    /** Distance to the player at which the lunge starts preparing. */
    range: number;
    /** Seconds spent crouched before dashing: the tell the player dodges on. */
    prepare: number;
    speed: number;
    /** How far the dash travels if nothing stops it. */
    distance: number;
    /** Seconds standing still after the dash: the punish window. */
    recovery: number;
    /** Seconds between the end of one lunge and the start of the next. */
    cooldown: number;
    hit?: AttackHitboxOptions;
}

export type LungeState = 'idle' | 'prepare' | 'dash' | 'recover';

/** A dash step that covers less than this share of its length ran into something. */
const BLOCKED_RATIO = 0.3;

/**
 * Prepare, then dash in a straight line through where the player stood when
 * the prepare ended. The hitbox rides along with the body for the whole dash.
 * Gameplay owns every timing; LungeAnimationDriver scrubs the goblin's Lunge
 * clip (crouch and tremble, leap, skid) to `state`/`progress`.
 */
export class LungeComponent implements EnemyAttacker {
    public readonly name = 'lunge';

    private mesh: THREE.Object3D;
    private target: THREE.Object3D;
    private attack: AttackComponent;
    private options: LungeOptions;

    private current: LungeState = 'idle';
    private timer = 0;
    private cooldown = 0;
    private travelled = 0;
    private direction = new THREE.Vector3();
    private aimPoint = new THREE.Vector3();
    private before = new THREE.Vector3();

    constructor(mesh: THREE.Object3D, target: THREE.Object3D, attack: AttackComponent, options: LungeOptions) {
        this.mesh = mesh;
        this.target = target;
        this.attack = attack;
        this.options = options;
    }

    public get state(): LungeState {
        return this.current;
    }

    /** 0..1 through the current state (0 when idle). */
    public get progress(): number {
        switch (this.current) {
            case 'idle':
                return 0;
            case 'prepare':
                return 1 - Math.max(0, this.timer) / this.options.prepare;
            case 'dash':
                return Math.min(1, this.travelled / this.options.distance);
            case 'recover':
                return 1 - Math.max(0, this.timer) / this.options.recovery;
        }
    }

    /** True only while the body is flying; drives the dash trail. */
    public get isDashing(): boolean {
        return this.current === 'dash';
    }

    public engage(target: THREE.Vector3, distance: number): boolean {
        if (this.current !== 'idle') return true;
        if (this.cooldown > 0 || distance > this.options.range) return false;
        // Behind a rock or across a cliff: keep chasing around it instead of
        // crouching for a dash that would stop dead against the obstacle.
        if (!this.hasLineTo(target)) return false;

        this.current = 'prepare';
        this.timer = this.options.prepare;
        return true;
    }

    public reset() {
        this.current = 'idle';
        this.timer = 0;
        this.cooldown = 0;
        this.attack.reset();
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown -= dt;

        switch (this.current) {
            case 'idle':
                return;
            case 'prepare':
                this.updatePrepare(dt);
                return;
            case 'dash':
                this.updateDash(dt);
                return;
            case 'recover':
                this.updateRecover(dt);
                return;
        }
    }

    private updatePrepare(dt: number) {
        this.timer -= dt;
        // Keeps tracking the player while crouched; the aim locks only on release.
        this.attack.face(this.target.position);

        if (this.timer <= 0) this.startDash();
    }

    private hasLineTo(target: THREE.Vector3): boolean {
        const { x, z } = this.mesh.position;
        return hasClearLine(x, z, target.x, target.z);
    }

    private startDash() {
        // The player ducked behind cover during the prepare: stand down, no cooldown,
        // so the next clear look starts a fresh lunge.
        if (!this.hasLineTo(this.target.position)) {
            this.current = 'idle';
            return;
        }

        this.direction.subVectors(this.target.position, this.mesh.position).setY(0);
        if (this.direction.lengthSq() === 0) this.direction.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
        this.direction.normalize();
        this.aimPoint.copy(this.mesh.position).add(this.direction);

        this.current = 'dash';
        this.travelled = 0;
        this.attack.trigger(this.aimPoint, {
            ...this.options.hit,
            duration: this.options.distance / this.options.speed,
            follow: true,
        });
    }

    private updateDash(dt: number) {
        const step = Math.min(this.options.speed * dt, this.options.distance - this.travelled);
        this.before.copy(this.mesh.position);
        slideMove(this.mesh, this.direction, step);

        const moved = this.before.setY(this.mesh.position.y).distanceTo(this.mesh.position);
        this.travelled += step;

        const blocked = step > 0 && moved < step * BLOCKED_RATIO;
        if (blocked || this.travelled >= this.options.distance) {
            // A dash cut short by a wall must not leave a live hitbox hanging there.
            this.attack.reset();
            this.current = 'recover';
            this.timer = this.options.recovery;
        }
    }

    private updateRecover(dt: number) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.current = 'idle';
            this.cooldown = this.options.cooldown;
        }
    }
}
