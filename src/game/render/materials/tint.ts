import * as THREE from 'three';
import type { Random } from '../world/grass/random';

/** How far a colour may stray from its base, in HSL units. */
export type TintSpread = { hue: number; saturation: number; lightness: number };

/**
 * A colour near `base`, nudged by `random()`. Callers seed the generator from
 * the entity id, so an entity keeps its colour across reloads and chunk
 * streaming and nothing extra has to be saved in the layout.
 */
export function jitterColor(base: number, random: Random, spread: TintSpread, amount = 1): THREE.Color {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(base).getHSL(hsl);
    const offset = () => (random() - 0.5) * 2 * amount;
    return new THREE.Color().setHSL(
        hsl.h + offset() * spread.hue,
        THREE.MathUtils.clamp(hsl.s + offset() * spread.saturation, 0, 1),
        THREE.MathUtils.clamp(hsl.l + offset() * spread.lightness, 0, 1),
    );
}
