import type { LayerDefinition, StateDefinition, TransitionDefinition } from './AnimatorController';
import type { AnimatorParameters } from './AnimatorParameters';

/** What a layer wants sampled this frame. All weights of one layer sum to 1. */
export interface ActiveState {
    /** Clip name, or null for an empty state: its weight lets the pose from the layers below show through. */
    clip: string | null;
    /** Seconds into the clip, wrapped for loops and clamped for one-shots. */
    time: number;
    weight: number;
}

/** How a layer learns clip lengths: the engine side knows the loaded clips, the layer does not. */
export type DurationLookup = (clip: string) => number | undefined;

interface StateInstance {
    state: StateDefinition;
    /** Unwrapped seconds since the state was entered. */
    time: number;
    /** Time up to which events have already fired. Kept apart from `time` because code may set the time by hand. */
    eventTime: number;
    /** Slice of the outgoing weight this instance keeps while it fades out. Meaningless on the current state. */
    share: number;
}

/**
 * One layer's state machine: which state is current, which ones are still fading out, and
 * how far along the crossfade is. Pure bookkeeping — it reports clip names, times and weights
 * and never touches a mesh.
 *
 * Crossfades: the incoming state ramps 0 -> 1 over the transition, and everything that was
 * playing shares the remainder in the proportions it had when the transition started. So a
 * transition that interrupts another one keeps blending smoothly instead of popping.
 */
export class AnimatorLayer {
    public readonly definition: LayerDefinition;

    private params: AnimatorParameters;
    /** Per-entity clip swaps, keyed by state name. Shared with (and owned by) the animator. */
    private overrides: ReadonlyMap<string, string>;
    private durationOf: DurationLookup;
    private emit: (event: string) => void;

    private states = new Map<string, StateDefinition>();
    private anyStateTransitions: TransitionDefinition[] = [];
    private transitionsFrom = new Map<string, TransitionDefinition[]>();

    private current: StateInstance;
    private fading: StateInstance[] = [];
    private fadeElapsed = 0;
    private fadeDuration = 0;

    /** Reused between frames so reporting the active states never allocates: `active` lists slots borrowed from `pool`. */
    private active: ActiveState[] = [];
    private pool: ActiveState[] = [];

    constructor(
        definition: LayerDefinition,
        params: AnimatorParameters,
        overrides: ReadonlyMap<string, string>,
        durationOf: DurationLookup,
        emit: (event: string) => void,
    ) {
        this.definition = definition;
        this.params = params;
        this.overrides = overrides;
        this.durationOf = durationOf;
        this.emit = emit;

        for (const state of definition.states) this.states.set(state.name, state);
        for (const transition of definition.transitions ?? []) {
            if (transition.from === '*') {
                this.anyStateTransitions.push(transition);
                continue;
            }
            let list = this.transitionsFrom.get(transition.from);
            if (!list) {
                list = [];
                this.transitionsFrom.set(transition.from, list);
            }
            list.push(transition);
        }

        const entry = definition.entry ?? definition.states[0].name;
        this.current = this.instantiate(this.states.get(entry)!);
    }

    public get stateName(): string {
        return this.current.state.name;
    }

    /** The current state's definition: what the driver reads markers from. */
    public get state(): StateDefinition {
        return this.current.state;
    }

    /** Fraction of the current clip played; keeps counting past 1 on loops, like Unity. */
    public get normalizedTime(): number {
        const duration = this.durationOfState(this.current.state);
        return duration ? this.current.time / duration : this.current.time;
    }

    public hasState(name: string): boolean {
        return this.states.has(name);
    }

    /** Jumps to a state directly, ignoring the transition graph. */
    public play(name: string, crossfade: number) {
        const state = this.states.get(name);
        if (!state) throw new Error(`[animator] layer "${this.definition.name}" has no state "${name}"`);
        this.enter(state, crossfade);
    }

    /** Scrubs the current state — the counterpart of `speed: 0` states driven by gameplay. */
    public setTime(seconds: number) {
        this.current.time = seconds;
    }

    public update(dt: number) {
        this.current.time += dt * this.speedOf(this.current.state);
        for (const instance of this.fading) instance.time += dt * this.speedOf(instance.state);

        if (this.fading.length > 0) {
            this.fadeElapsed += dt;
            if (this.fadeElapsed >= this.fadeDuration) this.fading.length = 0;
        }

        // Only the current state fires events: during a crossfade both clips play, and a
        // footstep sounding twice reads worse than one landing a few frames late.
        this.fireEvents(this.current);

        const transition = this.findTransition();
        if (transition) {
            this.params.consume(transition.conditions ?? []);
            this.enter(this.states.get(transition.to)!, transition.duration ?? 0);
        }
    }

