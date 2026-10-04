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
- `npx tsc --noEmit` — type-check only, useful after any change since `strict` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` are all enforced and `npm run dev` does not type-check
- No test runner is set up yet.

## Architecture

Layered, event-driven — each layer only knows about the layer below it via typed events, not direct references: `core` → `data` → `domain` → `game`/`ui` (the latter two never reference each other).

- `src/core/` — framework-agnostic infra, no Three.js/DOM knowledge. Imports nothing from other layers (type imports from `data/` only).
  - `EventEmitter.ts` — generic typed pub/sub (`EventEmitter<Events>`), has `on`/`off`/`once`/`emit`.
  - `events.ts` — `AppEvents` type map + one shared `events` singleton. Add new cross-layer events here. `projectDiscovered` = first-time discovery (book refresh); `projectShown` = open the book on that project's page; `levelUpRequested` = open the book on the Level page; `levelUpAvailableChanged` = player in/out of bonfire range (stats buyable only then).
  - `StateMachine.ts` — tracks `AppState` (`LOADING | MENU | GAME | CLASSIC | DEAD | EDITOR`) and emits `stateChange`. Does **not** touch the DOM.
  - `pause.ts` — `setPaused(reason, paused)`: pause is a *set of reasons* (only `book` today), emits `pauseChanged` only when the aggregate flips. `isGameplayActive()` = state `GAME` and nothing paused; every global gameplay input listener checks it.
- `src/data/` — pure content, no game-mechanics or rendering knowledge, never imports from `domain`/`game`/`ui`.
  - `Project.ts` / `projects.ts` — `Project` type + hardcoded `Project[]`. Pure content: no placement, no region, no discovery info. Single source of truth for classic mode, the in-game book, and statue→project resolution.
  - `MapEntity.ts` — tagged union (`kind: 'enemy' | 'chest' | 'item' | 'prop' | 'statue' | 'bonfire'`) + `ChestLoot` union. Placement lives here, never in `projects.ts`; a `projectId` on a map entity is the *sole* coupling point between world and project data.
  - `mapLayout.ts` — flat concat of hand-authored region files in `chunks/` (`spawnValley`, `northReach`). Runtime chunk membership is derived from position, never authored.
  - `tileMap.ts` — terrain as integer levels per tile + `waterLevel`; `resizeTileMap`.
  - `stats.ts` — `StatId`, `PlayerStats`.
- `src/domain/` — pure derivation, no Three.js/DOM imports (localStorage only through `persistence.ts`).
  - `persistence.ts` — `loadJson`/`saveJson` + `createPersistentSet(key)`; used by `discovery`, `openedChests`, `defeatedBosses`, `checkpoint`, `playerProgress`.
  - `playerProgress.ts` — coins + stat levels, upgrade costs, `getPlayerStats()`. Saves are *merged* onto defaults per field, so adding a stat never wipes old saves.
  - `chestLoot.ts` — one handler per `ChestLoot` kind (mapped type forces exhaustiveness).
  - `chunks.ts` — `CHUNK_SIZE`, `chunkKeyAt`, `bucketByChunk`, `keysInRadius`.
  - `CardStyle.ts` — `projectToUICardStyle(project)`, `rarity`-keyed presentation lookup for UI cards only.
  - `components/` — engine-agnostic component logic: `Component.ts` base interface, `HealthComponent.ts`.
  - `collision/CircleCollision.ts` — pure circle-vs-circle push-apart resolution.
  - `pathfinding/` — `NavGrid.ts` (`worldToCol`/`worldToRow` *clamp*, so use `isInsideBounds` for the map edge; `canTraverse` predicate for cliff steps) + `AStar.ts` (binary-heap open set from `MinHeap.ts`; the start cell is dropped from the returned path).
  - `terrain/TileGrid.ts` — heights derived from tile levels (1 level = ramp, 2+ = cliff); `heightAt` reads the same two triangles per tile the renderer draws (split on the c00→c11 diagonal).
  - `animation/` — Unity-style animator, engine-free half. `AnimatorController.ts` (definition: parameters bool/float/trigger, layers with bone-name `mask`, states naming a clip as exported from Blender plus `loop`/`speed`/`speedParam`/`markers` (seconds)/`events`, transitions with conditions/crossfade `duration`/`exitTime`/`'*'` any-state; `validateController` throws on typos), `AnimatorParameters.ts`, `AnimatorLayer.ts` (per-layer state machine: crossfade weights, interruption-safe fading list, event firing; learns clip lengths through a `DurationLookup`).
- `src/game/` — Three.js scene graph and interaction.
  - `Experience.ts` — owns scene/camera/renderer/render loop; instantiates `World`, `PlayerAttackInteraction`, and (dev only) `EditorSystem` (F1). `Experience.init(canvas)` once (lazily, from `main.ts`, on first `GAME` entry) + `getInstance()` elsewhere. Frame delta is clamped (`MAX_FRAME_DELTA`) and the timer is connected to page visibility. Shadow map `autoUpdate` is off and flagged once per tick, because the water depth prepass renders the scene a second time.
  - `entities/Entity.ts` — Three-aware wrapper: `id`, `mesh`, `collisionRadius`, `bodyHeight` (radius + height = combat hurtbox), `groundOffset` (origin→feet), component map, `update(dt)` fan-out.
  - `entities/{Enemy,Chest,Item,Prop,Statue,Bonfire}Factory.ts` + `entityFactories.ts` — typed `Record`-based dispatch table; new kind = one factory + one registry entry.
  - `entities/EnemyPool.ts` — per-`enemyType` stat/look table and Entity pooling. `init(camera, player, entityGroup)` must run first (throws otherwise). `reset(entity, source)` = back to just-spawned (health, flash, swing, AI, transform), shared by acquire and bonfire rest.
  - `animation/` — Three half of the animator. `AnimatorComponent.ts` (built from the controller alone, `bind(rig, clips)` once the glTF arrives; blends layers bottom-up with lerp/slerp from the bind pose, masks by bone name, reads each layer's active states once per frame; API: `setBool/setFloat/setTrigger`, `play`, `setTime`, `overrideClip`, `on(event)`), `sampleClip.ts`, `Rig.ts` (`collectRig`, `equip`).
  - `entities/PlayerFactory.ts` — root group → `visual` → model; placeholder capsule until `player.glb` loads. Initial speed/HP come from `getPlayerStats()`. Combo moves use `damageScale` (× base damage) so Strength upgrades apply. Components in order: movement, dash, attack, combo, `animationDriver`, `animator`, dust, swordTrail, health, hitFlash — order matters (driver feeds params the animator reads the same frame; trail samples the posed sword).
  - `entities/playerAnimation.ts` — `playerController` graph only (no clip data). Blender checklist in the file header.
  - `entities/SwordFactory.ts` — placeholder sword, origin at the grip, blade along +Z.
  - `entities/loadModel.ts` — cached glTF load (failed loads are evicted so they can retry), `SkeletonUtils.clone`, PBR→toon conversion, fit to height.
  - `entities/components/` — `MovementComponent`, `DashComponent`, `AttackComponent` (`reset`, `baseDamage`), `ComboComponent` (`damageScale`, `reset`, `onBusyChanged`), `PlayerAnimationDriver`, `DetectionComponent`, `EnemyAIComponent` (`reset(origin)`), `PathfindingComponent`, `HealthBarComponent`, `HitFlashComponent` (`reset`), `GlowComponent`, `InteractableComponent`, `DustEmitterComponent`, `SwordTrailComponent`.
  - `CombatSystem.ts` — hitboxes vs body hurtboxes (radius + `bodyHeight`, not `setFromObject`), damage, flash, particles, shake, kills + pool release, bonfire/respawn enemy reset. `forgetChunk(key)` drops enemy sources (dead ones too) of an unloading chunk.
  - `InteractionSystem.ts` — nearest `interactable` in range, prompt event, key dispatch.
  - `EntityCollisionSystem.ts` — per-frame circle push-apart over all entities.
  - `PlayerAttackInteraction.ts` — left-click raycasts onto the ground plane at player height, aims + triggers the attack.
  - `effects/` — `ParticleSystem.ts` (one `InstancedMesh` per system, per-instance alpha attribute), `ScreenShake.ts`.
  - `input/keyboardLayout.ts` — QWERTY/AZERTY movement bindings.
  - `render/` — `toon.ts` (`createToonMaterial`, shared gradient), `toonLighting.ts` (GLSL band step for patched Lambert).
  - `world/World.ts` — terrain, water, player, chunk-streamed entities, entity group visibility per state, per-frame update, death/respawn, camera follow.
  - `world/ChunkStreamer.ts` — which chunks are loaded around the player (pure bookkeeping; callbacks spawn/despawn).
  - `world/Terrain.ts` + `terrainField.ts` — tile mesh with jagged cliff walls, streamed grass patches; shared `TileGrid` accessor, `groundHeight`, `snapToGround`.
  - `world/grass/` — instanced grass (`GrassSurface`, blade geometry, patched materials, ground material/palette).
  - `world/water/` — endless sea plane, depth prepass, heightfield texture, water shader.
  - `world/Environment.ts` — sky, fog, lights. The shadow camera follows the player (`followShadows`), snapped to whole shadow texels.
  - `world/navigation.ts` — shared nav grid: collidable props/statues/bonfires block cells, underwater ground blocks cells, cliff steps via `canTraverse`.
  - `editor/` — dev-only map editor (`EditorSystem`, `editorLayout` localStorage working copy, `TileSelection`, `entityDefaults`). The working copy replaces the committed map only once the editor is first opened.
- `src/ui/` — DOM/HTML layer, reacts to `core/events.ts`, no Three.js imports.
  - `UIStateView.ts` — `stateChange` → `state-<name>` class on `#ui-container` and `body`.
  - `views/` — `MenuView`, `BookView` (B; also classic mode, project discovery and bonfire level-up), `HudView` (HP, coins, loot toast), `InteractPromptView`, `IrisView` (death transition), `EditorView` (dev only; builds its own panel markup, not in `index.html`). Every other interface lives inside the book.
  - `components/` — book rendering: `renderBookToc`, `renderBookEntry`, `renderLevelPage` (player + stats), `pageFlip`, `formatDate`.
