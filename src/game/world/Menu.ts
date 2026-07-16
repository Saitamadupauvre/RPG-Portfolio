import * as THREE from 'three';
import type { AppState } from '../../core/StateMachine';

export type DoorTarget = Extract<AppState, 'GAME' | 'CLASSIC'>;

export class Menu {
    public group: THREE.Group;
    public doors: THREE.Mesh[] = [];

    constructor() {
        this.group = new THREE.Group();

        const gameDoor = this.createDoor(0x2266ff, 'GAME');
        gameDoor.position.x = -1.5;

        const classicDoor = this.createDoor(0xaa8822, 'CLASSIC');
        classicDoor.position.x = 1.5;

        this.doors.push(gameDoor, classicDoor);
        this.group.add(gameDoor, classicDoor);
    }

    private createDoor(color: number, target: DoorTarget): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(1, 2, 0.2);
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.doorTarget = target;
        return mesh;
    }

    public setVisible(visible: boolean) {
        this.group.visible = visible;
    }
}
