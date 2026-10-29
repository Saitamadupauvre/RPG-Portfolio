/**
 * The black circle screen transition: closes onto a point, opens around one.
 * A single overlay shared by the menu (closing onto the Game button) and the
 * death / game-entry transitions (opening on the player), so one module owns
 * it: two views tweening the same element would fight over it.
 *
 * Every animation interrupts whatever the iris was doing; the interrupted
 * call's promise resolves `false` so a sequence waiting on it stops there.
 */

const PEEK_RADIUS = 110;
const PEEK_MS = 350;
const PEEK_HOLD_MS = 500;
const OPEN_MS = 900;
const EDGE_FEATHER = 2;
/** A soft shade just inside the edge, so the circle reads as a lens rather than a hole. */
const EDGE_SHADE = 40;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

class Iris {
    private element: HTMLElement;
    private centerX = 0;
    private centerY = 0;
    private radius = 0;
    /** Stops the step in progress and resolves its promise with `false`. */
    private interruptStep: (() => void) | null = null;

    constructor(element: HTMLElement) {
        this.element = element;
        window.addEventListener('resize', () => this.paint());
    }

    /** True while the screen is (at least partly) behind the iris. */
    public get active(): boolean {
        return this.element.classList.contains('active');
    }

    /**
     * Shut onto (x, y). Stays black afterwards. Starts from wherever the
     * circle stands, so cutting into a reveal (resting the moment you respawn)
     * shrinks it back instead of snapping it wide open first.
     */
    public close(x: number, y: number, durationMs: number): Promise<boolean> {
        const full = this.fullRadius(x, y);
        const from = this.active ? Math.min(this.radius, full) : full;
        this.interrupt();
        this.show(x, y, from, 1);
        return this.tweenRadius(0, durationMs);
    }

    /** Fades to black where it stands, for when there is no point to close onto. */
    public cover(durationMs: number): Promise<boolean> {
        this.interrupt();
        this.show(this.centerX, this.centerY, 0, 0);
        return this.step(durationMs, (t) => {
            this.element.style.opacity = String(t);
        });
    }

    /** From black, after `delayMs`, fades the whole screen back in: no circle to follow a camera that just cut. */
    public async uncover(durationMs: number, delayMs = 0): Promise<boolean> {
        this.interrupt();
        this.show(this.centerX, this.centerY, 0, 1);
        const finished = (await this.wait(delayMs))
            && (await this.step(durationMs, (t) => {
                this.element.style.opacity = String(1 - t);
            }));
        if (finished) this.hide();
        return finished;
    }

    /** From black, peek at (x, y), hold, then open onto the whole screen. */
    public async reveal(x: number, y: number, delayMs = 0): Promise<boolean> {
        this.interrupt();
        this.show(x, y, 0, 1);
        const finished = (await this.wait(delayMs))
            && (await this.tweenRadius(PEEK_RADIUS, PEEK_MS))
            && (await this.wait(PEEK_HOLD_MS))
            && (await this.tweenRadius(this.fullRadius(), OPEN_MS));
        if (finished) this.hide();
        return finished;
    }

    /** Drops whatever is playing and clears the screen at once. */
    public clear() {
        this.interrupt();
        this.hide();
    }

    private show(x: number, y: number, radius: number, opacity: number) {
        this.centerX = x;
        this.centerY = y;
        this.radius = radius;
        this.element.style.opacity = String(opacity);
        this.element.classList.add('active');
        this.paint();
    }

    private hide() {
        this.element.classList.remove('active');
        this.element.style.opacity = '1';
    }

    private interrupt() {
        this.interruptStep?.();
        this.interruptStep = null;
    }

    /** Far enough from (x, y) to clear the furthest corner. */
    private fullRadius(x = this.centerX, y = this.centerY) {
        return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + EDGE_FEATHER;
    }

    private paint() {
        const r = this.radius;
        this.element.style.background =
            `radial-gradient(circle at ${this.centerX}px ${this.centerY}px, ` +
            `rgba(0, 0, 0, 0) ${Math.max(0, r - EDGE_SHADE)}px, rgba(0, 0, 0, 0.35) ${r}px, ` +
            `#000 ${r + EDGE_FEATHER}px)`;
    }

    private tweenRadius(to: number, durationMs: number): Promise<boolean> {
        const from = this.radius;
        return this.step(durationMs, (t) => {
            this.radius = from + (to - from) * t;
            this.paint();
        });
    }

    /** Runs `apply` with an eased 0..1 every frame for `durationMs`. */
    private step(durationMs: number, apply: (t: number) => void): Promise<boolean> {
        const duration = reducedMotion.matches ? 0 : durationMs;

        return new Promise((resolve) => {
            const start = performance.now();
            let frame = 0;

            const tick = (now: number) => {
                const t = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
                apply(ease(t));
                if (t < 1) {
                    frame = requestAnimationFrame(tick);
                    return;
                }
                this.interruptStep = null;
                resolve(true);
            };

            this.interruptStep = () => {
                cancelAnimationFrame(frame);
                resolve(false);
            };
            frame = requestAnimationFrame(tick);
        });
    }

    private wait(durationMs: number): Promise<boolean> {
        return new Promise((resolve) => {
            const timer = window.setTimeout(() => {
                this.interruptStep = null;
                resolve(true);
            }, reducedMotion.matches ? 0 : durationMs);

            this.interruptStep = () => {
                window.clearTimeout(timer);
                resolve(false);
            };
        });
    }
}

let instance: Iris | null = null;

/** Created on first use, once index.html's `#iris` exists. */
export function getIris(): Iris {
    if (instance) return instance;

    const element = document.getElementById('iris');
    if (!element) throw new Error('index.html is missing #iris');
    instance = new Iris(element);
    return instance;
}
