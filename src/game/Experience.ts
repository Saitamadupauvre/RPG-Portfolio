import * as THREE from 'three';
import { World } from './world/World';
import { MenuInteraction } from './MenuInteraction';

export class Experience {
    private static instance: Experience;

    public canvas: HTMLCanvasElement;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public timer: THREE.Timer;

    public world: World;

    private constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.timer = new THREE.Timer();

        this.world = new World(this);
        new MenuInteraction(this);

        window.addEventListener('resize', () => this.resize());

        this.tick();
    }

    public static init(canvas: HTMLCanvasElement): Experience {
        if (!Experience.instance) Experience.instance = new Experience(canvas);
        return Experience.instance;
    }

    public static getInstance(): Experience {
        if (!Experience.instance) throw new Error('Experience.init(canvas) must be called before getInstance()');
        return Experience.instance;
    }

    private resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private tick() {
        this.timer.update();

        if (this.world) this.world.update(this.timer.getDelta());

        this.renderer.render(this.scene, this.camera);

        window.requestAnimationFrame(() => this.tick());
    }
}

