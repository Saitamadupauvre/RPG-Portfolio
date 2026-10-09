import * as THREE from 'three';
import { BLADE_HEIGHT } from './bladeGeometry';
import { createGrassColorUniforms, GRASS_COLOR_GLSL, type GrassColorUniforms } from './groundPalette';

/** Compile-time loop bound: GLSL needs a constant, so the array size is fixed. */
export const MAX_COLLIDERS = 16;

/** Collider radius, in world units, past which the sideways grass shove stops growing. */
const MAX_PUSH_RADIUS = 0.8;
/** Fraction of that radius a blade at the collider's centre is shoved outward. */
const PUSH_STRENGTH = 0.8;
/**
 * How much of each blade's own tilt reaches its lighting normal. Blades lean
 * up to ~20 degrees at random, and lit by their full tilt, the ones leaning
 * away from the sun came out much darker than their neighbours. 0 would light
 * every blade like the flat ground; a little tilt keeps a faint variation.
 */
const NORMAL_TILT = 0.25;

export type GrassUniforms = GrassColorUniforms & {
    uTime: { value: number };
    uWindStrength: { value: number };
    uWindSpeed: { value: number };
    uBladeHeight: { value: number };
    uColliders: { value: THREE.Vector4[] };
    uColliderCount: { value: number };
};

export function createGrassUniforms(): GrassUniforms {
    return {
        ...createGrassColorUniforms(),
        uTime: { value: 0 },
        uWindStrength: { value: 0.09 },
        uWindSpeed: { value: 1.1 },
        uBladeHeight: { value: BLADE_HEIGHT },
        uColliders: { value: Array.from({ length: MAX_COLLIDERS }, () => new THREE.Vector4()) },
        uColliderCount: { value: 0 },
    };
}

const GRASS_VERTEX_PARS = /* glsl */ `
attribute float aHeight;
uniform float uTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uBladeHeight;
uniform vec4 uColliders[${MAX_COLLIDERS}];
uniform int uColliderCount;
varying vec3 vGrassNormal;
varying vec2 vGrassRootXZ;
varying float vGrassHeight;
`;

const GRASS_FRAGMENT_PARS = /* glsl */ `
varying vec3 vGrassNormal;
varying vec2 vGrassRootXZ;
varying float vGrassHeight;
${GRASS_COLOR_GLSL}
`;

// Runs right after <begin_vertex> has filled `transformed`, and before
// <project_vertex> applies instanceMatrix — so `transformed` is still in
// blade-local space while the maths below is done in world space.
const GRASS_BEND = /* glsl */ `
#include <begin_vertex>

#ifdef USE_INSTANCING
    mat4 grassModel = modelMatrix * instanceMatrix;
    mat3 grassRot = mat3(instanceMatrix);
#else
    mat4 grassModel = modelMatrix;
    mat3 grassRot = mat3(1.0);
#endif

vec3 grassRoot = grassModel[3].xyz;
// The root, not the tip: a blade takes the colour of the ground it grows
// from, and it keeps it while the wind moves the tip.
vGrassRootXZ = grassRoot.xz;
vGrassHeight = aHeight;

// Lighting normal, in view space. The fragment shader lights every blade with
// this instead of its true face normal, which is what stops the field from
// scattering into hard lit/unlit halves. It sits mostly on world up (how the
// ground under it is lit) and only NORMAL_TILT of the way toward the blade's
// own leaning axis.
vec3 grassBladeUp = normalize(normalMatrix * normalize(grassRot * vec3(0.0, 1.0, 0.0)));
vec3 grassWorldUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
vGrassNormal = normalize(mix(grassWorldUp, grassBladeUp, ${NORMAL_TILT.toFixed(2)}));

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
    // Sideways shove scales with the collider, but clamped: a wide body would
    // otherwise fling blades metres outward and visibly stretch the field
    // around itself instead of parting it.
    float grassShove = min(grassCollider.w, ${MAX_PUSH_RADIUS.toFixed(2)}) * ${PUSH_STRENGTH.toFixed(2)};

    grassDisp.xz += grassDir * grassPush * grassShove * grassW;
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

// Root matches the ground underneath, patches included, so blades emerge from
// it instead of sitting on it; tips go slightly brighter.
const GRASS_COLOR = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb = bladeColorAt(vGrassRootXZ, vGrassHeight);
`;

/**
 * A stock MeshLambertMaterial with wind + collision bending injected into its
 * vertex shader, and ground-matched colouring into its fragment shader.
 * Patching (rather than a raw ShaderMaterial like the old Grass.ts) means
 * blades get the scene lights, fog, shadows and colour management for free.
 */
export function createGrassMaterial(uniforms: GrassUniforms) {
    const material = new THREE.MeshLambertMaterial({
        // White: the real colour is set in GRASS_COLOR.
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
            .replace('#include <color_fragment>', GRASS_COLOR);
    };

    // Without this, three would reuse a plain Lambert program from its cache.
    material.customProgramCacheKey = () => 'grass-surface';

    return material;
}
