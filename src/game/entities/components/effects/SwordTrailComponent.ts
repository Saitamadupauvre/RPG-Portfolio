import * as THREE from 'three';
import type { Component } from '../../../domain/components/Component';
import { BladeTrail } from '../../effects/BladeTrail';
import { LIGHT, PALETTE } from '../../render/palette';
import { getSwordBladeBaseWorldPosition, getSwordTipWorldPosition } from '../SwordFactory';
import type { AttackComponent } from './AttackComponent';

/**
 * Sweeps a fading ribbon through the blade's path while the swing hitbox is live, so the trail
 * shows exactly the arc that can hit. Same cream-to-sky colours as the player's dash trail.
 * Must update after the animator, which poses the sword this frame.
 */
export class SwordTrailComponent implements Component {
    public readonly name = 'swordTrail';

    private sword: THREE.Object3D;
    private attack: AttackComponent;
    private trail: BladeTrail;
    private base = new THREE.Vector3();
    private tip = new THREE.Vector3();

    constructor(sword: THREE.Object3D, attack: AttackComponent, parent: THREE.Object3D) {
        this.sword = sword;
        this.attack = attack;
        this.trail = new BladeTrail(parent, {
            time: 0.16,
            gradient: [
                { t: 0, color: PALETTE.cream, alpha: 0.85 },
                { t: 0.35, color: LIGHT.sky, alpha: 0.55 },
                { t: 1, color: LIGHT.sky, alpha: 0 },
            ],
        });
    }

    public update(dt: number) {
        const emitting = this.attack.isAttacking;
        if (emitting) {
            // matrixWorld is refreshed at render time; the animator posed the bones since, so
            // walk the chain up from the sword now or the trail would lag one frame behind it.
            this.sword.updateWorldMatrix(true, false);
            getSwordBladeBaseWorldPosition(this.sword, this.base);
            getSwordTipWorldPosition(this.sword, this.tip);
        }
        this.trail.update(dt, this.base, this.tip, emitting);
    }

    public dispose() {
        this.trail.dispose();
    }
}
