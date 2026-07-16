# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

3D portfolio site, two entry modes from one 3D menu:
- **Game mode**: explore a 3D world, projects = chests guarded by enemies, bigger/featured projects = boss fights. Full action combat (movement, attack timing, health bars).
- **Fast portfolio mode**: flat list of all projects + short bio, for recruiters who don't want to play a game.

Stack: Vite + TypeScript + Three.js. No framework (no React/Vue) — DOM is manipulated directly via `document.getElementById` etc, Three.js owns the WebGL canvas.

## Commands

- `npm run dev` — start Vite dev server (port 3000, see `vite.config.ts`)
- `npm run build` — `tsc` (type-check only, `noEmit`) then `vite build`
- `npm run preview` — preview the production build
- `npx tsc --noEmit` — type-check only, useful after any change since `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` are all enforced and `npm run dev` does not type-check
- No test runner is set up yet.

## Architecture

Layered, event-driven — each layer only knows about the layer below it via typed events, not direct references:

- `src/core/` — framework-agnostic infra, no Three.js/DOM knowledge.
  - `EventEmitter.ts` — generic typed pub/sub (`EventEmitter<Events>`), has `on`/`off`/`emit`.
  - `events.ts` — `AppEvents` type map (currently just `stateChange`) + one shared `events` singleton instance. Add new cross-layer events here.
  - `StateMachine.ts` — tracks `AppState` (`LOADING | MENU | GAME | CLASSIC`) and emits `stateChange` on `events`. Does **not** touch the DOM.
- `src/data/` — pure content, no game-mechanics knowledge.
  - `Project.ts` — `Project` type. Has a `rarity` field (`common | rare | epic | legendary`) but no `isBoss`/lock/enemy info — the domain layer (not yet built) will derive chest/enemy behavior from `rarity`, keeping content decoupled from mechanics.
  - `projects.ts` — hardcoded `Project[]`, the single source of truth consumed by both game mode (spawn chest+enemy per project) and classic mode (render list).
- `src/game/` — Three.js scene graph.
  - `Experience.ts` — owns scene/camera/renderer/render loop. Singleton via `Experience.init(canvas)` (call once, in `main.ts`) + `Experience.getInstance()` (everywhere else); constructor is private, throws if `getInstance()` called before `init()`.
  - `world/World.ts` — owns `Environment` + game objects (currently just a placeholder spinning cube).
  - `world/Environment.ts` — lights.
- `src/ui/` — DOM/HTML layer, reacts to `core/events.ts`.
  - `UIStateView.ts` — listens for `stateChange`, sets `#ui-container` className (this used to live inside `StateMachine` itself — now separated).
- `src/main.ts` — wiring only: `Experience.init(canvas)`, `initUIStateView()`, state transitions on button clicks.

Not yet built: 3D clickable menu (raycast-pickable door/portal meshes replacing the flat `#btn-play`/`#btn-classic` buttons), `domain/` layer (framework-agnostic `Enemy`/`Player`/`Chest`/`Combat` entities, no Three.js/DOM imports so combat logic is testable without a WebGL context), enemies, chests, combat.

## Design decisions locked in

- **Project → game object mapping**: each project is a chest, guarded by an enemy. Defeating the enemy opens the chest, which opens the project modal (`#project-modal`).
- **Boss vs regular enemy**: manually tagged per project (via `rarity`, not derived from actual size/complexity of the project) — deliberate curation choice, not automatic.
- **Combat depth**: full action combat — movement, attack timing/hitboxes, health bars. Biggest scope item in the project; build incrementally (hit detection first, feel/juice later).
- **3D menu**: fully 3D clickable objects in-scene (e.g. two doors/portals — "Game Mode" / "Fast Portfolio"), not flat HTML buttons with a 3D backdrop. Click → raycaster hits the door mesh → `stateMachine.changeState(...)`.
- **Project data**: hardcoded typed array in `src/data/projects.ts`, ~5-10 projects. No CMS/backend.
- **Deploy target**: static build → GitHub Pages / Vercel / Netlify. No server-side code planned.

## How to work with Alban on this repo

Alban is learning JS/TS through building this. Preferred workflow:

- **Pair-program, not autopilot.** Propose the plan/approach for a step, explain it, wait for go-ahead, *then* write the code. Don't silently write large chunks of new logic unprompted.
- After writing code, explain it like a professor would: what each non-obvious piece does and *why* that pattern was chosen over alternatives — not just a restatement of the code.
- Actively point out anti-patterns, JS/TS gotchas, and better approaches, even if not explicitly asked. Treat every change as a small teaching moment.
- Resolved teaching points (don't re-explain from scratch, just reference briefly if relevant):
  - ~~Singleton via `if (instance) return instance` inside a constructor~~ — replaced everywhere with explicit `static getInstance()`/`static init()` (see `Experience.ts`; `EventEmitter`/`StateMachine` are now plain module-level `export const` singletons instead, since nothing needed the constructor-hijack there).
  - ~~`StateMachine` reached into the DOM directly~~ — now emits `stateChange` via `core/events.ts`; `ui/UIStateView.ts` owns the DOM side-effect.
  - ~~`EventEmitter` had no `off()`, was untyped (`any[]`)~~ — now generic (`EventEmitter<Events>`) with `on`/`off`/`emit`.
- Open teaching points, still relevant:
  - Three.js resources (geometry/material/texture) need explicit `.dispose()` — no GC for GPU memory. Matters once enemies/chests are spawned and removed dynamically, not for the current static scene.
  - Check `vite.config.ts` `outDir: '../dist'` — builds outside the project folder; confirm this is intentional before relying on it for deploy.

## Conventions

- TypeScript strict-ish config: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` all on — keep code clean enough to satisfy these, don't loosen them to silence errors. Run `npx tsc --noEmit` after changes since `npm run dev` won't catch these.
- Prefer a `type` alias over `interface` for anything used as a generic constraint (e.g. `Record<string, unknown[]>`) — `interface` supports declaration merging so TS can't prove it has no extra untyped keys; `type` is closed and checks structurally.
- Singletons: use module-level `export const instance = new X()` when construction needs no external input (`EventEmitter`, `StateMachine`). Use `private constructor` + `static init(...)`/`static getInstance()` when construction needs external input that's only available later (`Experience` needs the canvas element).
- File layout: `src/core/` = framework-agnostic infra (state, events). `src/data/` = pure content, no mechanics. `src/game/` = Three.js scene graph (`Experience` owns `World`, `World` owns `Environment` + game objects). `src/ui/` = DOM layer reacting to `core/events.ts`.
