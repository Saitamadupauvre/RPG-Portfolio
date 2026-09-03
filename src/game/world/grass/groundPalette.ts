import * as THREE from 'three';

/**
 * The painterly ground palette, shared by the ground material and the grass
 * blades. Both run the same `grassGroundColor()` over the same world XZ, so a
 * blade's root is tinted with exactly the patch of ground it grows out of —
 * that shared lookup is what makes the two read as one surface.
 */
export const PATCH_A = 0x66ab48;
export const PATCH_B = 0x96cf5c;
export const PATCH_C = 0x3d8a52;
export const PATCH_ACCENT = 0xd3e07a;

export type PatchUniforms = {
    uPatchA: { value: THREE.Color };
    uPatchB: { value: THREE.Color };
    uPatchC: { value: THREE.Color };
    uPatchAccent: { value: THREE.Color };
};

// THREE.Color converts hex from sRGB into the renderer's working (linear)
// space on construction, so these need no manual conversion in GLSL.
export function createPatchUniforms(): PatchUniforms {
    return {
        uPatchA: { value: new THREE.Color(PATCH_A) },
        uPatchB: { value: new THREE.Color(PATCH_B) },
        uPatchC: { value: new THREE.Color(PATCH_C) },
        uPatchAccent: { value: new THREE.Color(PATCH_ACCENT) },
    };
}

/** Declarations + the shared lookup. Inject once per fragment shader. */
export const PATCH_GLSL = /* glsl */ `
uniform vec3 uPatchA;
uniform vec3 uPatchB;
uniform vec3 uPatchC;
uniform vec3 uPatchAccent;

float grassHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float grassNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = grassHash(i);
    float b = grassHash(i + vec2(1.0, 0.0));
    float c = grassHash(i + vec2(0.0, 1.0));
    float d = grassHash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 grassGroundColor(vec2 p) {
    float n1 = smoothstep(0.35, 0.65, grassNoise(p * 0.11));
    float n2 = smoothstep(0.40, 0.60, grassNoise(p * 0.34 + 100.0));
    float n3 = grassNoise(p * 1.4 + 250.0);

    vec3 color = mix(uPatchA, uPatchB, n1);
    color = mix(color, uPatchC, n2 * 0.55);
    color = mix(color, uPatchAccent, smoothstep(0.82, 0.96, n3) * 0.55);
    return color;
}
`;
