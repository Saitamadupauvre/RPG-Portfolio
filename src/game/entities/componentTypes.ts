import type { HealthComponent } from '../../domain/components/HealthComponent';
import type { AnimatorComponent } from '../animation/AnimatorComponent';
import type { AnimationDriver } from './components/AnimationDriver';
import type { AttackComponent } from './components/AttackComponent';
import type { ComboComponent } from './components/ComboComponent';
import type { DashComponent } from './components/DashComponent';
import type { DashTrailComponent } from './components/DashTrailComponent';
import type { DustEmitterComponent } from './components/DustEmitterComponent';
import type { EnemyAIComponent } from './components/EnemyAIComponent';
import type { FireComponent } from './components/FireComponent';
import type { GhostComponent } from './components/GhostComponent';
import type { GlowComponent } from './components/GlowComponent';
import type { HealthBarComponent } from './components/HealthBarComponent';
import type { HitFlashComponent } from './components/HitFlashComponent';
import type { InteractableComponent } from './components/InteractableComponent';
import type { MovementComponent } from './components/MovementComponent';
import type { SwordTrailComponent } from './components/SwordTrailComponent';
import type { TriggerComponent } from './components/TriggerComponent';
import type { XrayComponent } from './components/XrayComponent';

export type ComponentMap = {
    /** Whatever feeds an animator its parameters: one driver per kind of character. */
    animationDriver: AnimationDriver;
    animator: AnimatorComponent;
    attack: AttackComponent;
    combo: ComboComponent;
    dash: DashComponent;
    dashTrail: DashTrailComponent;
    dust: DustEmitterComponent;
    enemyAI: EnemyAIComponent;
    fire: FireComponent;
    ghost: GhostComponent;
    glow: GlowComponent;
    health: HealthComponent;
    healthBar: HealthBarComponent;
    hitFlash: HitFlashComponent;
    interactable: InteractableComponent;
    movement: MovementComponent;
    swordTrail: SwordTrailComponent;
    trigger: TriggerComponent;
    xray: XrayComponent;
};

export type ComponentKey = keyof ComponentMap;
