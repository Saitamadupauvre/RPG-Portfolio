import * as THREE from 'three';

/**
 * Anything the hit flash (or any tint effect) is allowed to drive. Written as a
 * structural type rather than a union of concrete material classes so swapping a
 * material type later does not ripple through every component signature.
 */
export type TintableMaterial = THREE.Material & { color: THREE.Color };

/** Same idea as TintableMaterial, for the pulsing glow on statues and bonfires. */
export type EmissiveMaterial = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };

/**
 * The lighting steps every surface in the game snaps to. Four rather than three,
 * and a lifted darkest step: more steps read smoother while still stepping, and
 * a shadow that never drops below ~0.6 keeps colour in the dark side instead of
 * crushing it toward black — which is what made the first pass look harsh.
 */
const TOON_STEPS = [0x9c, 0xc2, 0xe2, 0xff];

let gradient: THREE.DataTexture | null = null;

/**
 * The ramp MeshToonMaterial looks up with dot(normal, lightDir). Nearest
 * filtering is the whole trick: without it the GPU interpolates between steps
 * and the hard band edges turn back into a gradient.
 *
 * Built lazily and shared by every material — it is a 3x1 texture, there is no
 * reason for more than one on the GPU.
 */
export function getToonGradient(): THREE.DataTexture {
    if (gradient) return gradient;

    const data = new Uint8Array(TOON_STEPS.length * 4);
    TOON_STEPS.forEach((step, i) => {
        data[i * 4 + 0] = step;
        data[i * 4 + 1] = step;
        data[i * 4 + 2] = step;
        data[i * 4 + 3] = 255;
    });

    gradient = new THREE.DataTexture(data, TOON_STEPS.length, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;

    return gradient;
}

export type ToonMaterialOptions = {
    color: THREE.ColorRepresentation;
    /** Self-lit rim/glow colour, for things that should read as emitting (flames, crystals). */
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
};

/**
 * The single entry point for every lit surface in the world. Centralised so the
 * whole game's look is one edit away — the alternative (MeshToonMaterial spread
 * across a dozen factories) means the gradient map gets forgotten on the next
 * new entity and that one mesh shades smoothly against everything else.
 */
export function createToonMaterial(options: ToonMaterialOptions): THREE.MeshToonMaterial {
    const material = new THREE.MeshToonMaterial({
        color: options.color,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 1,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        gradientMap: getToonGradient(),
    });

    return material;
}

/** Copies what carries over from a glTF's PBR material onto a toon one. */
export function toToonMaterial(source: THREE.MeshStandardMaterial): THREE.MeshToonMaterial {
    const material = createToonMaterial({
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
