import * as THREE from 'three';
import { Experience } from "../Experience";

const SKY_COLOR = 0x8ecae6;
const GROUND_COLOR = 0x4a7c3a;
const SUN_COLOR = 0xfff2d0;

export class Environment {
    private experience: Experience;
    private hemisphere: THREE.HemisphereLight;
    private sun: THREE.DirectionalLight;

    constructor(experience: Experience) {
        this.experience = experience;

        this.experience.scene.background = new THREE.Color(SKY_COLOR);
        this.experience.scene.fog = new THREE.Fog(SKY_COLOR, 25, 60);

        this.hemisphere = new THREE.HemisphereLight(SKY_COLOR, GROUND_COLOR, 0.9);

        this.sun = new THREE.DirectionalLight(SUN_COLOR, 2);
        this.sun.position.set(10, 15, 8);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 50;
        this.sun.shadow.camera.left = -20;
        this.sun.shadow.camera.right = 20;
        this.sun.shadow.camera.top = 20;
        this.sun.shadow.camera.bottom = -20;

        this.experience.scene.add(this.hemisphere);
        this.experience.scene.add(this.sun);
    }
}
