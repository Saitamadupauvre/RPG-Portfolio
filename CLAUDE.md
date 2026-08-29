# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

3D portfolio site, two entry modes reached from a menu:
- **Game mode**: free-roam 3D world (open world, not linear), meant to be a *real* game — moderate difficulty, enjoyable, a bit of challenge. No win/end condition (it exists to show projects). A final boss is planned but not scoped yet. Enemies, statues, items, and props are placed by hand as level design — never auto-generated from the project list.
- **Fast portfolio / classic mode**: flat list of every entry in `src/data/projects.ts`, independent of what's placed in the game world, for recruiters who don't want to play a game.

Visual split: **3D low-poly** for the game world (Three.js meshes), **2D pixel-art** for all UI/menus/overlays (hand-rolled DOM+CSS, no canvas renderer). Pixel look is currently CSS-only placeholders (`src/style/pixel-ui.css`: blocky monospace, hard-edged panels, stepped shadows) — swappable for real pixel-art PNGs/font later without touching component structure.

Stack: Vite + TypeScript + Three.js. No framework (no React/Vue) — DOM is manipulated directly via `document.getElementById`/`document.createElement` etc, Three.js owns the WebGL canvas.

## Commits

Commit messages: one line, conventional-commit style (`feat(scope): summary`, `fix(scope): summary`), no attribution/co-author lines.

## Commands

- `npm run dev` — start Vite dev server (port 3000, see `vite.config.ts`)
- `npm run build` — `tsc` (type-check only, `noEmit`) then `vite build`
- `npm run preview` — preview the production build
- `npx tsc --noEmit` — type-check only, useful after any change since `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` are all enforced and `npm run dev` does not type-check
- No test runner is set up yet.

## Architecture

Layered, event-driven — each layer only knows about the layer below it via typed events, not direct references: `core` → `data` → `domain` → `game`/`ui` (the latter two never reference each other).

- `src/core/` — framework-agnostic infra, no Three.js/DOM knowledge.
  - `EventEmitter.ts` — generic typed pub/sub (`EventEmitter<Events>`), has `on`/`off`/`emit`.
  - `events.ts` — `AppEvents` type map + one shared `events` singleton. Add new cross-layer events here.
  - `StateMachine.ts` — tracks `AppState` (`LOADING | MENU | GAME | CLASSIC`) and emits `stateChange`. Does **not** touch the DOM.
- `src/data/` — pure content, no game-mechanics or rendering knowledge, never imports from `domain`/`game`/`ui`.
  - `Project.ts` / `projects.ts` — `Project` type + hardcoded `Project[]`. Pure content: no placement, no region, no discovery info. Single source of truth for classic mode, the in-game book, and statue→project resolution.
  - `MapEntity.ts` — tagged union (`kind: 'enemy' | 'chest' | 'item' | 'prop'`) describing level content, authored by hand in `mapLayout.ts`. Placement lives here, never in `projects.ts`; the optional `projectId` on a map entity is the *sole* coupling point between world and project data.
- `src/domain/` — pure derivation, no Three.js/DOM imports.
  - `CardStyle.ts` — `projectToUICardStyle(project)`, `rarity`-keyed presentation lookup for UI cards only.
  - `collectItem.ts` — `resolveItemProject(item)` → `Project | undefined`.
  - `components/` — engine-agnostic component logic: `Component.ts` base interface, `HealthComponent.ts`.
  - `collision/CircleCollision.ts` — pure circle-vs-circle push-apart resolution.
  - `pathfinding/` — `NavGrid.ts` (grid build, `worldToCol`/`worldToRow`/`isBlocked`) + `AStar.ts`.
