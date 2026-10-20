/** Every tutorial a trigger can open. Each one is also a page of the book's Tutorial section, same id. */
export const TUTORIAL_IDS = ['movement', 'dash', 'attack'] as const;

export type TutorialId = (typeof TUTORIAL_IDS)[number];

export function isTutorialId(value: string): value is TutorialId {
    return (TUTORIAL_IDS as readonly string[]).includes(value);
}
