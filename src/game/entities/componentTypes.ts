import type { HealthComponent } from '@domain/components/HealthComponent';
import type { AnimatorComponent } from '@game/animation/AnimatorComponent';
import type { AnimationDriver } from './components/animation/AnimationDriver';
import type { AttackComponent } from './components/combat/AttackComponent';
import type { ComboComponent } from './components/combat/ComboComponent';
import type { DashComponent } from './components/movement/DashComponent';
import type { DashTrailComponent } from './components/effects/DashTrailComponent';
import type { DeathFadeComponent } from './components/effects/DeathFadeComponent';
import type { DustEmitterComponent } from './components/effects/DustEmitterComponent';
import type { EnemyBrain } from './components/ai/EnemyBrain';
import type { FireComponent } from './components/effects/FireComponent';
import type { GhostComponent } from './components/effects/GhostComponent';
import type { GlowComponent } from './components/effects/GlowComponent';
import type { HealthBarComponent } from './components/effects/HealthBarComponent';
import type { HitFlashComponent } from './components/effects/HitFlashComponent';
import type { InteractableComponent } from './components/interaction/InteractableComponent';
import type { MovementComponent } from './components/movement/MovementComponent';
import type { SwordTrailComponent } from './components/effects/SwordTrailComponent';
import type { TriggerComponent } from './components/interaction/TriggerComponent';
import type { XrayComponent } from './components/effects/XrayComponent';

export type ComponentMap = {
    /** Whatever feeds an animator its parameters: one driver per kind of character. */
    animationDriver: AnimationDriver;
    animator: AnimatorComponent;
    attack: AttackComponent;
    combo: ComboComponent;
    dash: DashComponent;
    dashTrail: DashTrailComponent;
    deathFade: DeathFadeComponent;
    dust: DustEmitterComponent;
    /** A hunter (EnemyAIComponent) or a roaming critter (RoamAIComponent). */
    enemyAI: EnemyBrain;
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
