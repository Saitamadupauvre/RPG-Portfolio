/**
 * The Unity model: a controller is a graph of states (each playing one clip) joined by
 * transitions that fire when parameters match, stacked in layers so an upper-body swing
 * can play over a lower-body walk. This file is only the *definition* — pure data plus a
 * validator — so it can be authored per entity and checked before any model has loaded.
 *
 * Clips are referenced by name: the names of the Actions exported from Blender. Everything
 * the engine cannot read out of a glTF (looping, phase markers, events) is declared here on
 * the state instead.
 */

export type ParameterType = 'bool' | 'float' | 'trigger';

/** Bools and triggers use `is`; floats use one of the numeric comparisons. */
export type Condition =
    | { param: string; is: boolean }
    | { param: string; equals: number }
    | { param: string; greater: number }
    | { param: string; less: number };

export interface ClipEvent {
    /** Seconds into the clip. */
    time: number;
    name: string;
}

export interface StateDefinition {
    name: string;
    /** Name of the clip, as exported. Omitted = empty state: the layer lets the pose from the layers below show through. */
    clip?: string;
    /** Whether the clip repeats. A one-shot holds its last frame until a transition leaves. */
    loop?: boolean;
    /** Playback rate. 0 means the clip only moves when code sets its time by hand. */
    speed?: number;
    /** Float parameter multiplied into the speed every frame (e.g. a walk cycle tied to move speed). */
    speedParam?: string;
    /** Named times in seconds (Blender frame / fps), for code that scrubs the clip and needs to know where its phases sit. */
    markers?: Record<string, number>;
    /** Fired once when playback crosses `time` (every cycle for a loop). */
    events?: ClipEvent[];
}

export interface TransitionDefinition {
    /** Source state name, or '*' to leave from any state. */
    from: string;
    to: string;
    conditions?: Condition[];
    /** Crossfade length in seconds. 0 (the default) snaps. */
    duration?: number;
    /** Normalized time (1 = one full clip) the source must reach first. Lets a one-shot finish before leaving. */
    exitTime?: number;
    /**
     * Whether a '*' transition may restart the state it is already in. Off by default: a bool
     * condition on an any-state transition would otherwise restart the state every frame.
     */
    canTransitionToSelf?: boolean;
}

export interface LayerDefinition {
    name: string;
    states: StateDefinition[];
    /** Checked in order each frame; the first that passes wins. Any-state ('*') ones are checked first. */
    transitions?: TransitionDefinition[];
    /** State the layer starts in. Defaults to the first one. */
    entry?: string;
    /** Bone names this layer is allowed to write. Unrestricted when omitted. */
    mask?: string[];
    /** How strongly the layer overrides what is below it. Defaults to 1. */
    weight?: number;
}

export interface AnimatorControllerDefinition {
    parameters: Record<string, ParameterType>;
    /** Evaluated bottom to top: each layer overrides the pose the previous ones produced. */
    layers: LayerDefinition[];
}

/**
 * Fails loudly on the mistakes that would otherwise show up as a silently frozen character:
 * a typo in a state name, a condition on a parameter that was never declared, a transition
 * with nothing to fire it. Clip names are checked later, against the model that loaded.
 */
export function validateController(definition: AnimatorControllerDefinition) {
    const stateNames = new Set<string>();

    for (const layer of definition.layers) {
        if (layer.states.length === 0) throw new Error(`[animator] layer "${layer.name}" has no states`);

        const localStates = new Set<string>();
        for (const state of layer.states) {
            if (stateNames.has(state.name)) {
                // Unique across layers, not only within one, so `overrideClip(name)` is unambiguous.
                throw new Error(`[animator] state name "${state.name}" is used twice`);
            }
            stateNames.add(state.name);
            localStates.add(state.name);

            if (state.speedParam) expectParameter(definition, state.speedParam, 'float', `state "${state.name}"`);
            for (const event of state.events ?? []) {
                if (event.time < 0) throw new Error(`[animator] state "${state.name}" event "${event.name}" has a negative time`);
            }
        }

        if (layer.entry && !localStates.has(layer.entry)) {
            throw new Error(`[animator] layer "${layer.name}" entry state "${layer.entry}" does not exist`);
        }

        for (const transition of layer.transitions ?? []) {
            const label = `transition ${transition.from} -> ${transition.to}`;
            if (transition.from !== '*' && !localStates.has(transition.from)) {
                throw new Error(`[animator] ${label}: unknown source state in layer "${layer.name}"`);
            }
            if (!localStates.has(transition.to)) {
                throw new Error(`[animator] ${label}: unknown target state in layer "${layer.name}"`);
            }
            if (!transition.conditions?.length && transition.exitTime == null) {
                throw new Error(`[animator] ${label} has no conditions and no exitTime, so it would fire every frame`);
            }
            for (const condition of transition.conditions ?? []) {
                const expected: ParameterType[] = 'is' in condition ? ['bool', 'trigger'] : ['float'];
                expectParameter(definition, condition.param, expected, label);
            }
        }
    }
}

function expectParameter(definition: AnimatorControllerDefinition, name: string, types: ParameterType | ParameterType[], where: string) {
    const type = definition.parameters[name];
    const allowed = Array.isArray(types) ? types : [types];
    if (!type) throw new Error(`[animator] ${where} uses undeclared parameter "${name}"`);
    if (!allowed.includes(type)) throw new Error(`[animator] ${where}: parameter "${name}" is a ${type}, expected ${allowed.join(' or ')}`);
}
