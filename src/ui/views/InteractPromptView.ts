import { events } from '../../core/events';

// DOM half of the interaction flow: the game layer decides *what* is interactable,
// this only renders the label. Keeps the prompt in the pixel-UI stack instead of a
// 3D sprite, so it restyles with the rest of the interface later.
export function initInteractPromptView() {
    const prompt = document.getElementById('interact-prompt');
    if (!prompt) return;

    events.on('interactPromptChange', (label) => {
        if (!label) {
            prompt.classList.remove('visible');
            return;
        }

        prompt.textContent = `[E] ${label}`;
        prompt.classList.add('visible');
    });
}
