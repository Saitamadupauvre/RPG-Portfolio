import { playSound } from '../../audio/audio';
import { stateMachine } from '../../core/StateMachine';
import { LOCALE_NAMES, LOCALES, type Locale } from '../../data/locale';
import {
    INPUT_ACTIONS,
    MOVE_ACTIONS,
    type InputAction,
    type Quality,
    type VolumeChannel,
} from '../../data/settings';
import { t } from '../../domain/i18n';
import { labelForKey } from '../../domain/input';
import { clearSave } from '../../domain/persistence';
import {
    bindingFor,
    getSettings,
    rebind,
    resetKeys,
    setLanguage,
    setQuality,
    setScreenShake,
    setVolume,
} from '../../domain/settings';
import { keyName } from './printedKeys';
import { renderKey } from './renderKey';

// Functions, not constants: the labels are read in the current language each time the page is drawn.
const actionLabel = (action: InputAction) => t(`action.${action}`);

const qualities = (): Choice<Quality>[] => [
    { value: 'low', label: t('settings.quality.low') },
    { value: 'medium', label: t('settings.quality.medium') },
    { value: 'high', label: t('settings.quality.high') },
];

const qualityHint = (quality: Quality) => t(`settings.quality.${quality}.hint`);

const onOff = (): Choice<boolean>[] => [
    { value: true, label: t('settings.on') },
    { value: false, label: t('settings.off') },
];

/** Each language named in itself, never translated: a reader stuck in the wrong one still finds theirs. */
const languages = (): Choice<Locale>[] => LOCALES.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }));

/** The reset button asks twice; the second click must come within this. */
const CONFIRM_MS = 3000;

type Choice<T> = { value: T; label: string };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function replay(element: HTMLElement, className: string) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

function row(label: string, control: HTMLElement, fixed = false): HTMLElement {
    const line = el('div', fixed ? 'settings-row fixed' : 'settings-row');
    line.append(el('span', 'settings-label', label), control);
    return line;
}

/** A row of buttons, one lit: the pixel version of a radio group. */
function renderChoice<T>(choices: Choice<T>[], current: T, onPick: (value: T) => void): HTMLElement {
    const group = el('div', 'settings-choice');
    group.setAttribute('role', 'group');
    for (const choice of choices) {
        const button = el('button', 'settings-option', choice.label);
        const active = choice.value === current;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.addEventListener('click', () => onPick(choice.value));
        group.appendChild(button);
    }
    return group;
}

/** Slider steps: 5% each, 20 positions, enough to hear a difference per step. */
const VOLUME_STEP = 0.05;

/**
 * A range input with its percentage beside it. Moves the volume on every step
 * (`input`), so the change is heard while dragging; `setVolume` does not
 * redraw the book, which would swap the slider out from under the pointer.
 */
function renderVolume(channel: VolumeChannel, current: number, label: string): HTMLElement {
    const wrap = el('div', 'settings-volume');
    const slider = el('input', 'settings-slider');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = String(VOLUME_STEP);
    slider.value = String(current);
    slider.setAttribute('aria-label', t('settings.volume.aria', { channel: label }));

    const readout = el('span', 'settings-volume-value');
    const show = () => {
        const percent = Math.round(Number(slider.value) * 100);
        readout.textContent = `${percent}%`;
        // The filled part of the track, read by the CSS (range inputs have no cross-browser "fill").
        slider.style.setProperty('--fill', `${percent}%`);
    };
    show();

    slider.addEventListener('input', () => {
        setVolume(channel, Number(slider.value));
        show();
    });
    // On release only: a sample per drag step would be a stutter.
    if (channel === 'sfx') slider.addEventListener('change', () => playSound('swordSwing'));

    wrap.append(slider, readout);
    return wrap;
}

// ---------- key capture ----------

/** At most one key listens at a time; this ends it, restoring its label. */
let endCapture: (() => void) | null = null;

/** Drops a capture in progress, e.g. because the book is closing. */
export function cancelKeyCapture() {
    endCapture?.();
}

/**
 * Waits for the next key and binds it to `action`. Listens on `window` in the
 * capture phase and stops the event there, so the key never also reaches the
 * book (Escape would close it) or the game (B would toggle the book).
 */
