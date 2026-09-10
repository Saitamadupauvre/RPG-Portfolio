import * as THREE from 'three';
import { TOON_LIGHTING_GLSL } from '../../render/toonLighting';
import { getHeightTexture, heightFieldBounds } from './heightField';

/** Depth over which the sea goes from near-clear at the shore to its full opacity. */
const DEPTH_FADE = 2.6;
/** Opacity right at the waterline, and once past DEPTH_FADE. */
const SHORE_ALPHA = 0.25;
const DEEP_ALPHA = 0.95;
/** Width of the white outline hugging the shore, in world units of depth. */
const OUTLINE_WIDTH = 0.35;

/** Peak-to-trough of the swell, in world units. The waves are real geometry now. */
const WAVE_HEIGHT = 0.42;
/** World-space wavelength of the slowest wave. */
const WAVE_LENGTH = 3.2;

/** Deep saturated navy, close to the reference art, instead of the old shallow teal. */
const WATER_COLOR = 0x0c3f66;
const OUTLINE_COLOR = 0xffffff;

/**
 * Cheap value noise, shared by the swell (vertex) and the foam shards
 * (fragment) - one implementation instead of two copies drifting apart.
 */
const NOISE_GLSL = /* glsl */ `
float waterHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float waterNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = waterHash(i);
    float b = waterHash(i + vec2(1.0, 0.0));
    float c = waterHash(i + vec2(0.0, 1.0));
    float d = waterHash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

/**
 * The swell, shared by the vertex and fragment stages.
 *
 * Two value-noise layers drifting at different speeds and headings, the way
 * Sea of Thieves' ocean is built - it never lines up into the readable ripple
 * lines a sine sum gives you, because two independent fields essentially never
 * agree on where their crests fall. A slow, perfectly uniform "breathing" term
 * rides underneath: it has zero spatial derivative (same everywhere) so it
 * cannot show up as slope or shading, only as the whole sheet of water quietly
 * rising and falling - which is exactly the cue a small, mostly-still lake
 * needs and a pile of ripples alone doesn't give it.
 *
 * No closed-form derivative for value noise, so the slope is a finite
 * difference - four extra noise samples per vertex, still just ALU, no
 * texture fetch, and this runs once per vertex rather than per pixel.
 */
const WAVE_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveLength;

float waterSwellHeight(vec2 xz) {
    float scale = 6.2831853 / uWaveLength;
    // p2's multiplier is capped so its wavelength stays above ~2 plane quads
    // (the 500-unit, 250-segment plane is 2 units per quad) - past that the
    // ripple is smaller than the geometry can resolve and aliases instead of
    // reading as "tighter".
    vec2 p1 = xz * scale * 0.8 + uTime * vec2(0.22, 0.13);
    vec2 p2 = xz * scale * 1.6 + uTime * vec2(-0.18, 0.29);

    float n1 = waterNoise(p1) * 2.0 - 1.0;
    float n2 = waterNoise(p2) * 2.0 - 1.0;

    return (n1 * 0.6 + n2 * 0.4) * uWaveHeight;
}

/**
 * Perfectly uniform, so it has zero spatial derivative and never shows up as
 * slope or shading - only as the whole sheet quietly rising and falling. Kept
 * separate from the noise swell rather than folded into its height: the swell
 * gets damped near a bank by \`waterCalm\` (below) so ripples don't chop the
 * coastline into a dotted line, and a small lake is *mostly* bank - damping
 * the tide along with it would have zeroed the one cue that reads as "moving"
 * at a glance.
 */
float waterBreathe() {
    return sin(uTime * 0.9) * uWaveHeight * 0.5;
}

void waterWave(vec2 xz, out float height, out vec2 slope) {
    const float EPS = 0.4;
    float hL = waterSwellHeight(xz - vec2(EPS, 0.0));
    float hR = waterSwellHeight(xz + vec2(EPS, 0.0));
    float hD = waterSwellHeight(xz - vec2(0.0, EPS));
    float hU = waterSwellHeight(xz + vec2(0.0, EPS));

    height = waterSwellHeight(xz);
    slope = vec2(hR - hL, hU - hD) / (2.0 * EPS);
}
`;

