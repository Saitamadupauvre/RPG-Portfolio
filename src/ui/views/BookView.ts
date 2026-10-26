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

/** Cap on leaves turned at once: past this, more paper reads as noise. */
const MAX_LEAVES = 14;

/** Mobile back button on a spread's second page, back to its first. */
const BACK_LABELS: Partial<Record<SectionId, string>> = {
    level: '← Player',
    settings: '← Controls',
};

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
    const backButton = requireElement('btn-book-back');

    let mode: BookMode = 'game';
    let sections: BookSection[] = [];
    let entries: BookEntry[] = [];
    let indexByKey = new Map<string, number>();
    let current = 0;
    let activeSection: SectionId = 'projects';
    /** Mobile only: one page at a time, TOC or entry. */
    let showingEntry = false;
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
        entryHost.replaceChildren(renderRight(entry?.sectionId === section.id ? entry : undefined));

        // Drives the thickness of the two page stacks: the further in, the thicker the left one.
        const progress = entries.length > 1 ? current / (entries.length - 1) : 0;
        book.style.setProperty('--progress', String(progress));
        book.classList.toggle('show-entry', showingEntry);
        backButton.textContent = BACK_LABELS[section.id] ?? '← Contents';
    };

    /** The page on a given side of the spine; on mobile there is only the one on screen. */
    const visiblePage = (side: 'left' | 'right') => {
        if (mobileQuery.matches) return showingEntry ? rightPage : leftPage;
        return side === 'left' ? leftPage : rightPage;
    };

    const turnPages = (count: number, direction: FlipDirection, apply: () => void) => {
        flip?.finish();
        if (reducedMotionQuery.matches) {
            apply();
            render();
            return;
        }
        flip = flipPages(flipper, {
            count,
            direction,
            from: visiblePage(direction === 'forward' ? 'right' : 'left'),
            to: () => visiblePage(direction === 'forward' ? 'left' : 'right'),
            onSwap: () => {
                apply();
                render();
            },
        });
    };

    function goTo(index: number, showEntry: boolean) {
        const target = entries[index];
        if (!target) return;

        const mobile = mobileQuery.matches;
        const samePlace = index === current && target.sectionId === activeSection;
        if (samePlace && (!mobile || showEntry === showingEntry)) return;

        // On mobile the TOC and the entry are two separate pages: one leaf each way.
        const direction: FlipDirection = mobile
            ? showEntry ? 'forward' : 'backward'
            : index >= current ? 'forward' : 'backward';
        const count = mobile ? 1 : Math.min(MAX_LEAVES, Math.max(1, Math.abs(index - current)));

        turnPages(count, direction, () => {
            current = index;
            activeSection = target.sectionId;
            showingEntry = showEntry;
        });
    }

    function selectSection(id: SectionId) {
        const first = entries.findIndex((entry) => entry.sectionId === id);
        if (first !== -1) {
            // A spread has no contents to pick from: on mobile, go straight to its second page.
            goTo(first, isSpreadSection(id));
            return;
        }
        // Empty section: nothing to read, just show its (empty) contents page.
        if (id === activeSection) return;
        const sectionIndex = (sid: SectionId) => sections.findIndex((s) => s.id === sid);
        const direction = sectionIndex(id) > sectionIndex(activeSection) ? 'forward' : 'backward';
        turnPages(mobileQuery.matches ? 1 : MAX_LEAVES / 2, direction, () => {
            activeSection = id;
            showingEntry = false;
        });
    }

    /** Opens the book, on the entry `key` when given, else where the reader left it. */
    const open = (nextMode: BookMode, key?: string) => {
        if (isClosing()) {
            finishClose();
            // Force a style flush so re-adding `open` restarts the entrance animation.
            void book.offsetWidth;
        }
        load(nextMode);
        showingEntry = false;

        const index = key === undefined ? undefined : indexByKey.get(key);
        const target = index === undefined ? undefined : entries[index];
        if (index !== undefined && target) {
            current = index;
            activeSection = target.sectionId;
            showingEntry = true;
        }

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
    backButton.addEventListener('click', () => goTo(current, false));

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
    // Not only the settings spread: tutorial pages draw the player's own keys too.
    events.on('settingsChanged', () => {
        if (isOpen() && !isClosing()) render();
    });
}
