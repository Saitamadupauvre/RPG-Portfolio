import * as THREE from 'three';
import { TOON_LIGHTING_GLSL } from '../../render/toonLighting';
import { BLADE_HEIGHT } from './bladeGeometry';
import { createPatchUniforms, PATCH_GLSL, type PatchUniforms } from './groundPalette';

/** Compile-time loop bound: GLSL needs a constant, so the array size is fixed. */
export const MAX_COLLIDERS = 16;

/** Tip colour: deep blue-green, so blades read as darker strokes over the ground. */
export const GRASS_TIP_COLOR = 0x1d7350;

export type GrassUniforms = PatchUniforms & {
    uTime: { value: number };
    uWindStrength: { value: number };
    uWindSpeed: { value: number };
    uBladeHeight: { value: number };
    uTipColor: { value: THREE.Color };
    uColliders: { value: THREE.Vector4[] };
    uColliderCount: { value: number };
};

export function createGrassUniforms(tipColor?: THREE.ColorRepresentation): GrassUniforms {
    return {
        ...createPatchUniforms(),
        uTime: { value: 0 },
        uWindStrength: { value: 0.09 },
        uWindSpeed: { value: 1.1 },
        uBladeHeight: { value: BLADE_HEIGHT },
        uTipColor: { value: new THREE.Color(tipColor ?? GRASS_TIP_COLOR) },
        uColliders: { value: Array.from({ length: MAX_COLLIDERS }, () => new THREE.Vector4()) },
        uColliderCount: { value: 0 },
    };
}

const GRASS_VERTEX_PARS = /* glsl */ `
attribute float aHeight;
attribute float aTint;
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uBladeHeight;
uniform vec4 uColliders[${MAX_COLLIDERS}];
uniform int uColliderCount;
varying float vGrassHeight;
varying float vGrassTint;
varying vec2 vGrassRootXZ;
varying vec3 vGrassNormal;
`;

const GRASS_FRAGMENT_PARS = /* glsl */ `
uniform vec3 uTipColor;
varying float vGrassHeight;
varying float vGrassTint;
varying vec2 vGrassRootXZ;
varying vec3 vGrassNormal;
${PATCH_GLSL}
`;

// Runs right after <begin_vertex> has filled `transformed`, and before
// <project_vertex> applies instanceMatrix — so `transformed` is still in
// blade-local space while the maths below is done in world space.
const GRASS_BEND = /* glsl */ `
#include <begin_vertex>

vGrassHeight = aHeight;
vGrassTint = aTint;

#ifdef USE_INSTANCING
    mat4 grassModel = modelMatrix * instanceMatrix;
    mat3 grassRot = mat3(instanceMatrix);
#else
    mat4 grassModel = modelMatrix;
    mat3 grassRot = mat3(1.0);
#endif

vec3 grassRoot = grassModel[3].xyz;
vGrassRootXZ = grassRoot.xz;

// The blade's own up axis, in view space. The fragment shader lights every
// blade with this instead of its true face normal, which is what stops the
// field from scattering into hard lit/unlit halves.
vGrassNormal = normalize(normalMatrix * normalize(grassRot * vec3(0.0, 1.0, 0.0)));

float grassW = aHeight * aHeight;
vec3 grassDisp = vec3(0.0);

// Two octaves at different wavelengths so the field rolls in broad gusts with
// finer ripple on top, rather than every blade ticking on the same beat.
float grassPhase = grassRoot.x * 0.35 + grassRoot.z * 0.45;
float grassWind = sin(uTime * uWindSpeed + grassPhase)
    + 0.3 * sin(uTime * uWindSpeed * 2.7 + grassPhase * 3.1);
grassDisp.x += grassWind * uWindStrength * grassW;
grassDisp.z += grassWind * uWindStrength * 0.4 * grassW;

for (int i = 0; i < ${MAX_COLLIDERS}; i++) {
    if (i >= uColliderCount) break;

    vec4 grassCollider = uColliders[i];
    vec2 grassAway = grassRoot.xz - grassCollider.xz;
    float grassDist = length(grassAway);

    if (grassDist > grassCollider.w) continue;
    if (abs(grassRoot.y - grassCollider.y) > grassCollider.w * 2.0) continue;

    float grassPush = 1.0 - grassDist / grassCollider.w;
    vec2 grassDir = grassDist > 0.0001 ? grassAway / grassDist : vec2(1.0, 0.0);

    grassDisp.xz += grassDir * grassPush * grassCollider.w * 0.8 * grassW;
    grassDisp.y -= grassPush * uBladeHeight * 0.9 * grassW;
}

// World-space displacement back into blade-local space. The columns of
// grassModel are orthogonal (rotation composed with per-axis scale), so its
// inverse is just a per-column projection — no mat3 inverse needed.
vec3 grassCx = grassModel[0].xyz;
vec3 grassCy = grassModel[1].xyz;
vec3 grassCz = grassModel[2].xyz;
transformed += vec3(
    dot(grassDisp, grassCx) / dot(grassCx, grassCx),
    dot(grassDisp, grassCy) / dot(grassCy, grassCy),
    dot(grassDisp, grassCz) / dot(grassCz, grassCz)
);
`;

// Overrides the interpolated face normal. Without this the DoubleSide flip
// would point half the blades' normals downward and black them out.
const GRASS_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize(vGrassNormal);
`;

// The root takes the exact ground colour underneath it, so blades emerge from
// the ground instead of sitting on it; the tip darkens into uTipColor.
const GRASS_COLOR = /* glsl */ `
#include <color_fragment>
vec3 grassBase = grassGroundColor(vGrassRootXZ);
vec3 grassShade = mix(grassBase, uTipColor, smoothstep(0.25, 1.0, vGrassHeight) * 0.7);
diffuseColor.rgb = grassShade * vGrassTint;
`;

/**
 * A stock MeshLambertMaterial with wind + collision bending injected into its
 * vertex shader, and ground-matched colouring into its fragment shader.
 * Patching (rather than a raw ShaderMaterial like the old Grass.ts) means
 * blades get the scene lights, fog, shadows and colour management for free.
 */
export function createGrassMaterial(uniforms: GrassUniforms) {
    const material = new THREE.MeshLambertMaterial({
        // White: the real colour comes from the gradient in GRASS_COLOR.
        color: 0xffffff,
        side: THREE.DoubleSide,
    });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${GRASS_VERTEX_PARS}`)
            .replace('#include <begin_vertex>', GRASS_BEND);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${GRASS_FRAGMENT_PARS}`)
            .replace('#include <normal_fragment_begin>', GRASS_NORMAL)
            .replace('#include <lights_fragment_end>', TOON_LIGHTING_GLSL)
            .replace('#include <color_fragment>', GRASS_COLOR);
    };

    // Without this, three would reuse a plain Lambert program from its cache.
    material.customProgramCacheKey = () => 'grass-surface';

    return material;
}
