import * as THREE from 'three';
import type { Component } from '../../domain/components/Component';

export class Entity {
    public readonly id: string;
    public readonly mesh: THREE.Object3D;
    private components = new Map<string, Component>();

    constructor(id: string, mesh: THREE.Object3D) {
        this.id = id;
        this.mesh = mesh;
    }

    public addComponent(key: string, component: Component): this {
        this.components.set(key, component);
        return this;
    }

    public getComponent<T extends Component>(key: string): T | undefined {
        return this.components.get(key) as T | undefined;
    }

    public update(dt: number) {
        for (const component of this.components.values()) {
            component.update?.(dt);
        }
    }
}
