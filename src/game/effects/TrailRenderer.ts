import * as THREE from 'three';

/** One key of a colour gradient along the trail: t = 0 at the head, 1 at the tail. */
export type TrailGradientStop = { t: number; color: number; alpha: number };

/**
 * Same knobs as Unity's TrailRenderer. Width and colour are evaluated along
 * the trail's current length, not per point age: the shape stays rigid while
 * it moves, and the tail shortens as its oldest points expire.
 */
export interface TrailRendererOptions {
    /** Seconds a point lives before the tail drops it. */
    time: number;
    /** Width multiplier, in world units. */
    width: number;
    /** Width factor along the trail (t = 0 head, 1 tail). Defaults to a straight taper, 1 to 0. */
    widthCurve?: (t: number) => number;
    /** Colour + alpha along the trail, sorted by t. Defaults to solid white. */
    gradient?: TrailGradientStop[];
    /** A new point is only laid down once the head is this far from the last one. */
    minVertexDistance?: number;
    /** 'view' turns the ribbon to face the camera; 'flat' lays it in the ground plane. */
    alignment?: 'view' | 'flat';
    maxPoints?: number;
    /** A jump longer than this (respawn, pool reuse) breaks the trail instead of drawing a line across the map. */
    maxJump?: number;
    /** Seconds the trail takes to pull back into its owner once emitting stops. */
    retractTime?: number;
}

const DEFAULTS = {
    widthCurve: (t: number) => 1 - t,
    gradient: [{ t: 0, color: 0xffffff, alpha: 1 }, { t: 1, color: 0xffffff, alpha: 1 }],
    minVertexDistance: 0.1,
    alignment: 'view' as const,
    maxPoints: 48,
    maxJump: 3,
    retractTime: 0.12,
};

/** Colours sampled once from the gradient; evaluating stops per vertex per frame is wasted work. */
const GRADIENT_RESOLUTION = 64;

// Two vertices per point, pushed apart from the centre line here, so the CPU
// never needs the camera. 'view': across both the trail and the eye ray.
// 'flat': across the trail in the ground plane.
const VERTEX = /* glsl */ `
attribute vec3 trailDirection;
attribute float side;
attribute float halfWidth;
attribute vec4 trailColor;
varying vec4 vColor;

void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
#ifdef ALIGN_FLAT
    vec3 across = (modelViewMatrix * vec4(cross(vec3(0.0, 1.0, 0.0), trailDirection), 0.0)).xyz;
#else
    vec3 viewDirection = (modelViewMatrix * vec4(trailDirection, 0.0)).xyz;
    vec3 across = cross(viewDirection, -viewPosition.xyz);
#endif
    float acrossLength = length(across);
    across = acrossLength > 1e-5 ? across / acrossLength : vec3(0.0);

    viewPosition.xyz += across * side * halfWidth;
    vColor = trailColor;
    gl_Position = projectionMatrix * viewPosition;
}
`;

