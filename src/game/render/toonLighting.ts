/**
 * The cel-shading step for materials that do *not* band their own light — the
 * patched Lambert ground and grass. A MeshToonMaterial already quantises its
 * direct term through the gradient map, so it must not run this on top.
 *
 * Applied to the accumulated diffuse light rather than the final colour, so the
 * terminator snaps into bands while texture/vertex colour stays untouched.
 *
 * The ratio is clamped because a near-black pixel would divide by a tiny
 * luminance and blow the factor up into a bright fringe.
 */
export const TOON_LIGHTING_GLSL = /* glsl */ `
#include <lights_fragment_end>
{
    vec3 toonLit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    float toonLum = dot(toonLit, vec3(0.2126, 0.7152, 0.0722));
    if (toonLum > 0.001) {
        float toonBanded = floor(toonLum * 4.0 + 0.5) / 4.0;
        float toonRatio = clamp(mix(toonLum, toonBanded, 0.8) / toonLum, 0.4, 1.25);
        reflectedLight.directDiffuse *= toonRatio;
        reflectedLight.indirectDiffuse *= toonRatio;
    }
}
`;
