import * as THREE from 'three';
import type { Component } from '../../domain/components/Component';
import { validateController, type AnimatorControllerDefinition, type StateDefinition } from '../../domain/animation/AnimatorController';
import { AnimatorParameters } from '../../domain/animation/AnimatorParameters';
import { AnimatorLayer, type ActiveState } from '../../domain/animation/AnimatorLayer';
import { sampleClip, type SampledTrack } from './sampleClip';
import type { Rig } from './Rig';

/**
 * One rig property the animator owns: which object, which property, and what it looked like
 * before any clip touched it (the bind pose). Vector and quaternion bindings are kept apart
 * because the two blend with different math (lerp vs slerp).
 */
interface VectorBinding {
    kind: 'vector';
    key: string;
    target: string;
    object: THREE.Object3D;
    property: 'position' | 'scale';
    rest: THREE.Vector3;
}

interface QuaternionBinding {
    kind: 'quaternion';
    key: string;
    target: string;
    object: THREE.Object3D;
    rest: THREE.Quaternion;
}

type Binding = VectorBinding | QuaternionBinding;

interface LayerRuntime {
    layer: AnimatorLayer;
    /** Null = no mask, the layer may write every node. */
    mask: Set<string> | null;
    weight: number;
}

export interface PlayOptions {
    /** Seconds of crossfade into the state. */
    crossfade?: number;
}

/**
 * The Three.js half of the animator: binds the clips a model brings to its bones, advances
 * the layers, and writes the blended pose every frame. Gameplay talks to it the way a Unity
 * script talks to an Animator — set parameters, occasionally `play` a state directly, listen
 * for clip events.
 *
 * The graph runs from the first frame; the model arrives whenever it loads and `bind` hooks
 * it up. Until then the animator moves nothing and loses nothing.
 *
 * Every frame the pose is rebuilt from the bind pose and the active clips, never accumulated:
 * a property some clip animates is written every frame (its rest value when nothing is
 * animating it), so a dash cannot leave the body stretched after it fades out. A property
 * no clip mentions is never touched, which leaves room for procedural code to own it.
 */
export class AnimatorComponent implements Component {
    public readonly name = 'animator';

    private definition: AnimatorControllerDefinition;
    private params: AnimatorParameters;
    private layers: LayerRuntime[] = [];
    private layerByName = new Map<string, LayerRuntime>();
    /** Per-entity clip swaps, state name -> clip name. The layers read this map by reference. */
    private overrides = new Map<string, string>();
    private listeners = new Map<string, Set<() => void>>();

    private rig: Rig = {};
    private clips = new Map<string, THREE.AnimationClip>();
    private bindings: Binding[] = [];
    private boundKeys = new Set<string>();

    // Scratch values so the blend never allocates.
    private vector = new THREE.Vector3();
    private vectorLayer = new THREE.Vector3();
    private vectorContribution = new THREE.Vector3();
    private quaternion = new THREE.Quaternion();
    private quaternionLayer = new THREE.Quaternion();
    private quaternionContribution = new THREE.Quaternion();

    constructor(definition: AnimatorControllerDefinition) {
        validateController(definition);
        this.definition = definition;
        this.params = new AnimatorParameters(definition.parameters);

        const durationOf = (clip: string) => this.clips.get(clip)?.duration;
        const emit = (event: string) => this.listeners.get(event)?.forEach((listener) => listener());
        for (const layerDefinition of definition.layers) {
            const runtime: LayerRuntime = {
                layer: new AnimatorLayer(layerDefinition, this.params, this.overrides, durationOf, emit),
                mask: layerDefinition.mask ? new Set(layerDefinition.mask) : null,
                weight: layerDefinition.weight ?? 1,
            };
            this.layers.push(runtime);
            this.layerByName.set(layerDefinition.name, runtime);
        }
    }

    // --- binding ------------------------------------------------------------------------

    /**
     * Hooks a loaded model up: its named nodes become the rig, its clips become what the states
     * play. Fails loudly on a state whose clip the model does not carry — a typo here would
     * otherwise be a character that quietly never moves.
     */
    public bind(rig: Rig, clips: readonly THREE.AnimationClip[]) {
        this.rig = rig;
        this.clips = new Map(clips.map((clip) => [clip.name, clip]));
        this.bindings = [];
        this.boundKeys.clear();

        for (const layer of this.definition.layers) {
            for (const state of layer.states) {
                if (state.clip) this.bindClip(this.requireClip(state.clip, `state "${state.name}"`));
            }
        }
        for (const [state, clip] of this.overrides) this.bindClip(this.requireClip(clip, `override of state "${state}"`));
    }

    // --- parameters ---------------------------------------------------------------------

    public setBool(name: string, value: boolean) {
        this.params.setBool(name, value);
    }

    public getBool(name: string): boolean {
        return this.params.getBool(name);
    }

    public setFloat(name: string, value: number) {
        this.params.setFloat(name, value);
    }

    public getFloat(name: string): number {
        return this.params.getFloat(name);
    }

    public setTrigger(name: string) {
        this.params.setTrigger(name);
    }

    public resetTrigger(name: string) {
        this.params.resetTrigger(name);
    }

    // --- states -------------------------------------------------------------------------

    /** Name of the state a layer is currently in. */
    public getState(layerName: string): string {
        return this.layer(layerName).layer.stateName;
    }

    /** Definition of a layer's current state: its clip name, markers, events. */
    public getStateDefinition(layerName: string): StateDefinition {
        return this.layer(layerName).layer.state;
    }

