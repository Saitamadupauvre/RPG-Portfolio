import * as THREE from 'three';
import { GRADIENT_RESOLUTION, sampleGradient, type TrailGradientStop } from './TrailRenderer';

/**
 * A weapon trail: the surface a blade sweeps through, not a line behind a point. Every frame
 * the blade's base and tip are sampled as one edge; consecutive edges are stitched into a strip
 * that fades with age. Where TrailRenderer follows one point (a dashing body), this keeps the
 * blade's length, which is what reads as a slash.
 */
export interface BladeTrailOptions {
    /** Seconds an edge stays before it has faded out. */
    time: number;
    /** Colour + alpha by age: t = 0 the newest edge, 1 the oldest. */
    gradient: TrailGradientStop[];
    /** Alpha multiplier at the base edge (the tip edge is 1), so the sweep softens toward the hilt. */
    baseAlpha?: number;
    /** Extra vertices laid on a Catmull-Rom curve between two samples, so a fast swing stays round. */
    subdivisions?: number;
    maxSamples?: number;
}

const DEFAULTS = {
    baseAlpha: 0.15,
    subdivisions: 4,
    maxSamples: 24,
};

const VERTEX = /* glsl */ `
attribute vec4 trailColor;
varying vec4 vColor;

void main() {
    vColor = trailColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

type Sample = { base: THREE.Vector3; tip: THREE.Vector3; age: number };

export class BladeTrail {
    public readonly mesh: THREE.Mesh;

    private options: Required<BladeTrailOptions>;
    private gradient: Float32Array;
    /** Ring buffer; `at(0)` is the newest sample. */
    private samples: Sample[];
    private newest = 0;
    private count = 0;

    private positions: Float32Array;
    private colors: Float32Array;
    private scratchBase = new THREE.Vector3();
    private scratchTip = new THREE.Vector3();

    constructor(parent: THREE.Object3D, options: BladeTrailOptions) {
        this.options = { ...DEFAULTS, ...options };
        this.gradient = sampleGradient(this.options.gradient);
        const { maxSamples, subdivisions } = this.options;
        this.samples = Array.from({ length: maxSamples }, () => ({ base: new THREE.Vector3(), tip: new THREE.Vector3(), age: 0 }));

        // Rows of two vertices (base, tip): one per sample plus the curve points between them.
        const maxRows = (maxSamples - 1) * (subdivisions + 1) + 1;
        this.positions = new Float32Array(maxRows * 2 * 3);
        this.colors = new Float32Array(maxRows * 2 * 4);

        const indices: number[] = [];
        for (let row = 0; row < maxRows - 1; row++) {
            const a = row * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('trailColor', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
        geometry.setIndex(indices);
        geometry.setDrawRange(0, 0);

        const material = new THREE.ShaderMaterial({
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        // Rewritten every frame anywhere on the map; its bounds would always be stale.
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        parent.add(this.mesh);
    }

    /**
     * Ages the trail and, while `emitting`, adds this frame's blade edge (world space).
     * Once emitting stops the trail stays where it was swung and fades out over `time`.
     */
    public update(dt: number, base: THREE.Vector3, tip: THREE.Vector3, emitting: boolean) {
        for (let i = 0; i < this.count; i++) this.at(i).age += dt;
        while (this.count > 0 && this.at(this.count - 1).age >= this.options.time) this.count--;

        if (emitting) {
            this.newest = (this.newest + 1) % this.samples.length;
            const sample = this.samples[this.newest];
            sample.base.copy(base);
            sample.tip.copy(tip);
            sample.age = 0;
            this.count = Math.min(this.count + 1, this.samples.length);
        }

        this.rebuild();
    }

    /** Drops every edge at once (respawn, a cancelled swing). */
    public clear() {
        this.count = 0;
        this.rebuild();
    }

    public dispose() {
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }

    private at(i: number): Sample {
        return this.samples[(this.newest - i + this.samples.length) % this.samples.length];
    }

    private rebuild() {
        // One edge alone is a line, not a surface: nothing to draw yet.
        if (this.count < 2) {
            this.mesh.visible = false;
            return;
        }

        const steps = this.options.subdivisions + 1;
        let row = 0;
        for (let i = 0; i < this.count - 1; i++) {
            // Curve from sample i to i+1, through its neighbours (clamped at the ends).
            const p0 = this.at(Math.max(0, i - 1));
            const p1 = this.at(i);
            const p2 = this.at(i + 1);
            const p3 = this.at(Math.min(this.count - 1, i + 2));
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                catmullRom(p0.base, p1.base, p2.base, p3.base, t, this.scratchBase);
                catmullRom(p0.tip, p1.tip, p2.tip, p3.tip, t, this.scratchTip);
                this.writeRow(row++, THREE.MathUtils.lerp(p1.age, p2.age, t));
            }
        }
        const last = this.at(this.count - 1);
        this.scratchBase.copy(last.base);
        this.scratchTip.copy(last.tip);
        this.writeRow(row++, last.age);

        const geometry = this.mesh.geometry;
        geometry.setDrawRange(0, (row - 1) * 6);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.trailColor.needsUpdate = true;
        this.mesh.visible = true;
    }

    private writeRow(row: number, age: number) {
        const v = row * 2;
        this.scratchBase.toArray(this.positions, v * 3);
        this.scratchTip.toArray(this.positions, (v + 1) * 3);

        const t = THREE.MathUtils.clamp(age / this.options.time, 0, 1);
        const g = Math.round(t * (GRADIENT_RESOLUTION - 1)) * 4;
        for (let k = 0; k < 4; k++) {
            this.colors[v * 4 + k] = this.gradient[g + k];
            this.colors[(v + 1) * 4 + k] = this.gradient[g + k];
        }
        this.colors[v * 4 + 3] *= this.options.baseAlpha;
    }
}

/** Uniform Catmull-Rom between p1 (t = 0) and p2 (t = 1). */
function catmullRom(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3) {
    const t2 = t * t;
    const t3 = t2 * t;
    out.x = 0.5 * (2 * p1.x + (p2.x - p0.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (3 * p1.x - p0.x - 3 * p2.x + p3.x) * t3);
    out.y = 0.5 * (2 * p1.y + (p2.y - p0.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (3 * p1.y - p0.y - 3 * p2.y + p3.y) * t3);
    out.z = 0.5 * (2 * p1.z + (p2.z - p0.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (3 * p1.z - p0.z - 3 * p2.z + p3.z) * t3);
    return out;
}