const FRAGMENT = /* glsl */ `
varying vec4 vColor;

void main() {
    if (vColor.a < 0.004) discard;
    gl_FragColor = vColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

type Point = { position: THREE.Vector3; age: number };

/**
 * A ribbon through the path its owner took, Unity-TrailRenderer style. Call
 * `update` every frame with the owner's position: the head always sits on the
 * owner, points are laid down behind it every `minVertexDistance`, and each
 * expires after `time` seconds. Once emitting stops, the head keeps following
 * the owner and the tail pulls in toward it over `retractTime`, so the trail
 * never lingers detached in the world. Positions are world space, so the mesh
 * belongs to a static parent.
 */
export class TrailRenderer {
    public readonly mesh: THREE.Mesh;

    private options: Required<TrailRendererOptions>;
    private gradient: Float32Array;

    /** Committed points, ring buffer; `at(0)` is the newest. */
    private points: Point[];
    private newest = 0;
    private count = 0;
    /** Where the owner is now; drawn ahead of the committed points. */
    private head = new THREE.Vector3();
    /** Something is on screen and attached to the owner: emitting, or retracting into it. */
    private active = false;
    /** Line length when emitting stopped; the retract shrinks it to zero. -1 while emitting. */
    private retractFrom = -1;
    private retractElapsed = 0;
    /** False when the head sits exactly on the newest point (just committed): a zero-length segment would collapse the head's width. */
    private headDrawn = false;

    private positions: Float32Array;
    private directions: Float32Array;
    private halfWidths: Float32Array;
    private colors: Float32Array;
    private distances: Float32Array;
    private scratch = new THREE.Vector3();

    constructor(parent: THREE.Object3D, options: TrailRendererOptions) {
        this.options = { ...DEFAULTS, ...options };
        this.gradient = sampleGradient(this.options.gradient);

        const max = this.options.maxPoints;
        this.points = Array.from({ length: max }, () => ({ position: new THREE.Vector3(), age: 0 }));

        // +1 for the live head drawn in front of the committed points.
        const vertexCount = (max + 1) * 2;
        this.positions = new Float32Array(vertexCount * 3);
        this.directions = new Float32Array(vertexCount * 3);
        this.halfWidths = new Float32Array(vertexCount);
        this.colors = new Float32Array(vertexCount * 4);
        this.distances = new Float32Array(max + 1);

        const sides = new Float32Array(vertexCount);
        for (let i = 0; i < vertexCount; i += 2) {
            sides[i] = -1;
            sides[i + 1] = 1;
        }

        // The quad strip never changes shape, only how much of it is drawn.
        const indices: number[] = [];
        for (let i = 0; i < max; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', dynamicAttribute(this.positions, 3));
        geometry.setAttribute('trailDirection', dynamicAttribute(this.directions, 3));
        geometry.setAttribute('halfWidth', dynamicAttribute(this.halfWidths, 1));
        geometry.setAttribute('trailColor', dynamicAttribute(this.colors, 4));
        geometry.setAttribute('side', new THREE.BufferAttribute(sides, 1));
        geometry.setIndex(indices);
        geometry.setDrawRange(0, 0);

        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            defines: this.options.alignment === 'flat' ? { ALIGN_FLAT: '' } : {},
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        // Vertices are rewritten every frame anywhere on the map; the bounds would always be stale.
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        parent.add(this.mesh);
    }

    /** Whether the trail still needs the owner's position (emitting or retracting). */
    public get isActive(): boolean {
        return this.active;
    }

    /** Ages and expires points, moves the head onto the owner's `position`, retracts when not `emitting`, rewrites the mesh. */
    public update(dt: number, position: THREE.Vector3, emitting: boolean) {
        for (let i = 0; i < this.count; i++) this.at(i).age += dt;
        while (this.count > 0 && this.at(this.count - 1).age >= this.options.time) this.count--;

        if (emitting) {
            // A dash during a retract carries on the same trail; otherwise start clean.
            if (!this.active) this.count = 0;
            this.active = true;
            this.retractFrom = -1;
        }

        if (this.active) {
            this.follow(position);
            if (!emitting) this.retract(dt);
        }

        this.rebuild();
    }

    public clear() {
        this.count = 0;
        this.active = false;
        this.headDrawn = false;
        this.retractFrom = -1;
        this.rebuild();
    }

    public dispose() {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }

    private at(i: number): Point {
        const max = this.options.maxPoints;
        return this.points[(this.newest - i + max) % max];
    }

    private follow(position: THREE.Vector3) {
        if (this.count > 0 && this.at(0).position.distanceTo(position) > this.options.maxJump) this.count = 0;

        // The first frame anchors the tail where the movement started.
        const committed = this.count === 0 || this.at(0).position.distanceTo(position) >= this.options.minVertexDistance;
        if (committed) this.commit(position);
        this.head.copy(position);
        this.headDrawn = !committed;
    }

    /**
     * Shrinks the line from the tail end toward the head, linearly over
     * `retractTime`. Points keep being laid down meanwhile, so the shrinking
     * trail still follows the path the owner walks instead of stretching.
     */
    private retract(dt: number) {
        if (this.retractFrom < 0) {
            this.retractFrom = this.measure();
            this.retractElapsed = 0;
        }

        this.retractElapsed += dt;
        const remaining = 1 - this.retractElapsed / this.options.retractTime;
        if (remaining <= 0) {
            this.clear();
            return;
        }
        this.trim(this.retractFrom * remaining);
    }

    /** Cuts the line `maxLength` from the head: the point crossing it slides onto the cut, the rest is dropped. */
    private trim(maxLength: number) {
        const length = this.measure();
        if (length <= maxLength) return;

        const n = this.drawnCount();
        for (let i = 1; i < n; i++) {
            if (this.distances[i] <= maxLength) continue;
            const segment = this.distances[i] - this.distances[i - 1];
            const k = segment > 0 ? (maxLength - this.distances[i - 1]) / segment : 0;
            this.drawn(i).lerpVectors(this.drawn(i - 1), this.drawn(i), k);
            // Older points sit further down the ring, so shrinking the count drops exactly them.
            this.count = i + 1 - (this.headDrawn ? 1 : 0);
            return;
        }
    }

    private commit(position: THREE.Vector3) {
        this.newest = (this.newest + 1) % this.options.maxPoints;
        const point = this.at(0);
        point.position.copy(position);
        point.age = 0;
        this.count = Math.min(this.count + 1, this.options.maxPoints);
    }

    private drawnCount(): number {
        return this.count + (this.headDrawn ? 1 : 0);
    }

    /** Fills `distances` (from the head along the line) and returns the line's length. */
    private measure(): number {
        const n = this.drawnCount();
        let length = 0;
        this.distances[0] = 0;
        for (let i = 1; i < n; i++) {
            length += this.drawn(i).distanceTo(this.drawn(i - 1));
            this.distances[i] = length;
        }
        return length;
    }

    /** Point i of the drawn line: the live head first (when it is off the newest point), then the committed points. */
    private drawn(i: number): THREE.Vector3 {
        if (this.headDrawn) return i === 0 ? this.head : this.at(i - 1).position;
        return this.at(i).position;
    }

    private rebuild() {
        const geometry = this.mesh.geometry;
        const n = this.drawnCount();
        // Width and colour stretch over the real length, so the shape holds while it shrinks.
        const length = this.measure();

        const visible = n >= 2 && length > 1e-4;
        this.mesh.visible = visible;
        geometry.setDrawRange(0, visible ? (n - 1) * 6 : 0);
        if (!visible) return;

        const { widthCurve, width } = this.options;
        for (let i = 0; i < n; i++) {
            const t = this.distances[i] / length;
            // Points toward the head; the two ends fall back to a one-sided difference.
            this.scratch.subVectors(this.drawn(Math.max(0, i - 1)), this.drawn(Math.min(n - 1, i + 1)));
            const halfWidth = Math.max(0, widthCurve(t)) * width / 2;
            const g = Math.min(GRADIENT_RESOLUTION - 1, Math.round(t * (GRADIENT_RESOLUTION - 1))) * 4;

            for (let s = 0; s < 2; s++) {
                const v = i * 2 + s;
                this.drawn(i).toArray(this.positions, v * 3);
                this.scratch.toArray(this.directions, v * 3);
                this.halfWidths[v] = halfWidth;
                this.colors.set(this.gradient.subarray(g, g + 4), v * 4);
            }
        }

        for (const name of ['position', 'trailDirection', 'halfWidth', 'trailColor']) {
            geometry.attributes[name].needsUpdate = true;
        }
    }
}

function dynamicAttribute(array: Float32Array, itemSize: number) {
    return new THREE.BufferAttribute(array, itemSize).setUsage(THREE.DynamicDrawUsage);
}

/** Bakes the stops into RGBA rows (linear colour, like every other material input). */
function sampleGradient(stops: TrailGradientStop[]): Float32Array {
    const out = new Float32Array(GRADIENT_RESOLUTION * 4);
    const colors = stops.map((stop) => new THREE.Color(stop.color));
    const mixed = new THREE.Color();

    for (let i = 0; i < GRADIENT_RESOLUTION; i++) {
        const t = i / (GRADIENT_RESOLUTION - 1);
        let next = stops.findIndex((stop) => stop.t >= t);
        if (next === -1) next = stops.length - 1;
        const prev = Math.max(0, next - 1);
        const span = stops[next].t - stops[prev].t;
        const k = span > 0 ? THREE.MathUtils.clamp((t - stops[prev].t) / span, 0, 1) : 0;

        mixed.copy(colors[prev]).lerp(colors[next], k);
        out.set([mixed.r, mixed.g, mixed.b, THREE.MathUtils.lerp(stops[prev].alpha, stops[next].alpha, k)], i * 4);
    }
    return out;
}
