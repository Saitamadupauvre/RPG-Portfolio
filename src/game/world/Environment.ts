import * as THREE from 'three';
import type { Experience } from '../Experience';
import { LIGHT } from '../render/palette';

const HEMISPHERE_INTENSITY = 0.85;
const SUN_INTENSITY = 2.8;
/**
 * How much of the sun a shadow removes. Below 1 the surface colour still shows
 * through, so shade on grass stays green instead of going grey.
 */
const SHADOW_INTENSITY = 0.75;
/** Shadow edge blur, in shadow texels. Soft edges read as daylight, hard ones as a stage spot. */
const SHADOW_RADIUS = 4;
/** Sun position relative to the point it lights. Fixed, so the light direction never changes. */
const SUN_OFFSET = new THREE.Vector3(10, 15, 8);
/**
 * Half-size of the square the shadow map covers, centred on the player. The
 * map follows the player rather than covering the whole terrain: same 2048²
 * texels over a far smaller area means much crisper shadows, and a terrain
 * resized in the editor can no longer fall outside the frustum.
 */
const SHADOW_HALF_SIZE = 45;
const SHADOW_MAP_SIZE = 2048;
/** World units per shadow texel. */
const SHADOW_TEXEL = (SHADOW_HALF_SIZE * 2) / SHADOW_MAP_SIZE;

export class Environment {
    private experience: Experience;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;
    private lightRight = new THREE.Vector3();
    private lightUp = new THREE.Vector3();
    private focus = new THREE.Vector3();

    constructor(experience: Experience) {
        this.experience = experience;

        this.experience.scene.background = new THREE.Color(LIGHT.sky);
        // Far enough that saturated colour survives across the view instead of
        // fading to sky within a few chunks.
        this.experience.scene.fog = new THREE.Fog(LIGHT.sky, 40, 95);

        // Sun-dominated: a strong warm key against a cooler, dimmer hemisphere.
        // That warm/cool split is what gives low-poly shapes their form; an
        // ambient-heavy setup lights every side the same and flattens them.
        this.hemisphere = new THREE.HemisphereLight(LIGHT.sky, LIGHT.bounce, HEMISPHERE_INTENSITY);

        this.sun = new THREE.DirectionalLight(LIGHT.sun, SUN_INTENSITY);
        this.sun.position.copy(SUN_OFFSET);
        this.sun.castShadow = true;
        // The direct lever for "less dark shadow": scales how much light the
        // shadow removes, instead of flooding the scene with ambient to
        // compensate (which would flatten everything).
        this.sun.shadow.intensity = SHADOW_INTENSITY;
        this.sun.shadow.radius = SHADOW_RADIUS;
        this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = SUN_OFFSET.length() + SHADOW_HALF_SIZE * 2;
        this.sun.shadow.camera.left = -SHADOW_HALF_SIZE;
        this.sun.shadow.camera.right = SHADOW_HALF_SIZE;
        this.sun.shadow.camera.top = SHADOW_HALF_SIZE;
        this.sun.shadow.camera.bottom = -SHADOW_HALF_SIZE;
        // The light's own right/up axes, for snapping the follow point below.
        const lightBasis = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), THREE.Object3D.DEFAULT_UP);
        lightBasis.extractBasis(this.lightRight, this.lightUp, new THREE.Vector3());
        // normalBias offsets the lookup along the surface normal, which clears
        // shadow acne on curved meshes without the peter-panning a large
        // constant bias causes.
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;

        this.experience.scene.add(this.hemisphere);
        this.experience.scene.add(this.sun);
        // The target must be in the scene graph or its matrix never updates.
        this.experience.scene.add(this.sun.target);
    }

    /**
     * Centres the shadow map on `point`. The centre is snapped to whole shadow
     * texels along the light's own axes: moving it by a fraction of a texel
     * would resample every shadow edge differently each frame, and they would
     * crawl and shimmer as the player walks.
     */
    public followShadows(point: THREE.Vector3) {
        const focus = this.focus.copy(point);
        const alongRight = focus.dot(this.lightRight);
        const alongUp = focus.dot(this.lightUp);
        focus.addScaledVector(this.lightRight, Math.round(alongRight / SHADOW_TEXEL) * SHADOW_TEXEL - alongRight);
        focus.addScaledVector(this.lightUp, Math.round(alongUp / SHADOW_TEXEL) * SHADOW_TEXEL - alongUp);

        this.sun.target.position.copy(focus);
        this.sun.position.copy(focus).add(SUN_OFFSET);
    }
}

