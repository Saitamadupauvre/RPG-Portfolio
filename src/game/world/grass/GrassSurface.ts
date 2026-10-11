import * as THREE from 'three';
import { BLADE_HEIGHT, createBladeGeometry } from './bladeGeometry';
import { createGrassMaterial, createGrassUniforms, MAX_COLLIDERS, type GrassUniforms } from './grassMaterial';
import { createRandom, hashString, type Random } from './random';

export type GrassCollider = { position: THREE.Vector3; radius: number };

export type GrassBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type GrassSurfaceOptions = {
    key: string;
    density?: number;
    chunkSize?: number;
    maxDistance?: number;
    acceptNormal?: (normal: THREE.Vector3) => number;
    rejectPoint?: (x: number, z: number) => boolean;
    triangles?: number[];
    sampleGeometry?: THREE.BufferGeometry;
};

export type GrassLodLevel = { distance: number; ratio: number };

const DEFAULT_LOD: GrassLodLevel[] = [
    { distance: 12, ratio: 1 },
    { distance: 22, ratio: 0.5 },
    { distance: 32, ratio: 0.25 },
    { distance: Infinity, ratio: 0.1 },
];

export const GRASS_LAYER = 1;

const DEFAULT_MAX_DISTANCE = 70;
const DEFAULT_DENSITY = 20;
const DEFAULT_CHUNK_SIZE = 5;
const MATRIX_FLOATS = 16;
const INITIAL_BUCKET_BLADES = 256;
const CHUNK_AXIS_SPAN = 4096;
const CHUNK_AXIS_OFFSET = CHUNK_AXIS_SPAN / 2;
const SPHERE_PADDING = BLADE_HEIGHT * 1.5;
const MAX_LEAN = 0.35;
const WIDTH_RANGE = [0.8, 1.2] as const;
const HEIGHT_RANGE = [0.55, 1.35] as const;

type Chunk = {
    mesh: THREE.InstancedMesh;
    sphere: THREE.Sphere;
    target: THREE.Object3D;
    key: string;
    capacity: number;
};

type Bucket = {
    matrices: Float32Array;
    length: number;
    box: THREE.Box3;
};

type RankedCollider = { collider: GrassCollider; distance: number };

const UP = new THREE.Vector3(0, 1, 0);

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

function range(random: Random, [min, max]: readonly [number, number]) {
    return min + random() * (max - min);
}

function chunkKey(point: THREE.Vector3, chunkSize: number): number {
    const cx = Math.floor(point.x / chunkSize) + CHUNK_AXIS_OFFSET;
    const cy = Math.floor(point.y / chunkSize) + CHUNK_AXIS_OFFSET;
    const cz = Math.floor(point.z / chunkSize) + CHUNK_AXIS_OFFSET;
    return (cx * CHUNK_AXIS_SPAN + cy) * CHUNK_AXIS_SPAN + cz;
}

function createBucket(): Bucket {
    return {
        matrices: new Float32Array(INITIAL_BUCKET_BLADES * MATRIX_FLOATS),
        length: 0,
        box: new THREE.Box3().makeEmpty(),
    };
}

function pushMatrix(bucket: Bucket, matrix: THREE.Matrix4) {
    if (bucket.length + MATRIX_FLOATS > bucket.matrices.length) {
        const grown = new Float32Array(bucket.matrices.length * 2);
        grown.set(bucket.matrices);
        bucket.matrices = grown;
    }
    matrix.toArray(bucket.matrices, bucket.length);
    bucket.length += MATRIX_FLOATS;
}

function readTriangle(geometry: THREE.BufferGeometry, triangle: number) {
    const position = geometry.attributes.position;
    const index = geometry.index;
    const i = triangle * 3;

    _a.fromBufferAttribute(position, index ? index.getX(i) : i);
    _b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
    _c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
}

function samplePoint(random: Random) {
    const u = Math.sqrt(random());
    const v = random();
    _point.set(0, 0, 0)
        .addScaledVector(_a, 1 - u)
        .addScaledVector(_b, u * (1 - v))
        .addScaledVector(_c, u * v);
}

function buildAreaTable(geometry: THREE.BufferGeometry, triangles?: number[]) {
    const count = triangles
        ? triangles.length
        : Math.floor((geometry.index?.count ?? geometry.attributes.position.count) / 3);
    const areas = new Float64Array(count);
    let total = 0;

    for (let i = 0; i < count; i++) {
        readTriangle(geometry, triangles ? triangles[i] : i);
        _ab.subVectors(_b, _a);
        _ac.subVectors(_c, _a);
        total += _ab.cross(_ac).length() * 0.5;
        areas[i] = total;
    }

    return { areas, total };
}

function pickTriangle(random: Random, areas: Float64Array, total: number) {
    const target = random() * total;
    let low = 0;
    let high = areas.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (areas[mid] < target) low = mid + 1;
        else high = mid;
    }
    return low;
}

export class GrassSurface {
    private uniforms: GrassUniforms;
    private bladeGeometry = createBladeGeometry();
    private material: THREE.MeshLambertMaterial;
    private chunks: Chunk[] = [];
    private maxDistance: number;
    private lod: GrassLodLevel[];
    private ranked: RankedCollider[] = [];
    public enabled = true;
    public readonly stats = { chunks: 0, visibleChunks: 0, drawnBlades: 0, grownBlades: 0 };