function captureKey(action: InputAction, button: HTMLElement, hint: HTMLElement) {
    cancelKeyCapture();

    const label = button.textContent ?? '';
    button.textContent = '...';
    button.classList.add('listening');
    // A focused button would also "click" on Space or Enter, restarting the capture.
    button.blur();
    hint.textContent = t('settings.keys.listening');

    const onKey = (event: KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;

        if (event.code === 'Escape') {
            stop();
            return;
        }
        if (rebind(action, { code: event.code, label: labelForKey(event) }) === 'reserved') {
            hint.textContent = t('settings.keys.reserved');
            replay(button, 'refused');
            return;
        }
        // Bound: the settings change redraws the page with the new key.
        stop(false);
    };
    const onPointer = (event: PointerEvent) => {
        if (event.target !== button) stop();
    };

    function stop(restore = true) {
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('pointerdown', onPointer, true);
        endCapture = null;
        if (!restore) return;
        button.textContent = label;
        button.classList.remove('listening', 'refused');
        hint.textContent = t('settings.keys.hint');
    }

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    endCapture = stop;
}

// ---------- pages ----------

/** A keycap button showing the action's key; clicking it waits for a new one. */
function renderKeyButton(action: InputAction, hint: HTMLElement): HTMLElement {
    const key = el('button', 'book-key settings-key', keyName(bindingFor(action)));
    if ([...(key.textContent ?? '')].length > 1) key.classList.add('book-key-wide');
    key.setAttribute('aria-label', t('settings.keys.aria', { action: actionLabel(action), key: key.textContent ?? '' }));
    key.addEventListener('click', () => captureKey(action, key, hint));
    return key;
}

const isMove = (action: InputAction) => (MOVE_ACTIONS as readonly InputAction[]).includes(action);

/** Left page of the Settings spread: every key. */
export function renderControlsPage(): HTMLElement {
    const page = el('div', 'settings-page');
    page.appendChild(el('h2', 'book-page-title', t('settings.controls')));

    const hint = el('p', 'settings-hint', t('settings.keys.hint'));
    const rows = el('div', 'settings-rows');

    // The four moves laid out as on the keyboard, each one its own button.
    const cross = el('div', 'book-keys book-keys-cross');
    cross.append(...MOVE_ACTIONS.map((action) => renderKeyButton(action, hint)));
    rows.appendChild(row(t('settings.movement'), cross));

    for (const action of INPUT_ACTIONS) {
        if (!isMove(action)) rows.appendChild(row(actionLabel(action), renderKeyButton(action, hint)));
    }

    rows.append(
        row(t('settings.attack'), renderKey('MouseLeft'), true),
        row(t('settings.settings'), renderKey('Esc'), true),
    );

    const reset = el('button', 'book-link settings-reset-keys', t('settings.keys.reset'));
    reset.addEventListener('click', resetKeys);

    page.append(rows, hint, reset);
    return page;
}

function renderResetProgress(): HTMLElement {
    const button = el('button', 'book-link settings-danger', t('settings.resetProgress'));
    let armed = false;

    button.addEventListener('click', () => {
        if (armed) {
            clearSave();
            // Every module holds its progress in memory: a reload is the one way to start clean.
            location.reload();
            return;
        }
        armed = true;
        button.textContent = t('settings.resetProgress.confirm');
        button.classList.add('armed');
        window.setTimeout(() => {
            armed = false;
            button.textContent = t('settings.resetProgress');
            button.classList.remove('armed');
        }, CONFIRM_MS);
    });
    return button;
}

/** Right page of the Settings spread: graphics and the game itself. */
export function renderOptionsPage(): HTMLElement {
    const settings = getSettings();
    const page = el('article', 'book-entry settings-page');

    const head = el('header', 'book-entry-header');
    head.append(el('span', 'book-entry-kicker', t('settings.kicker')), el('h2', 'book-entry-title', t('settings.options')));

    const graphics = el('div', 'settings-rows');
    graphics.append(
        row(t('settings.quality'), renderChoice(qualities(), settings.quality, setQuality)),
        el('p', 'settings-hint', qualityHint(settings.quality)),
        row(t('settings.screenShake'), renderChoice(onOff(), settings.screenShake, setScreenShake)),
    );

    const music = t('settings.music');
    const sfx = t('settings.sfx');
    const sound = el('div', 'settings-rows');
    sound.append(
        row(music, renderVolume('music', settings.volume.music, music)),
        row(sfx, renderVolume('sfx', settings.volume.sfx, sfx)),
    );

    const game = el('div', 'settings-rows');
    game.appendChild(row(t('settings.language'), renderChoice(languages(), settings.language, setLanguage)));

    const quit = el('button', 'book-link', t('settings.quit'));
    quit.addEventListener('click', () => stateMachine.changeState('MENU'));

    const actions = el('div', 'book-links');
    actions.append(quit, renderResetProgress());

    page.append(
        head,
        el('h3', 'settings-heading', t('settings.graphics')),
        graphics,
        el('h3', 'settings-heading', t('settings.sound')),
        sound,
        el('h3', 'settings-heading', t('settings.game')),
        game,
        actions,
        el('p', 'settings-hint', t('settings.resetProgress.hint')),
    );
    return page;
}
