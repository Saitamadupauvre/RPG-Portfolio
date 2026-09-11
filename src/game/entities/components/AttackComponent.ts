import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

export interface AttackHitboxOptions {
    size?: THREE.Vector3;
    color?: number;
    opacity?: number;
    distance?: number;
    duration?: number;
    damage?: number;
}

export interface AttackHooks {
    onAttackStart?: () => void;
    onAttackEnd?: () => void;
}

const DEFAULTS: Required<AttackHitboxOptions> = {
    size: new THREE.Vector3(0.6, 0.6, 0.6),
    color: 0xff0000,
    opacity: 0.5,
    distance: 1,
    duration: 0.25,
    damage: 10,
};

export class AttackComponent implements Component {
    public readonly name = 'attack';

    private mesh: THREE.Object3D;
    private options: Required<AttackHitboxOptions>;
    private hooks: AttackHooks;

    private isAttackingState = false;
    private cachedHitbox = new THREE.Box3();
    private center = new THREE.Vector3();
    private faceDirection = new THREE.Vector3();
    private elapsed = 0;
    private hitIds = new Set<string>();
    private activeOptions: Required<AttackHitboxOptions>;

    constructor(mesh: THREE.Object3D, _group: THREE.Object3D, options: AttackHitboxOptions = {}, hooks: AttackHooks = {}) {
        this.mesh = mesh;
        this.options = { ...DEFAULTS, ...options };
        this.activeOptions = this.options;
        this.hooks = hooks;
    }

    public get isAttacking(): boolean {
        return this.isAttackingState;
    }

    /** 0..1 progress through the active swing, or null when idle. Drives the arm animation. */
    public get swingProgress(): number | null {
        if (!this.isAttackingState) return null;
        return Math.min(1, this.elapsed / this.activeOptions.duration);
    }

    public get damage(): number {
        return this.activeOptions.damage;
    }

    /** Base damage of every future swing; the live swing keeps its own value. */
    public setBaseDamage(damage: number) {
        this.options = { ...this.options, damage };
    }

    public face(aimPoint: THREE.Vector3): THREE.Vector3 | null {
        this.faceDirection.subVectors(aimPoint, this.mesh.position).setY(0);
        if (this.faceDirection.lengthSq() === 0) return null;
        this.faceDirection.normalize();
        this.mesh.rotation.y = Math.atan2(this.faceDirection.x, this.faceDirection.z);
        return this.faceDirection;
    }

    public trigger(aimPoint: THREE.Vector3, overrides: AttackHitboxOptions = {}) {
        if (this.isAttackingState) return;

        const direction = this.face(aimPoint);
        if (!direction) return;

        this.activeOptions = { ...this.options, ...overrides };
        this.hooks.onAttackStart?.();

        this.center.copy(this.mesh.position).addScaledVector(direction, this.activeOptions.distance);
        this.cachedHitbox.setFromCenterAndSize(this.center, this.activeOptions.size);

        this.isAttackingState = true;
        this.elapsed = 0;
        this.hitIds.clear();
    }

    public getHitbox(): THREE.Box3 | null {
        if (!this.isAttackingState) return null;
        return this.cachedHitbox;
    }

    public registerHit(id: string): boolean {
        if (this.hitIds.has(id)) return false;
        this.hitIds.add(id);
        return true;
    }

    public update(dt: number) {
        if (!this.isAttackingState) return;

        this.elapsed += dt;
        if (this.elapsed < this.activeOptions.duration) return;

        this.isAttackingState = false;
        this.hooks.onAttackEnd?.();
    }
}