    constructor(options: {
        maxDistance?: number;
        lod?: GrassLodLevel[];
    } = {}) {
        this.uniforms = createGrassUniforms();
        this.material = createGrassMaterial(this.uniforms);
        this.maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
        this.lod = [...(options.lod ?? DEFAULT_LOD)].sort((a, b) => a.distance - b.distance);
    }

    public attach(target: THREE.Mesh, options: GrassSurfaceOptions) {
        const density = options.density ?? DEFAULT_DENSITY;
        const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
        if (options.maxDistance !== undefined) this.maxDistance = options.maxDistance;

        const geometry = options.sampleGeometry ?? target.geometry;
        const { triangles } = options;
        const { areas, total } = buildAreaTable(geometry, triangles);
        if (total <= 0) return;

        const random = createRandom(hashString(options.key));
        const bladeCount = Math.round(density * total);
        const buckets = new Map<number, Bucket>();

        for (let i = 0; i < bladeCount; i++) {
            const picked = pickTriangle(random, areas, total);
            readTriangle(geometry, triangles ? triangles[picked] : picked);
            samplePoint(random);

            _ab.subVectors(_b, _a);
            _ac.subVectors(_c, _a);
            _normal.crossVectors(_ab, _ac).normalize();

            if (options.acceptNormal && random() >= options.acceptNormal(_normal)) continue;
            if (options.rejectPoint?.(_point.x, _point.z)) continue;

            _qAlign.setFromUnitVectors(UP, _normal);
            _qYaw.setFromAxisAngle(UP, random() * Math.PI * 2);
            _leanAxis.set(random() * 2 - 1, 0, random() * 2 - 1).normalize();
            _qLean.setFromAxisAngle(_leanAxis, range(random, [-MAX_LEAN, MAX_LEAN]));

            _qAlign.multiply(_qYaw).multiply(_qLean);
            const width = range(random, WIDTH_RANGE);
            const height = range(random, HEIGHT_RANGE);
            _scale.set(width, height, width);
            _matrix.compose(_point, _qAlign, _scale);

            const key = chunkKey(_point, chunkSize);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = createBucket();
                buckets.set(key, bucket);
            }
            pushMatrix(bucket, _matrix);
            bucket.box.expandByPoint(_point);
        }

        for (const { matrices, length, box } of buckets.values()) {
            const count = length / MATRIX_FLOATS;
            const mesh = new THREE.InstancedMesh(this.bladeGeometry, this.material, count);
            mesh.instanceMatrix.array.set(matrices.subarray(0, length));
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            mesh.layers.set(GRASS_LAYER);
            target.add(mesh);

            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);
            sphere.radius += SPHERE_PADDING;

            this.chunks.push({ mesh, sphere, target, key: options.key, capacity: count });
        }
    }

    public detach(target: THREE.Object3D, key?: string) {
        const kept: Chunk[] = [];

        for (const chunk of this.chunks) {
            if (chunk.target !== target || (key !== undefined && chunk.key !== key)) {
                kept.push(chunk);
                continue;
            }

            target.remove(chunk.mesh);
            chunk.mesh.dispose();
        }

        this.chunks = kept;
    }

    public update(elapsed: number, camera: THREE.Camera, colliders: GrassCollider[]) {
        this.uniforms.uTime.value = elapsed;
        this.packColliders(camera, colliders);

        _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreen);

        const stats = this.stats;
        stats.chunks = this.chunks.length;
        stats.visibleChunks = 0;
        stats.drawnBlades = 0;
        stats.grownBlades = 0;

        for (const chunk of this.chunks) {
            stats.grownBlades += chunk.capacity;
            _sphere.copy(chunk.sphere).applyMatrix4(chunk.target.matrixWorld);
            const distance = _sphere.center.distanceTo(camera.position) - _sphere.radius;
            const inRange = this.enabled && distance < this.maxDistance && _frustum.intersectsSphere(_sphere);
            const count = inRange ? Math.round(chunk.capacity * this.ratioFor(distance)) : 0;

            chunk.mesh.visible = count > 0;
            if (count === 0) continue;

            chunk.mesh.count = count;
            stats.visibleChunks++;
            stats.drawnBlades += count;
        }
    }

    public dispose() {
        for (const chunk of this.chunks) {
            chunk.mesh.removeFromParent();
            chunk.mesh.dispose();
        }
        this.chunks = [];
        this.bladeGeometry.dispose();
        this.material.dispose();
    }

    private ratioFor(distance: number): number {
        for (const level of this.lod) {
            if (distance < level.distance) return level.ratio;
        }
        return this.lod[this.lod.length - 1].ratio;
    }

    private rankByDistance(camera: THREE.Camera, colliders: GrassCollider[]): RankedCollider[] {
        const ranked = this.ranked;

        for (let i = 0; i < colliders.length; i++) {
            const entry = ranked[i] ?? (ranked[i] = { collider: colliders[i], distance: 0 });
            entry.collider = colliders[i];
            entry.distance = colliders[i].position.distanceToSquared(camera.position);
        }
        ranked.length = colliders.length;

        return ranked.sort((a, b) => a.distance - b.distance);
    }

    private packColliders(camera: THREE.Camera, colliders: GrassCollider[]) {
        const count = Math.min(colliders.length, MAX_COLLIDERS);
        const ranked = colliders.length > MAX_COLLIDERS ? this.rankByDistance(camera, colliders) : null;
        const slots = this.uniforms.uColliders.value;

        for (let i = 0; i < count; i++) {
            const { position, radius } = ranked ? ranked[i].collider : colliders[i];
            slots[i].set(position.x, position.y, position.z, radius);
        }
        this.uniforms.uColliderCount.value = count;
    }
}