    /** Seconds the clip of a layer's current state lasts, or null in an empty state / before the model loaded. */
    public getClipDuration(layerName: string): number | null {
        const state = this.getStateDefinition(layerName);
        const clip = this.overrides.get(state.name) ?? state.clip;
        return clip ? this.clips.get(clip)?.duration ?? null : null;
    }

    /** Forces a state, bypassing the transition graph — for one-offs like a hit reaction or a cutscene pose. */
    public play(stateName: string, options: PlayOptions = {}) {
        this.owner(stateName).layer.play(stateName, options.crossfade ?? 0.1);
    }

    /** Scrubs a layer's current state to a time in seconds. Meant for `speed: 0` states that gameplay drives. */
    public setTime(layerName: string, seconds: number) {
        this.layer(layerName).layer.setTime(seconds);
    }

    /**
     * Swaps the clip a state plays, for this entity only — Unity's AnimatorOverrideController.
     * The graph, parameters and transitions stay shared; only what each state shows changes.
     */
    public overrideClip(stateName: string, clipName: string) {
        this.owner(stateName);
        this.overrides.set(stateName, clipName);
        if (this.clips.size > 0) this.bindClip(this.requireClip(clipName, `override of state "${stateName}"`));
    }

    public clearOverride(stateName: string) {
        this.overrides.delete(stateName);
    }

    // --- events -------------------------------------------------------------------------

    public on(event: string, listener: () => void) {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener);
    }

    public off(event: string, listener: () => void) {
        this.listeners.get(event)?.delete(listener);
    }

    // --- frame --------------------------------------------------------------------------

    public update(dt: number) {
        for (const { layer } of this.layers) layer.update(dt);

        for (const binding of this.bindings) {
            if (binding.kind === 'vector') this.writeVector(binding);
            else this.writeQuaternion(binding);
        }
    }

    /**
     * Folds the layers bottom to top. Inside a layer the active states are averaged by weight;
     * a state without a clip contributes the pose from below (pass-through), and a state whose
     * clip does not animate this property contributes the rest pose, so a crossfade out of a
     * clip eases the property home instead of dropping it.
     */
    private writeVector(binding: VectorBinding) {
        const value = this.vector.copy(binding.rest);

        for (const { layer, mask, weight } of this.layers) {
            if (mask && !mask.has(binding.target)) continue;

            let accumulated = 0;
            for (const state of layer.activeStates()) {
                const contribution = this.vectorContribution;
                const track = this.trackFor(state, binding.key);
                if (!state.clip) contribution.copy(value);
                else if (track?.kind === 'vector') contribution.fromArray(track.interpolant.evaluate(state.time));
                else contribution.copy(binding.rest);

                accumulated += state.weight;
                if (accumulated === state.weight) this.vectorLayer.copy(contribution);
                else this.vectorLayer.lerp(contribution, state.weight / accumulated);
            }

            if (accumulated > 0) value.lerp(this.vectorLayer, weight);
        }

        binding.object[binding.property].copy(value);
    }

    private writeQuaternion(binding: QuaternionBinding) {
        const value = this.quaternion.copy(binding.rest);

        for (const { layer, mask, weight } of this.layers) {
            if (mask && !mask.has(binding.target)) continue;

            let accumulated = 0;
            for (const state of layer.activeStates()) {
                const contribution = this.quaternionContribution;
                const track = this.trackFor(state, binding.key);
                if (!state.clip) contribution.copy(value);
                else if (track?.kind === 'quaternion') contribution.fromArray(track.interpolant.evaluate(state.time));
                else contribution.copy(binding.rest);

                accumulated += state.weight;
                if (accumulated === state.weight) this.quaternionLayer.copy(contribution);
                else this.quaternionLayer.slerp(contribution, state.weight / accumulated);
            }

            if (accumulated > 0) value.slerp(this.quaternionLayer, weight);
        }

        binding.object.quaternion.copy(value);
    }

    private trackFor(state: ActiveState, key: string): SampledTrack | undefined {
        const clip = state.clip ? this.clips.get(state.clip) : undefined;
        return clip ? sampleClip(clip).tracks.get(key) : undefined;
    }

    private requireClip(name: string, where: string): THREE.AnimationClip {
        const clip = this.clips.get(name);
        if (clip) return clip;
        const available = [...this.clips.keys()].join(', ') || 'none';
        throw new Error(`[animator] ${where} wants clip "${name}", but the model only has: ${available}`);
    }

    /** Registers every node property a clip animates, snapshotting the node's bind pose as its rest value. */
    private bindClip(clip: THREE.AnimationClip) {
        for (const [key, { target, property, kind }] of sampleClip(clip).tracks) {
            if (this.boundKeys.has(key)) continue;

            const object = this.rig[target];
            if (!object) {
                console.warn(`[animator] clip "${clip.name}" animates "${target}", which the model has no node for`);
                continue;
            }

            this.boundKeys.add(key);
            if (kind === 'quaternion' || property === 'rotation') {
                this.bindings.push({ kind: 'quaternion', key, target, object, rest: object.quaternion.clone() });
            } else {
                this.bindings.push({ kind: 'vector', key, target, object, property, rest: object[property].clone() });
            }
        }
    }

    private layer(name: string): LayerRuntime {
        const runtime = this.layerByName.get(name);
        if (!runtime) throw new Error(`[animator] no layer named "${name}"`);
        return runtime;
    }

    private owner(stateName: string): LayerRuntime {
        const runtime = this.layers.find(({ layer }) => layer.hasState(stateName));
        if (!runtime) throw new Error(`[animator] no state named "${stateName}"`);
        return runtime;
    }
}
