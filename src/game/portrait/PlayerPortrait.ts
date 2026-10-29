import * as THREE from 'three';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { playerController } from '../entities/playerAnimation';
import { loadPlayerModel } from '../entities/playerModel';
import { createSwordMesh } from '../entities/SwordFactory';
import { applyColorGrading } from '../render/grading';
import { LIGHT, PALETTE } from '../render/palette';
import { HEMISPHERE_INTENSITY, SUN_INTENSITY } from '../world/Environment';

/** Vertical field of view, in degrees: narrow, like a portrait lens, so the knight is not distorted. */
const FOV = 24;
/**
 * What the camera keeps in view whatever shape the canvas takes, in metres: the knight, its
 * sword and its shadow.
 */
const FRAME_WIDTH = 1.55;
const FRAME_HEIGHT = 2.15;
/** Where the camera aims: mid-body, a little low so the feet and the shadow stay in. */
const AIM = new THREE.Vector3(0, 0.88, 0);
/** Looking down on the knight a little, like the game camera, only much less. */
const PITCH = THREE.MathUtils.degToRad(10);

/** The pose at rest: turned toward the stats page, which brings the sword arm forward. Radians. */
const REST_YAW = 0.35;
/** Radians of turn per CSS pixel dragged. */
const DRAG_TURN = 0.012;
/** How fast the knight turns back once let go: the gap left shrinks by this rate per second. */
const RETURN_RATE = 4;
/** Longest step the animation takes, so a frame after a long pause does not jump the clip. */
const MAX_DELTA = 0.1;
const MAX_PIXEL_RATIO = 2;

/** The sun as the knight sees it: high and front right, as in the world, so the shadow falls behind its feet. */
const SUN_POSITION = new THREE.Vector3(1.5, 4, 2.5);
/** Half-size of the square the shadow map covers: the knight and nothing else. */
const SHADOW_HALF_SIZE = 1.4;
const SHADOW_OPACITY = 0.3;

/**
 * The live knight on the book's Level page. It has its own small renderer and scene and draws
 * into the canvas the book places on that page. The canvas is transparent, so the knight
 * stands on the paper, and it draws only while it is on screen.
 *
 * A second WebGL context rather than the game's: a context draws into its own canvas only,
 * and the game's has no transparency to let the paper through.
 */
export class PlayerPortrait {
    private canvas: HTMLCanvasElement;
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    /** The knight hangs here: turning it turns the knight. */
    private turntable = new THREE.Group();
    private animator = new AnimatorComponent(playerController);
    private size = new THREE.Vector2();

    private yaw = REST_YAW;
    /** Pointer x at the last move of a drag, null when nothing is dragging. */
    private dragX: number | null = null;
    /** Timestamp of the last frame drawn, null when the next frame starts a new run. */
    private lastTime: number | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            // Keeps the last frame readable after it was shown: a page turn copies it onto the leaf.
            preserveDrawingBuffer: true,
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        applyColorGrading(this.renderer);

        this.buildScene();
        this.listenForDrags();

        loadPlayerModel({ originY: 0, sword: createSwordMesh(), animator: this.animator })
            .then(({ object }) => {
                this.turntable.add(object);
                // Compiled now, long before the book opens, so its first frame does not wait for shaders.
                return this.renderer.compileAsync(this.scene, this.camera);
            })
            .catch((error) => console.error('[portrait] player model failed to load', error));

        // Draws only while on screen: with the book closed or on another section, it costs nothing.
        new IntersectionObserver((entries) => {
            const latest = entries[entries.length - 1];
            this.setRunning(latest?.isIntersecting ?? false);
        }).observe(canvas);
        new ResizeObserver(() => this.resize()).observe(canvas);
    }

    /** Daylight like the world's (same sky, bounce and warm sun), and a floor that shows only its shadow. */
    private buildScene() {
        const hemisphere = new THREE.HemisphereLight(LIGHT.sky, LIGHT.bounce, HEMISPHERE_INTENSITY);

        const sun = new THREE.DirectionalLight(LIGHT.sun, SUN_INTENSITY);
        sun.position.copy(SUN_POSITION);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.radius = 4;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        sun.shadow.camera.left = -SHADOW_HALF_SIZE;
        sun.shadow.camera.right = SHADOW_HALF_SIZE;
        sun.shadow.camera.top = SHADOW_HALF_SIZE;
        sun.shadow.camera.bottom = -SHADOW_HALF_SIZE;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = SUN_POSITION.length() + SHADOW_HALF_SIZE * 2;

        // Draws nothing but the shadow falling on it: everywhere else the paper shows through.
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(SHADOW_HALF_SIZE, 32),
            new THREE.ShadowMaterial({ color: PALETTE.bark, opacity: SHADOW_OPACITY }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;

        this.scene.add(hemisphere, sun, floor, this.turntable);
    }

    /** Drag sideways to turn the knight; let go and it eases back to its pose. */
    private listenForDrags() {
        this.canvas.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            this.dragX = event.clientX;
            // Keeps the moves coming when the pointer leaves the canvas mid-drag.
            this.canvas.setPointerCapture(event.pointerId);
        });
        this.canvas.addEventListener('pointermove', (event) => {
            if (this.dragX === null) return;
            this.yaw += (event.clientX - this.dragX) * DRAG_TURN;
            this.dragX = event.clientX;
        });
        // Fires on release, on cancel, and when the page redraws the canvas away mid-drag.
        this.canvas.addEventListener('lostpointercapture', () => {
            this.dragX = null;
            // However many turns the drag made, head back the short way round.
            const offset = this.yaw - REST_YAW;
            this.yaw = REST_YAW + Math.atan2(Math.sin(offset), Math.cos(offset));
        });
    }

    /** Matches the drawing buffer to the canvas's size on the page, and frames the knight for its shape. */
    private resize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        // Off the page (another section is showing): keep the last frame rather than wiping it.
        if (width === 0 || height === 0) return;

        // Resizing clears the drawing buffer, so only when something really changed.
        const pixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
        this.renderer.getSize(this.size);
        if (this.size.x === width && this.size.y === height && this.renderer.getPixelRatio() === pixelRatio) return;

        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(width, height, false);
        this.frameCamera(width / height);
    }

    /** Backs the camera off until the frame fits both ways: a tall canvas is limited by its width, a wide one by its height. */
    private frameCamera(aspect: number) {
        const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
        const distance = Math.max(FRAME_HEIGHT / 2 / tanHalfFov, FRAME_WIDTH / 2 / (tanHalfFov * aspect));

        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(0, Math.sin(PITCH) * distance, Math.cos(PITCH) * distance).add(AIM);
        this.camera.lookAt(AIM);
    }

    private setRunning(running: boolean) {
        this.lastTime = null;
        this.renderer.setAnimationLoop(running ? (time) => this.frame(time) : null);
    }

    private frame(time: number) {
        // Hidden without leaving the layout: the phone book hides the page it is not showing.
        if (getComputedStyle(this.canvas).visibility === 'hidden') {
            this.lastTime = null;
            return;
        }
        const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_DELTA);
        this.lastTime = time;

        // Exponential ease, so the return takes the same time at 30 fps as at 144.
        if (this.dragX === null) this.yaw += (REST_YAW - this.yaw) * (1 - Math.exp(-RETURN_RATE * dt));
        this.turntable.rotation.y = this.yaw;

        this.animator.update(dt);
        this.renderer.render(this.scene, this.camera);
    }
}
