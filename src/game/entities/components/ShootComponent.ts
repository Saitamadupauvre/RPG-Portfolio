import * as THREE from 'three';
import type { HealthComponent } from '../../../domain/components/HealthComponent';
import type { AttackComponent } from './AttackComponent';
import type { EnemyAttacker } from './EnemyAttacker';
import { hasClearLine, slideMove } from '../movement';
import { hasLineOfFire, type ProjectileSystem } from '../../ProjectileSystem';

export interface ShootOptions {
    /** Stops to shoot once the player is this close, if nothing stands in the line of fire. */
    range: number;
    /** Seconds from raising the bow to the release: the tell. */
    draw: number;
    /** The last seconds of the draw, aim frozen: the window to step out of the line. */
    lock: number;
    /** Seconds after the release before it can move again. */
    recovery: number;
    /** Seconds between the end of one shot and the start of the next. */
    cooldown: number;
    /** Seconds it reels after a hit breaks its draw. */
    flinch: number;
    arrow: {
        speed: number;
        damage: number;
        /** How much of the player's movement it aims ahead of: 0 = where they stand, 1 = where they will be. */
        lead: number;
    };
    /** Hops away when the player comes closer than this, so a melee chase has to be earned. */
    retreat: number;
    hop: { distance: number; duration: number; cooldown: number };
}

export type ShootState = 'idle' | 'draw' | 'recover' | 'flinch' | 'hop';

/** Where the feet leave the ground and land again, as a share of the hop (Blender frames 3 and 9 of 12). */
const HOP_TAKEOFF = 0.25;
const HOP_LANDING = 0.75;
/** Headings tried for a hop, from straight away from the player: a wall behind turns it into a side-step. */
const HOP_ANGLES = [0, Math.PI / 4, -Math.PI / 4];
/** Lean back on a flinch, radians. */
const FLINCH_TILT = 0.3;
/** Nock height above the body's centre at full draw, for the line-of-fire test before the model has loaded. */
const NOCK_HEIGHT = 0.15;
/** How fast the estimate of the player's velocity follows the real one. */
const VELOCITY_SMOOTHING = 10;
/** Teleports (a respawn) are not running; anything faster is ignored. */
const MAX_TRACKED_SPEED = 12;

/**
 * A skeleton archer. Keeps its distance and shoots: once the player is in range with a
 * clear line, it plants, draws (tracking the player, aim leading their run), freezes the
 * aim for a beat and looses an arrow. Too close, it hops back. Hit while drawing, it
 * flinches and the shot is lost — so pressing in on it is the answer to it.
 *
 * Gameplay owns every timing; ArcherAnimationDriver scrubs the clips to `state`/`progress`.
 */
export class ShootComponent implements EnemyAttacker {
    public readonly name = 'shoot';

    private mesh: THREE.Object3D;
    private target: THREE.Object3D;
    private attack: AttackComponent;
    private health: HealthComponent;
    private projectiles: ProjectileSystem;
    private options: ShootOptions;
    /** The nocked arrow in the model: shots leave from it. Null until the model loads. */
    private muzzle: THREE.Object3D | null = null;

    private current: ShootState = 'idle';
    private timer = 0;
    private cooldown = 0;
    private hopCooldown = 0;
    private hopped = 0;
    private lastHp: number;

    private aimPoint = new THREE.Vector3();
    private hopDirection = new THREE.Vector3();
    private targetVelocity = new THREE.Vector3();
    private lastTarget = new THREE.Vector3();
    private hasLastTarget = false;
    private from = new THREE.Vector3();
    private scratch = new THREE.Vector3();

    constructor(
        mesh: THREE.Object3D,
        target: THREE.Object3D,
        attack: AttackComponent,
        health: HealthComponent,
        projectiles: ProjectileSystem,
        options: ShootOptions,
    ) {
        this.mesh = mesh;
        this.target = target;
        this.attack = attack;
        this.health = health;
        this.projectiles = projectiles;
        this.options = options;
        this.lastHp = health.hp;
        // Yaw first, then the flinch's pitch around the body's own sideways axis.
        this.mesh.rotation.order = 'YXZ';
    }

    public get state(): ShootState {
        return this.current;
    }

    /** 0..1 through the current state (0 when idle). */
    public get progress(): number {
        const length = this.lengthOf(this.current);
        return length > 0 ? Math.min(1, this.timer / length) : 0;
    }

    /** Hooks up the nocked arrow of the loaded model, so shots leave from the string. */
    public setMuzzle(node: THREE.Object3D | null) {
        this.muzzle = node;
    }

    public engage(target: THREE.Vector3, distance: number): boolean {
        if (this.current !== 'idle') return true;

        if (distance < this.options.retreat && this.hopCooldown <= 0 && this.startHop(target)) return true;
        if (distance > this.options.range) return false;
        // Behind a tree or below a cliff edge: keep walking until the shot is clear.
        this.from.copy(this.mesh.position);
        this.from.y += NOCK_HEIGHT;
        if (!hasLineOfFire(this.from, target)) return false;

        // In range and clear: hold the spot facing the player, reloading or drawing.
        this.attack.face(target);
        if (this.cooldown <= 0) {
            this.leadAim(this.aimPoint);
            this.enter('draw');
        }
        return true;
    }

