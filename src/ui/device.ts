/**
 * A phone or a tablet without a keyboard and mouse: the game needs both, so these only get the book.
 * The primary pointer, not the screen width: a narrow desktop window can still play.
 */
export const isTouchOnly = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
