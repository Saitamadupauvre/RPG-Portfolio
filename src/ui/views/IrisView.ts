import { events } from '../../core/events';

// Cartoon iris wipe. The overlay is a full-screen element whose background is a radial
// gradient: transparent inside the hole radius, solid black outside it. The radius is
// tweened in JS per frame rather than by a CSS transform, because scaling a small circle
// up to screen size stretches its rasterized texture (blurry, and past a point the GPU
// gives up and renders a square). A gradient is repainted at full size every frame instead.
const CLOSE_MS = 1200;   // keep in sync with RESPAWN_DELAY_MS in game/world/World.ts
const PEEK_MS = 350;
const PEEK_HOLD_MS = 500;
const OPEN_MS = 900;
const PEEK_RADIUS = 110;
const EDGE_FEATHER = 2; // px of softness so the hole's edge isn't a jagged aliased ring

export function initIrisView() {
    const iris = document.getElementById('iris');
    const deathText = document.getElementById('death-text');
    if (!iris || !deathText) return;

    let centerX = 0;
    let centerY = 0;
    let radius = 0;
    let frame = 0;

    const fullRadius = () => Math.hypot(window.innerWidth, window.innerHeight);

    const paint = () => {
        iris.style.background =
            `radial-gradient(circle at ${centerX}px ${centerY}px, ` +
            `rgba(0, 0, 0, 0) ${radius}px, #000 ${radius + EDGE_FEATHER}px)`;
    };

    // easeInOutQuad: slow at both ends, quick through the middle — reads as a deliberate
    // camera iris rather than a linear mechanical wipe.
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

    const tween = (to: number, durationMs: number, onDone?: () => void) => {
        cancelAnimationFrame(frame);

        const from = radius;
        const start = performance.now();

        const step = (now: number) => {
            const t = durationMs <= 0 ? 1 : Math.min(1, (now - start) / durationMs);
            radius = from + (to - from) * ease(t);
            paint();

            if (t < 1) {
                frame = requestAnimationFrame(step);
            } else {
                onDone?.();
            }
        };

        frame = requestAnimationFrame(step);
    };

    // A resize mid-wipe would leave black bars outside the old gradient box, so repaint.
    window.addEventListener('resize', paint);

    events.on('playerDied', (x, y) => {
        centerX = x;
        centerY = y;
        radius = fullRadius();
        paint();
        iris.classList.add('active');

        tween(0, CLOSE_MS);
        deathText.classList.add('visible');
    });

    events.on('playerRespawned', (x, y) => {
        deathText.classList.remove('visible');
        centerX = x;
        centerY = y;

        tween(PEEK_RADIUS, PEEK_MS, () => {
            window.setTimeout(() => {
                tween(fullRadius(), OPEN_MS, () => iris.classList.remove('active'));
            }, PEEK_HOLD_MS);
        });
    });
}
