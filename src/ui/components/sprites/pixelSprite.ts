const SVG_NS = 'http://www.w3.org/2000/svg';

/** One frame: rows of characters, one character per art pixel, '.' transparent. */
export type SpriteFrame = readonly string[];

export type Sprite = {
    /** Several frames make a sprite sheet, laid side by side and stepped through in CSS. */
    frames: readonly SpriteFrame[];
    palette: Readonly<Record<string, string>>;
};

/**
 * Draws pixel art as an SVG: crisp at any integer scale, no image files, and
 * the art stays editable as text. Each horizontal run of one colour becomes one
 * rect, so a sprite costs a few dozen elements rather than one per pixel.
 *
 * The result is a `.sprite` box one frame wide (sized in CSS from `--cols`,
 * `--rows` and `--px`) holding the whole sheet; `.sprite-play` steps it.
 */
export function renderSprite(sprite: Sprite, className = ''): HTMLElement {
    const { frames, palette } = sprite;
    const rows = frames[0]?.length ?? 0;
    const cols = frames[0]?.[0]?.length ?? 0;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${cols * frames.length} ${rows}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');

    frames.forEach((frame, index) => {
        if (frame.length !== rows || frame.some((row) => row.length !== cols)) {
            throw new Error(`Sprite frame ${index} is not ${cols}x${rows}`);
        }
        frame.forEach((row, y) => {
            for (let x = 0; x < cols; ) {
                const char = row[x];
                let end = x + 1;
                while (end < cols && row[end] === char) end++;

                const fill = palette[char];
                if (char !== '.' && fill) {
                    const rect = document.createElementNS(SVG_NS, 'rect');
                    rect.setAttribute('x', String(index * cols + x));
                    rect.setAttribute('y', String(y));
                    rect.setAttribute('width', String(end - x));
                    rect.setAttribute('height', '1');
                    rect.setAttribute('fill', fill);
                    svg.appendChild(rect);
                }
                x = end;
            }
        });
    });

    const box = document.createElement('span');
    box.className = `sprite ${className}`.trim();
    box.style.setProperty('--cols', String(cols));
    box.style.setProperty('--rows', String(rows));
    box.style.setProperty('--frames', String(frames.length));
    box.appendChild(svg);
    return box;
}

/** The same frame flipped left to right. */
export function mirror(frame: SpriteFrame): SpriteFrame {
    return frame.map((row) => [...row].reverse().join(''));
}
