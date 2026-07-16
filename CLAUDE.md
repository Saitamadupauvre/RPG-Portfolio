# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

3D portfolio site, two entry modes reached via a 3D menu:
- **Game mode**: free-roam 3D world (open world, not linear). Enemies, chests, items, and props are placed independently as level design — not auto-generated from the project list. A collectible **item** can optionally carry a `projectId` link; collecting a linked item opens the project modal. Unlinked items are just game loot with no project tie-in. Full action combat is the biggest planned scope item (movement, attack timing/hitboxes, health bars) — not yet built.
- **Fast portfolio / classic mode**: flat list of every entry in `src/data/projects.ts`, independent of what's placed in the game world, for recruiters who don't want to play a game.

Visual split: **3D low-poly** for the game world (Three.js meshes), **2D pixel-art** for all UI/menus/overlays (hand-rolled DOM+CSS, no canvas renderer). Pixel look is currently CSS-only placeholders (`src/style/pixel-ui.css`: blocky monospace, hard-edged panels, stepped shadows) — swappable for real pixel-art PNGs/font later without touching component structure.

Stack: Vite + TypeScript + Three.js. No framework (no React/Vue) — DOM is manipulated directly via `document.getElementById`/`document.createElement` etc, Three.js owns the WebGL canvas.

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
  - `events.ts` — `AppEvents` type map (`stateChange`, `itemCollected`) + one shared `events` singleton instance. Add new cross-layer events here.
  - `StateMachine.ts` — tracks `AppState` (`LOADING | MENU | GAME | CLASSIC`) and emits `stateChange` on `events`. Does **not** touch the DOM.
- `src/data/` — pure content, no game-mechanics or rendering knowledge, never imports from `domain`/`game`/`ui`.
  - `Project.ts` — `Project` type (`id`, `title`, `description`, `tags`, `links`, `rarity`). `projects.ts` — hardcoded `Project[]`, the single source of truth for classic mode and for resolving item→project links. Independent of map layout.
  - `MapEntity.ts` — tagged union (`kind: 'enemy' | 'chest' | 'item' | 'prop'`) describing level content. Only `item` has an optional `projectId`; that's the *sole* coupling point between the game world and project data. `mapLayout.ts` — hardcoded `MapEntity[]`, authored independently of `projects.ts` (adding level content ≠ adding a project, and vice versa).
- `src/domain/` — pure derivation, no Three.js/DOM imports.
  - `CardStyle.ts` — `projectToUICardStyle(project)`, a `rarity`-keyed lookup table producing presentation info (`frameVariant`, `badgeLabel`, `glow`) for UI cards only — never used for map spawning.
  - `collectItem.ts` — `resolveItemProject(item)`, looks up `item.projectId` in `projects.ts`, returns `Project | undefined`.
  - `components/` — pure component logic attachable to game entities (see below). `Component.ts` base interface (`readonly name`, optional `update?(dt)`); `HealthComponent.ts` (`hp`/`maxHp`/`takeDamage`/`heal`/`isDead`).
