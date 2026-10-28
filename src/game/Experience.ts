import * as THREE from 'three';
import { World } from './world/World';
import { PlayerAttackInteraction } from './PlayerAttackInteraction';
import { EditorSystem } from './editor/EditorSystem';
import { stateMachine } from '../core/StateMachine';
import { events } from '../core/events';
import { getSettings, type Quality } from '../domain/settings';
import { WaterDepthPrepass } from './world/water/depthPrepass';
import { PerfOverlay } from './debug/PerfOverlay';
import { GRASS_LAYER, WIND_LAYER } from './render/layers';
import { applyColorGrading } from './render/grading';
import { PlayerPortrait } from './portrait/PlayerPortrait';
import { MAX_STREAKS } from './world/windStreaks';

/** Longest step the simulation takes in one frame, in seconds. */
const MAX_FRAME_DELTA = 0.1;

/**
 * Pixel ratio ceiling. Fill cost grows with its square: 2 shades 4 pixels per
 * CSS pixel, 1.5 only 2.25, and on a low-poly scene with MSAA the difference
 * is hard to see.
 */
const MAX_PIXEL_RATIO = 1.5;

type GraphicsPreset = { pixelRatio: number; shadows: boolean; grass: boolean; windStreaks: number };

/**
 * What each quality setting turns on. Shadows (a second render of the scene
 * from the sun) and grass (tens of thousands of instanced blades) are the two
 * costs worth dropping on a weak GPU; past that, only resolution is left.
 */
const QUALITY: Record<Quality, GraphicsPreset> = {
    low: { pixelRatio: 1, shadows: false, grass: false, windStreaks: 0 },
    medium: { pixelRatio: 1, shadows: true, grass: true, windStreaks: MAX_STREAKS / 2 },
    high: { pixelRatio: MAX_PIXEL_RATIO, shadows: true, grass: true, windStreaks: MAX_STREAKS },
};

export class Experience {
    private static instance: Experience;

    public canvas: HTMLCanvasElement;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public timer: THREE.Timer;

    public world: World;

    private editor: EditorSystem | null = null;
    private perf: PerfOverlay | null = null;
    private waterDepthPrepass: WaterDepthPrepass;
    private drawingSize = new THREE.Vector2();

    private constructor(canvas: HTMLCanvasElement, portraitCanvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);
        this.camera.position.z = 5;
        // Cameras only see layer 0 by default; grass sits on its own layer so
        // the water depth prepass can skip it.
        this.camera.layers.enable(GRASS_LAYER);
        this.camera.layers.enable(WIND_LAYER);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            // X-ray silhouettes mask out the characters' own pixels through the stencil.
            stencil: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // PCF is the soft filter since r182 (PCFSoftShadowMap is deprecated);
        // the blur width is set per light with shadow.radius.
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        // The scene is rendered twice per frame (water depth prepass, then the
        // real pass). Each render() redraws the shadow map unless told not to,
        // so shadows are flagged for exactly one redraw per tick instead.
        this.renderer.shadowMap.autoUpdate = false;
        applyColorGrading(this.renderer);
        // The scene renders twice per tick; by default info resets on every
        // render() and would only ever show the second one. Reset per tick instead.
        this.renderer.info.autoReset = false;

        this.timer = new THREE.Timer();
        // Lets the timer ignore the time a hidden tab spent asleep; without it
        // the first frame back reports the whole absence as one delta.
        this.timer.connect(document);

        this.renderer.getDrawingBufferSize(this.drawingSize);
        this.waterDepthPrepass = new WaterDepthPrepass(this.drawingSize.x, this.drawingSize.y);

        this.world = new World(this);
        new PlayerAttackInteraction(this);

        // A second, small WebGL context, for the book's Level page. A browser that refuses
        // one only costs that page its knight, never the game.
        try {
            new PlayerPortrait(portraitCanvas);
        } catch (error) {
            console.error('[portrait] no WebGL context for the Level page knight', error);
        }

        if (import.meta.env.DEV) {
            this.editor = new EditorSystem(this);
            this.perf = new PerfOverlay(() => this.applyGraphics());
            window.addEventListener('keydown', (event) => {
                if (event.code !== 'F1') return;
                // Browsers open their help window on F1 unless we claim the key.
                event.preventDefault();
                this.toggleEditor();
            });
        }

