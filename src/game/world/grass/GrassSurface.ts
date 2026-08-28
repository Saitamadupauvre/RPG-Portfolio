import * as THREE from 'three';
import { BLADE_HEIGHT, createBladeGeometry } from './bladeGeometry';
import { createGrassMaterial, createGrassUniforms, MAX_COLLIDERS, type GrassUniforms } from './grassMaterial';

export type GrassCollider = { position: THREE.Vector3; radius: number };

export type GrassSurfaceOptions = {
    /** Blades per square world unit of surface area. */
    density?: number;
    /** Edge length of a cull chunk, in the target's local units. */
    chunkSize?: number;
    /** Chunks further than this from the camera are hidden. */
    maxDistance?: number;
};

/** Draw a `ratio` slice of a chunk's blades once it is `distance` units away. */
export type GrassLodLevel = { distance: number; ratio: number };

/**
 * Blades are stored tallest-first, so a ratio keeps the most visible ones and
 * the field thins out instead of dropping whole chunks. Tuned against the
 * scene fog (26..72) so the last tier dies inside the fog, never in clear view.
 */
const DEFAULT_LOD: GrassLodLevel[] = [
    { distance: 18, ratio: 1 },
    { distance: 34, ratio: 0.5 },
    { distance: 52, ratio: 0.22 },
    { distance: Infinity, ratio: 0.09 },
];

const DEFAULT_MAX_DISTANCE = 70;

type Chunk = {
    mesh: THREE.InstancedMesh;
    /** Bounding sphere in the target's local space. */
    sphere: THREE.Sphere;
    target: THREE.Object3D;
    /** Instances the chunk holds; mesh.count is the LOD slice of it. */
    capacity: number;
};

const UP = new THREE.Vector3(0, 1, 0);

// Module-level scratch objects: allocating these per frame would churn the GC.
const _projScreen = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _sphere = new THREE.Sphere();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _point = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _qAlign = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qLean = new THREE.Quaternion();
const _leanAxis = new THREE.Vector3();

const range = (min: number, max: number) => min + Math.random() * (max - min);

type Bucket = {
    matrices: THREE.Matrix4[];
    tints: number[];
    heights: number[];
    box: THREE.Box3;
};

/**
 * Reorders a chunk tallest blade first. LOD then just shortens the draw count,
 * and what survives at distance is the tall grass — the blades that actually
 * carry the silhouette — instead of a random, patchy-looking subset.
 */
function sortBucketByHeight(bucket: Bucket): Bucket {
    const order = bucket.heights
        .map((height, index) => ({ height, index }))
        .sort((a, b) => b.height - a.height);

    return {
        matrices: order.map(({ index }) => bucket.matrices[index]),
        tints: order.map(({ index }) => bucket.tints[index]),
        heights: order.map(({ height }) => height),
        box: bucket.box,
    };
}

/**
 * Scatters instanced grass blades over any mesh's triangles.
 *
 * One instance can host several attached meshes; they share a blade geometry,
 * a material and a uniform block, so wind and collisions are updated once per
 * frame regardless of how many surfaces are grassed.
 */
export class GrassSurface {
    private uniforms: GrassUniforms;
    private bladeGeometry = createBladeGeometry();
    private material: THREE.MeshLambertMaterial;
    private chunks: Chunk[] = [];
    private maxDistance: number;
    private lod: GrassLodLevel[];

    constructor(options: {
        tipColor?: THREE.ColorRepresentation;
        maxDistance?: number;
        lod?: GrassLodLevel[];
    } = {}) {
        this.uniforms = createGrassUniforms(options.tipColor);
        this.material = createGrassMaterial(this.uniforms);
        this.maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
        this.lod = [...(options.lod ?? DEFAULT_LOD)].sort((a, b) => a.distance - b.distance);
    }