- `src/game/` — Three.js scene graph and interaction.
  - `Experience.ts` — owns scene/camera/renderer/render loop; instantiates `World` and `PlayerAttackInteraction`. `Experience.init(canvas)` once (lazily, from `main.ts`, on first `GAME` entry) + `getInstance()` elsewhere.
  - `entities/Entity.ts` — Three-aware wrapper: `id`, `mesh`, collision radius, component map, `update(dt)` fan-out.
  - `entities/{Enemy,Chest,Item,Prop}Factory.ts` + `entityFactories.ts` — typed `Record`-based dispatch table; new kind = one factory + one registry entry.
  - `entities/EnemyPool.ts` — per-`enemyType` stat/look table (hp, speed, aggro/deaggro radius, attack range, combo pattern) and Entity pooling so kill+respawn reuses meshes/components. `EnemyFactory` just delegates to `enemyPool.acquire`.
  - `entities/PlayerFactory.ts` — capsule + forward-marker cube, `movement`/`attack`/`health`/`hitFlash` components.
  - `entities/components/` — Three-aware components: `MovementComponent` (WASD, camera-relative, wall slide against the nav grid, smooth turn, lock during attack), `AttackComponent` (windup/active/recovery hitbox, per-target hit registration), `ComboComponent` (per-type move chains), `DetectionComponent`, `EnemyAIComponent` (aggro/deaggro/return-to-origin), `PathfindingComponent`, `HealthBarComponent` (billboard bar), `HitFlashComponent`.
  - `CombatSystem.ts` — resolves player→enemy and enemy→player hitboxes, applies damage, hit flash, particles, screen shake, kills + pool release. Keeps `World` a registry, not a combat engine.
  - `EntityCollisionSystem.ts` — per-frame circle push-apart over all entities.
  - `PlayerAttackInteraction.ts` — left-click raycasts onto the ground plane at player height, aims + triggers the attack.
  - `effects/` — `HitParticles.ts`, `ScreenShake.ts`.
  - `world/World.ts` — ground plane, player, entity build from `mapLayout`, entity group visibility per state, per-frame entity/player/collision/camera/combat update. Camera is a fixed isometric offset following the player.
  - `world/Environment.ts` — sky color, fog, hemisphere + shadow-casting directional light.
  - `world/navigation.ts` — shared nav grid accessor.
- `src/ui/` — DOM/HTML layer, reacts to `core/events.ts`, no Three.js imports.
  - `UIStateView.ts` — `stateChange` → `#ui-container` className `state-<name>`.
  - `views/MenuView.ts` — wires the two DOM menu buttons to `stateMachine.changeState`.
  - `components/renderProjectCard.ts` — pure `(project, cardStyle) => HTMLElement`. Reused by every surface showing a project.
  - `views/ClassicView.ts`, `views/ProjectModalView.ts`.
- `src/main.ts` — wiring only: init UI views, lazy-import `Experience` on first `GAME` state, timed `LOADING` → `MENU`.

### Known dead / stale code (fix or delete before building on it)

- `src/game/world/Grass.ts` + `GroundMaterial.ts` — never imported. Grass is to be redone as a material applicable to any mesh (the current version was too awkward to reuse).
- `src/game/ItemInteraction.ts` — never instantiated; superseded by the planned proximity + `E` interaction system.
- `mapLayout.ts` currently holds only test enemies and walls — no statues/items, so game mode cannot surface a project yet.

## Locked-in vision (decided with Alban, not yet all built)

