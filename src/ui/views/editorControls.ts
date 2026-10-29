/** Small form builders shared by the editor panel and its scatter section. */

/**
 * `whole` covers grid sizes, which are counts and cannot be zero or fractional.
 * The water level is neither — it is a world Y that is usually negative — so it
 * opts out rather than being silently rounded up to 1.
 */
export function numberField(
    label: string,
    value: number,
    onChange: (value: number) => void,
    whole = true,
): HTMLElement {
    const field = numberInput(value, (parsed) => {
        const next = whole ? Math.round(parsed) : parsed;
        if (whole && next <= 0) return;
        onChange(next);
    });
    field.classList.add('editor-number');

    return row(label, field);
}

/** A bare number box, for rows that hold more than one (a min and a max). */
export function numberInput(value: number, onChange: (value: number) => void): HTMLInputElement {
    return input('number', String(value), (raw) => {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
    });
}

export function input(type: 'text' | 'number', value: string, onChange: (value: string) => void): HTMLInputElement {
    const element = document.createElement('input');
    element.type = type;
    element.className = 'editor-input';
    element.value = value;
    if (type === 'number') element.step = '0.5';
    element.addEventListener('change', () => onChange(element.value));
    return element;
}

export function row(label: string, field: HTMLElement): HTMLElement {
    const line = document.createElement('label');
    line.className = 'editor-field';

    const text = document.createElement('span');
    text.textContent = label;
    line.appendChild(text);
    line.appendChild(field);

    return line;
}

/** Several fields side by side under one label. */
export function group(label: string, ...fields: HTMLElement[]): HTMLElement {
    const box = document.createElement('div');
    box.className = 'editor-vector';
    box.append(...fields);
    return row(label, box);
}

export function button(label: string, onClick: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.className = 'btn editor-btn';
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
}
