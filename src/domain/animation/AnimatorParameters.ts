import type { Condition, ParameterType } from './AnimatorController';

/**
 * The knobs gameplay turns to steer a controller. Checked at runtime against the declared
 * parameter list, so a misspelled `setBool('mooving')` throws at the call site instead of
 * leaving a transition that silently never fires.
 */
export class AnimatorParameters {
    private types: Record<string, ParameterType>;
    private values = new Map<string, number | boolean>();
    /** A trigger stays raised until a transition that reads it fires, then clears itself. */
    private triggers = new Set<string>();

    constructor(types: Record<string, ParameterType>) {
        this.types = types;
        for (const [name, type] of Object.entries(types)) {
            if (type === 'bool') this.values.set(name, false);
            if (type === 'float') this.values.set(name, 0);
        }
    }

    public setBool(name: string, value: boolean) {
        this.expect(name, 'bool');
        this.values.set(name, value);
    }

    public getBool(name: string): boolean {
        this.expect(name, 'bool');
        return this.values.get(name) === true;
    }

    public setFloat(name: string, value: number) {
        this.expect(name, 'float');
        this.values.set(name, value);
    }

    public getFloat(name: string): number {
        this.expect(name, 'float');
        return this.values.get(name) as number;
    }

    public setTrigger(name: string) {
        this.expect(name, 'trigger');
        this.triggers.add(name);
    }

    public resetTrigger(name: string) {
        this.expect(name, 'trigger');
        this.triggers.delete(name);
    }

    public check(condition: Condition): boolean {
        if ('is' in condition) {
            const raised = this.types[condition.param] === 'trigger'
                ? this.triggers.has(condition.param)
                : this.values.get(condition.param) === true;
            return raised === condition.is;
        }

        const value = this.values.get(condition.param) as number;
        if ('equals' in condition) return value === condition.equals;
        if ('greater' in condition) return value > condition.greater;
        return value < condition.less;
    }

    /** Lowers every trigger a fired transition depended on, so one press fires one transition. */
    public consume(conditions: readonly Condition[]) {
        for (const condition of conditions) {
            if ('is' in condition && this.types[condition.param] === 'trigger') this.triggers.delete(condition.param);
        }
    }

    private expect(name: string, type: ParameterType) {
        const actual = this.types[name];
        if (!actual) throw new Error(`[animator] unknown parameter "${name}"`);
        if (actual !== type) throw new Error(`[animator] parameter "${name}" is a ${actual}, not a ${type}`);
    }
}
