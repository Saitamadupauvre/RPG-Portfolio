import * as THREE from 'three';

export type BoundProperty = 'position' | 'rotation' | 'scale';

/**
 * One glTF track, ready to sample. Three's own interpolant does the work — linear, step or
 * cubic spline as exported, and proper slerp for quaternion tracks — so whatever Blender
 * writes plays back the way Blender showed it.
 */
export interface SampledTrack {
    target: string;
    property: BoundProperty;
    kind: 'vector' | 'quaternion';
    interpolant: THREE.Interpolant;
}

export interface SampledClip {
    duration: number;
    /** Keyed by `${nodeName}.${property}`, which is also how the animator names its bindings. */
    tracks: Map<string, SampledTrack>;
}

export function trackKey(target: string, property: BoundProperty): string {
    return `${target}.${property}`;
}

const PROPERTY_OF: Record<string, BoundProperty | undefined> = {
    position: 'position',
    quaternion: 'rotation',
    scale: 'scale',
};

/** Compiled once per clip object, however many entities share it. */
const cache = new WeakMap<THREE.AnimationClip, SampledClip>();

export function sampleClip(clip: THREE.AnimationClip): SampledClip {
    let sampled = cache.get(clip);
    if (sampled) return sampled;

    const tracks = new Map<string, SampledTrack>();
    for (const track of clip.tracks) {
        const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
        const property = PROPERTY_OF[propertyName];
        if (!nodeName || !property) {
            // Morph targets and the like: nothing the rig blend knows how to write.
            console.warn(`[animator] clip "${clip.name}" track "${track.name}" is not a transform track and is ignored`);
            continue;
        }
        tracks.set(trackKey(nodeName, property), {
            target: nodeName,
            property,
            kind: property === 'rotation' ? 'quaternion' : 'vector',
            interpolant: createInterpolant(track),
        });
    }

    sampled = { duration: clip.duration, tracks };
    cache.set(clip, sampled);
    return sampled;
}

/**
 * Three keeps the factory the track was configured with in `createInterpolant` — including the
 * loader's cubic-spline one for CUBICSPLINE exports — but leaves it out of the typings.
 */
function createInterpolant(track: THREE.KeyframeTrack): THREE.Interpolant {
    const configured = (track as { createInterpolant?: (result?: Float32Array) => THREE.Interpolant }).createInterpolant;
    return configured ? configured.call(track) : track.InterpolantFactoryMethodLinear();
}
