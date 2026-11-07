import { events } from '@core/events/events';
import { isTouchOnly } from '@core/input/device';
import { isGameplayActive } from '@core/state/pause';
import { STICK_DEADZONE, touchInput, type StickAxis } from '@core/input/touchInput';
import { renderSprite } from '@ui/components/sprites/pixelSprite';
import { BOOK, DASH, SWORD } from '@ui/components/sprites/sprites';

/**
 * The phone's gamepad, drawn over the game (only on a touch-only device):
 * - left half of the screen: a floating move stick, centred wherever the thumb lands;
 * - bottom right: the attack stick (tap or hold = strike the nearest enemy,
 *   drag = aim; held, it keeps chaining the combo), the dash button above it;
 * - top right: the book (the B key).
 *
 * Pointer Events with `setPointerCapture`: each finger stays with the control
 * it pressed, wherever it slides, so both thumbs work at once. The view only
 * writes `core/input/touchInput` and emits events; the game reads them.
 */
export function initTouchControlsView() {
    if (!isTouchOnly()) return;

    const zone = requireElement('touch-move-zone');
    const moveStick = requireElement('touch-move-stick');
    const attackStick = requireElement('touch-attack-stick');
    const dash = requireElement('touch-dash');
    const book = requireElement('touch-book');

    requireElement('touch-attack-knob').appendChild(renderSprite(SWORD));
    dash.appendChild(renderSprite(DASH));
    book.appendChild(renderSprite(BOOK));

    const move = createStick(moveStick, (axis) => {
        touchInput.move.x = axis.x;
        touchInput.move.y = axis.y;
    });

    // ---------- move: floating ----------
    zone.addEventListener('pointerdown', (event) => {
        if (move.pointerId !== null) return;
        // The stick jumps under the thumb, kept whole on screen.
        const rect = zone.getBoundingClientRect();
        const radius = moveStick.offsetWidth / 2;
        const x = clamp(event.clientX - rect.left, radius, rect.width - radius);
        const y = clamp(event.clientY - rect.top, radius, rect.height - radius);
        moveStick.style.left = `${x}px`;
        moveStick.style.top = `${y}px`;
        moveStick.classList.add('floating');
        zone.setPointerCapture(event.pointerId);
        move.press(event);
    });
    zone.addEventListener('pointermove', (event) => move.drag(event));
    const releaseMove = (event: PointerEvent) => {
        if (!move.release(event)) return;
        // Back to its resting spot, where it shows the thumb where to go.
        moveStick.style.left = '';
        moveStick.style.top = '';
        moveStick.classList.remove('floating');
    };
    zone.addEventListener('pointerup', releaseMove);
    zone.addEventListener('pointercancel', releaseMove);

    // ---------- attack: fixed stick ----------
    const aim: StickAxis = { x: 0, y: 0 };
    let aiming = false;
    let frame = 0;

    const attack = createStick(attackStick, (axis) => {
        aim.x = axis.x;
        aim.y = axis.y;
        // Once dragged out, the stick aims until released, even back near the centre.
        if (Math.hypot(axis.x, axis.y) > STICK_DEADZONE) aiming = true;
    });

    // Every frame while held: the combo takes the next move as soon as it can,
    // so holding the stick chains swings. A tap still lands one, at once.
    const strike = () => {
        events.emit('touchAttack', aiming ? aim : null);
        frame = requestAnimationFrame(strike);
    };

    attackStick.addEventListener('pointerdown', (event) => {
        if (attack.pointerId !== null) return;
        attackStick.setPointerCapture(event.pointerId);
        attack.press(event);
        aiming = false;
        strike();
    });
    attackStick.addEventListener('pointermove', (event) => attack.drag(event));
    const releaseAttack = (event: PointerEvent) => {
        if (!attack.release(event)) return;
        cancelAnimationFrame(frame);
        aiming = false;
    };
    attackStick.addEventListener('pointerup', releaseAttack);
    attackStick.addEventListener('pointercancel', releaseAttack);

    // ---------- buttons ----------
    // On pointerdown, not click: a click waits for the finger to lift, a dash must not.
    dash.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        events.emit('touchDash');
    });
    book.addEventListener('click', () => events.emit('bookRequested'));

    /** Let go of everything: the book opened, the player died, the phone turned. */
    const releaseAll = () => {
        move.reset();
        attack.reset();
        cancelAnimationFrame(frame);
        aiming = false;
        moveStick.style.left = '';
        moveStick.style.top = '';
        moveStick.classList.remove('floating');
    };
    events.on('pauseChanged', (paused) => paused && releaseAll());
    events.on('stateChange', () => {
        if (!isGameplayActive()) releaseAll();
    });
    window.addEventListener('blur', releaseAll);

    // Nothing to aim the browser's long-press menu or text selection at.
    document.getElementById('touch-controls')?.addEventListener('contextmenu', (event) => event.preventDefault());

    initFullscreenExit();
}

