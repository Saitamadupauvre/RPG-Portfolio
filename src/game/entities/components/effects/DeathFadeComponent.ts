import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import type { XraySilhouette } from '../../render/xraySilhouette';

/** Seconds to turn fully white, to hold the white, then to fade out. */
const WHITEN = 0.08;
const HOLD = 0.15;
const FADE = 0.35;

const WHITE = new THREE.Color(0xffffff);
const BLACK = new THREE.Color(0x000000);

type LitMaterial = THREE.Material & { color: THREE.Color; emissive: THREE.Color; emissiveMap: THREE.Texture | null };

/** What a material looked like before dying, put back by `reset`. */
type Saved = {
    material: LitMaterial;
    color: THREE.Color;
    emissive: THREE.Color;
    emissiveMap: THREE.Texture | null;
    transparent: boolean;
    opacity: number;
};

/**
 * Death: the body turns pure white, holds it a beat, then fades away.
 *
 * White through `emissive` with the colour pushed to black, rather than a white
 * `color`: Lambert still shades a white colour, so its shadow side stays grey.
 * Materials are collected when the fade starts, not when the entity is built,
 * so a model that loaded since is what fades. Lit materials only: health bars
 * and x-ray twins are basic materials, and they go their own way.
 */
export class DeathFadeComponent implements Component {
    public readonly name = 'deathFade';

    private root: THREE.Object3D;
    private silhouette: XraySilhouette | null;
    private saved: Saved[] = [];
    private shadowCasters: THREE.Mesh[] = [];
    private elapsed = -1;

    constructor(root: THREE.Object3D, silhouette: XraySilhouette | null = null) {
        this.root = root;
        this.silhouette = silhouette;
    }

    /** True from `start` until `reset`. */
    public get active(): boolean {
        return this.elapsed >= 0;
    }

    /** True once the body has faded out completely. */
    public get done(): boolean {
        return this.elapsed >= WHITEN + HOLD + FADE;
    }

    public start() {
        if (this.active) return;

        this.elapsed = 0;
        // A twin drawn over a body going transparent would show it through itself.
        this.silhouette?.setEnabled(false);

        const seen = new Set<THREE.Material>();
        this.root.traverse((object) => {
            if (!(object instanceof THREE.Mesh) || !object.visible) return;
            if (object.castShadow) this.shadowCasters.push(object);

            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (seen.has(material) || !isLit(material)) continue;
                seen.add(material);
                this.saved.push({
                    material,
                    color: material.color.clone(),
                    emissive: material.emissive.clone(),
                    emissiveMap: material.emissiveMap,
                    transparent: material.transparent,
                    opacity: material.opacity,
                });
                material.emissiveMap = null;
                // Opaque materials write alpha 1 whatever the opacity: the shader has to be rebuilt.
                material.transparent = true;
                material.needsUpdate = true;
            }
        });
    }

    /** Back to the body it had before dying, visible again. */
    public reset() {
        for (const { material, color, emissive, emissiveMap, transparent, opacity } of this.saved) {
            material.color.copy(color);
            material.emissive.copy(emissive);
            material.emissiveMap = emissiveMap;
            material.transparent = transparent;
            material.opacity = opacity;
            material.needsUpdate = true;
        }
        for (const mesh of this.shadowCasters) mesh.castShadow = true;

        this.saved = [];
        this.shadowCasters = [];
        this.elapsed = -1;
        this.root.visible = true;
        this.silhouette?.setEnabled(true);
    }

    public update(dt: number) {
        if (!this.active || this.done) return;

        const wasFading = this.elapsed > WHITEN + HOLD;
        this.elapsed += dt;

        const white = Math.min(1, this.elapsed / WHITEN);
        const fade = THREE.MathUtils.clamp((this.elapsed - WHITEN - HOLD) / FADE, 0, 1);
        for (const { material, color, emissive, opacity } of this.saved) {
            material.color.copy(color).lerp(BLACK, white);
            material.emissive.copy(emissive).lerp(WHITE, white);
            material.opacity = opacity * (1 - fade);
        }

        // Shadow maps ignore opacity: a solid shadow under a fading body would outlast it.
        if (!wasFading && fade > 0) {
            for (const mesh of this.shadowCasters) mesh.castShadow = false;
        }
        if (this.done) this.root.visible = false;
    }
}

function isLit(material: THREE.Material): material is LitMaterial {
    return 'emissive' in material && 'color' in material;
}
