import * as THREE from 'three';
import { PALETTE } from '../../render/palette';

export const GRASS_BASE_COLOR = PALETTE.meadow;
export const GRASS_PATCH_COLOR = PALETTE.meadowPatch;

const PATCH_SCALE = 14;
const PATCH_OCTAVE_MIX = 0.7;
const PATCH_DETAIL_SCALE = 2.3;
const PATCH_DETAIL_OFFSET = 17;
const PATCH_EDGE_LOW = 0.42;
const PATCH_EDGE_HIGH = 0.62;
const TIP_BRIGHTNESS = 1.2;
const BLADE_VARIATION = 0.04;
const BLADE_VARIATION_SCALE = 13.17;

export type GrassColorUniforms = {
    uGrassColor: { value: THREE.Color };
    uGrassPatchColor: { value: THREE.Color };
};

export function createGrassColorUniforms(): GrassColorUniforms {
    return {
        uGrassColor: { value: new THREE.Color(GRASS_BASE_COLOR) },
        uGrassPatchColor: { value: new THREE.Color(GRASS_PATCH_COLOR) },
    };
}

export const GRASS_COLOR_GLSL = /* glsl */ `
uniform vec3 uGrassColor;
uniform vec3 uGrassPatchColor;

float meadowHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
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
    float n = meadowNoise(p) * ${PATCH_OCTAVE_MIX.toFixed(2)}
        + meadowNoise(p * ${PATCH_DETAIL_SCALE.toFixed(1)} + ${PATCH_DETAIL_OFFSET.toFixed(1)}) * ${(1 - PATCH_OCTAVE_MIX).toFixed(2)};
    return mix(uGrassColor, uGrassPatchColor, smoothstep(${PATCH_EDGE_LOW.toFixed(2)}, ${PATCH_EDGE_HIGH.toFixed(2)}, n));
}

vec3 bladeColorAt(vec2 root, float height) {
    vec3 base = grassColorAt(root);
    float variation = 1.0 + (meadowHash(root * ${BLADE_VARIATION_SCALE.toFixed(2)}) * 2.0 - 1.0) * ${BLADE_VARIATION.toFixed(3)};
    vec3 tip = base * ${TIP_BRIGHTNESS.toFixed(3)} * variation;
    return mix(base, tip, height);
}
`;
