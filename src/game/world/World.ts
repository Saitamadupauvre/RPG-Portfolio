import type { Experience } from "../Experience";
import { Environment } from "./Environment";
import { Menu } from "./Menu";
import { events } from "../../core/events";

export class World {
    private experience: Experience;
    public menu: Menu;

    constructor(experience: Experience) {
        this.experience = experience;
        new Environment(this.experience);

        this.menu = new Menu();
        this.experience.scene.add(this.menu.group);
        this.menu.setVisible(false);

        events.on('stateChange', (newState) => {
            this.menu.setVisible(newState === 'MENU');
        });
    }

    public update(_dt: number) {
    }
}
