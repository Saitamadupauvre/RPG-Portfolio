import * as THREE from 'three';

/**
 * The one wind of the world. Grass sway and water swell both read it, so they
 * always blow the same way at the same strength: grass bending one way while
 * the sea rolls another is exactly the kind of mismatch the eye catches.
 */
export const WIND = {
    /** Horizontal heading the wind blows toward, on the XZ plane. */
    direction: new THREE.Vector2(1, 0.4).normalize(),
    /** Unitless. Grass sway and wave height both scale with it. */
    strength: 0.3,
    /** How fast the gusts and the waves travel. */
    speed: 2.3,
} as const;

export type WindUniforms = {
    uWindDir: { value: THREE.Vector2 };
    uWindStrength: { value: number };
    uWindSpeed: { value: number };
};

/**
 * One shared set of uniform objects, not a fresh copy per material. Spreading
 * this into a material's uniforms copies the *references* to these `{ value }`
 * objects, so changing `uWindStrength.value` once (from a debug slider, say)
 * moves the grass and the sea together.
 */
const windUniforms: WindUniforms = {
    uWindDir: { value: WIND.direction.clone() },
    uWindStrength: { value: WIND.strength },
    uWindSpeed: { value: WIND.speed },
};

export function getWindUniforms(): WindUniforms {
    return windUniforms;
}

export const WIND_GLSL = /* glsl */ `
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uWindSpeed;
`;
