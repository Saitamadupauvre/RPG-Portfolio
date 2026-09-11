import * as THREE from 'three';

/**
 * Renders the scene's depth (water hidden) into a texture the water shader can
 * compare itself against — the standard stylized-water technique (Unity's
 * `_CameraDepthTexture`, Genshin/BOTW-style shores): foam and colour read what
 * is actually behind the water pixel by pixel, so they hug any bank exactly,
 * including a steep or overhanging one, instead of a separately-sampled
 * heightfield that can drift out of step with the rendered geometry.
 */
export class WaterDepthPrepass {
    public readonly target: THREE.WebGLRenderTarget;
    public readonly depthTexture: THREE.DepthTexture;

    constructor(width: number, height: number) {
        this.target = new THREE.WebGLRenderTarget(width, height);
        this.depthTexture = new THREE.DepthTexture(width, height);
        this.depthTexture.type = THREE.FloatType;
        this.target.depthTexture = this.depthTexture;
    }

    public setSize(width: number, height: number) {
        this.target.setSize(width, height);
    }

    public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, water: THREE.Object3D) {
        const wasVisible = water.visible;
        water.visible = false;

        // Rendered with each mesh's own material rather than a cheap
        // `scene.overrideMaterial = MeshDepthMaterial`. The grass patches its
        // vertex shader to bend blades (see grassMaterial.ts), and an override
        // material does not run that displacement — grass would write depth at
        // its undisplaced positions and the shore foam would read the wrong
        // distance. `customDepthMaterial` is no escape hatch either: three only
        // consults it during shadow passes, not for `overrideMaterial`.
        const previousTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(this.target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);

        water.visible = wasVisible;
    }

    public dispose() {
        this.target.dispose();
        this.depthTexture.dispose();
    }
}
