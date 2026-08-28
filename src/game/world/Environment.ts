import * as THREE from 'three';
import { Experience } from "../Experience";

const SKY_COLOR = 0xbfe6f2;
/** Bounce light colour. Warm and bright, so shadowed sides stay green, not grey. */
const BOUNCE_COLOR = 0x93c46b;
const SUN_COLOR = 0xfff4dc;

export class Environment {
    private experience: Experience;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;

    constructor(experience: Experience) {
        this.experience = experience;

        this.experience.scene.background = new THREE.Color(SKY_COLOR);
        this.experience.scene.fog = new THREE.Fog(SKY_COLOR, 26, 72);

        // Ambient-dominated: the hemisphere does most of the work so nothing
        // ever falls into near-black, and the sun only adds shape on top.
        this.hemisphere = new THREE.HemisphereLight(SKY_COLOR, BOUNCE_COLOR, 1.0);

        this.sun = new THREE.DirectionalLight(SUN_COLOR, 1.35);
        this.sun.position.set(10, 15, 8);
        this.sun.castShadow = true;
        // The direct lever for "less dark shadow": scales how much light the
        // shadow removes, instead of flooding the scene with ambient to
        // compensate (which would flatten everything).
        this.sun.shadow.intensity = 0.4;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 50;
        this.sun.shadow.camera.left = -20;
        this.sun.shadow.camera.right = 20;
        this.sun.shadow.camera.top = 20;
        this.sun.shadow.camera.bottom = -20;
        // normalBias offsets the lookup along the surface normal, which clears
        // shadow acne on curved meshes without the peter-panning a large
        // constant bias causes.
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;

        this.experience.scene.add(this.hemisphere);
        this.experience.scene.add(this.sun);
    }
}