/**
 * Terrain height under a point, sampled from the heightfield texture.
 *
 * The field is one texel per tile *corner*, so a position measured in tiles maps
 * to texel centres by the usual +0.5 offset. Get that wrong and the whole
 * coastline slides half a tile off the cliff it belongs to.
 */
const GROUND_GLSL = /* glsl */ `
uniform sampler2D uHeightMap;
uniform vec2 uHeightOrigin;
uniform vec2 uHeightTiles;
uniform float uHeightTileSize;
uniform float uWaterLevel;

float waterGroundHeight(vec2 worldXZ) {
    vec2 texels = uHeightTiles + 1.0;
    vec2 inTiles = (worldXZ - uHeightOrigin) / uHeightTileSize;
    vec2 uv = (clamp(inTiles, vec2(0.0), uHeightTiles) + 0.5) / texels;
    float height = texture2D(uHeightMap, uv).r;

    // Past the map edge there is no terrain at all, so the sea floor drops away.
    // Sloping rather than stepping keeps the coast from ending in a hard ring
    // where the grid stops, and gives the island a shelf to sit on.
    vec2 outside = max(vec2(0.0), abs(inTiles - uHeightTiles * 0.5) - uHeightTiles * 0.5);
    return height - length(outside) * uHeightTileSize * 3.0;
}
`;

const WATER_VERTEX_PARS = /* glsl */ `
varying vec2 vWaterXZ;
varying vec3 vWaterWave;
varying float vWaterViewZ;
${GROUND_GLSL}
${NOISE_GLSL}
${WAVE_GLSL}
`;

/**
 * Displace the plane's vertices.
 *
 * The world XZ is rebuilt here rather than taken from a later chunk because the
 * displacement has to happen before `project_vertex` turns `transformed` into a
 * clip position. Amplitude is damped by depth so the swell flattens into the
 * shore instead of chopping the coastline into a dotted line. The heightfield
 * is only ever read here, approximate and cheap, to know how calm to make the
 * swell near a bank - the coastline itself is drawn in the fragment stage from
 * the real rendered depth, not from this field.
 */
const WATER_VERTEX = /* glsl */ `
#include <begin_vertex>

vec3 waterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWaterXZ = waterWorld.xz;

float waterVertexDepth = uWaterLevel - waterGroundHeight(vWaterXZ);
float waterCalm = smoothstep(0.0, 1.2, waterVertexDepth);

float waterHeight;
vec2 waterSlope;
waterWave(vWaterXZ, waterHeight, waterSlope);

vWaterWave = vec3(waterHeight * waterCalm + waterBreathe(), waterSlope * waterCalm);
transformed.y += vWaterWave.x;

vWaterViewZ = -(modelViewMatrix * vec4(transformed, 1.0)).z;
`;

const WATER_FRAGMENT_PARS = /* glsl */ `
varying vec2 vWaterXZ;
varying vec3 vWaterWave;
varying float vWaterViewZ;
uniform vec3 uWaterColor;
uniform vec3 uOutlineColor;
uniform float uDepthFade;
uniform float uOutlineWidth;
uniform float uShoreAlpha;
uniform float uDeepAlpha;
uniform sampler2D uSceneDepth;
uniform vec2 uResolution;
uniform float uCameraNear;
uniform float uCameraFar;
uniform float uWaterLevel;
uniform float uWaveHeight;

/**
 * The scene's own depth buffer (water excluded), read back as a straight
 * camera distance. This is what makes the shore and foam hug whatever is
 * actually rendered - a gentle beach, a sheer cliff, a prop standing in the
 * shallows - instead of a heightfield sampled at a different resolution that
 * can drift out of step with the real geometry.
 */
float waterSceneDistance(vec2 screenUV) {
    float ndcDepth = texture2D(uSceneDepth, screenUV).x * 2.0 - 1.0;
    return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - ndcDepth * (uCameraFar - uCameraNear));
}
${NOISE_GLSL}
`;

