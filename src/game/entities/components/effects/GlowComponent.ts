import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { EmissiveMaterial } from '../../render/materials';

const PULSE_SPEED = 2.5;
const PULSE_MIN = 0.35;
const PULSE_MAX = 1;

export class GlowComponent implements Component {
    public readonly name = 'glow';

    private materials: EmissiveMaterial[] = [];
    private color: number;
    private elapsed = 0;
    private active = true;

    constructor(materials: EmissiveMaterial | EmissiveMaterial[], color: number) {
        this.color = color;
        this.setMaterials(materials);
    }

    /** Moves the glow onto other materials — used when a loaded model replaces the placeholder. */
    public setMaterials(materials: EmissiveMaterial | EmissiveMaterial[]) {
        this.materials = Array.isArray(materials) ? materials : [materials];
        for (const material of this.materials) {
            material.emissive = new THREE.Color(this.color);
            if (!this.active) material.emissiveIntensity = 0;
        }
    }

    public setActive(active: boolean) {
        this.active = active;
        if (!active) for (const material of this.materials) material.emissiveIntensity = 0;
    }

    public update(dt: number) {
        if (!this.active) return;

        this.elapsed += dt;

        const wave = (Math.sin(this.elapsed * PULSE_SPEED) + 1) / 2;
        const intensity = PULSE_MIN + wave * (PULSE_MAX - PULSE_MIN);
        for (const material of this.materials) material.emissiveIntensity = intensity;
    }
}
