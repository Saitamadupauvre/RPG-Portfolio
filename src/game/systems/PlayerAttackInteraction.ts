import * as THREE from 'three';
import type { Experience } from '@game/Experience';
import { isGameplayActive } from '@core/state/pause';
import { events } from '@core/events/events';
import { isTouchOnly } from '@core/input/device';
import type { StickAxis } from '@core/input/touchInput';

/** How far a tap on the attack stick looks for an enemy to strike. */
const AUTO_AIM_RANGE = 6;
/** How far ahead of the player an aim point is set: only its direction matters. */
const AIM_REACH = 2;

/**
 * Mouse: a click aims at the ground under the cursor and attacks.
 * Touch: the attack stick (`touchAttack`) aims along its direction, a tap at the nearest enemy.
 */
export class PlayerAttackInteraction {
    private experience: Experience;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private aim = new THREE.Vector3();
    private forward = new THREE.Vector3();
    private right = new THREE.Vector3();

    constructor(experience: Experience) {
        this.experience = experience;
        // A tap on the view must not attack on a phone: the move stick lives anywhere on the left half.
        if (!isTouchOnly()) this.experience.canvas.addEventListener('click', (event) => this.onAttack(event));
        events.on('touchAttack', (aim) => this.onTouchAttack(aim));
    }

    private onAttack(event: MouseEvent) {
        if (!isGameplayActive()) return;

        const player = this.experience.world.player;
        const combo = player.getComponent('combo');
        if (!combo) return;

        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.experience.camera);
        this.groundPlane.constant = -player.mesh.position.y;

        const target = new THREE.Vector3();
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, target)) return;

        combo.trigger(target);
    }

    private onTouchAttack(stick: StickAxis | null) {
        if (!isGameplayActive()) return;

        const world = this.experience.world;
        const player = world.player;
        const combo = player.getComponent('combo');
        // Every frame while the stick is held: skip the work while the combo cannot take a move.
        if (!combo?.canTrigger) return;

        const position = player.mesh.position;
        if (stick) {
            // Screen axes onto the ground, from the camera's own frame, so the aim follows any camera.
            this.experience.camera.getWorldDirection(this.forward).setY(0).normalize();
            this.right.crossVectors(this.forward, THREE.Object3D.DEFAULT_UP);
            this.aim.copy(position)
                .addScaledVector(this.forward, stick.y * AIM_REACH)
                .addScaledVector(this.right, stick.x * AIM_REACH);
        } else {
            const enemy = world.nearestEnemy(position, AUTO_AIM_RANGE);
            if (enemy) {
                this.aim.copy(enemy.mesh.position);
            } else {
                // Nobody near: straight ahead, the way the knight faces.
                const facing = player.mesh.rotation.y;
                this.aim.set(position.x + Math.sin(facing), position.y, position.z + Math.cos(facing));
            }
        }
        this.aim.y = position.y;
        combo.trigger(this.aim);
    }
}
