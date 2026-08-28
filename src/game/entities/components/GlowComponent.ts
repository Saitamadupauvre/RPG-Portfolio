import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

const PULSE_SPEED = 2.5;
const PULSE_MIN = 0.35;
const PULSE_MAX = 1;

// Pulsing emissive highlight used to signal "there is something here for you".
// Owns its own clock rather than reading a global one so the pulse keeps working
// no matter which system drives update(dt).
export class GlowComponent implements Component {
    public readonly name = 'glow';

    private material: THREE.MeshStandardMaterial;
    private elapsed = 0;
    private active = true;

    constructor(material: THREE.MeshStandardMaterial, color: number) {
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
        // (sin + 1) / 2 maps the wave into 0..1, then lerp into the intensity range.
        const wave = (Math.sin(this.elapsed * PULSE_SPEED) + 1) / 2;
        this.material.emissiveIntensity = PULSE_MIN + wave * (PULSE_MAX - PULSE_MIN);
    }
}
