import * as THREE from 'three';
import { getWindUniforms, WIND_GLSL } from '../world/wind';

/** One clock shared by every tree, so the material program and its uniforms are shared too. */
const treeTime = { value: 0 };

/** Cheap enough to call from every tree mesh's `onBeforeRender`: it only stamps the clock. */
export function tickTreeSway() {
    treeTime.value = performance.now() / 1000;
}

/** Fractions of the model's height where the base darkening starts and ends. */
const SHADE_FROM = 0.2;
const SHADE_TO = 0.8;

/**
 * Patches a lit material so the tree sways with the world wind and darkens
 * toward its base. The bend grows with the square of the height above the tree's
 * origin: the foot stays planted, the crown moves most. The offset is applied in
 * world space so every tree leans the same way the grass does, whatever its yaw.
 *
 * The shadow pass uses a separate depth material, so shadows do not sway; at
 * this amplitude nobody can tell.
 */
/** Trees this tall sway as the raw height-squared law says; anything shorter is boosted to match. */
const REFERENCE_HEIGHT = 2.5;

export function applyTreeSway(material: THREE.Material, modelHeight: number, worldHeight: number) {
    // The bend grows with height squared, which would leave a half-metre bush motionless.
    const boost = Math.max(1, (REFERENCE_HEIGHT / worldHeight) ** 2);
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, getWindUniforms(), {
            uTreeTime: treeTime,
            uTreeBoost: { value: boost },
            // In the model's own units, so a bush darkens over its height as a tree does over its.
            uTreeShade: { value: new THREE.Vector2(SHADE_FROM * modelHeight, SHADE_TO * modelHeight) },
        });

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                ${WIND_GLSL}
                uniform float uTreeTime;
                uniform float uTreeBoost;
                varying float vTreeY;`,
            )
            .replace(
                '#include <project_vertex>',
                /* glsl */ `
                vTreeY = transformed.y;
                vec4 treeWorld = modelMatrix * vec4(transformed, 1.0);
                vec3 treeOrigin = modelMatrix[3].xyz;
                float treeH = max(treeWorld.y - treeOrigin.y, 0.0);
                float treePhase = dot(treeOrigin.xz, uWindDir) * 0.2 - uTreeTime * uWindSpeed;
                float treeGust = 0.6 + sin(treePhase) + 0.4 * sin(treePhase * 2.3 + treeOrigin.x);
                treeWorld.xz += uWindDir * treeGust * uWindStrength * treeH * treeH * 0.03 * uTreeBoost;
                vec4 mvPosition = viewMatrix * treeWorld;
                gl_Position = projectionMatrix * mvPosition;`,
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                uniform vec2 uTreeShade;
                varying float vTreeY;`,
            )
            .replace(
                '#include <color_fragment>',
                /* glsl */ `#include <color_fragment>
                diffuseColor.rgb *= mix(vec3(0.84, 0.91, 0.96), vec3(1.0), smoothstep(uTreeShade.x, uTreeShade.y, vTreeY));`,
            );
    };
    material.customProgramCacheKey = () => 'tree-sway';
    material.needsUpdate = true;
}
