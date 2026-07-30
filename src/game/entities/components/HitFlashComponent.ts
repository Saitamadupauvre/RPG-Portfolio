import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';

const FLASH_COLOR = new THREE.Color(0xffffff);

// Flashes an entity's own material white on hit, fading back to its base color.
// Requires a non-shared material instance — flashing one enemy must not flash others of the same type.
export class HitFlashComponent implements Component {
    public readonly name = 'hitFlash';

    private material: THREE.MeshStandardMaterial;
    private baseColor: THREE.Color;
    private duration: number;
    private elapsed = -1;

    constructor(material: THREE.MeshStandardMaterial, duration = 0.15) {
        this.material = material;
        this.baseColor = material.color.clone();
        this.duration = duration;
    }

    public trigger() {
        this.elapsed = 0;
        this.material.color.copy(FLASH_COLOR);
    }

    public update(dt: number) {
        if (this.elapsed < 0) return;

        this.elapsed += dt;
        if (this.elapsed >= this.duration) {
            this.material.color.copy(this.baseColor);
            this.elapsed = -1;
            return;
        }

        const t = this.elapsed / this.duration;
        this.material.color.copy(this.baseColor).lerp(FLASH_COLOR, 1 - t);
    }
}
