import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { EmissiveMaterial } from '../../render/toon';

const PULSE_SPEED = 2.5;
const PULSE_MIN = 0.35;
const PULSE_MAX = 1;

export class GlowComponent implements Component {
    public readonly name = 'glow';

    private material: EmissiveMaterial;
    private elapsed = 0;
    private active = true;

    constructor(material: EmissiveMaterial, color: number) {
        this.material = material;
        this.material.emissive = new THREE.Color(color);
    }

    public setActive(active: boolean) {
        this.active = active;
        if (!active) this.material.emissiveIntensity = 0;
    }

    public update(dt: number) {
        if (!this.active) return;

        this.elapsed += dt;

        const wave = (Math.sin(this.elapsed * PULSE_SPEED) + 1) / 2;
        this.material.emissiveIntensity = PULSE_MIN + wave * (PULSE_MAX - PULSE_MIN);
    }
}
