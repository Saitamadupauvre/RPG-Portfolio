import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toToonMaterial, type TintableMaterial } from '../render/toon';

const loader = new GLTFLoader();

/** One in-flight promise per URL, so several entities sharing a model only fetch and parse it once. */
const cache = new Map<string, Promise<THREE.Group>>();

function load(url: string): Promise<THREE.Group> {
    let pending = cache.get(url);
    if (!pending) {
        pending = loader.loadAsync(url).then((gltf) => gltf.scene);
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
    /** Per-instance toon materials — safe to tint (hit flash) without touching other instances. */
    materials: TintableMaterial[];
}

/**
 * Loads a glTF, clones it per caller, normalizes its size/placement, and hands back
 * the instance's own materials. Cloning is what makes the shared cache safe.
 */
export async function loadModel(url: string, fit: ModelFitOptions): Promise<LoadedModel> {
    const source = await load(url);
    const object = source.clone(true);

    const materials: TintableMaterial[] = [];
    object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;

        // clone() shares materials with the cached original, and glTF always brings PBR
        // materials — so convert each one to toon *and* keep it per-instance in a single
        // step. Converting here rather than in the caller means every model in the game
        // is cel-shaded by construction, with no factory left to forget it.
        const convert = (material: THREE.Material): THREE.Material => {
            const toon = material instanceof THREE.MeshStandardMaterial
                ? toToonMaterial(material)
                : material.clone();
            if ('color' in toon) materials.push(toon as TintableMaterial);
            return toon;
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

    return { object, materials };
}
