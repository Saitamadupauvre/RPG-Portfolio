import * as THREE from 'three';
import { PALETTE } from '../render/palette';
import { WIND_LAYER } from '../render/layers';
import { getWindUniforms, WIND_GLSL } from './wind';

/** Quads along one ribbon. Enough for a loop to read round, not faceted. */
const SEGMENTS = 28;
/** Ribbons alive at once at full quality. */
export const MAX_STREAKS = 8;
/** World units travelled per second, per unit of `WIND.speed`: 2.3 gives ~2.3 u/s, a drift rather than a dart. */
const TRAVEL_PER_SPEED = 1;
/** How far back in time the tail samples the path, in seconds: sets the ribbon's length. */
const TRAIL_TIME = 1.3;
/** Ribbon half width at its widest, world units. */
const HALF_WIDTH = 0.1;
const OPACITY = 0.5;
/** Life range in seconds; a streak spawns again elsewhere once it ends. */
const LIFE_MIN = 6;
const LIFE_MAX = 9;
/**
 * Where a streak is born, in the wind's own frame round the player: far
 * upwind, so it fades in at a distance and drifts into view, and off to one
 * side of the player's wind line, so it passes beside the knight rather than
 * through them.
 */
const SPAWN_UPWIND_MIN = 8;
const SPAWN_UPWIND_MAX = 15;
const SPAWN_ACROSS_MIN = 4.5;
const SPAWN_ACROSS_MAX = 13;
/** A streak drifting near the player anyway fades out inside this ring (inner, outer). */
const CLEAR_NEAR = 3.5;
const CLEAR_FAR = 6;
/** Height above the highest ground or water along the path; a share of streaks ride the high band. */
const HEIGHT_MIN = 0.9;
const HEIGHT_MAX = 2.2;
const HIGH_CHANCE = 0.35;
const HIGH_MIN = 3;
const HIGH_MAX = 4.5;
/** Share of streaks that curl into a loop once in their life. */
const LOOP_CHANCE = 0.55;

const f = (value: number) => value.toFixed(4);

