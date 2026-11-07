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

/**
 * What the water depth prepass draws: the terrain and the rocks, nothing else.
 * Objects stay on layer 0 too (`enable`, not `set`), so the main camera still
 * sees them. Leaving everything else out is a CPU fix more than a GPU one: a
 * material drawn into a render target and then onto the screen swaps shader
 * keys (tone mapping, colour space) both times, and three rebuilds its program
 * parameters on every such draw. With every bush and tree in, that was most of
 * the frame.
 */
export const SHORE_LAYER = 4;