- `src/main.ts` — wiring only: init UI views, go straight to `MENU`, lazy-import `Experience` on first `GAME` entry behind the loading screen (`body.booting`).

## Locked-in vision (decided with Alban, not yet all built)

- **Project discovery = statues.** Each statue carries a `projectId`, glows while undiscovered, and is collected by pressing **`E`** in range. The statue mesh does **not** disappear on collect — only the glow does.
- **Book UI**: one book for game and classic mode. In game mode it lists **all** projects (uncollected ones locked) and is the only interface besides the menu, HP bar, coins, interact prompt, loot toast and death screen: discovering a project opens the book on its page, and the bonfire's level-up opens the Level section. Stats can only be bought while standing at a bonfire.
- **Death & bonfires** (Dark Souls model): hand-placed `bonfire` map entities. Death respawns the player at the last rested bonfire; resting refills HP and **resets all enemies except bosses**.
- **No region system.** The map is handcrafted; project data stays pure content with no placement/region fields.
- **Camera**: fixed isometric offset for now. Contextual zoom later for big bosses/rooms.
- **Attack**: mouse-click aim + attack stays.
- **Menu**: later becomes two openable pixel-art doors (2D art, not 3D meshes — the earlier 3D-door plan is dropped). All UI goes pixel art; current CSS is placeholder.
- **Editor mode**: dev-only map editor, not shipped. Outputs JSON to commit (live localStorage editing only if it's cheap to add).
- **Chunk system**: built — entity streaming by derived chunk key.

### Build order agreed

1. Statue entity + proximity/`E` interaction system (delete the dead raycast `ItemInteraction`), emitting a discovery event.
2. Book UI (all projects, locked placeholders).
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
  - ~~One `pauseChanged(boolean)` emitted by several modals~~ — closing one unpaused the game under another. Now a set of reasons in `core/pause.ts` (same idea as `MovementComponent.frozenBy`).
  - ~~Four copy-pasted localStorage load/save blocks~~ — `domain/persistence.ts`.
  - ~~`Box3.setFromObject` as a hurtbox~~ — counted health bars and swords; hurtboxes are now radius + `bodyHeight`.
  - ~~Hand-coded procedural animation (`AnimationComponent`) lerping Euler angles~~ — replaced by Blender clips through the animator; rotations slerp as quaternions, poses rebuilt from the bind pose each frame instead of accumulated. A plain `clone()` of a skinned model keeps pointing at the original's bones — `loadModel` goes through `SkeletonUtils.clone`.
- Open teaching points, still relevant:
  - Three.js resources (geometry/material/texture) need explicit `.dispose()` — no GC for GPU memory. Only `AttackComponent` disposes today; item removal and pooled-entity teardown do not.

## Conventions

- TypeScript config: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all on — keep code clean enough to satisfy these, don't loosen them. Run `npx tsc --noEmit` after changes.
- Prefer a `type` alias over `interface` for anything used as a generic constraint — `interface` allows declaration merging so TS can't prove it has no extra keys. Exception: plain data-shape interfaces meant to be `implements`ed (e.g. `Component`), which need at least one non-optional member for TS's weak-type check.
- Singletons: module-level `export const instance = new X()` when construction needs no external input (`EventEmitter`, `StateMachine`, `EnemyPool`). `private constructor` + `static init(...)`/`static getInstance()` when it needs input available only later (`Experience` needs the canvas).
- Discriminated unions (tagged with a `kind` literal) over one flat interface with many optional fields.
- File layout: `src/core/` = framework-agnostic infra. `src/data/` = pure content, never imports other `src/` layers. `src/domain/` = pure derivation from `data/`, no Three.js/DOM. `src/game/` = Three.js scene graph. `src/ui/` = DOM layer. `game/` and `ui/` never import each other — only through `core/events.ts`.