- **Project discovery = statues.** Each statue carries a `projectId`, glows while undiscovered, and is collected by pressing **`E`** in range. The statue mesh does **not** disappear on collect — only the glow does.
- **Book UI**: in-game book lists **all** projects; uncollected ones show as locked placeholders. For now the book renders the same card content as classic mode (reuse `renderProjectCard`), just a different frame.
- **Death & bonfires** (Dark Souls model): hand-placed `bonfire` map entities. Death respawns the player at the last rested bonfire; resting refills HP and **resets all enemies except bosses**.
- **No region system.** The map is handcrafted; project data stays pure content with no placement/region fields.
- **Camera**: fixed isometric offset for now. Contextual zoom later for big bosses/rooms.
- **Attack**: mouse-click aim + attack stays.
- **Menu**: later becomes two openable pixel-art doors (2D art, not 3D meshes — the earlier 3D-door plan is dropped). All UI goes pixel art; current CSS is placeholder.
- **Editor mode**: dev-only map editor, not shipped. Outputs JSON to commit (live localStorage editing only if it's cheap to add).
- **Chunk system**: needed later, once the map outgrows one hand-authored `mapLayout` array.

### Build order agreed

1. Statue entity + proximity/`E` interaction system (delete the dead raycast `ItemInteraction`), emitting a discovery event.
2. Book UI (all projects, locked placeholders, reuses `renderProjectCard`).
3. Player death + HP HUD + bonfire checkpoints (respawn, HP refill, non-boss enemy reset).
4. Chunk system → editor mode → grass material redo → real pixel-art pass.

## Design decisions locked in

- **Map vs. project data are separate concerns.** Level content is placed and typed on its own in `mapLayout.ts` — never auto-derived 1:1 from `projects.ts`. The only link is an optional `projectId` on a map entity, resolved at interaction time.
- **Entity/component pattern**, not per-type subclassing. Player, enemies, and future entity types reuse the same `Entity` base plus attachable components.
- **Boss vs regular enemy**: `enemyType` is authored per `MapEntity`, not derived from `Project.rarity`.
- **Combat depth**: full action combat — movement, attack timing/hitboxes, health bars. Built incrementally; hit detection, combos, AI, and juice (particles/shake/flash) already exist.
- **Pixel UI via hand-rolled DOM+CSS**, not a canvas-2D renderer. `image-rendering: pixelated` + `border-image` 9-slice framing is the intended mechanism once real art exists.
- **Project data**: hardcoded typed array in `src/data/projects.ts`, ~5-10 projects. No CMS/backend.
- **Deploy target**: static build → GitHub Pages / Vercel / Netlify. No server-side code.

## How to work with Alban on this repo

Alban is learning JS/TS through building this. Preferred workflow:

- **Pair-program, not autopilot.** Propose the plan/approach for a step, explain it, wait for go-ahead, *then* write the code. Don't silently write large chunks of new logic unprompted.
- After writing code, explain it like a professor would: what each non-obvious piece does and *why* that pattern was chosen over alternatives.
- Actively point out anti-patterns, JS/TS gotchas, and better approaches, even if not explicitly asked.
- Resolved teaching points (don't re-explain from scratch):
  - ~~Singleton via `if (instance) return instance` inside a constructor~~ — replaced with explicit `static getInstance()`/`static init()`.
  - ~~`StateMachine` reached into the DOM directly~~ — now emits `stateChange`; `ui/UIStateView.ts` owns the DOM side-effect.
  - ~~`EventEmitter` had no `off()`, was untyped~~ — now generic with `on`/`off`/`emit`.
  - ~~Raw `THREE.Object3D` returned from entity factories~~ — replaced with `Entity` (mesh + component map).
  - ~~Switch statement dispatching on `MapEntity['kind']`~~ — replaced with a typed `Record` dispatch table.
  - ~~Full-viewport `.screen` divs with `pointer-events: auto` but no interactive children~~ — swallowed canvas clicks. Only elements with real interactive content opt back in.
  - ~~Combat logic living in `World`~~ — extracted to `CombatSystem`; `World` stays a scene/entity registry.
  - ~~New `THREE` objects per enemy spawn~~ — `EnemyPool` reuses Entities; geometry shared per type, material cloned per entity (because `HitFlashComponent` mutates color).
- Open teaching points, still relevant:
  - Three.js resources (geometry/material/texture) need explicit `.dispose()` — no GC for GPU memory. Only `AttackComponent` disposes today; item removal and pooled-entity teardown do not.
  - Check `vite.config.ts` `outDir: '../dist'` — builds outside the project folder; confirm this is intentional before relying on it for deploy.

## Conventions

- TypeScript strict-ish config: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all on — keep code clean enough to satisfy these, don't loosen them. Run `npx tsc --noEmit` after changes.
- Prefer a `type` alias over `interface` for anything used as a generic constraint — `interface` allows declaration merging so TS can't prove it has no extra keys. Exception: plain data-shape interfaces meant to be `implements`ed (e.g. `Component`), which need at least one non-optional member for TS's weak-type check.
- Singletons: module-level `export const instance = new X()` when construction needs no external input (`EventEmitter`, `StateMachine`, `EnemyPool`). `private constructor` + `static init(...)`/`static getInstance()` when it needs input available only later (`Experience` needs the canvas).
- Discriminated unions (tagged with a `kind` literal) over one flat interface with many optional fields.
- File layout: `src/core/` = framework-agnostic infra. `src/data/` = pure content, never imports other `src/` layers. `src/domain/` = pure derivation from `data/`, no Three.js/DOM. `src/game/` = Three.js scene graph. `src/ui/` = DOM layer. `game/` and `ui/` never import each other — only through `core/events.ts`.
