import * as THREE from 'three';
import type { Entity } from '../entities/Entity';

/** Seconds the enemies take to fade in once the game starts. */
const FADE_SECONDS = 1.2;

/** What a material looked like before it was held invisible, put back when the fade ends. */
type Saved = { transparent: boolean; opacity: number; depthWrite: boolean };

/**
 * Keeps the enemies out of the menu backdrop (the knight rests alone by the
 * fire), then fades them in when the game starts, so they appear rather
 * than pop.
 *
 * Held invisible through their materials (transparent, opacity 0), not by
 * hiding their meshes: a transparent material needs its own shader, and
 * compiling it for every enemy in the frame the game starts stalls the glide.
 * Drawn at opacity 0 in the menu, that shader is built behind the menu instead.
 * Without depth writes, or the invisible bodies would still cut holes in the
 * grass and water behind them.
 *
 * Every enemy owns its materials (the pool clones them, `loadModel` converts
 * them per instance), so turning one transparent touches nobody else.
 */
export class EnemyFadeIn {
    private saved = new Map<THREE.Material, Saved>();
    private shadowCasters = new Set<THREE.Mesh>();
    /** Below 0 while held invisible; then seconds into the fade. */
    private elapsed = FADE_SECONDS;

    /**
     * Every menu frame: catches enemies streamed in since and models that
     * replaced a placeholder since, before the frame draws them.
     */
    public hold(entities: readonly Entity[]) {
        this.elapsed = -1;
        for (const entity of entities) {
            if (!isEnemy(entity)) continue;
            this.collect(entity.mesh);
            // The twin is a basic material, left out of `collect`; and with no enemy update in the
            // menu, one quit mid-hunt would keep its silhouette on over an invisible body.
            entity.getComponent('xray')?.hide();
        }
        for (const material of this.saved.keys()) material.opacity = 0;
    }

    public start(entities: readonly Entity[]) {
        this.hold(entities);
        this.elapsed = 0;
    }

    public update(dt: number) {
        if (this.elapsed < 0 || this.elapsed >= FADE_SECONDS) return;

        this.elapsed = Math.min(FADE_SECONDS, this.elapsed + dt);
        if (this.elapsed >= FADE_SECONDS) {
            this.finish();
            return;
        }

        const t = this.elapsed / FADE_SECONDS;
        for (const [material, { opacity }] of this.saved) {
            material.opacity = opacity * t;
        }
    }

    private collect(root: THREE.Object3D) {
        root.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            // Shadow maps ignore opacity: a solid shadow under an invisible body would give it away.
            if (object.castShadow) {
                object.castShadow = false;
                this.shadowCasters.add(object);
            }

            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                // Lit materials only: the health bar and the x-ray twin are basic ones and go their own way.
                if (this.saved.has(material) || !('emissive' in material)) continue;
                this.saved.set(material, {
                    transparent: material.transparent,
                    opacity: material.opacity,
                    depthWrite: material.depthWrite,
                });
                // Opaque materials write alpha 1 whatever the opacity: the shader has to be rebuilt.
                material.transparent = true;
                material.depthWrite = false;
                material.opacity = 0;
                material.needsUpdate = true;
            }
        });
    }

    /** Every material back as it was, the fade over. */
    private finish() {
        for (const [material, { transparent, opacity, depthWrite }] of this.saved) {
            material.transparent = transparent;
            material.opacity = opacity;
            material.depthWrite = depthWrite;
            material.needsUpdate = true;
        }
        for (const mesh of this.shadowCasters) mesh.castShadow = true;

        this.saved.clear();
        this.shadowCasters.clear();
        this.elapsed = FADE_SECONDS;
    }
}

function isEnemy(entity: Entity): boolean {
    return entity.getComponent('enemyAI') !== undefined;
}
