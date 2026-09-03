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

/** Draw the swing hitbox as a translucent box. Debug only - the sword trail is the real feedback. */
const SHOW_HITBOX = false;

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
    private group: THREE.Object3D;
    private options: Required<AttackHitboxOptions>;
    private hooks: AttackHooks;

    private hitbox: THREE.Mesh | null = null;
    private elapsed = 0;
    private hitIds = new Set<string>();
    private activeOptions: Required<AttackHitboxOptions>;

    constructor(mesh: THREE.Object3D, group: THREE.Object3D, options: AttackHitboxOptions = {}, hooks: AttackHooks = {}) {
        this.mesh = mesh;
        this.group = group;
        this.options = { ...DEFAULTS, ...options };
        this.activeOptions = this.options;
        this.hooks = hooks;
    }

    public get isAttacking(): boolean {
        return this.hitbox !== null;
    }

    /** 0..1 progress through the active swing, or null when idle. Drives the arm animation. */
    public get swingProgress(): number | null {
        if (!this.hitbox) return null;
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
        const direction = new THREE.Vector3().subVectors(aimPoint, this.mesh.position).setY(0);
        if (direction.lengthSq() === 0) return null;
        direction.normalize();
        this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        return direction;
    }

    public trigger(aimPoint: THREE.Vector3, overrides: AttackHitboxOptions = {}) {
        if (this.hitbox) return;

        const direction = this.face(aimPoint);
        if (!direction) return;

        this.activeOptions = { ...this.options, ...overrides };
        this.hooks.onAttackStart?.();

        const geometry = new THREE.BoxGeometry(this.activeOptions.size.x, this.activeOptions.size.y, this.activeOptions.size.z);
        const material = new THREE.MeshBasicMaterial({
            color: this.activeOptions.color,
            transparent: true,
            opacity: this.activeOptions.opacity,
        });

        this.hitbox = new THREE.Mesh(geometry, material);
        // Kept in the scene graph even when hidden: Box3.setFromObject reads geometry, not visibility,
        // so hit detection is unaffected and toggling SHOW_HITBOX needs no other change.
        this.hitbox.visible = SHOW_HITBOX;
        this.hitbox.position.copy(this.mesh.position).addScaledVector(direction, this.activeOptions.distance);
        this.group.add(this.hitbox);
        this.elapsed = 0;
        this.hitIds.clear();
    }

    public getHitbox(): THREE.Box3 | null {
        if (!this.hitbox) return null;
        return new THREE.Box3().setFromObject(this.hitbox);
    }

    public registerHit(id: string): boolean {
        if (this.hitIds.has(id)) return false;
        this.hitIds.add(id);
        return true;
    }

    public update(dt: number) {
        if (!this.hitbox) return;

        this.elapsed += dt;
        if (this.elapsed < this.activeOptions.duration) return;

        this.group.remove(this.hitbox);
        this.hitbox.geometry.dispose();
        (this.hitbox.material as THREE.Material).dispose();
        this.hitbox = null;
        this.hooks.onAttackEnd?.();
    }
}