// Each vertex places itself on its streak's path at (age - along * TRAIL_TIME):
// the tail is where the head *was*, so the ribbon follows its own curls with
// no history kept on the CPU. The path is one function of time, evaluated
// twice per vertex (position + a step ahead for the tangent).
const VERTEX = /* glsl */ `
${WIND_GLSL}
uniform float uTime;
uniform vec3 uFocus;
attribute float along;
attribute float side;
attribute vec3 aSpawn;
attribute vec2 aLife;
attribute vec4 aSeed;
varying float vAlpha;
varying float vSide;
#include <fog_pars_vertex>

const float PI = 3.14159265;

vec3 pathAt(float s) {
    vec3 dir = vec3(uWindDir.x, 0.0, uWindDir.y);
    vec3 across = vec3(-dir.z, 0.0, dir.x);
    vec3 up = vec3(0.0, 1.0, 0.0);

    vec3 p = aSpawn + dir * s * uWindSpeed * ${f(TRAVEL_PER_SPEED)};
    // Lazy meander: a slow sway across the wind plus a softer bob.
    p += across * sin(s * (0.5 + aSeed.x * 0.4) + aSeed.y * 6.28) * (0.5 + aSeed.z * 0.6);
    p += up * sin(s * (0.7 + aSeed.z * 0.4) + aSeed.x * 6.28) * 0.25;

    // The loop: one turn of a circle in the plane of the wind and loopAxis.
    // Smootherstep on the angle keeps the speed continuous where it starts and
    // ends, and makes the turn fastest at the top, which is what draws it as a
    // closed curl rather than a wave: there it outruns the forward drift.
    float radius = aSeed.w;
    if (radius > 0.0) {
        float loopStart = 0.8 + aSeed.y * 2.0;
        float loopDuration = 1.1 + aSeed.x * 0.4;
        float u = clamp((s - loopStart) / loopDuration, 0.0, 1.0);
        float a = 6.2831853 * u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
        vec3 loopAxis = normalize(mix(up, across, step(0.5, aSeed.z) * 0.6));
        p += dir * sin(a) * radius + loopAxis * (1.0 - cos(a)) * radius;
    }
    return p;
}

void main() {
    float age = uTime - aLife.x;
    float s = max(age - along * ${f(TRAIL_TIME)}, 0.0);

    vec3 worldPosition = pathAt(s);
    vec3 ahead = pathAt(s + 0.02) - worldPosition;

    vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
    vec3 viewTangent = (viewMatrix * vec4(ahead, 0.0)).xyz;
    vec3 widthDir = cross(viewTangent, -mvPosition.xyz);
    float widthLength = length(widthDir);
    widthDir = widthLength > 1e-6 ? widthDir / widthLength : vec3(0.0);

    // Pointed at both ends, fullest just behind the head.
    float taper = sin(PI * pow(along, 0.6));
    mvPosition.xyz += widthDir * side * taper * ${f(HALF_WIDTH)};

    float fadeIn = smoothstep(0.0, 1.8, age);
    float fadeOut = 1.0 - smoothstep(aLife.y - 1.5, aLife.y, age);
    float clearOfPlayer = smoothstep(${f(CLEAR_NEAR)}, ${f(CLEAR_FAR)}, distance(worldPosition.xz, uFocus.xz));
    // Thins out toward the tail, so it reads as a gust trailing off.
    float tail = 1.0 - along * along;
    // Calm air shows fewer, fainter streaks; the 0.3 is WIND.strength's default.
    float windShow = clamp(uWindStrength / 0.3, 0.0, 1.5);
    vAlpha = fadeIn * fadeOut * tail * windShow * clearOfPlayer;
    vSide = side;

    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vSide;
#include <fog_pars_fragment>

void main() {
    // A flat core with a thin soft rim: stylized, but not aliased at 3 px wide.
    float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
    float alpha = vAlpha * edge * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

/** Highest of ground and water at a point, for spawning above both. */
export type SurfaceHeight = (x: number, z: number) => number;

/**
 * Stylized wind streaks: thin cream ribbons drifting downwind, some curling
 * into a loop. They read the shared wind uniforms, so they always blow with
 * the grass and the sea.
 *
 * One instanced draw call. The motion lives in the vertex shader; the
 * CPU only respawns a streak (a few floats) when its life ends, a few
 * times a second in all.
 */
export class WindStreaks {
    public readonly mesh: THREE.Mesh;
    private geometry: THREE.InstancedBufferGeometry;

    private uniforms: { uTime: { value: number }; uFocus: { value: THREE.Vector3 } };
    private spawn: THREE.InstancedBufferAttribute;
    private life: THREE.InstancedBufferAttribute;
    private seed: THREE.InstancedBufferAttribute;
    private surfaceHeight: SurfaceHeight;
    private started = false;

    constructor(surfaceHeight: SurfaceHeight) {
        this.surfaceHeight = surfaceHeight;

        // A strip from head (along 0) to tail (along 1), two vertices per step.
        const vertexCount = (SEGMENTS + 1) * 2;
        const alongs = new Float32Array(vertexCount);
        const sides = new Float32Array(vertexCount);
        for (let i = 0; i <= SEGMENTS; i++) {
            alongs[i * 2] = alongs[i * 2 + 1] = i / SEGMENTS;
            sides[i * 2] = -1;
            sides[i * 2 + 1] = 1;
        }
        const indices: number[] = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }

        const geometry = new THREE.InstancedBufferGeometry();
        // Three wants a position attribute to count vertices; the shader ignores it.
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        geometry.setAttribute('along', new THREE.BufferAttribute(alongs, 1));
        geometry.setAttribute('side', new THREE.BufferAttribute(sides, 1));
        geometry.setIndex(indices);

        this.spawn = instanced(3);
        this.life = instanced(2);
        this.seed = instanced(4);
        geometry.setAttribute('aSpawn', this.spawn);
        geometry.setAttribute('aLife', this.life);
        geometry.setAttribute('aSeed', this.seed);

        this.uniforms = { uTime: { value: 0 }, uFocus: { value: new THREE.Vector3() } };
        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            // Spread, not merged: UniformsUtils.merge would clone the wind
            // uniforms and cut the link to the grass and the sea.
            uniforms: {
                ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
                ...getWindUniforms(),
                ...this.uniforms,
                uColor: { value: new THREE.Color(PALETTE.cream) },
                uOpacity: { value: OPACITY },
            },
            fog: true,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        // A plain Mesh over instanced geometry, not an InstancedMesh: there is no
        // per-instance matrix to keep, the shader places every vertex itself.
        geometry.instanceCount = MAX_STREAKS;
        this.geometry = geometry;
        this.mesh = new THREE.Mesh(geometry, material);
        // Positions come from the shader anywhere round the player; the bounds would be wrong.
        this.mesh.frustumCulled = false;
        // Kept out of the water depth prepass, which would otherwise draw them into the shore foam.
        this.mesh.layers.set(WIND_LAYER);
        // After the water, so a streak over the sea blends on top of it.
        this.mesh.renderOrder = 11;
    }

    /** How many streaks draw; the quality setting lowers it, 0 hides the mesh. */
    public setCount(count: number) {
        this.geometry.instanceCount = Math.min(count, MAX_STREAKS);
        this.mesh.visible = this.geometry.instanceCount > 0;
    }

    /** `time` = the clock the grass and water use, so all three stay in step. */
    public update(time: number, focus: THREE.Vector3) {
        this.uniforms.uTime.value = time;
        this.uniforms.uFocus.value.copy(focus);
        if (!this.mesh.visible) return;

        const lives = this.life.array as Float32Array;
        let respawned = false;
        for (let i = 0; i < this.geometry.instanceCount; i++) {
            // First frame: births spread back over a life, so they do not all appear at once.
            const born = this.started ? null : time - Math.random() * LIFE_MAX;
            if (born === null && time - lives[i * 2] < lives[i * 2 + 1]) continue;
            this.respawn(i, born ?? time, focus);
            respawned = true;
        }
        this.started = true;
        if (respawned) {
            this.spawn.needsUpdate = true;
            this.life.needsUpdate = true;
            this.seed.needsUpdate = true;
        }
    }

    private respawn(index: number, birth: number, focus: THREE.Vector3) {
        const { uWindDir, uWindSpeed } = getWindUniforms();
        const dir = uWindDir.value;
        const life = THREE.MathUtils.lerp(LIFE_MIN, LIFE_MAX, Math.random());

        const upwind = THREE.MathUtils.lerp(SPAWN_UPWIND_MIN, SPAWN_UPWIND_MAX, Math.random());
        const across = THREE.MathUtils.lerp(SPAWN_ACROSS_MIN, SPAWN_ACROSS_MAX, Math.random()) * (Math.random() < 0.5 ? -1 : 1);
        // (-dir.y, dir.x) is the wind's left, the same `across` the shader sways along.
        const x = focus.x - dir.x * upwind - dir.y * across;
        const z = focus.z - dir.y * upwind + dir.x * across;

        // Above the highest surface along the way (start, middle, end), so a
        // streak never threads through a cliff it drifts into.
        const travel = life * uWindSpeed.value * TRAVEL_PER_SPEED;
        const floor = Math.max(
            this.surfaceHeight(x, z),
            this.surfaceHeight(x + dir.x * travel * 0.5, z + dir.y * travel * 0.5),
            this.surfaceHeight(x + dir.x * travel, z + dir.y * travel),
        );
        const high = Math.random() < HIGH_CHANCE;
        const y = floor + (high
            ? THREE.MathUtils.lerp(HIGH_MIN, HIGH_MAX, Math.random())
            : THREE.MathUtils.lerp(HEIGHT_MIN, HEIGHT_MAX, Math.random()));

        this.spawn.setXYZ(index, x, y, z);
        this.life.setXY(index, birth, life);
        const radius = Math.random() < LOOP_CHANCE ? THREE.MathUtils.lerp(0.6, 1.1, Math.random()) : 0;
        this.seed.setXYZW(index, Math.random(), Math.random(), Math.random(), radius);
    }
}

function instanced(itemSize: number): THREE.InstancedBufferAttribute {
    const attribute = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STREAKS * itemSize), itemSize);
    attribute.setUsage(THREE.DynamicDrawUsage);
    return attribute;
}