    /** The states to sample this frame, weighted. The returned array is reused: read it before the next update. */
    public activeStates(): readonly ActiveState[] {
        const progress = this.fadeProgress;
        this.active.length = 0;
        this.report(this.current, progress);
        for (const instance of this.fading) this.report(instance, instance.share * (1 - progress));
        return this.active;
    }

    private report(instance: StateInstance, weight: number) {
        if (weight <= 0) return;

        const index = this.active.length;
        let slot = this.pool[index];
        if (!slot) {
            slot = { clip: null, time: 0, weight: 0 };
            this.pool.push(slot);
        }
        slot.clip = this.clipOf(instance.state);
        slot.time = this.sampleTime(instance);
        slot.weight = weight;
        this.active.push(slot);
    }

    private sampleTime(instance: StateInstance): number {
        const duration = this.durationOfState(instance.state);
        if (!duration) return 0;
        if (instance.state.loop) return ((instance.time % duration) + duration) % duration;
        return Math.min(Math.max(instance.time, 0), duration);
    }

    private get fadeProgress(): number {
        if (this.fading.length === 0) return 1;
        return Math.min(1, this.fadeElapsed / this.fadeDuration);
    }

    private clipOf(state: StateDefinition): string | null {
        return this.overrides.get(state.name) ?? state.clip ?? null;
    }

    private durationOfState(state: StateDefinition): number | undefined {
        const clip = this.clipOf(state);
        return clip ? this.durationOf(clip) : undefined;
    }

    private speedOf(state: StateDefinition): number {
        const base = state.speed ?? 1;
        return state.speedParam ? base * this.params.getFloat(state.speedParam) : base;
    }

    private instantiate(state: StateDefinition): StateInstance {
        // Events sit at time >= 0, so starting the event clock a hair below zero lets one placed
        // exactly on the first frame fire.
        return { state, time: 0, eventTime: -Number.EPSILON, share: 0 };
    }

    private enter(state: StateDefinition, duration: number) {
        const next = this.instantiate(state);

        if (duration <= 0) {
            this.current = next;
            this.fading.length = 0;
            return;
        }

        // Freeze the outgoing blend: each instance keeps the weight it has right now as its
        // share of whatever the incoming state has not claimed yet.
        const progress = this.fadeProgress;
        const outgoing: StateInstance[] = [];
        this.current.share = progress;
        if (this.current.share > 0.001) outgoing.push(this.current);
        for (const instance of this.fading) {
            instance.share *= 1 - progress;
            if (instance.share > 0.001) outgoing.push(instance);
        }

        this.fading = outgoing;
        this.fadeElapsed = 0;
        this.fadeDuration = duration;
        this.current = next;
    }

    private findTransition(): TransitionDefinition | null {
        for (const transition of this.anyStateTransitions) {
            if (transition.to === this.current.state.name && !transition.canTransitionToSelf) continue;
            if (this.passes(transition)) return transition;
        }
        for (const transition of this.transitionsFrom.get(this.current.state.name) ?? []) {
            if (this.passes(transition)) return transition;
        }
        return null;
    }

    private passes(transition: TransitionDefinition): boolean {
        if (transition.exitTime != null && this.normalizedTime < transition.exitTime) return false;
        return (transition.conditions ?? []).every((condition) => this.params.check(condition));
    }

    private fireEvents(instance: StateInstance) {
        const previous = instance.eventTime;
        const now = instance.time;
        instance.eventTime = now;

        const events = instance.state.events;
        const duration = this.durationOfState(instance.state);
        if (!events || !duration || now <= previous) return;

        for (const event of events) {
            if (!instance.state.loop) {
                if (event.time > previous && event.time <= now) this.emit(event.name);
                continue;
            }
            // A looping clip repeats the event every cycle; catch every repeat inside (previous, now]
            // even if a long frame skipped a whole cycle.
            const firstCycle = Math.floor(previous / duration);
            const lastCycle = Math.floor(now / duration);
            for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
                const at = event.time + cycle * duration;
                if (at > previous && at <= now) this.emit(event.name);
            }
        }
    }
}
