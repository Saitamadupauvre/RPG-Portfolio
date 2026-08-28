import { events } from '../../core/events';

const KEY_LABELS: Record<string, string> = {
    KeyE: 'E',
    KeyF: 'F',
};

function keyLabel(code: string): string {
    return KEY_LABELS[code] ?? code.replace('Key', '');
}

export function initInteractPromptView() {
    const prompt = document.getElementById('interact-prompt');
    if (!prompt) return;

    events.on('interactPromptChange', (actions) => {
        if (!actions || actions.length === 0) {
            prompt.classList.remove('visible');
            return;
        }

        prompt.textContent = actions
            .map((action) => `[${keyLabel(action.key)}] ${action.label}`)
            .join('   ');
        prompt.classList.add('visible');
    });
}
