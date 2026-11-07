import * as THREE from 'three';
import type { AttackComponent } from './AttackComponent';
import type { RoamingAttacker } from './EnemyAttacker';
import { turnToward } from '../movement';
import { hasLineOfFire } from '../../ProjectileSystem';
import type { FireSystem, FlameOptions } from '../../FireSystem';

export interface BreathOptions {
    /** Starts breathing once the player is this close, if nothing stands in the line of fire. */
    range: number;
    /** Seconds rearing back and drawing breath, tracking the player: the tell. */
    windup: number;
    /** Seconds the flame pours out. */
    breathe: number;
    /** Seconds after the flame before it can move again. */
    recovery: number;
    /** Seconds between the end of one breath and the start of the next. */
    cooldown: number;
    /** How fast the flame sweeps after the player, radians per second: circling faster outruns it. */
    turnRate: number;
    /** Puffs per second while it breathes. */
    rate: number;
    /** Half-angle of the cone the puffs leave in, radians. */
    spread: number;
    flame: FlameOptions;
}

export type BreathState = 'idle' | 'windup' | 'breathe' | 'recover';

/** Mouth height above the body's centre, for the line-of-fire test and the flame before the model has loaded. */
const MOUTH_HEIGHT = 0.1;
/** How far ahead of the body's centre the stand-in mouth is. */
const MOUTH_REACH = 0.75;
/** What the flame aims at above the player's origin: the chest, not the feet. */
const AIM_HEIGHT = 0.2;

/**
 * The fox dragon's fire breath. Once the player is in range with a clear line, it plants,
 * rears back while it tracks them (the tell), then pours a stream of fire from its mouth. The
 * stream follows the player, but only at `turnRate`: running round the dragon, or putting a
 * tree or a cliff between, is the answer. A blow does not stop it by itself; the brain decides
 * (RoamAIComponent breaks it off with `interrupt` and runs).
 *
 * Gameplay owns every timing; BreathAnimationDriver scrubs the clip to `state`/`progress`.
 */
export class BreathComponent implements RoamingAttacker {
    public readonly name = 'breath';

    private mesh: THREE.Object3D;
    private target: THREE.Object3D;
    private attack: AttackComponent;
    private fire: FireSystem;
    private options: BreathOptions;
    /** The tip of the snout in the model: flames leave from it. Null until the model loads. */
    private muzzle: THREE.Object3D | null = null;

    private current: BreathState = 'idle';
    private timer = 0;
    private cooldown = 0;
    /** Fractional puffs carried over to the next frame, so the rate holds at any frame rate. */
    private owed = 0;

    private from = new THREE.Vector3();
    private aim = new THREE.Vector3();
    private direction = new THREE.Vector3();
    private jitter = new THREE.Vector3();

    constructor(mesh: THREE.Object3D, target: THREE.Object3D, attack: AttackComponent, fire: FireSystem, options: BreathOptions) {
        this.mesh = mesh;
        this.target = target;
        this.attack = attack;
        this.fire = fire;
        this.options = options;
    }

    public get state(): BreathState {
        return this.current;
    }

    /** 0..1 through the current state (0 when idle). */
    public get progress(): number {
        const length = this.lengthOf(this.current);
        return length > 0 ? Math.min(1, this.timer / length) : 0;
    }

    public get busy(): boolean {
        return this.current !== 'idle';
    }

    /** Hooks up the snout tip of the loaded model, so the flame leaves from the mouth. */
    public setMuzzle(node: THREE.Object3D | null) {
        this.muzzle = node;
    }

    public engage(target: THREE.Vector3, distance: number): boolean {
        if (this.current !== 'idle') return true;
        if (distance > this.options.range) return false;
        this.from.copy(this.mesh.position);
        this.from.y += MOUTH_HEIGHT;
        if (!hasLineOfFire(this.from, target)) return false;

        // In range and clear: hold the spot facing the player, catching its breath or rearing up.
        this.attack.face(target);
        if (this.cooldown <= 0) this.enter('windup');
        return true;
    }

    public reset() {
        this.enter('idle');
        this.cooldown = 0;
    }

    /** Swallows the flame mid-breath (puffs already out keep flying) and catches its breath again. */
    public interrupt() {
        if (this.current === 'idle') return;
        this.enter('idle');
        this.cooldown = this.options.cooldown;
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown -= dt;

        this.timer += dt;
        switch (this.current) {
            case 'idle':
                return;
            case 'windup':
                this.attack.face(this.target.position);
                if (this.timer >= this.options.windup) this.enter('breathe');
                return;
            case 'breathe':
                this.turnTowardTarget(dt);
                this.pour(dt);
                if (this.timer >= this.options.breathe) this.enter('recover');
                return;
            case 'recover':
                if (this.timer >= this.options.recovery) {
                    this.enter('idle');
                    this.cooldown = this.options.cooldown;
                }
                return;
        }
    }

    /** Turns the body toward the player, never faster than `turnRate`. */
    private turnTowardTarget(dt: number) {
        const dx = this.target.position.x - this.mesh.position.x;
        const dz = this.target.position.z - this.mesh.position.z;
        if (dx * dx + dz * dz < 1e-6) return;
        turnToward(this.mesh, Math.atan2(dx, dz), this.options.turnRate * dt);
    }

    /**
     * Puffs leave the mouth along the body's heading, pitched toward the player's chest so the
     * stream comes down on them rather than over their head, and scattered within `spread`.
     */
    private pour(dt: number) {
        const { rate, spread, flame } = this.options;
        this.owed += rate * dt;
        if (this.owed < 1) return;

        const from = this.mouth(this.from);
        const heading = this.mesh.rotation.y;
        const reach = Math.max(1, Math.hypot(this.target.position.x - from.x, this.target.position.z - from.z));
        const drop = this.target.position.y + AIM_HEIGHT - from.y;
        this.aim.set(Math.sin(heading) * reach, drop, Math.cos(heading) * reach).normalize();

        while (this.owed >= 1) {
            this.owed -= 1;
            this.jitter.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(spread);
            this.direction.copy(this.aim).add(this.jitter).normalize();
            this.fire.emit(from, this.direction, flame);
        }
    }

    /** World position of the snout tip, or a stand-in ahead of the body before the model is in. */
    private mouth(out: THREE.Vector3): THREE.Vector3 {
        if (this.muzzle) return this.muzzle.getWorldPosition(out);
        const heading = this.mesh.rotation.y;
        return out.set(Math.sin(heading) * MOUTH_REACH, MOUTH_HEIGHT, Math.cos(heading) * MOUTH_REACH).add(this.mesh.position);
    }

    private enter(state: BreathState) {
        this.current = state;
        this.timer = 0;
        this.owed = 0;
    }

    private lengthOf(state: BreathState): number {
        switch (state) {
            case 'idle':
                return 0;
            case 'windup':
                return this.options.windup;
            case 'breathe':
                return this.options.breathe;
            case 'recover':
                return this.options.recovery;
        }
    }
}