/**
 * One colour, one white foam edge, nothing else painted. Body-of-sea variation
 * comes from light hitting the displaced geometry; the foam is a thin solid
 * line right at the shore that fractures into disconnected noisy shards a bit
 * further out, instead of one smooth ring - closer to the hand-drawn splash
 * look in the reference art. "Depth" here is camera-space depth into the
 * water (scene distance minus the water's own distance), not world-space
 * water depth - the standard stylized-water trick, and what keeps the foam
 * locked to the real edge of whatever the water is sitting against.
 */
const WATER_COLOR_GLSL = /* glsl */ `
#include <color_fragment>

vec2 waterScreenUV = gl_FragCoord.xy / uResolution;
float waterDepth = waterSceneDistance(waterScreenUV) - vWaterViewZ;

// fwidth is how much depth changes across one pixel, so this fades the coast
// over exactly one pixel however far away it is - an antialiased edge for the
// price of a derivative, where a bare discard gives a staircase. Clamped: a
// steep bank makes depth jump hard across one pixel, and an unclamped
// derivative there blows the antialiasing band past the whole outline width,
// washing the foam out to nothing instead of drawing a crisp line.
float waterEdge = min(fwidth(waterDepth), 0.5) + 0.002;
if (waterDepth < -waterEdge) discard;
float waterCoast = smoothstep(-waterEdge, waterEdge, waterDepth);

// A slim, always-solid line right against the shore...
float waterCoreWidth = uOutlineWidth * 0.4;
float waterCoreLine = 1.0 - smoothstep(waterCoreWidth - waterEdge, waterCoreWidth + waterEdge, waterDepth);

// ...plus jagged shards further out: the same band, but its outer edge is
// jittered by noise and the band itself is chopped into disconnected patches
// by a second, coarser noise field.
float waterShardJitter = (waterNoise(vWaterXZ * 6.0) - 0.5) * uOutlineWidth * 2.2;
float waterShardDepth = waterDepth - waterShardJitter;
float waterShardEdge = clamp(fwidth(waterShardDepth), 0.01, 0.5);
float waterShardLine = 1.0 - smoothstep(uOutlineWidth - waterShardEdge, uOutlineWidth + waterShardEdge, waterShardDepth);
waterShardLine *= smoothstep(0.32, 0.55, waterNoise(vWaterXZ * 2.4 + 13.7));

float waterOutline = max(waterCoreLine, waterShardLine);

diffuseColor.rgb = mix(uWaterColor, uOutlineColor, waterOutline);

// No paint on the swell itself - Sea of Thieves reads the waves purely as
// shading: a soft shadow sitting in the troughs, the surface's own colour
// everywhere else. Height alone (not slope) so it's a calm tonal roll rather
// than a hard rim on the flanks.
float waterTrough = smoothstep(0.05, -0.85, vWaterWave.x / max(uWaveHeight, 0.0001));
diffuseColor.rgb *= mix(1.0, 0.82, waterTrough * waterCoast);

float waterAlpha = mix(uShoreAlpha, uDeepAlpha, smoothstep(0.0, uDepthFade, waterDepth));
diffuseColor.a = max(waterAlpha, waterOutline) * waterCoast;
`;

/**
 * The normal of the displaced surface, from the wave's exact derivative.
 *
 * The geometry really moves, but a plane's interpolated normal still points
 * straight up unless it is rebuilt - and without it the toon banding collapses
 * the whole ocean into one uniform band. Slope along each axis, negated, against
 * a unit up: the standard height-field-to-normal.
 */
