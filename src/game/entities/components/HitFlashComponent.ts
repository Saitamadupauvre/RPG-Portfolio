import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { TintableMaterial } from '../../render/toon';

const FLASH_COLOR = new THREE.Color(0xffffff);

export class HitFlashComponent implements Component {
    public readonly name = 'hitFlash';

    private materials: TintableMaterial[] = [];
    private baseColors: THREE.Color[] = [];
    private duration: number;
    private elapsed = -1;

    constructor(materials: TintableMaterial | TintableMaterial[], duration = 0.15) {
        this.setMaterials(materials);
        this.duration = duration;
    }

    /** Swaps the flashed materials — used when the placeholder mesh is replaced by a loaded model. */
    public setMaterials(materials: TintableMaterial | TintableMaterial[]) {
        this.restore();
        this.materials = Array.isArray(materials) ? materials : [materials];
        this.baseColors = this.materials.map((material) => material.color.clone());
        this.elapsed = -1;
    }

    public trigger() {
        this.elapsed = 0;
        for (const material of this.materials) material.color.copy(FLASH_COLOR);
    }

    public update(dt: number) {
        if (this.elapsed < 0) return;

        this.elapsed += dt;
        if (this.elapsed >= this.duration) {
            this.restore();
            this.elapsed = -1;
            return;
        }

        const t = this.elapsed / this.duration;
        for (let i = 0; i < this.materials.length; i++) {
            this.materials[i].color.copy(this.baseColors[i]).lerp(FLASH_COLOR, 1 - t);
        }
    }

    private restore() {
        for (let i = 0; i < this.materials.length; i++) {
            this.materials[i].color.copy(this.baseColors[i]);
        }
    }
}
