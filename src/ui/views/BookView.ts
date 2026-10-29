import { playSound } from '../../audio/audio';
import { events } from '../../core/events';
import { setPaused } from '../../core/pause';
import { stateMachine, type AppState } from '../../core/StateMachine';
import {
    entryKey,
    flattenBook,
    getBook,
    isSpreadSection,
    LEVEL_KEY,
    SETTINGS_KEY,
    type BookEntry,
    type BookMode,
    type BookSection,
    type SectionId,
} from '../../domain/book';
import { buyUpgrade } from '../../domain/playerProgress';
import { keyFor } from '../../domain/settings';
import { getIris } from '../components/iris';
import { flipPages, type FlipDirection, type PageFlip } from '../components/pageFlip';
import { renderBookEntry } from '../components/renderBookEntry';
import { renderBookTabs, renderBookToc } from '../components/renderBookToc';
import { renderPlayerPage, renderStatsPage } from '../components/renderLevelPage';
import { loadPrintedKeys } from '../components/printedKeys';
import { cancelKeyCapture, renderControlsPage, renderOptionsPage } from '../components/renderSettingsPage';
import { renderSprite } from '../components/pixelSprite';
import { ARROW_POINT_LEFT, ARROW_POINT_RIGHT } from '../sprites';

/** Cap on leaves turned at once: past this, more paper reads as noise. */
const MAX_LEAVES = 14;
/** When the front cover starts to swing open: `book-cover-open`'s delay in book.css. */
const COVER_OPEN_DELAY_S = 0.65;

/** Phone layout: one page of the spread slides in instead of a leaf turning. */
const SLIDE_MS = 260;
const SLIDE_PX = 28;
/** A horizontal drag this long, and mostly sideways, turns to the other page. */
const SWIPE_PX = 50;

type Side = 'left' | 'right';

/** The app state each mode lives in. Leaving it closes the book. */
const MODE_STATE: Record<BookMode, AppState> = { game: 'GAME', classic: 'CLASSIC' };

const mobileQuery = window.matchMedia('(max-width: 700px)');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`index.html is missing #${id}`);
    return element;
}

