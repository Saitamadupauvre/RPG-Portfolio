import * as THREE from 'three';
import type { Component } from '../../domain/components/Component';
import type { ComponentKey, ComponentMap } from './componentTypes';
import { disposeObject3D } from './disposeObject3D';

export class Entity {
    public id: string;
    public readonly mesh: THREE.Object3D;

    public readonly collisionRadius?: number;
    private components = new Map<ComponentKey, Component>();
    private disposer?: () => void;

    constructor(id: string, mesh: THREE.Object3D, collisionRadius?: number) {
        this.id = id;
        this.mesh = mesh;
        this.collisionRadius = collisionRadius;
    }

    public addComponent<K extends ComponentKey>(key: K, component: ComponentMap[K]): this {
        this.components.set(key, component);
        return this;
    }

    public getComponent<K extends ComponentKey>(key: K): ComponentMap[K] | undefined {
        return this.components.get(key) as ComponentMap[K] | undefined;
    }

    public setDisposer(disposer: () => void): this {
        this.disposer = disposer;
        return this;
    }

    public update(dt: number) {
        for (const component of this.components.values()) {
            component.update?.(dt);
        }
    }

    public dispose() {
        if (this.disposer) {
            this.disposer();
            return;
        }
        disposeObject3D(this.mesh);
    }
}
