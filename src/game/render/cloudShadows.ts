import * as THREE from 'three';

/**
 * Drifting cloud shadows, as a shader patch rather than geometry.
 *
 * The alternative — real cloud meshes above the map casting into the shadow map
 * — would need a second shadow-casting light and a much larger shadow frustum,
 * and would fight the sun's own shadows for map resolution. Sampling a scrolling
 * noise field in the fragment shader costs a handful of instructions, covers the
 * whole world regardless of the shadow camera's bounds, and never aliases.
 */

const CLOUD_SCALE = 0.045;
const CLOUD_STRENGTH = 0.38;
const CLOUD_DRIFT = new THREE.Vector2(0.55, 0.3);

/**
 * One uniform object shared by every patched material — `Object.assign` copies
 * the reference, not the value, so advancing `uCloudTime.value` once per frame
 * moves the clouds on the ground, the grass and every entity together. Separate
 * uniform objects per material would drift out of sync.
 */
export const cloudUniforms = {
    uCloudTime: { value: 0 },
    uCloudScale: { value: CLOUD_SCALE },
    uCloudStrength: { value: CLOUD_STRENGTH },
    uCloudDrift: { value: CLOUD_DRIFT },
};

export function updateCloudShadows(dt: number) {
    cloudUniforms.uCloudTime.value += dt;
}

/**
 * Declarations + the lookup. Names are `cloud*`-prefixed on purpose: the grass
 * and ground shaders already inject `grassHash`/`grassNoise` from the patch
 * palette, and a duplicate function name is a GLSL link error.
 */
export const CLOUD_FRAGMENT_PARS = /* glsl */ `
uniform float uCloudTime;
uniform float uCloudScale;
uniform float uCloudStrength;
uniform vec2 uCloudDrift;

float cloudHash(vec2 p) {
    return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123);
}

float cloudNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = cloudHash(i);
    float b = cloudHash(i + vec2(1.0, 0.0));
    float c = cloudHash(i + vec2(0.0, 1.0));
    float d = cloudHash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/**
 * Two octaves is enough: one alone gives blobs too regular to read as cloud,
 * three costs more than the extra detail is worth at this scale. The second
 * octave is offset so it does not line up with the first's lattice.
 */
float cloudShadow(vec2 worldXZ) {
    vec2 p = worldXZ * uCloudScale + uCloudDrift * uCloudTime * 0.05;
    float n = cloudNoise(p) * 0.65 + cloudNoise(p * 2.3 + 41.0) * 0.35;

    // smoothstep, not the raw noise: it gives the patches a defined edge and
    // leaves real gaps of full sun between them, instead of a permanent haze
    // over the whole map.
    float cover = smoothstep(0.42, 0.68, n);
    return 1.0 - cover * uCloudStrength;
}
`;

/**
 * The whole `<lights_fragment_end>` replacement: cloud darkening applied to the
 * accumulated diffuse light *before* quantisation, so the cloud's edge snaps
 * into the same bands as the sun's terminator instead of laying a smooth
 * gradient over a cel-shaded scene.
 *
 * `worldXZ` is an expression, not a fixed varying, because each material has a
 * different one available: the ground and grass already carry per-fragment world
 * XZ, while entities use their object origin (see `CLOUD_ORIGIN_*` below).
 *
 * The ratio is clamped because a near-black pixel would divide by a tiny
 * luminance and blow the factor up into a bright fringe.
 */
export function toonLightingGLSL(worldXZ: string): string {
    return /* glsl */ `
#include <lights_fragment_end>
{
    vec3 toonLit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    float toonLum = dot(toonLit, vec3(0.2126, 0.7152, 0.0722));
    if (toonLum > 0.001) {
        float toonTarget = toonLum * cloudShadow(${worldXZ});
        float toonBanded = floor(toonTarget * 4.0 + 0.5) / 4.0;
        float toonRatio = clamp(mix(toonTarget, toonBanded, 0.8) / toonLum, 0.4, 1.25);
        reflectedLight.directDiffuse *= toonRatio;
        reflectedLight.indirectDiffuse *= toonRatio;
    }
}
`;
}

/**
 * Cloud darkening only, for materials that already band their own light — a
 * MeshToonMaterial has quantised the direct term through its gradient map, and
 * running the banding above on top of that would re-quantise an already-stepped
 * value and shift every band edge.
 */
export function cloudOnlyGLSL(worldXZ: string): string {
    return /* glsl */ `
#include <lights_fragment_end>
{
    float toonCloud = cloudShadow(${worldXZ});
    reflectedLight.directDiffuse *= toonCloud;
    reflectedLight.indirectDiffuse *= mix(1.0, toonCloud, 0.5);
}
`;
}

/**
 * Entities sample the cloud at their object origin rather than per-fragment, so
 * a character darkens as a whole when a cloud passes over. That is both the
 * cartoon read we want and skinning-proof: a per-vertex world position taken at
 * `begin_vertex` would be the bind pose on a skinned mesh, and would smear the
 * cloud across an animated model.
 */
const CLOUD_ORIGIN_VERTEX_PARS = /* glsl */ `
varying vec2 vCloudXZ;
`;

const CLOUD_ORIGIN_ASSIGN = /* glsl */ `
#include <begin_vertex>
vCloudXZ = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
`;

const CLOUD_ORIGIN_FRAGMENT_PARS = /* glsl */ `
varying vec2 vCloudXZ;
${CLOUD_FRAGMENT_PARS}
`;

/** Patches a stock material (no shader of its own) with origin-sampled cloud shadows. */
export function applyCloudShadows(material: THREE.Material, cacheKey: string) {
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, cloudUniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${CLOUD_ORIGIN_VERTEX_PARS}`)
            .replace('#include <begin_vertex>', CLOUD_ORIGIN_ASSIGN);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${CLOUD_ORIGIN_FRAGMENT_PARS}`)
            .replace('#include <lights_fragment_end>', cloudOnlyGLSL('vCloudXZ'));
    };

    // Without this three reuses a cached unpatched program for the same material type.
    material.customProgramCacheKey = () => cacheKey;
}
