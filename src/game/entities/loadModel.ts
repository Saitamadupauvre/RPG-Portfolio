import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fromGltfMaterial, type TintableMaterial } from '../render/materials';

const loader = new GLTFLoader();

interface CachedModel {
    scene: THREE.Group;
    animations: THREE.AnimationClip[];
}

/** One in-flight promise per URL, so several entities sharing a model only fetch and parse it once. */
const cache = new Map<string, Promise<CachedModel>>();

function load(url: string): Promise<CachedModel> {
    let pending = cache.get(url);
    if (!pending) {
        pending = loader.loadAsync(url).then(
            (gltf) => ({ scene: gltf.scene, animations: gltf.animations }),
            (error: unknown) => {
                // A rejected promise left in the cache would fail every later
                // request for this URL forever; dropping it lets the next one retry.
                cache.delete(url);
                throw error;
            },
        );
        cache.set(url, pending);
    }
    return pending;
}

export interface ModelFitOptions {
    /** Target world height; the model is uniformly scaled to match. */
    height: number;
    /** Where the model's own origin ends up on Y, relative to its parent. */
    originY?: number;
    /** Extra yaw if the source model does not face +Z. */
    yaw?: number;
}

export interface LoadedModel {
    object: THREE.Object3D;
    /** Per-instance lit materials — safe to tint (hit flash) without touching other instances. */
    materials: TintableMaterial[];
    /** The clips the file carries (Blender actions), shared between instances: clips are read-only data. */
    animations: readonly THREE.AnimationClip[];
}

/**
 * Loads a glTF, clones it per caller, normalizes its size/placement, and hands back
 * the instance's own materials and the file's clips. Cloning is what makes the shared
 * cache safe; it goes through SkeletonUtils because a plain clone() leaves a skinned mesh
 * pointing at the original's bones.
 */
export async function loadModel(url: string, fit: ModelFitOptions): Promise<LoadedModel> {
    const { scene, animations } = await load(url);
    const object = cloneSkinned(scene);

    const materials: TintableMaterial[] = [];
    object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        // A skinned mesh's bounding sphere is computed from the bind pose and never follows the
        // bones, so the culler would blink it out whenever the pose leaves that sphere.
        if (child instanceof THREE.SkinnedMesh) child.frustumCulled = false;

        // clone() shares materials with the cached original, and glTF always brings PBR
        // materials — so convert each one to Lambert *and* keep it per-instance in a single
        // step. Converting here rather than in the caller means every model in the game
        // is lit the same way by construction, with no factory left to forget it.
        const convert = (material: THREE.Material): THREE.Material => {
            const lit = material instanceof THREE.MeshStandardMaterial
                ? fromGltfMaterial(material)
                : material.clone();
            if ('color' in lit) materials.push(lit as TintableMaterial);
            return lit;
        };

        child.material = Array.isArray(child.material)
            ? child.material.map(convert)
            : convert(child.material);
    });

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);

    if (size.y > 0) {
        const scale = fit.height / size.y;
        object.scale.setScalar(scale);
        // Re-measure after scaling rather than scaling the old numbers: cheaper to read, and correct
        // even if the model's origin is not at its centre.
        const scaledBox = new THREE.Box3().setFromObject(object);
        const centre = new THREE.Vector3();
        scaledBox.getCenter(centre);
        object.position.x -= centre.x;
        object.position.z -= centre.z;
        object.position.y -= scaledBox.min.y - (fit.originY ?? 0);
    }

    object.rotation.y = fit.yaw ?? 0;

    return { object, materials, animations };
}
