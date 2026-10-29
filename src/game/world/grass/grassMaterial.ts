import * as THREE from 'three';
import { BLADE_HEIGHT } from './bladeGeometry';
import { createGrassColorUniforms, GRASS_COLOR_GLSL, type GrassColorUniforms } from './groundPalette';
import { getWindUniforms, WIND_GLSL, type WindUniforms } from '../wind';

export const MAX_COLLIDERS = 16;

const MAX_PUSH_RADIUS = 0.8;
const PUSH_STRENGTH = 1.0;
const PUSH_DROP = 0.9;
const CALM_RADIUS = 1.6;
const NORMAL_TILT = 0.25;

const WIND_PHASE_SCALE = 0.45;
const WIND_DETAIL_AMPLITUDE = 0.3;
const WIND_DETAIL_FREQUENCY = 3.1;
const WIND_DETAIL_SPEED = 2.7;
const FLUTTER_AMPLITUDE = 0.35;
const FLUTTER_SPEED = 6.0;
const FLUTTER_SCRAMBLE_X = 7.3;
const FLUTTER_SCRAMBLE_Z = 5.1;
const DOWNWIND_BIAS = 0.6;
const GUST_FREQUENCY = 0.3;
const GUST_SPEED = 0.45;
const GUST_MIN = 0.3;
const GUST_RANGE = 2.2;
const MAX_SWAY = 0.95;

const f = (value: number) => value.toFixed(3);

export type GrassUniforms = GrassColorUniforms & WindUniforms & {
    uTime: { value: number };
    uBladeHeight: { value: number };
    uColliders: { value: THREE.Vector4[] };
    uColliderCount: { value: number };
};

export function createGrassUniforms(): GrassUniforms {
    return {
        ...createGrassColorUniforms(),
        ...getWindUniforms(),
        uTime: { value: 0 },
        uBladeHeight: { value: BLADE_HEIGHT },
        uColliders: { value: Array.from({ length: MAX_COLLIDERS }, () => new THREE.Vector4()) },
        uColliderCount: { value: 0 },
    };
}

const GRASS_VERTEX_PARS = /* glsl */ `
attribute float aHeight;
uniform float uTime;
${WIND_GLSL}
uniform float uBladeHeight;
uniform vec4 uColliders[${MAX_COLLIDERS}];
uniform int uColliderCount;
varying vec3 vGrassNormal;
varying vec2 vGrassRootXZ;
varying float vGrassRootY;
varying float vGrassHeight;

vec3 grassWindDisplacement(vec2 rootXZ, float weight, float bladeHeight) {
    float phase = dot(rootXZ, uWindDir) * ${f(WIND_PHASE_SCALE)};
    float wind = sin(phase - uTime * uWindSpeed)
        + ${f(WIND_DETAIL_AMPLITUDE)} * sin(phase * ${f(WIND_DETAIL_FREQUENCY)} - uTime * uWindSpeed * ${f(WIND_DETAIL_SPEED)})
        + ${f(FLUTTER_AMPLITUDE)} * sin(uTime * uWindSpeed * ${f(FLUTTER_SPEED)} + rootXZ.x * ${f(FLUTTER_SCRAMBLE_X)} + rootXZ.y * ${f(FLUTTER_SCRAMBLE_Z)});

    float gust = 0.5 + 0.5 * sin(phase * ${f(GUST_FREQUENCY)} - uTime * uWindSpeed * ${f(GUST_SPEED)});
    gust = ${f(GUST_MIN)} + ${f(GUST_RANGE)} * gust * gust;

    float sway = (wind + ${f(DOWNWIND_BIAS)}) * gust * uWindStrength * weight;
    vec2 displacement = uWindDir * sway;

    float maxSway = bladeHeight * ${f(MAX_SWAY)} * weight;
    float swayLength = length(displacement);
    if (swayLength > maxSway) displacement *= maxSway / swayLength;

    float drop = dot(displacement, displacement) / (2.0 * bladeHeight);
    return vec3(displacement.x, -drop, displacement.y);
}

vec3 grassColliderDisplacement(vec3 root, float weight, float bladeHeight, out float calm) {
    vec3 displacement = vec3(0.0);
    calm = 0.0;

    for (int i = 0; i < ${MAX_COLLIDERS}; i++) {
        if (i >= uColliderCount) break;

        vec4 collider = uColliders[i];
        if (abs(root.y - collider.y) > collider.w * 2.0) continue;

        vec2 away = root.xz - collider.xz;
        float dist = length(away);
        calm = max(calm, 1.0 - smoothstep(collider.w, collider.w * ${f(CALM_RADIUS)}, dist));
        if (dist > collider.w) continue;

        float push = 1.0 - dist / collider.w;
        vec2 direction = dist > 0.0001 ? away / dist : vec2(1.0, 0.0);
        float shove = min(collider.w, ${f(MAX_PUSH_RADIUS)}) * ${f(PUSH_STRENGTH)};

        displacement.xz += direction * push * shove * weight;
        displacement.y -= push * bladeHeight * ${f(PUSH_DROP)} * weight;
    }

    return displacement;
}
`;

const GRASS_FRAGMENT_PARS = /* glsl */ `
varying vec3 vGrassNormal;
varying vec2 vGrassRootXZ;
varying float vGrassRootY;
varying float vGrassHeight;
${GRASS_COLOR_GLSL}
`;

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
vGrassRootXZ = grassRoot.xz;
vGrassRootY = grassRoot.y;
vGrassHeight = aHeight;

vec3 grassBladeUp = normalize(normalMatrix * normalize(grassRot * vec3(0.0, 1.0, 0.0)));
vec3 grassWorldUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
vGrassNormal = normalize(mix(grassWorldUp, grassBladeUp, ${f(NORMAL_TILT)}));

float grassWeight = aHeight * aHeight;
float grassBladeHeight = uBladeHeight * length(grassModel[1].xyz);

float grassCalm;
vec3 grassDisp = grassColliderDisplacement(grassRoot, grassWeight, grassBladeHeight, grassCalm);
grassDisp += grassWindDisplacement(grassRoot.xz, grassWeight, grassBladeHeight) * (1.0 - grassCalm);

vec3 grassCx = grassModel[0].xyz;
vec3 grassCy = grassModel[1].xyz;
vec3 grassCz = grassModel[2].xyz;
transformed += vec3(
    dot(grassDisp, grassCx) / dot(grassCx, grassCx),
    dot(grassDisp, grassCy) / dot(grassCy, grassCy),
    dot(grassDisp, grassCz) / dot(grassCz, grassCz)
);
`;

const GRASS_NORMAL = /* glsl */ `
#include <normal_fragment_begin>
normal = normalize(vGrassNormal);
`;

const GRASS_COLOR_PATCH = /* glsl */ `
#include <color_fragment>
// Shaded by the root's height, so a blade matches the ground it grows from.
diffuseColor.rgb = bladeColorAt(vGrassRootXZ, vGrassHeight) * heightShade(vGrassRootY);
`;

export function createGrassMaterial(uniforms: GrassUniforms) {
    const material = new THREE.MeshLambertMaterial({
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
            .replace('#include <color_fragment>', GRASS_COLOR_PATCH);
    };

    material.customProgramCacheKey = () => 'grass-surface';

    return material;
}
