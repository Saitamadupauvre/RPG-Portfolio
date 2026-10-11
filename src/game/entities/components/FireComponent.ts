import type * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { Vec3 } from '../../../data/MapEntity';
import { getCheckpoint } from '../../../domain/checkpoint';
import { createFireEffect, type FireEffect } from '../../render/fireEffect';

/** How strong a bonfire burns when it is not the one the player last rested at, and when it is. */
const INTENSITY_IDLE = 0.22;
const INTENSITY_LIT = 1;
/** Per second; the fire swells up or dies down over about a second rather than snapping. */
const CHANGE_RATE = 2.5;
/** Checkpoints are stored as the bonfire's own position, so this only absorbs float noise. */
const SAME_SPOT = 0.5;

/**
 * The flames of a bonfire. The one the player last rested at (the checkpoint) is
 * "lit" and roars; every other bonfire only smoulders.
 */
export class FireComponent implements Component {
    public readonly name = 'fire';

    private effect: FireEffect;
    private position: Vec3;
    private elapsed = Math.random() * 100;
    private intensity: number;

    constructor(parent: THREE.Object3D, position: Vec3, fireHeight: number) {
        this.position = position;
        this.effect = createFireEffect(fireHeight);
        parent.add(this.effect.object);
        // Start at the right strength: a bonfire streamed in must not visibly ramp up.
        this.intensity = this.targetIntensity();
        this.effect.update(this.elapsed, this.intensity);
    }

    public isLit(): boolean {
        const [x, , z] = getCheckpoint();
        return Math.hypot(x - this.position[0], z - this.position[2]) < SAME_SPOT;
    }

    public update(dt: number) {
        this.elapsed += dt;
        this.intensity += (this.targetIntensity() - this.intensity) * (1 - Math.exp(-CHANGE_RATE * dt));
        this.effect.update(this.elapsed, this.intensity);
    }

    private targetIntensity(): number {
        return this.isLit() ? INTENSITY_LIT : INTENSITY_IDLE;
    }
}
