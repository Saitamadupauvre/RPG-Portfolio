import type { HealthComponent } from '../../domain/components/HealthComponent';
import type { AnimationComponent } from './components/AnimationComponent';
import type { AttackComponent } from './components/AttackComponent';
import type { ComboComponent } from './components/ComboComponent';
import type { DashComponent } from './components/DashComponent';
import type { DustEmitterComponent } from './components/DustEmitterComponent';
import type { EnemyAIComponent } from './components/EnemyAIComponent';
import type { GlowComponent } from './components/GlowComponent';
import type { HealthBarComponent } from './components/HealthBarComponent';
import type { HitFlashComponent } from './components/HitFlashComponent';
import type { InteractableComponent } from './components/InteractableComponent';
import type { MovementComponent } from './components/MovementComponent';
import type { SwordTrailComponent } from './components/SwordTrailComponent';

export type ComponentMap = {
    animation: AnimationComponent;
    attack: AttackComponent;
    combo: ComboComponent;
    dash: DashComponent;
    dust: DustEmitterComponent;
    enemyAI: EnemyAIComponent;
    glow: GlowComponent;
    health: HealthComponent;
    healthBar: HealthBarComponent;
    hitFlash: HitFlashComponent;
    interactable: InteractableComponent;
    movement: MovementComponent;
    swordTrail: SwordTrailComponent;
};

export type ComponentKey = keyof ComponentMap;
