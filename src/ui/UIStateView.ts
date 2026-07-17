import { events } from '../core/events';

export function initUIStateView() {
    const uiContainer = document.getElementById('ui-container');
    if (!uiContainer) return;

    events.on('stateChange', (newState) => {
        uiContainer.className = `state-${newState.toLowerCase()}`;
        document.body.className = `state-${newState.toLowerCase()}`;
    });
}
