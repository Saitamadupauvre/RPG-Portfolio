import * as THREE from 'three';

/**
 * The one grass colour, shared by the ground material and the grass blades.
 * Kept in its own module so the two can never drift apart: a blade standing
 * on ground of a different green reads as a sticker, not as grass.
 */
export const GRASS_COLOR = 0x66ab48;

export type GrassColorUniforms = {
    uGrassColor: { value: THREE.Color };
};

// THREE.Color converts hex from sRGB into the renderer's working (linear)
// space on construction, so it needs no manual conversion in GLSL.
export function createGrassColorUniforms(): GrassColorUniforms {
    return {
        uGrassColor: { value: new THREE.Color(GRASS_COLOR) },
    };
}
