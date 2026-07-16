import type { Component } from './Component';

export class HealthComponent implements Component {
    public readonly name = 'health';
    public hp: number;
    public readonly maxHp: number;

    constructor(maxHp: number) {
        this.maxHp = maxHp;
        this.hp = maxHp;
    }

    public takeDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
    }

    public heal(amount: number) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    public isDead(): boolean {
        return this.hp <= 0;
    }
}
