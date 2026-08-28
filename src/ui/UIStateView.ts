import { events } from '../core/events';

export function initUIStateView() {
    const uiContainer = document.getElementById('ui-container');
    if (!uiContainer) return;

    events.on('stateChange', (newState) => {
        // Assigning className wholesale would drop `pixel-ui` (and anything else set in
        // the markup) — only the state class is ours to replace.
        const stateClass = `state-${newState.toLowerCase()}`;
        setStateClass(uiContainer, stateClass);
        setStateClass(document.body, stateClass);
    });
}

function setStateClass(element: HTMLElement, stateClass: string) {
    for (const name of [...element.classList]) {
        if (name.startsWith('state-')) element.classList.remove(name);
    }
    element.classList.add(stateClass);
}