    public attach(target: THREE.Mesh, options: GrassSurfaceOptions = {}) {
        const density = options.density ?? 20;
        const chunkSize = options.chunkSize ?? 5;
        if (options.maxDistance !== undefined) this.maxDistance = options.maxDistance;

        const { areas, total } = this.buildAreaTable(target.geometry);
        if (total <= 0) return;

        const bladeCount = Math.round(density * total);
        // Each bucket grows its own bounding box as blades land in it, rather
        // than keeping every sampled point around just to measure it later.
        const buckets = new Map<string, Bucket>();

        for (let i = 0; i < bladeCount; i++) {
            const triangle = this.pickTriangle(areas, total);
            this.readTriangle(target.geometry, triangle);
            this.samplePoint();

            _ab.subVectors(_b, _a);
            _ac.subVectors(_c, _a);
            _normal.crossVectors(_ab, _ac).normalize();

            _qAlign.setFromUnitVectors(UP, _normal);
            _qYaw.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
            _leanAxis.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1).normalize();
            _qLean.setFromAxisAngle(_leanAxis, range(-0.35, 0.35));

            _qAlign.multiply(_qYaw).multiply(_qLean);
            const width = range(0.8, 1.2);
            // Height varies a lot on purpose: a uniform-height lawn reads as a
            // flat green carpet, mixed heights read as grass.
            const height = range(0.55, 1.35);
            _scale.set(width, height, width);
            _matrix.compose(_point, _qAlign, _scale);

            const key = this.chunkKey(_point, chunkSize);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { matrices: [], tints: [], heights: [], box: new THREE.Box3().makeEmpty() };
                buckets.set(key, bucket);
            }
            bucket.matrices.push(_matrix.clone());
            // Per-blade brightness. Without it the field is one flat wash; the
            // speckle is most of what makes painted grass look hand-made.
            bucket.tints.push(range(0.85, 1.15));
            bucket.heights.push(height);
            bucket.box.expandByPoint(_point);
        }

        for (const bucket of buckets.values()) {
            const { matrices, tints, box } = sortBucketByHeight(bucket);
            // Cloned per chunk because aTint is an *instanced* attribute, and
            // instanced attributes live on the geometry — a shared geometry
            // could only ever carry one chunk's tints. The blade itself is a
            // handful of vertices, so the duplication is negligible.
            const geometry = this.bladeGeometry.clone();
            geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(tints), 1));

            const mesh = new THREE.InstancedMesh(geometry, this.material, matrices.length);
            for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            // Culled per chunk by update(), not by three's per-object test.
            mesh.frustumCulled = false;
            target.add(mesh);

            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);
            sphere.radius += BLADE_HEIGHT * 1.5;

            this.chunks.push({ mesh, sphere, target, capacity: matrices.length });
        }
    }

    public update(elapsed: number, camera: THREE.Camera, colliders: GrassCollider[]) {
        this.uniforms.uTime.value = elapsed;
        this.packColliders(camera, colliders);

        _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreen);

        for (const chunk of this.chunks) {
            _sphere.copy(chunk.sphere).applyMatrix4(chunk.target.matrixWorld);
            const distance = _sphere.center.distanceTo(camera.position) - _sphere.radius;

            chunk.mesh.visible = distance < this.maxDistance && _frustum.intersectsSphere(_sphere);
            if (!chunk.mesh.visible) continue;

            // InstancedMesh.count is the draw count, not the allocation: lowering
            // it skips the tail of the buffer, so a coarser LOD costs nothing to
            // switch to and needs no second mesh.
            chunk.mesh.count = Math.max(1, Math.round(chunk.capacity * this.ratioFor(distance)));
        }
    }

    private ratioFor(distance: number): number {
        for (const level of this.lod) {
            if (distance < level.distance) return level.ratio;
        }
        return this.lod[this.lod.length - 1].ratio;
    }

    public dispose() {
        for (const chunk of this.chunks) {
            chunk.mesh.removeFromParent();
            chunk.mesh.geometry.dispose();
            chunk.mesh.dispose();
        }
        this.chunks = [];
        // The template every chunk geometry was cloned from.
        this.bladeGeometry.dispose();
        this.material.dispose();
    }

    /** Nearest colliders to the camera win when there are more than the shader can hold. */
    private packColliders(camera: THREE.Camera, colliders: GrassCollider[]) {
        let selected = colliders;
        if (selected.length > MAX_COLLIDERS) {
            selected = [...colliders]
                .sort((a, b) =>
                    a.position.distanceToSquared(camera.position) - b.position.distanceToSquared(camera.position))
                .slice(0, MAX_COLLIDERS);
        }

        const slots = this.uniforms.uColliders.value;
        for (let i = 0; i < selected.length; i++) {
            const { position, radius } = selected[i];
            slots[i].set(position.x, position.y, position.z, radius);
        }
        this.uniforms.uColliderCount.value = selected.length;
    }

    /**
     * Cumulative triangle areas. Sampling against this makes big triangles
     * receive proportionally more blades — a plain "pick a random triangle"
     * would clump grass wherever the mesh happens to be finely tessellated.
     */
    private buildAreaTable(geometry: THREE.BufferGeometry) {
        const triangleCount = Math.floor((geometry.index?.count ?? geometry.attributes.position.count) / 3);
        const areas = new Float64Array(triangleCount);
        let total = 0;

        for (let i = 0; i < triangleCount; i++) {
            this.readTriangle(geometry, i);
            _ab.subVectors(_b, _a);
            _ac.subVectors(_c, _a);
            total += _ab.cross(_ac).length() * 0.5;
            areas[i] = total;
        }

        return { areas, total };
    }

    private pickTriangle(areas: Float64Array, total: number) {
        const target = Math.random() * total;
        let low = 0;
        let high = areas.length - 1;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (areas[mid] < target) low = mid + 1;
            else high = mid;
        }
        return low;
    }

    private readTriangle(geometry: THREE.BufferGeometry, triangle: number) {
        const position = geometry.attributes.position;
        const index = geometry.index;
        const i = triangle * 3;
        const [ia, ib, ic] = index
            ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
            : [i, i + 1, i + 2];

        _a.fromBufferAttribute(position, ia);
        _b.fromBufferAttribute(position, ib);
        _c.fromBufferAttribute(position, ic);
    }

    /**
     * Uniform barycentric sample of triangle _a/_b/_c into _point. The sqrt is
     * what makes it uniform — raw (r1, r2) weights bunch points near one corner.
     */
    private samplePoint() {
        const u = Math.sqrt(Math.random());
        const v = Math.random();
        _point.set(0, 0, 0)
            .addScaledVector(_a, 1 - u)
            .addScaledVector(_b, u * (1 - v))
            .addScaledVector(_c, u * v);
    }

    /**
     * Chunk on all three local axes, so a plane authored in XY (a ground mesh
     * rotated into place) chunks just as well as one authored in XZ.
     */
    private chunkKey(point: THREE.Vector3, chunkSize: number) {
        const cx = Math.floor(point.x / chunkSize);
        const cy = Math.floor(point.y / chunkSize);
        const cz = Math.floor(point.z / chunkSize);
        return `${cx},${cy},${cz}`;
    }
}
