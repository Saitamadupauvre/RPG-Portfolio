import { events, type PromptAction } from '../../core/events';
import { translate } from '../../domain/i18n';
import { bindingFor } from '../../domain/settings';
import { keyName } from '../components/printedKeys';

export function initInteractPromptView() {
    const prompt = document.getElementById('interact-prompt');
    if (!prompt) return;

    /** What is on screen, kept so a language switch can rewrite it in place. */
    let shown: readonly PromptAction[] | null = null;

    const render = () => {
        if (!shown || shown.length === 0) {
            prompt.classList.remove('visible');
            return;
        }

        // Keys are looked up on every show, so a key rebound in the settings is what the prompt says.
        prompt.replaceChildren(...shown.map((action) => {
            const item = document.createElement('span');
            item.className = 'prompt-action';

            const key = document.createElement('kbd');
            key.className = 'prompt-key';
            key.textContent = keyName(bindingFor(action.input));

            item.append(key, translate(action.label));
            return item;
        }));
        prompt.classList.add('visible');
    };

    events.on('interactPromptChange', (actions) => {
        shown = actions;
        render();
    });
    events.on('languageChanged', render);
}
