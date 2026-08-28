import type { Component } from './Component';

export class HealthComponent implements Component {
    public readonly name = 'health';
    public hp: number;
    public readonly maxHp: number;

    // Optional so enemies stay zero-cost: only the player wires this up, to bridge hp
    // changes to the UI without HealthComponent importing anything from core/ or ui/.
    private onChange?: (hp: number, maxHp: number) => void;

    constructor(maxHp: number, onChange?: (hp: number, maxHp: number) => void) {
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.onChange = onChange;
    }

    public takeDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
        this.onChange?.(this.hp, this.maxHp);
    }

    public heal(amount: number) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
        this.onChange?.(this.hp, this.maxHp);
    }

    public refill() {
        this.hp = this.maxHp;
        this.onChange?.(this.hp, this.maxHp);
    }

    public isDead(): boolean {
        return this.hp <= 0;
    }
}