- `src/game/` — Three.js scene graph and interaction.
  - `Experience.ts` — owns scene/camera/renderer/render loop, instantiates `World`, `MenuInteraction`, `ItemInteraction`. Singleton via `Experience.init(canvas)` (call once, in `main.ts`) + `Experience.getInstance()` (everywhere else); constructor is private, throws if `getInstance()` called before `init()`.
  - `entities/Entity.ts` — Three-aware entity wrapper: `id`, `mesh: THREE.Object3D`, a `Map<string, Component>`, `addComponent`/`getComponent<T>`/`update(dt)` (fans out to attached components). Domain components stay engine-agnostic; `Entity` is the seam where they meet a mesh.
  - `entities/{Enemy,Chest,Item,Prop}Factory.ts` — each `(mapEntity) => Entity`, builds the mesh and attaches components (only `EnemyFactory` attaches `HealthComponent` today: grunt 20 / elite 50 / boss 200 hp). `entities/entityFactories.ts` — typed dispatch table (`Record<MapEntity['kind'], factory>`) + `createMapEntity()`; adding a new `MapEntity` kind means one new factory file + one registry entry, no switch/branch to touch elsewhere.
  - `world/World.ts` — builds all entities via `mapLayout.map(createMapEntity)`, groups their meshes in `entityGroup` (visible only in `GAME` state — mirrors `Menu.group`'s own visibility toggle), tracks `items: {entity, source}[]` separately for interaction/removal, runs `entity.update(dt)` each frame. Owns `Environment` (lights) and `Menu` (3D door meshes).
  - `world/Menu.ts` — builds the two clickable 3D "door" meshes (`GAME`/`CLASSIC`), tagged via `mesh.userData.doorTarget`.
  - `MenuInteraction.ts` / `ItemInteraction.ts` — both raycast on canvas click against a specific mesh set, gated by current `AppState` (`MENU` / `GAME` respectively); `MenuInteraction` calls `stateMachine.changeState(...)`, `ItemInteraction` emits `itemCollected` with the item's source `MapEntity`.
- `src/ui/` — DOM/HTML layer, reacts to `core/events.ts`, no Three.js imports.
  - `UIStateView.ts` — listens for `stateChange`, sets `#ui-container` className to `state-<name>` (CSS in `style.css` drives `.screen` visibility per state).
  - `components/renderProjectCard.ts` — pure function `(project, cardStyle) => HTMLElement`, framework-free `document.createElement`/`.append` DOM building. Reused by every surface that shows a project.
  - `views/ClassicView.ts` — on first `CLASSIC` state entry, renders every `projects.ts` entry into `#classic-project-list` via `renderProjectCard`.
  - `views/ProjectModalView.ts` — listens for `itemCollected`, calls `resolveItemProject`; only opens/populates `#project-modal` (via the same `renderProjectCard`) when a project comes back, no-ops for unlinked items.
- `src/main.ts` — wiring only: `Experience.init(canvas)`, `initUIStateView()`, `initClassicView()`, `initProjectModalView()`, initial `LOADING` → `MENU` transition on a timer.

Not yet built: player entity/movement, combat (attack hitboxes tied into `HealthComponent`), enemy AI/behavior components, real pixel-art assets (font file + border-image 9-slice frame PNGs to replace `pixel-ui.css` placeholders).

## Design decisions locked in

- **Map vs. project data are separate concerns.** Enemies/chests/props are level design, placed and typed on their own in `mapLayout.ts` — never auto-derived 1:1 from `projects.ts`. The only link is optional `item.projectId`, resolved at collection time via `domain/collectItem.ts`.
- **Entity/component pattern**, not per-type subclassing: `game/entities/Entity.ts` (mesh + id) + attachable `domain/components/*` (pure logic, e.g. `HealthComponent`). Player, enemies, and any future entity type reuse the same base and components — no duplicated HP/behavior code per entity type.
- **Boss vs regular enemy**: `enemyType` is authored directly per `MapEntity`, not derived from `Project.rarity` — map design and project curation are independent axes.
- **Combat depth**: full action combat — movement, attack timing/hitboxes, health bars. Biggest scope item in the project; build incrementally (hit detection first, feel/juice later).
- **3D menu**: fully 3D clickable objects in-scene (two doors — "Game Mode" / "Fast Portfolio"), not flat HTML buttons with a 3D backdrop. Click → raycaster hits the door mesh → `stateMachine.changeState(...)`.
- **Pixel UI via hand-rolled DOM+CSS**, not a canvas-2D renderer — consistent with "DOM manipulated directly." `image-rendering: pixelated` + `border-image` 9-slice framing is the intended mechanism once real art assets exist; `pixel-ui.css` currently holds CSS-only placeholders for the same class names.
- **Project data**: hardcoded typed array in `src/data/projects.ts`, ~5-10 projects. No CMS/backend.
- **Deploy target**: static build → GitHub Pages / Vercel / Netlify. No server-side code planned.

## How to work with Alban on this repo

Alban is learning JS/TS through building this. Preferred workflow:

- **Pair-program, not autopilot.** Propose the plan/approach for a step, explain it, wait for go-ahead, *then* write the code. Don't silently write large chunks of new logic unprompted.
- After writing code, explain it like a professor would: what each non-obvious piece does and *why* that pattern was chosen over alternatives — not just a restatement of the code.
- Actively point out anti-patterns, JS/TS gotchas, and better approaches, even if not explicitly asked. Treat every change as a small teaching moment.
- Resolved teaching points (don't re-explain from scratch, just reference briefly if relevant):
  - ~~Singleton via `if (instance) return instance` inside a constructor~~ — replaced everywhere with explicit `static getInstance()`/`static init()` (see `Experience.ts`; `EventEmitter`/`StateMachine` are plain module-level `export const` singletons instead, since nothing needed the constructor-hijack there).
  - ~~`StateMachine` reached into the DOM directly~~ — now emits `stateChange` via `core/events.ts`; `ui/UIStateView.ts` owns the DOM side-effect.
  - ~~`EventEmitter` had no `off()`, was untyped (`any[]`)~~ — now generic (`EventEmitter<Events>`) with `on`/`off`/`emit`.
  - ~~Raw `THREE.Object3D` returned from entity factories~~ — no seam for HP/behavior. Replaced with `Entity` (mesh + component map) so combat/AI slot in via `domain/components/*` without touching factories' return type.
  - ~~Switch statement dispatching on `MapEntity['kind']`~~ — replaced with a typed `Record`-based dispatch table (`entityFactories.ts`); new entity kind = one factory + one registry entry, no branch to edit.
  - ~~Full-viewport `.screen` divs with `pointer-events: auto` but no interactive children~~ — silently swallowed all canvas clicks (3D door raycasts never fired). Only elements with actual interactive content (`.btn`, `.modal-content`, `#classic-screen`) should opt back into pointer events; bare `.screen` containers stay `pointer-events: none`.
- Open teaching points, still relevant:
  - Three.js resources (geometry/material/texture) need explicit `.dispose()` — no GC for GPU memory. Matters once enemies/chests are spawned and removed dynamically at runtime (item collection already removes meshes on collect — dispose() not yet added there).
  - Check `vite.config.ts` `outDir: '../dist'` — builds outside the project folder; confirm this is intentional before relying on it for deploy.

## Conventions

- TypeScript strict-ish config: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all on — keep code clean enough to satisfy these, don't loosen them to silence errors. Run `npx tsc --noEmit` after changes since `npm run dev` won't catch these.
- Prefer a `type` alias over `interface` for anything used as a generic constraint (e.g. `Record<string, unknown[]>`) — `interface` supports declaration merging so TS can't prove it has no extra untyped keys; `type` is closed and checks structurally. Exception: plain data-shape interfaces meant to be `implements`ed (e.g. `Component`) — TS's weak-type check requires at least one non-optional member for those, so give them one meaningful required field rather than making everything optional.
- Singletons: use module-level `export const instance = new X()` when construction needs no external input (`EventEmitter`, `StateMachine`). Use `private constructor` + `static init(...)`/`static getInstance()` when construction needs external input that's only available later (`Experience` needs the canvas element).
- Discriminated unions (tagged with a `kind`/similar literal field) over one flat interface with many optional fields — lets TS narrow automatically in `switch`/dispatch without casts (see `MapEntity`).
- File layout: `src/core/` = framework-agnostic infra (state, events). `src/data/` = pure content, no mechanics — never imports from other `src/` layers. `src/domain/` = pure derivation from `data/` (lookup tables, resolvers, components) — no Three.js/DOM imports. `src/game/` = Three.js scene graph, consumes `domain/`. `src/ui/` = DOM layer reacting to `core/events.ts`, consumes `domain/`. `game/` and `ui/` never import from each other directly — only through `core/events.ts`.