    public reset() {
        this.enter('idle');
        this.cooldown = 0;
        this.hopCooldown = 0;
        this.hasLastTarget = false;
        this.targetVelocity.set(0, 0, 0);
        this.lastHp = this.health.hp;
    }

    public update(dt: number) {
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.hopCooldown > 0) this.hopCooldown -= dt;
        this.trackTarget(dt);

        // A blow lands mid-draw: the shot is lost.
        const hurt = this.health.hp < this.lastHp;
        this.lastHp = this.health.hp;
        if (hurt && this.current === 'draw') {
            this.enter('flinch');
            this.cooldown = this.options.cooldown / 2;
        }

        this.timer += dt;
        switch (this.current) {
            case 'idle':
                return;
            case 'draw':
                this.updateDraw();
                return;
            case 'recover':
                if (this.timer >= this.options.recovery) this.finishShot();
                return;
            case 'flinch':
                this.mesh.rotation.x = -FLINCH_TILT * Math.sin(Math.PI * this.progress);
                if (this.timer >= this.options.flinch) this.enter('idle');
                return;
            case 'hop':
                this.updateHop();
                return;
        }
    }

    private updateDraw() {
        const { draw, lock } = this.options;
        // Tracks the player until the lock; after it the aim is set and the shot can be dodged.
        if (this.timer < draw - lock) {
            this.leadAim(this.aimPoint);
            this.attack.face(this.aimPoint);
        }
        if (this.timer >= draw) this.release();
    }

    private release() {
        const from = this.nock(this.from);
        const direction = this.scratch.subVectors(this.aimPoint, from);
        if (direction.lengthSq() > 1e-6) {
            this.projectiles.fire(from, direction.normalize(), this.options.arrow.speed, this.options.arrow.damage);
        }
        this.enter('recover');
    }

    private finishShot() {
        this.enter('idle');
        this.cooldown = this.options.cooldown;
    }

    /** Where the player will be when the arrow gets there, scaled by how much it leads. */
    private leadAim(out: THREE.Vector3): THREE.Vector3 {
        const { speed, lead } = this.options.arrow;
        const flight = this.nock(this.scratch).distanceTo(this.target.position) / speed;
        return out.copy(this.target.position).addScaledVector(this.targetVelocity, flight * lead);
    }

    /** World position of the nocked arrow, or a stand-in above the body before the model is in. */
    private nock(out: THREE.Vector3): THREE.Vector3 {
        if (this.muzzle) return this.muzzle.getWorldPosition(out);
        return out.copy(this.mesh.position).setY(this.mesh.position.y + NOCK_HEIGHT);
    }

    private trackTarget(dt: number) {
        const position = this.target.position;
        if (this.hasLastTarget && dt > 0) {
            const velocity = this.scratch.subVectors(position, this.lastTarget).divideScalar(dt).setY(0);
            if (velocity.length() <= MAX_TRACKED_SPEED) {
                this.targetVelocity.lerp(velocity, 1 - Math.exp(-VELOCITY_SMOOTHING * dt));
            }
        }
        this.lastTarget.copy(position);
        this.hasLastTarget = true;
    }

    /** Picks the first heading away from `threat` with room to land; false when boxed in. */
    private startHop(threat: THREE.Vector3): boolean {
        const away = this.scratch.subVectors(this.mesh.position, threat).setY(0);
        if (away.lengthSq() < 1e-6) away.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
        away.normalize();

        const { x, z } = this.mesh.position;
        const { distance } = this.options.hop;
        for (const angle of HOP_ANGLES) {
            this.hopDirection.copy(away).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
            if (!hasClearLine(x, z, x + this.hopDirection.x * distance, z + this.hopDirection.z * distance)) continue;

            this.attack.face(threat);
            this.hopped = 0;
            this.enter('hop');
            return true;
        }
        return false;
    }

    private updateHop() {
        const { distance, cooldown } = this.options.hop;
        // Only the airborne part of the clip covers ground; the crouch and the landing stay put.
        const air = THREE.MathUtils.smoothstep(this.progress, HOP_TAKEOFF, HOP_LANDING);
        slideMove(this.mesh, this.hopDirection, distance * air - this.hopped);
        this.hopped = distance * air;

        if (this.progress >= 1) {
            this.enter('idle');
            this.hopCooldown = cooldown;
        }
    }

    private enter(state: ShootState) {
        this.current = state;
        this.timer = 0;
        if (state !== 'flinch') this.mesh.rotation.x = 0;
    }

    private lengthOf(state: ShootState): number {
        switch (state) {
            case 'idle':
                return 0;
            case 'draw':
                return this.options.draw;
            case 'recover':
                return this.options.recovery;
            case 'flinch':
                return this.options.flinch;
            case 'hop':
                return this.options.hop.duration;
        }
    }
}
