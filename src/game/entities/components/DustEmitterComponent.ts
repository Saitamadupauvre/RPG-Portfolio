import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { ParticleSystem } from '../../effects/ParticleSystem';
import type { MovementComponent } from './MovementComponent';

const SPAWN_INTERVAL = 0.15;
const BURST_COUNT = 3;

const DUST_CONFIG = {
    size: 0.05,
    color: 0x8a6d4b,
    poolSize: 32,
    life: 0.35,
    speed: 0.6,
    verticalSpeed: 0.8,
    gravity: 4,
};

/** Spawns a small dust burst at the feet at a fixed cadence while the player is moving. */
export class DustEmitterComponent implements Component {
    public readonly name = 'dust';

    private mesh: THREE.Object3D;
    private movement: MovementComponent;
    private particles: ParticleSystem;
    private timer = 0;
    private scratch = new THREE.Vector3();

    constructor(mesh: THREE.Object3D, movement: MovementComponent, parent: THREE.Object3D) {
        this.mesh = mesh;
        this.movement = movement;
        this.particles = new ParticleSystem(parent, DUST_CONFIG);
    }

    public update(dt: number) {
        this.particles.update(dt);

        if (!this.movement.isMoving()) {
            this.timer = 0;
            return;
        }

        this.timer -= dt;
        if (this.timer > 0) return;

        this.timer = SPAWN_INTERVAL;
        this.scratch.copy(this.mesh.position).setY(0.05);
        this.particles.spawnBurst(this.scratch, BURST_COUNT);
    }
}
