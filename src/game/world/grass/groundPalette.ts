import * as THREE from 'three';
import { PALETTE } from '../../render/palette';

/**
 * The grass colour, shared by the ground material and the grass blades.
 * Kept in its own module so the two can never drift apart: a blade standing
 * on ground of a different green reads as a sticker, not as grass.
 */
export const GRASS_COLOR = PALETTE.meadow;
export const GRASS_PATCH_COLOR = PALETTE.meadowPatch;

/** World units across one patch, roughly. Large on purpose: no fine noise. */
const PATCH_SCALE = 14;
/**
 * Each blade fades from exactly the ground's shade at its root to slightly
 * brighter at its tip. The root match hides where blade meets ground; the
 * brighter tips are what give the field its lit, layered top.
 * GROUND_SHADE scales the ground (and so every root) against the palette
 * colour; 1 leaves it as authored. Shader multipliers are in linear space,
 * so a visible change needs a bigger number than it seems (see TIP_BRIGHTNESS).
 */
const GROUND_SHADE = 1.0;
const TIP_BRIGHTNESS = 1.2;
/** Per-blade brightness spread at the tip, +/- this fraction. Kept tiny. */
const BLADE_VARIATION = 0.04;

export type GrassColorUniforms = {
    uGrassColor: { value: THREE.Color };
    uGrassPatchColor: { value: THREE.Color };
};

// THREE.Color converts hex from sRGB into the renderer's working (linear)
// space on construction, so it needs no manual conversion in GLSL.
export function createGrassColorUniforms(): GrassColorUniforms {
    return {
        uGrassColor: { value: new THREE.Color(GRASS_COLOR) },
        uGrassPatchColor: { value: new THREE.Color(GRASS_PATCH_COLOR) },
    };
}

/**
 * Fragment-side GLSL for the grass colour at a world XZ. Both the ground and
 * the blades call `grassColorAt` with the same world position (the blade uses
 * its root), so a blade always matches the ground it grows from, patches
 * included.
 *
 * The patches are value noise at a very low frequency, thresholded with a
 * smoothstep: below the threshold the ground stays the base colour, above it
 * fades to the lighter patch colour, so roughly half the ground ends up in a
 * patch. The narrow transition gives soft-edged blobs rather than a constant
 * wobble everywhere. Lower both smoothstep edges for more patches.
 */
export const GRASS_COLOR_GLSL = /* glsl */ `
uniform vec3 uGrassColor;
uniform vec3 uGrassPatchColor;

float meadowHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float meadowNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = meadowHash(i);
    float b = meadowHash(i + vec2(1.0, 0.0));
    float c = meadowHash(i + vec2(0.0, 1.0));
    float d = meadowHash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 grassColorAt(vec2 xz) {
    vec2 p = xz / ${PATCH_SCALE.toFixed(1)};
    // A second, finer octave bends the blob outlines so they are not grid-shaped.
    float n = meadowNoise(p) * 0.7 + meadowNoise(p * 2.3 + 17.0) * 0.3;
    return mix(uGrassColor, uGrassPatchColor, smoothstep(0.42, 0.62, n));
}

vec3 groundColorAt(vec2 xz) {
    return grassColorAt(xz) * ${GROUND_SHADE.toFixed(3)};
}

/**
 * root: the blade's world XZ. height: 0 at the root, 1 at the tip.
 * The variation only scales the tip end, so every root still lands exactly on
 * groundColorAt and no blade shows a seam against the ground.
 */
vec3 bladeColorAt(vec2 root, float height) {
    vec3 base = grassColorAt(root);
    float variation = 1.0 + (meadowHash(root * 13.17) * 2.0 - 1.0) * ${BLADE_VARIATION.toFixed(3)};
    vec3 tip = base * ${TIP_BRIGHTNESS.toFixed(3)} * variation;
    return mix(base * ${GROUND_SHADE.toFixed(3)}, tip, height);
}
`;
