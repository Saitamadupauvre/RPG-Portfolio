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

type Chunk = {
    mesh: THREE.InstancedMesh;
    /** Bounding sphere in the target's local space. */
    sphere: THREE.Sphere;
    target: THREE.Object3D;
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

    constructor(options: { tipColor?: THREE.ColorRepresentation; maxDistance?: number } = {}) {
        this.uniforms = createGrassUniforms(options.tipColor);
        this.material = createGrassMaterial(this.uniforms);
        this.maxDistance = options.maxDistance ?? 30;
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
        const buckets = new Map<string, { matrices: THREE.Matrix4[]; tints: number[]; box: THREE.Box3 }>();

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
            _scale.set(width, range(0.55, 1.35), width);
            _matrix.compose(_point, _qAlign, _scale);

            const key = this.chunkKey(_point, chunkSize);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { matrices: [], tints: [], box: new THREE.Box3().makeEmpty() };
                buckets.set(key, bucket);
            }
            bucket.matrices.push(_matrix.clone());
            // Per-blade brightness. Without it the field is one flat wash; the
            // speckle is most of what makes painted grass look hand-made.
            bucket.tints.push(range(0.85, 1.15));
            bucket.box.expandByPoint(_point);
        }

        for (const { matrices, tints, box } of buckets.values()) {
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

            this.chunks.push({ mesh, sphere, target });
        }
    }

    public update(elapsed: number, camera: THREE.Camera, colliders: GrassCollider[]) {
        this.uniforms.uTime.value = elapsed;
        this.packColliders(camera, colliders);

        _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreen);

        for (const chunk of this.chunks) {
            _sphere.copy(chunk.sphere).applyMatrix4(chunk.target.matrixWorld);
            const inRange = _sphere.center.distanceTo(camera.position) - _sphere.radius < this.maxDistance;
            chunk.mesh.visible = inRange && _frustum.intersectsSphere(_sphere);
        }
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
