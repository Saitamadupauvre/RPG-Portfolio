import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { ParticleSystem } from '../../effects/ParticleSystem';
import { getSwordTipWorldPosition } from '../SwordFactory';
import type { AttackComponent } from './AttackComponent';

const TRAIL_CONFIG = {
    size: 0.05,
    color: 0xaad4ff,
    poolSize: 24,
    life: 0.15,
    speed: 0,
    verticalSpeed: 0,
    gravity: 0,
};

/** Drops a fading particle at the blade tip every frame the swing hitbox is active. */
export class SwordTrailComponent implements Component {
    public readonly name = 'swordTrail';

    private hand: THREE.Object3D;
    private attack: AttackComponent;
    private particles: ParticleSystem;
    private scratch = new THREE.Vector3();

    constructor(hand: THREE.Object3D, attack: AttackComponent, parent: THREE.Object3D) {
        this.hand = hand;
        this.attack = attack;
        this.particles = new ParticleSystem(parent, TRAIL_CONFIG);
    }

    public update(dt: number) {
        this.particles.update(dt);

        if (!this.attack.isAttacking) return;

        getSwordTipWorldPosition(this.hand, this.scratch);
        this.particles.spawnBurst(this.scratch, 1);
    }
}
