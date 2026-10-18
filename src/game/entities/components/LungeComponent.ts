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

type LungeState = 'idle' | 'prepare' | 'dash' | 'recover';

const LEAN_BACK = -0.35;
const LEAN_FORWARD = 0.3;
const TREMBLE_ANGLE = 0.08;
const TREMBLE_RATE = 55;
/** A dash step that covers less than this share of its length ran into something. */
const BLOCKED_RATIO = 0.3;

/**
 * Prepare, then dash in a straight line through where the player stood when
 * the prepare ended. The hitbox rides along with the body for the whole dash.
 * The tell is a pose, not a clip: the root leans back and trembles, then
 * pitches forward into the dash.
 */
export class LungeComponent implements EnemyAttacker {
    public readonly name = 'lunge';

    private mesh: THREE.Object3D;
    private target: THREE.Object3D;
    private attack: AttackComponent;
    private options: LungeOptions;

    private state: LungeState = 'idle';
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
        // Yaw first, then pitch around the body's own sideways axis, so leaning
        // follows the facing instead of always tipping along world X.
        this.mesh.rotation.order = 'YXZ';
    }

    /** True only while the body is flying; drives the dash trail. */
    public get isDashing(): boolean {
        return this.state === 'dash';
    }

    public engage(target: THREE.Vector3, distance: number): boolean {
        if (this.state !== 'idle') return true;
        if (this.cooldown > 0 || distance > this.options.range) return false;
        // Behind a rock or across a cliff: keep chasing around it instead of
        // crouching for a dash that would stop dead against the obstacle.
        if (!this.hasLineTo(target)) return false;

        this.state = 'prepare';
        this.timer = this.options.prepare;
        return true;
    }

    public reset() {
        this.state = 'idle';
        this.timer = 0;
        this.cooldown = 0;
        this.setPose(0, 0);
        this.attack.reset();
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown -= dt;

        switch (this.state) {
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

        const progress = 1 - Math.max(0, this.timer) / this.options.prepare;
        const tremble = Math.sin(this.timer * TREMBLE_RATE) * TREMBLE_ANGLE * progress;
        this.setPose(LEAN_BACK * progress, tremble);

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
            this.state = 'idle';
            this.setPose(0, 0);
            return;
        }

        this.direction.subVectors(this.target.position, this.mesh.position).setY(0);
        if (this.direction.lengthSq() === 0) this.direction.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
        this.direction.normalize();
        this.aimPoint.copy(this.mesh.position).add(this.direction);

        this.state = 'dash';
        this.travelled = 0;
        this.setPose(LEAN_FORWARD, 0);
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
            this.state = 'recover';
            this.timer = this.options.recovery;
        }
    }

    private updateRecover(dt: number) {
        this.timer -= dt;
        const progress = Math.max(0, this.timer) / this.options.recovery;
        this.setPose(LEAN_FORWARD * progress, 0);

        if (this.timer <= 0) {
            this.state = 'idle';
            this.cooldown = this.options.cooldown;
        }
    }

    private setPose(pitch: number, roll: number) {
        this.mesh.rotation.x = pitch;
        this.mesh.rotation.z = roll;
    }
}
