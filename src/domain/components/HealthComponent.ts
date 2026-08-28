import type { Component } from './Component';

export class HealthComponent implements Component {
    public readonly name = 'health';
    public hp: number;
    public maxHp: number;

    private onChange?: (hp: number, maxHp: number) => void;

    constructor(maxHp: number, onChange?: (hp: number, maxHp: number) => void) {
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.onChange = onChange;
    }

    public takeDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
        this.publish();
    }

    /** Upgrades change maxHp at runtime; keep the missing-HP amount stable. */
    public setMaxHp(maxHp: number) {
        const missing = this.maxHp - this.hp;
        this.maxHp = maxHp;
        this.hp = Math.max(1, Math.min(maxHp, maxHp - missing));
        this.publish();
    }

    public heal(amount: number) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.publish();
    }

    public refill() {
        this.hp = this.maxHp;
        this.publish();
    }

    public publish() {
        this.onChange?.(this.hp, this.maxHp);
    }

    public isDead(): boolean {
        return this.hp <= 0;
    }
}