/** `portrait`: the canvas the game draws the live knight into, placed on the Level page. */
export function initBookView(portrait: HTMLCanvasElement) {
    const overlay = requireElement('book');
    const book = requireElement('book-body');
    const tabs = requireElement('book-tabs');
    const leftPage = requireElement('book-page-left');
    const rightPage = requireElement('book-page-right');
    const toc = requireElement('book-toc');
    const entryHost = requireElement('book-entry');
    const flipper = requireElement('book-flipper');
    const prevButton = requireElement('btn-book-prev');
    const nextButton = requireElement('btn-book-next');
    prevButton.appendChild(renderSprite(ARROW_POINT_LEFT));
    nextButton.appendChild(renderSprite(ARROW_POINT_RIGHT));

    let mode: BookMode = 'game';
    let sections: BookSection[] = [];
    let entries: BookEntry[] = [];
    let indexByKey = new Map<string, number>();
    let current = 0;
    let activeSection: SectionId = 'projects';
    /** Phone layout only: the page of the spread on screen, contents (left) or entry (right). */
    let side: Side = 'left';
    let flip: PageFlip | null = null;
    const openGroups = new Set<string>();
    /** Set by the game: the player stands at a bonfire. */
    let canLevelUp = false;

    const isOpen = () => overlay.classList.contains('open');
    const isClosing = () => overlay.classList.contains('closing');

    /** Rebuilds the derived book, keeping the reader on the same entry when it still exists. */
    const load = (nextMode: BookMode) => {
        const previousKey = mode === nextMode ? entries[current]?.key : undefined;
        mode = nextMode;
        sections = getBook(mode);
        entries = flattenBook(sections);
        indexByKey = new Map(entries.map((entry, index) => [entry.key, index]));
        current = previousKey !== undefined ? (indexByKey.get(previousKey) ?? 0) : 0;
        activeSection = entries[current]?.sectionId ?? sections[0]?.id ?? 'projects';
    };

    const buy: typeof buyUpgrade = (id) => canLevelUp && buyUpgrade(id);

    /** Left page: the section's contents, or the first half of a spread (player, controls). */
    const renderLeft = (section: BookSection) => {
        if (section.id === 'level') return renderPlayerPage(portrait);
        if (section.id === 'settings') return renderControlsPage();
        return renderBookToc(section, {
            indexOf: (key) => indexByKey.get(key) ?? -1,
            current,
            openGroups,
            onSelect: (index) => goTo(index, true),
        });
    };

    const renderRight = (entry: BookEntry | undefined) => {
        if (entry?.kind === 'level') return renderStatsPage({ canLevelUp, onBuy: buy });
        if (entry?.kind === 'settings') return renderOptionsPage();
        return renderBookEntry(entry);
    };

    const render = () => {
        const section = sections.find((s) => s.id === activeSection) ?? sections[0];
        if (!section) return;

        tabs.replaceChildren(...renderBookTabs(sections, section.id, selectSection));
        toc.replaceChildren(renderLeft(section));

        const entry = entries[current];
        const hasEntry = entry?.sectionId === section.id;
        entryHost.replaceChildren(renderRight(hasEntry ? entry : undefined));

        // Drives the thickness of the two page stacks: the further in, the thicker the left one.
        const progress = entries.length > 1 ? current / (entries.length - 1) : 0;
        book.style.setProperty('--progress', String(progress));
        // Phone layout: which page shows, and whether there is a right page to go to.
        book.classList.toggle('show-entry', side === 'right');
        book.classList.toggle('has-entry', hasEntry);
    };

    /** Phone layout: the new page slides in from the side it lies on, cover and page edges with it. */
    const slidePages = (direction: FlipDirection, apply: () => void) => {
        apply();
        render();
        playSound('pageTurn');
        const offset = direction === 'forward' ? SLIDE_PX : -SLIDE_PX;
        for (const part of book.querySelectorAll('.book-cover, .book-stack, .book-page')) {
            part.animate(
                [{ transform: `translateX(${offset}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
                { duration: SLIDE_MS, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
            );
        }
    };

    const turnPages = (count: number, direction: FlipDirection, apply: () => void) => {
        flip?.finish();
        if (reducedMotionQuery.matches) {
            apply();
            render();
            return;
        }
        // One page on screen: no spine for a leaf to turn around.
        if (mobileQuery.matches) {
            slidePages(direction, apply);
            return;
        }
        flip = flipPages(flipper, {
            count,
            direction,
            from: direction === 'forward' ? rightPage : leftPage,
            to: () => (direction === 'forward' ? leftPage : rightPage),
            onSwap: () => {
                apply();
                render();
            },
        });
    };

    const sectionIndex = (id: SectionId) => sections.findIndex((s) => s.id === id);
    /** Phone layout: every page in reading order, two per section (contents, then entry). */
    const pagePosition = (id: SectionId, pageSide: Side) => sectionIndex(id) * 2 + (pageSide === 'right' ? 1 : 0);

    function goTo(index: number, showEntry: boolean) {
        const target = entries[index];
        if (!target) return;

        const mobile = mobileQuery.matches;
        const targetSide: Side = showEntry ? 'right' : 'left';
        const samePlace = index === current && target.sectionId === activeSection;
        if (samePlace && (!mobile || targetSide === side)) return;

        let direction: FlipDirection = index >= current ? 'forward' : 'backward';
        if (mobile) {
            const from = pagePosition(activeSection, side);
            const to = pagePosition(target.sectionId, targetSide);
            if (from !== to) direction = to > from ? 'forward' : 'backward';
        }
        const count = Math.min(MAX_LEAVES, Math.max(1, Math.abs(index - current)));

        turnPages(count, direction, () => {
            current = index;
            activeSection = target.sectionId;
            side = targetSide;
        });
    }

    function selectSection(id: SectionId) {
        const first = entries.findIndex((entry) => entry.sectionId === id);
        if (first !== -1) {
            // A spread has no contents to pick from: on the phone, go straight to its second page.
            goTo(first, isSpreadSection(id));
            return;
        }
        // Empty section: nothing to read, just show its (empty) contents page.
        if (id === activeSection) return;
        const direction = sectionIndex(id) > sectionIndex(activeSection) ? 'forward' : 'backward';
        turnPages(MAX_LEAVES / 2, direction, () => {
            activeSection = id;
            side = 'left';
        });
    }

    /** Phone layout: the other page of the spread on screen. */
    const showSide = (next: Side) => {
        if (next === side || !mobileQuery.matches) return;
        if (next === 'right' && !book.classList.contains('has-entry')) return;
        goTo(current, next === 'right');
    };

    prevButton.addEventListener('click', () => showSide('left'));
    nextButton.addEventListener('click', () => showSide('right'));

    // Swipe toward the other page: left swipe brings the right page in. Not on the knight
    // (dragging turns it) or a slider; up and down stay the page's own scrolling.
    let swipeStart: { x: number; y: number } | null = null;
    book.addEventListener('pointerdown', (event) => {
        const target = event.target as Element;
        swipeStart = target.closest('canvas, input') ? null : { x: event.clientX, y: event.clientY };
    });
    book.addEventListener('pointerup', (event) => {
        if (!swipeStart) return;
        const dx = event.clientX - swipeStart.x;
        const dy = event.clientY - swipeStart.y;
        swipeStart = null;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        showSide(dx < 0 ? 'right' : 'left');
    });
    book.addEventListener('pointercancel', () => {
        swipeStart = null;
    });

    /** Opens the book, on the entry `key` when given, else where the reader left it. */
    const open = (nextMode: BookMode, key?: string) => {
        if (isClosing()) {
            finishClose();
            // Force a style flush so re-adding `open` restarts the entrance animation.
            void book.offsetWidth;
        }
        load(nextMode);
        side = 'left';

        const index = key === undefined ? undefined : indexByKey.get(key);
        const target = index === undefined ? undefined : entries[index];
        if (index !== undefined && target) {
            current = index;
            activeSection = target.sectionId;
            side = 'right';
        }
        // No leaf turns on the way in: the cover swinging open stands for one.
        playSound('pageTurn', { delay: reducedMotionQuery.matches ? 0 : COVER_OPEN_DELAY_S });

        render();
        overlay.classList.add('open');
        setPaused('book', true);
    };

    function finishClose() {
        cancelKeyCapture();
        flip?.finish();
        flip = null;
        overlay.classList.remove('open', 'closing');
        setPaused('book', false);
    }

    /** Plays the drop-out animation; `finishClose` runs when it ends. */
    const close = () => {
        if (!isOpen() || isClosing()) return;
        if (reducedMotionQuery.matches) finishClose();
        else overlay.classList.add('closing');

        // Classic mode *is* the book: closing it means leaving for the menu.
        if (mode === 'classic' && stateMachine.getState() === 'CLASSIC') stateMachine.changeState('MENU');
    };

    book.addEventListener('animationend', (event) => {
        if (event.target === book && isClosing()) finishClose();
    });

    requireElement('btn-close-book').addEventListener('click', close);

    // Not behind the iris (a rest or a respawn in progress): the book would open
    // unseen under the black screen and greet the player once it clears.
    const canOpenFromKey = () => stateMachine.getState() === 'GAME' && !getIris().active;

    window.addEventListener('keydown', (event) => {
        if (event.code === 'Escape') {
            // Escape closes whatever page is open, and from the game opens straight on the settings.
            if (isOpen()) close();
            else if (canOpenFromKey() && !event.repeat) open('game', SETTINGS_KEY);
            return;
        }

        if (event.code !== keyFor('book') || event.repeat) return;
        if (stateMachine.getState() !== 'GAME') return;

        if (isOpen() && !isClosing()) close();
        else if (canOpenFromKey()) open('game');
    });

    events.on('stateChange', (state) => {
        if (state === 'CLASSIC') open('classic');
        else if (isOpen() && state !== MODE_STATE[mode]) close();
    });

    /** Game mode only: open the book on `key`, or turn to it if the book is already open. */
    const showEntry = (key: string) => {
        if (stateMachine.getState() !== 'GAME') return;

        if (!isOpen() || isClosing()) {
            open('game', key);
            return;
        }
        const index = indexByKey.get(key);
        if (index !== undefined) goTo(index, true);
    };

    events.on('projectDiscovered', () => {
        if (!isOpen()) return;
        load(mode);
        render();
    });

    events.on('projectShown', (project) => showEntry(entryKey('project', project.id)));
    events.on('levelUpRequested', () => showEntry(LEVEL_KEY));
    events.on('tutorialShown', (tutorialId) => showEntry(entryKey('page', tutorialId)));

    // Anything the Level spread shows: redraw it in place when it changes.
    const refreshLevel = () => {
        if (isOpen() && activeSection === 'level') render();
    };
    events.on('levelUpAvailableChanged', (available) => {
        canLevelUp = available;
        refreshLevel();
    });
    events.on('coinsChanged', refreshLevel);
    events.on('playerStatsChanged', refreshLevel);
    // The keyboard layout arrives late (an async browser API): redraw the keys it names.
    loadPrintedKeys(() => {
        if (isOpen() && !isClosing()) render();
    });
    // Not only the settings spread: tutorial pages draw the player's own keys too,
    // and every page is written in the language the settings name.
    events.on('settingsChanged', () => {
        if (isOpen() && !isClosing()) render();
    });
}
