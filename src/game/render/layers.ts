/**
 * Three.js render layers in use. A camera only draws objects on a layer it has
 * enabled (layer 0 by default), and a raycaster only hits those too.
 */

/** Grass blades: on their own layer so the water depth prepass can skip them. */
export const GRASS_LAYER = 1;

/** Drawn and picked in the editor only (trigger volumes): enabled on the camera while in `EDITOR`. */
export const EDITOR_LAYER = 2;

/** Wind streaks: transparent ribbons the water depth prepass must not draw into the shore foam. */
export const WIND_LAYER = 3;