type Stick = {
    readonly pointerId: number | null;
    press(event: PointerEvent): void;
    drag(event: PointerEvent): void;
    /** True if `event` was this stick's finger. */
    release(event: PointerEvent): boolean;
    reset(): void;
};

/**
 * One stick: the knob follows the finger from the stick's centre, clamped to
 * its ring, and reports the offset as a 0..1 axis with `y` up the screen.
 */
function createStick(stick: HTMLElement, onChange: (axis: StickAxis) => void): Stick {
    const knob = stick.querySelector<HTMLElement>('.touch-knob')!;
    const axis: StickAxis = { x: 0, y: 0 };
    let pointerId: number | null = null;
    let centerX = 0;
    let centerY = 0;

    const set = (x: number, y: number) => {
        axis.x = x;
        axis.y = y;
        const reach = stick.offsetWidth / 2;
        knob.style.transform = `translate(${Math.round(x * reach)}px, ${Math.round(-y * reach)}px)`;
        onChange(axis);
    };

    const reset = () => {
        pointerId = null;
        stick.classList.remove('held');
        set(0, 0);
    };

    return {
        get pointerId() {
            return pointerId;
        },
        press(event) {
            pointerId = event.pointerId;
            // Measured on every press: the floating stick has just moved.
            const rect = stick.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            stick.classList.add('held');
            this.drag(event);
        },
        drag(event) {
            if (event.pointerId !== pointerId) return;
            const reach = stick.offsetWidth / 2;
            let x = (event.clientX - centerX) / reach;
            let y = -(event.clientY - centerY) / reach;
            const length = Math.hypot(x, y);
            if (length > 1) {
                x /= length;
                y /= length;
            }
            set(x, y);
        },
        release(event) {
            if (event.pointerId !== pointerId) return false;
            reset();
            return true;
        },
        reset,
    };
}

/**
 * Leaving the game leaves fullscreen too. Entering it happens in MenuView's
 * Play handler: a browser grants fullscreen only inside a tap's own handler.
 */
function initFullscreenExit() {
    events.on('stateChange', (state) => {
        if ((state === 'MENU' || state === 'CLASSIC') && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    });
}

/**
 * Fullscreen held sideways, on Play: Android Chrome allows both (the lock only
 * once fullscreen); an iPhone has neither for a page and keeps the rotate screen.
 * Must run synchronously in the tap's handler, before any `await`.
 */
export function enterGameFullscreen() {
    if (!isTouchOnly() || document.fullscreenElement || !document.documentElement.requestFullscreen) return;

    document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
            // Not in TypeScript's DOM types any more (only some browsers have it).
            const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
            return orientation.lock?.('landscape');
        })
        .catch(() => {
            // Refused or unsupported: the rotate screen still asks for a sideways phone.
        });
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} is missing from index.html`);
    return element;
}