const WATER_NORMAL = /* glsl */ `
#include <normal_fragment_begin>

vec3 waterNormal = normalize(vec3(-vWaterWave.y, 1.0, -vWaterWave.z));
// The normal is in view space by the time lighting reads it. viewMatrix is the
// one transform available here (normalMatrix is vertex-side only), and w = 0
// makes it rotate the direction without translating it.
normal = normalize((viewMatrix * vec4(waterNormal, 0.0)).xyz);
`;

export type WaterUniforms = {
    uWaterLevel: { value: number };
    uTime: { value: number };
    uHeightMap: { value: THREE.Texture };
    uHeightOrigin: { value: THREE.Vector2 };
    uHeightTiles: { value: THREE.Vector2 };
    uHeightTileSize: { value: number };
    uWaterColor: { value: THREE.Color };
    uOutlineColor: { value: THREE.Color };
    uDepthFade: { value: number };
    uOutlineWidth: { value: number };
    uShoreAlpha: { value: number };
    uDeepAlpha: { value: number };
    uWaveHeight: { value: number };
    uWaveLength: { value: number };
    uSceneDepth: { value: THREE.Texture | null };
    uResolution: { value: THREE.Vector2 };
    uCameraNear: { value: number };
    uCameraFar: { value: number };
};

/**
 * Built the same way as the ground (`grass/groundMaterial.ts`): a stock Lambert
 * patched through `onBeforeCompile`, so it inherits the scene's lights, fog and
 * shadows and can run the shared toon banding. A raw ShaderMaterial would have
 * to re-implement all of that to sit next to the terrain without looking foreign.
 */
export function createWaterMaterial(waterLevel: number): {
    material: THREE.MeshLambertMaterial;
    uniforms: WaterUniforms;
} {
    const bounds = heightFieldBounds();
    const texture = getHeightTexture();

    const uniforms: WaterUniforms = {
        uWaterLevel: { value: waterLevel },
        uTime: { value: 0 },
        uHeightMap: { value: texture },
        uHeightOrigin: { value: bounds.origin },
        uHeightTiles: { value: bounds.tiles },
        uHeightTileSize: { value: bounds.tileSize },
        uWaterColor: { value: new THREE.Color(WATER_COLOR) },
        uOutlineColor: { value: new THREE.Color(OUTLINE_COLOR) },
        uDepthFade: { value: DEPTH_FADE },
        uOutlineWidth: { value: OUTLINE_WIDTH },
        uShoreAlpha: { value: SHORE_ALPHA },
        uDeepAlpha: { value: DEEP_ALPHA },
        uWaveHeight: { value: WAVE_HEIGHT },
        uWaveLength: { value: WAVE_LENGTH },
        uSceneDepth: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uCameraNear: { value: 0.1 },
        uCameraFar: { value: 150 },
    };

    const material = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        // A dark navy multiplied by toon-banded shadow light crushes to near
        // black in a walled-in pond that never catches direct sun. Emissive
        // sits outside the light multiply, so it keeps the sea readably blue
        // in full shade without washing out the lit swell.
        emissive: new THREE.Color(WATER_COLOR).multiplyScalar(0.35),
        transparent: true,
        // The surface must not occlude what is under it, but still be occluded by
        // anything standing above it — that is depth-test on, depth-write off.
        depthWrite: false,
        side: THREE.FrontSide,
    });

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${WATER_VERTEX_PARS}`)
            .replace('#include <begin_vertex>', WATER_VERTEX);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${WATER_FRAGMENT_PARS}`)
            .replace('#include <lights_fragment_end>', TOON_LIGHTING_GLSL)
            .replace('#include <color_fragment>', WATER_COLOR_GLSL)
            .replace('#include <normal_fragment_begin>', WATER_NORMAL);
    };

    material.customProgramCacheKey = () => 'patched-water';

    return { material, uniforms };
}
