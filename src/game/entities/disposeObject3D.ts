import * as THREE from 'three';

export function disposeObject3D(root: THREE.Object3D) {
    root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;

        mesh.geometry?.dispose();

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material?.dispose();
    });
}
