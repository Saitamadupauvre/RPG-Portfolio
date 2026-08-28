import type { HealthComponent } from '../../domain/components/HealthComponent';
import type { AttackComponent } from './components/AttackComponent';
import type { DashComponent } from './components/DashComponent';
import type { EnemyAIComponent } from './components/EnemyAIComponent';
import type { GlowComponent } from './components/GlowComponent';
import type { HealthBarComponent } from './components/HealthBarComponent';
import type { HitFlashComponent } from './components/HitFlashComponent';
import type { InteractableComponent } from './components/InteractableComponent';
import type { MovementComponent } from './components/MovementComponent';

export type ComponentMap = {
    attack: AttackComponent;
    dash: DashComponent;
    enemyAI: EnemyAIComponent;
    glow: GlowComponent;
    health: HealthComponent;
    healthBar: HealthBarComponent;
    hitFlash: HitFlashComponent;
    interactable: InteractableComponent;
    movement: MovementComponent;
};

export type ComponentKey = keyof ComponentMap;
