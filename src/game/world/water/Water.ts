import * as THREE from 'three';
import { createWaterMaterial, type WaterUniforms } from './waterMaterial';
import { getHeightTexture, heightFieldBounds, rebuildHeightTexture } from './heightField';

/**
 * Big enough to reach past the camera's far plane (150) from anywhere on it, so
 * the horizon is always water fading into fog rather than an edge.
 */
const PLANE_SIZE = 500;
/**
 * Quads across the plane. The waves are geometry now, so this is what sets how
 * smooth a crest is: 250 gives a 2-unit quad against a 7-unit wavelength, about
 * three quads per crest, which is the point where extra segments stop being
 * visible and start being 63k vertices for nothing.
 */
const PLANE_SEGMENTS = 250;
/**
 * The plane rides the player, but only in whole steps. Following continuously
 * would move the mesh sub-pixel every frame, and although the shader keys its
 * noise off world position (so the pattern is anchored), a snapped position also
 * keeps the geometry's float precision from drifting far from the origin.
 */
const FOLLOW_STEP = 8;

/**
 * The endless sea.
 *
 * One draw call. The swell is real vertex displacement, so the light moving over
 * the water comes from geometry; the coastline, the depth fade and the white
 * shore outline are read in the fragment shader from the terrain heightfield, so
 * no coastline geometry is ever built and sculpting a new bay costs a 60x60
 * texture upload.
 */
export class Water {
    public readonly mesh: THREE.Mesh;
    private material: THREE.MeshLambertMaterial;
    private uniforms: WaterUniforms;

    constructor(level: number) {
        const { material, uniforms } = createWaterMaterial(level);
        this.material = material;
        this.uniforms = uniforms;

        const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS);
        geometry.rotateX(-Math.PI / 2);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = level;
        // Drawn after the opaque world so it blends over what it covers; a
        // transparent mesh with no explicit order can otherwise sort against the
        // grass by centroid distance and flicker.
        this.mesh.renderOrder = 10;
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = true;
        // The plane is always under the camera, so frustum culling by its
        // bounding sphere gains nothing and can only ever wrongly cull it.
        this.mesh.frustumCulled = false;
    }

    public setLevel(level: number) {
        this.mesh.position.y = level;
        this.uniforms.uWaterLevel.value = level;
    }

    public getLevel(): number {
        return this.uniforms.uWaterLevel.value;
    }

    /** Re-reads the heightfield after the terrain was sculpted or resized. */
    public onTerrainChanged() {
        const texture = rebuildHeightTexture();
        const bounds = heightFieldBounds();

        this.uniforms.uHeightMap.value = texture;
        this.uniforms.uHeightOrigin.value.copy(bounds.origin);
        this.uniforms.uHeightTiles.value.copy(bounds.tiles);
        this.uniforms.uHeightTileSize.value = bounds.tileSize;
    }

    public update(elapsed: number, follow: THREE.Vector3) {
        this.uniforms.uTime.value = elapsed;
        this.mesh.position.x = Math.round(follow.x / FOLLOW_STEP) * FOLLOW_STEP;
        this.mesh.position.z = Math.round(follow.z / FOLLOW_STEP) * FOLLOW_STEP;
    }

    /** Feeds the shader the depth prepass result, so the shore and foam can read the real scene. */
    public setSceneDepth(depthTexture: THREE.Texture, camera: THREE.PerspectiveCamera, width: number, height: number) {
        this.uniforms.uSceneDepth.value = depthTexture;
        this.uniforms.uResolution.value.set(width, height);
        this.uniforms.uCameraNear.value = camera.near;
        this.uniforms.uCameraFar.value = camera.far;
    }

    public dispose() {
        this.mesh.geometry.dispose();
        this.material.dispose();
        getHeightTexture().dispose();
    }
}
