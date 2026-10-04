export type FlipDirection = 'forward' | 'backward';

export type PageFlipOptions = {
    /** How many leaves turn. Big jumps in the book turn a whole bundle. */
    count: number;
    direction: FlipDirection;
    /**
     * Real pages, cloned onto the first and last leaf so the turn starts and lands
     * on real content: `from` is the page being lifted, `to()` the page landed on
     * (read after the swap, once it holds the new content).
     */
    from: HTMLElement;
    to: () => HTMLElement;
    /** Called once, while the last leaf stands upright: the moment to swap the real content. */
    onSwap: () => void;
};

export type PageFlip = { finish: () => void };

const LEAF_DURATION_MS = 560;
const MAX_STAGGER_MS = 45;
/** The whole bundle leaves within this window, however many leaves there are. */
const MAX_SPREAD_MS = 420;
/** Gap between stacked leaves, so the 3D sort puts each one above the previous. */
const LEAF_GAP_PX = 0.4;
const EASING = 'cubic-bezier(0.45, 0.05, 0.3, 1)';

function createLeaf(): { leaf: HTMLElement; front: HTMLElement; back: HTMLElement } {
    const leaf = document.createElement('div');
    leaf.className = 'book-leaf';
    const front = document.createElement('div');
    front.className = 'book-leaf-face book-leaf-front';
    const back = document.createElement('div');
    back.className = 'book-leaf-face book-leaf-back';
    leaf.append(front, back);
    return { leaf, front, back };
}

function copyPage(page: HTMLElement, face: HTMLElement) {
    face.replaceChildren(...[...page.children].map((child) => child.cloneNode(true)));
}

/**
 * Turns `count` blank leaves around the spine. A leaf sits on the right page at
 * rotateY(0) and on the left page at rotateY(-180deg), so going backward is the
 * same animation played the other way.
 */
export function flipPages(layer: HTMLElement, options: PageFlipOptions): PageFlip {
    const { count, direction, from, to, onSwap } = options;

    let swapped = false;
    const swap = () => {
        if (swapped) return;
        swapped = true;
        onSwap();
    };

    const stagger = count > 1 ? Math.min(MAX_STAGGER_MS, MAX_SPREAD_MS / (count - 1)) : 0;
    const forward = direction === 'forward';
    const leaves: ReturnType<typeof createLeaf>[] = [];
    const animations: Animation[] = [];

    for (let i = 0; i < count; i++) {
        const leaf = createLeaf();
        // Leaf 0 starts on top of its stack, the last one ends on top of the other.
        const startZ = (count - i) * LEAF_GAP_PX;
        const endZ = (i + 1) * LEAF_GAP_PX;
        const flat = forward ? 0 : -180;
        const turned = forward ? -180 : 0;

        layer.appendChild(leaf.leaf);
        leaves.push(leaf);
        animations.push(
            leaf.leaf.animate(
                [
                    { transform: `translateZ(${startZ}px) rotateY(${flat}deg)` },
                    { transform: `translateZ(${endZ}px) rotateY(${turned}deg)` },
                ],
                // `both`: waiting leaves hold their start pose instead of snapping
                // to the CSS one, and finished ones stay put until removed.
                { duration: LEAF_DURATION_MS, delay: i * stagger, easing: EASING, fill: 'both' },
            ),
        );
    }

    // The top leaf lifts the page the reader was looking at.
    const first = leaves[0];
    if (first) copyPage(from, forward ? first.front : first.back);

    const lastDelay = (count - 1) * stagger;
    const swapTimer = window.setTimeout(() => {
        swap();
        // The last leaf lands on the new page: give it that content so removing it is invisible.
        const last = leaves[leaves.length - 1];
        if (last) copyPage(to(), forward ? last.back : last.front);
    }, lastDelay + LEAF_DURATION_MS / 2);

    const cleanup = () => {
        window.clearTimeout(swapTimer);
        for (const { leaf } of leaves) leaf.remove();
    };

    // `finished` rejects when an animation is cancelled; finish() already cleaned up then.
    Promise.all(animations.map((a) => a.finished)).then(cleanup, () => {});

    return {
        finish() {
            swap();
            for (const animation of animations) animation.cancel();
            cleanup();
        },
    };
}