        window.addEventListener('resize', () => this.resize());
        this.applyGraphics();
        events.on('settingsChanged', () => this.applyGraphics());

        this.tick();
    }

    /** `portraitCanvas`: where the book's Level page shows the live knight (the book places it, the game draws it). */
    public static init(canvas: HTMLCanvasElement, portraitCanvas: HTMLCanvasElement): Experience {
        if (!Experience.instance) Experience.instance = new Experience(canvas, portraitCanvas);
        return Experience.instance;
    }

    public static getInstance(): Experience {
        if (!Experience.instance) throw new Error('Experience.init(canvas, portraitCanvas) must be called before getInstance()');
        return Experience.instance;
    }

    private toggleEditor() {
        if (!this.editor) return;

        const state = stateMachine.getState();
        if (state === 'EDITOR') {
            this.editor.exit();
            stateMachine.changeState('GAME');
        } else if (state === 'GAME') {
            stateMachine.changeState('EDITOR');
            this.editor.enter();
        }
    }

    /**
     * Pushes the quality setting into the renderer and world. In dev the perf
     * overlay's switches can only turn more things off on top of it.
     */
    private applyGraphics() {
        const preset = QUALITY[getSettings().quality];
        const toggles = this.perf?.toggles;

        this.world.grass.enabled = preset.grass && (toggles?.grass ?? true);
        this.world.water.mesh.visible = toggles?.water ?? true;
        this.world.windStreaks.setCount(preset.windStreaks);
        // Changes every lit material's shader, so three recompiles them once:
        // expect one hitch on the switch itself.
        this.world.setShadows(preset.shadows && (toggles?.shadows ?? true));

        // Every settings change lands here, rebinding a key included: only resize
        // when the ratio really moved, since resizing reallocates the buffers.
        const pixelRatio = Math.min(window.devicePixelRatio, toggles?.lowPixelRatio ? 1 : preset.pixelRatio);
        if (pixelRatio === this.renderer.getPixelRatio()) return;
        this.renderer.setPixelRatio(pixelRatio);
        this.resize();
    }

    private resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.renderer.getDrawingBufferSize(this.drawingSize);
        this.waterDepthPrepass.setSize(this.drawingSize.x, this.drawingSize.y);
    }

    private tick() {
        window.requestAnimationFrame(() => this.tick());
        this.timer.update();

        // Back in the menu or the classic book the canvas is hidden: drawing it would only heat the GPU.
        const state = stateMachine.getState();
        if (state !== 'GAME' && state !== 'DEAD' && state !== 'EDITOR') return;

        this.renderer.info.reset();

        // Even with the tab-visibility fix, a long GC pause or a slow frame can
        // hand over a huge delta: enemies would teleport, dashes tunnel through
        // walls and combo timers finish in one frame. Clamping trades a moment
        // of slow motion for the simulation never skipping past anything.
        const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DELTA);
        this.world.update(dt);
        this.editor?.update();

        this.renderer.shadowMap.needsUpdate = true;

        // The water shader reads back what is actually behind it, so its shore
        // and foam hug the rendered geometry exactly - this has to happen before
        // the real render, with the water itself hidden, or it would read its
        // own depth back.
        if (this.perf?.toggles.depthPrepass !== false) {
            this.waterDepthPrepass.render(this.renderer, this.scene, this.camera, this.world.water.mesh);
        }
        this.world.water.setSceneDepth(this.waterDepthPrepass.depthTexture, this.camera, this.drawingSize.x, this.drawingSize.y);

        this.renderer.render(this.scene, this.camera);
        if (this.perf) {
            const grass = this.world.grass.stats;
            const k = (count: number) => `${(count / 1000).toFixed(0)}k`;
            this.perf.update(this.renderer.info, [
                `grass ${grass.visibleChunks}/${grass.chunks} chunks`,
                `      ${k(grass.drawnBlades)} drawn / ${k(grass.grownBlades)} grown`,
            ]);
        }
    }
}
