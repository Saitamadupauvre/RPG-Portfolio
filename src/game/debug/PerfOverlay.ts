import type * as THREE from 'three';

/** Dev switches the overlay flips; Experience reads them every tick. */
export type PerfToggles = {
    grass: boolean;
    depthPrepass: boolean;
    shadows: boolean;
    water: boolean;
    /** Caps the pixel ratio at 1 instead of the device's (up to 2). */
    lowPixelRatio: boolean;
};

/** How many frames each readout averages over — enough to smooth, short enough to react. */
const SAMPLE_FRAMES = 60;

const KEYS: Record<string, keyof PerfToggles> = {
    F3: 'grass',
    F4: 'depthPrepass',
    F6: 'shadows',
    F7: 'water',
    F8: 'lowPixelRatio',
};

/**
 * Dev-only frame-cost readout. F2 shows/hides it, F3/F4/F6/F7/F8 switch one
 * suspect off at a time so its cost shows up as the FPS difference.
 *
 * Frame time is the gap between two ticks, not the time spent inside one: the
 * GPU works asynchronously, so timing JS around render() only measures how
 * long it took to *queue* the commands. The tick-to-tick gap includes the GPU
 * holding the next frame back, which is the cost we are actually chasing.
 */
export class PerfOverlay {
    public readonly toggles: PerfToggles = {
        grass: true,
        depthPrepass: true,
        shadows: true,
        water: true,
        lowPixelRatio: false,
    };

    private element = document.createElement('pre');
    private frameTimes: number[] = [];
    private lastTime = performance.now();
    /** Own counter: frameTimes.length stops growing at SAMPLE_FRAMES. */
    private frame = 0;
    private onChange: () => void;

    constructor(onChange: () => void) {
        this.onChange = onChange;

        // Inline style instead of pixel-ui.css: dev tooling, never shipped,
        // so it stays out of the real UI's stylesheet.
        Object.assign(this.element.style, {
            position: 'fixed',
            top: '8px',
            left: '8px',
            margin: '0',
            padding: '6px 8px',
            font: '12px monospace',
            color: '#0f0',
            background: 'rgba(0, 0, 0, 0.7)',
            pointerEvents: 'none',
            zIndex: '9999',
            whiteSpace: 'pre',
        });
        this.element.hidden = true;
        document.body.appendChild(this.element);

        window.addEventListener('keydown', (event) => {
            if (event.code === 'F2') {
                event.preventDefault();
                this.element.hidden = !this.element.hidden;
                return;
            }

            const toggle = KEYS[event.code];
            if (!toggle) return;
            event.preventDefault();
            this.toggles[toggle] = !this.toggles[toggle];
            this.onChange();
        });
    }

    /** Call once per tick, after every render() of that tick. */
    public update(info: THREE.WebGLInfo, extra: string[] = []) {
        const now = performance.now();
        this.frameTimes.push(now - this.lastTime);
        this.lastTime = now;
        if (this.frameTimes.length > SAMPLE_FRAMES) this.frameTimes.shift();

        // Rewriting the DOM every frame would itself cost layout time.
        if (this.element.hidden || ++this.frame % 10 !== 0) return;

        const average = this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
        const worst = Math.max(...this.frameTimes);
        const flag = (on: boolean) => (on ? 'on ' : 'OFF');
        const { toggles } = this;

        this.element.textContent = [
            `fps   ${(1000 / average).toFixed(0)}`,
            `ms    ${average.toFixed(1)} avg  ${worst.toFixed(1)} worst`,
            `calls ${info.render.calls}`,
            `tris  ${(info.render.triangles / 1000).toFixed(0)}k`,
            `geo   ${info.memory.geometries}  tex ${info.memory.textures}`,
            ...extra,
            ``,
            `F3 grass     ${flag(toggles.grass)}`,
            `F4 prepass   ${flag(toggles.depthPrepass)}`,
            `F6 shadows   ${flag(toggles.shadows)}`,
            `F7 water     ${flag(toggles.water)}`,
            `F8 dpr 1     ${flag(toggles.lowPixelRatio)}`,
        ].join('\n');
    }
}
