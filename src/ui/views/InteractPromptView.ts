import { events } from '../../core/events';
import { bindingFor } from '../../domain/settings';
import { keyName } from '../components/printedKeys';

export function initInteractPromptView() {
    const prompt = document.getElementById('interact-prompt');
    if (!prompt) return;

    events.on('interactPromptChange', (actions) => {
        if (!actions || actions.length === 0) {
            prompt.classList.remove('visible');
            return;
        }

        // Keys are looked up on every show, so a key rebound in the settings is what the prompt says.
        prompt.replaceChildren(...actions.map((action) => {
            const item = document.createElement('span');
            item.className = 'prompt-action';

            const key = document.createElement('kbd');
            key.className = 'prompt-key';
            key.textContent = keyName(bindingFor(action.input));

            item.append(key, action.label);
            return item;
        }));
        prompt.classList.add('visible');
    });
}
