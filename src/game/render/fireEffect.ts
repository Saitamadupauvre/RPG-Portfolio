import * as THREE from 'three';
import { PALETTE } from './palette';
import { createRandom } from '../world/grass/random';

const PARTICLE_COUNT = 72;

/**
 * Billboarded soft discs, animated entirely on the GPU: each particle's place in
 * its life is `fract(time * speed + seed)`, so nothing is updated per particle on
 * the CPU. Born gold at the logs, orange as it climbs, then smoke-grey and gone.
 *
 * `uIntensity` (0..1) is the one knob: it decides how many particles exist at
 * all (a low fire is sparse, not merely small), how high they climb and how big
 * they are, so a dim fire and a roaring one read as clearly different fires.
 */
const PARTICLE_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uIntensity;
uniform float uHeight;
uniform float uSize;
varying vec2 vUv;
varying float vLife;
varying float vVisible;

void main() {
    float speed = mix(0.55, 1.0, aSeed.x);
    float life = fract(uTime * speed + aSeed.y);

    vVisible = step(aSeed.z, uIntensity);
    vLife = life;
    vUv = uv;

    float climb = life * (0.6 + 0.4 * aSeed.x) * uHeight;
    float angle = aSeed.w * 6.2831 + life * 2.4;
    // Born wide at the logs, narrowing into a flame, drifting out again as smoke.
    float spread = (0.16 + 0.1 * aSeed.x) * (1.0 - 0.7 * smoothstep(0.0, 0.5, life) + 0.6 * smoothstep(0.55, 1.0, life));
    vec3 centre = vec3(cos(angle) * spread, climb, sin(angle) * spread);

    float size = uSize * vVisible
        * smoothstep(0.0, 0.08, life)
        * mix(1.0, 0.55, life)
        * (0.65 + 0.7 * aSeed.w)
        * (0.5 + 0.5 * uIntensity);

    vec4 viewPosition = modelViewMatrix * vec4(centre, 1.0);
    viewPosition.xy += position.xy * size;
    gl_Position = projectionMatrix * viewPosition;
}
`;

const PARTICLE_FRAGMENT = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uFlame;
uniform vec3 uSmoke;
varying vec2 vUv;
varying float vLife;
varying float vVisible;

void main() {
    float distanceFromCentre = length(vUv - 0.5) * 2.0;
    float shape = 1.0 - smoothstep(0.72, 1.0, distanceFromCentre);

    vec3 colour = mix(uCore, uFlame, smoothstep(0.0, 0.3, vLife));
    colour = mix(colour, uSmoke, smoothstep(0.42, 0.78, vLife));

    float smoke = smoothstep(0.42, 0.78, vLife);
    float alpha = shape * vVisible
        * smoothstep(0.0, 0.08, vLife)
        * (1.0 - smoothstep(0.72, 1.0, vLife))
        * mix(1.0, 0.75, smoke);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

const GLOW_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uStrength;
varying vec2 vUv;
void main() {
    float falloff = 1.0 - smoothstep(0.0, 1.0, length(vUv - 0.5) * 2.0);
    float alpha = falloff * falloff * uStrength;
    if (alpha < 0.005) discard;
    gl_FragColor = vec4(uColour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/** How far the firelight reaches over the ground at full strength, and how bright it is there. */
const GLOW_RADIUS = 1.9;
const GLOW_MAX_STRENGTH = 0.4;

/** A dim fire is mostly embers close to the logs; a roaring one reaches this high. */
const HEIGHT_DIM = 0.3;
const HEIGHT_ROARING = 1.5;
const PARTICLE_SIZE = 0.38;

export type FireEffect = {
    object: THREE.Group;
    /** `time` in seconds; `intensity` 0 (out) to 1 (roaring). */
    update(time: number, intensity: number): void;
};

/**
 * `fireHeight` lifts the particles from the ground to the middle of the logs;
 * the firelight stays on the ground, where it is seen.
 */
export function createFireEffect(fireHeight: number): FireEffect {
    const random = createRandom(7);
    const seeds = new Float32Array(PARTICLE_COUNT * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = random();

    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geometry.instanceCount = PARTICLE_COUNT;

    const particleUniforms = {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uHeight: { value: HEIGHT_DIM },
        uSize: { value: PARTICLE_SIZE },
        uCore: { value: new THREE.Color(PALETTE.gold) },
        uFlame: { value: new THREE.Color(PALETTE.autumn) },
        uSmoke: { value: new THREE.Color(PALETTE.stone) },
    };
    const particles = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        uniforms: particleUniforms,
        vertexShader: PARTICLE_VERTEX,
        fragmentShader: PARTICLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
    }));
    // Instances roam away from the quad's own bounds, which would cull them wrongly.
    particles.frustumCulled = false;
    particles.position.y = fireHeight;

    const glowUniforms = {
        uColour: { value: new THREE.Color(PALETTE.autumn) },
        uStrength: { value: 0 },
    };
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(GLOW_RADIUS * 2, GLOW_RADIUS * 2), new THREE.ShaderMaterial({
        uniforms: glowUniforms,
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;

    const object = new THREE.Group();
    object.add(glow, particles);

    return {
        object,
        update(time, intensity) {
            particleUniforms.uTime.value = time;
            particleUniforms.uIntensity.value = intensity;
            particleUniforms.uHeight.value = THREE.MathUtils.lerp(HEIGHT_DIM, HEIGHT_ROARING, intensity);

            // A slow, uneven flicker; the dim fire flickers less because there is less to flicker.
            const flicker = 1 + 0.12 * Math.sin(time * 7.3) * Math.sin(time * 3.1 + 1.0);
            glowUniforms.uStrength.value = GLOW_MAX_STRENGTH * intensity * intensity * flicker;
        },
    };
}
