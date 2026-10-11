import * as THREE from 'three';

/**
 * Anything the hit flash (or any tint effect) is allowed to drive. Written as a
 * structural type rather than a union of concrete material classes so swapping a
 * material type later does not ripple through every component signature.
 */
export type TintableMaterial = THREE.Material & { color: THREE.Color };

/** Same idea as TintableMaterial, for the pulsing glow on statues and bonfires. */
export type EmissiveMaterial = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };

export type LitMaterialOptions = {
    color: THREE.ColorRepresentation;
    /** Self-lit rim/glow colour, for things that should read as emitting (flames, crystals). */
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
};

/**
 * The single entry point for every lit surface in the world. Centralised so the
 * whole game's look is one edit away — the alternative (material constructors
 * spread across a dozen factories) means the next look change forgets one of
 * them and that mesh shades differently from everything else.
 *
 * Lambert rather than Standard (PBR): the ground, grass and water are patched
 * Lambert too, so entities catch light the same way the terrain does, and flat
 * low-poly colours gain nothing from roughness/metalness.
 */
export function createLitMaterial(options: LitMaterialOptions): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
        color: options.color,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 1,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
    });
}

/** Copies what carries over from a glTF's PBR material onto a lit one. */
export function fromGltfMaterial(source: THREE.MeshStandardMaterial): THREE.MeshLambertMaterial {
    const material = createLitMaterial({
        color: source.color,
        emissive: source.emissive,
        emissiveIntensity: source.emissiveIntensity,
        transparent: source.transparent,
        opacity: source.opacity,
    });

    material.map = source.map;
    material.normalMap = source.normalMap;
    material.emissiveMap = source.emissiveMap;
    material.alphaTest = source.alphaTest;
    material.side = source.side;
    material.name = source.name;

    return material;
}
