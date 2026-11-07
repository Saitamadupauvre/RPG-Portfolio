import * as THREE from 'three';

/** How much of a ghosted prop still shows. */
const GHOST_OPACITY = 0.3;

const ghosts = new WeakMap<THREE.Material, THREE.Material>();

/**
 * The see-through twin of `base`, made once and shared by every mesh wearing
 * `base` (all rocks share one ground material, so they share one ghost too).
 * `Material.copy` leaves the shader patch behind, so it is carried over by
 * hand: a ghosted tree keeps swaying, a ghosted rock keeps its grass top.
 * Not writing depth, so whatever stands behind it (the player) draws through.
 */
export function ghostMaterial(base: THREE.Material): THREE.Material {
    let ghost = ghosts.get(base);
    if (!ghost) {
        const made = base.clone();
        made.onBeforeCompile = base.onBeforeCompile;
        made.customProgramCacheKey = base.customProgramCacheKey;
        made.transparent = true;
        made.opacity = GHOST_OPACITY;
        made.depthWrite = false;
        // Freed with the material it stands in for.
        base.addEventListener('dispose', () => made.dispose());
        ghosts.set(base, made);
        ghost = made;
    }
    return ghost;
}
