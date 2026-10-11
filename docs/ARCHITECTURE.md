# Architecture

Mall Rats splits into a **headless simulation**, a **Three.js presenter**, and a **React shell**. The simulation is the source of truth for gameplay; React never owns player position, collisions or the wallet mid-frame.

```
src/
  config/          Tunable data: physics, obstacles, routes, catalogue, economy, missions, IAP packs
  engine/          60 Hz sim, course, validator, generator, scoring, security, drops, autopilot
  economy/         Versioned save schema + atomic GameStore
  monetization/    Rewarded-ad and billing provider interfaces (mocks for development)
  render/          Three.js world, character, board, guard, obstacles, pickups
  audio/           WebAudio SFX + two procedural music beds
  game/            Input + requestAnimationFrame runtime (fixed-step accumulator)
  ui/              React overlays: menu, HUD, shop, wardrobe, results, settings
```

## Simulation

`RunSimulation` (`src/engine/simulation.ts`) steps at `SIM_DT = 1/60`. The runtime (`src/game/runtime.ts`) accumulates real time and calls `sim.step(intent)` in a loop, then interpolates the renderer. Spikes drop frames; they never skip simulation ticks in a way that changes collision order.

Player state (`src/engine/player.ts`) is a small state machine: ground, air, duck, grind. Intents are discrete (`left` / `right` / `up` / `down` / `trickLeft` / `trickRight`). One swipe is one intent — air tricks do not also change lane.

The course (`src/engine/course.ts`) is a sliding window of chunk instances with object pools for obstacles, rails and pickups. Chunks behind the player are recycled.

## Fair routes

Authored templates in `src/config/routes.ts` are proven by `validateTemplate` (`src/engine/validator.ts`): a BFS over `(s, lane, mode, airTick, duckTick, …)` with **stricter** hitboxes than live play (`validatorPadding` vs in-game `collisionMargin`). A template must be passable from all three entry lanes at speeds 11, 13, 15, 17, 19, 21 and 23 m/s, including mirrored copies and difficulty layers. Mystery-bag slots must be reachable from every entry lane.

The generator stitches templates with a settle-time buffer: the gap after a chunk’s last obstacle is at least `speed * settleTime()` so a player can land or finish a duck before the next hazard. Junctions always offer the main concourse plus a branch; branches reconnect through an exit chunk.

`AutoPilot` is a real-time planner used by tests (and a hidden dev fixture). It is not shipped as an assist in production UI.

## Presentation

`GameRenderer` builds a low-poly mall from merged geometry (`GeoBuilder`) and canvas textures (store signs, floors, deck graphics). The skater is a modular rig: clothing slots swap meshes; hair/face/skin are free look options. A studio mode (menu / shop / wardrobe) frames the same rig against a backdrop and supports drag-to-rotate.

The HUD writes `textContent` from a bridge; React does not re-render at 60 Hz.

## Persistence

`GameStore` clones a draft, mutates it, asserts invariants (non-negative integer wallet, equipped items owned, duplicates only of owned items), then writes JSON to `localStorage` (with a `.backup` copy). A failed write leaves live state untouched. Payout operations (shop, ads, IAP, bag collect, duplicate sales, tutorial, missions, run finish) carry an idempotency key so double-taps and duplicate SDK callbacks are no-ops.

This is **device-local**. It is not tamper-proof. Paid Mall Cash in a shipping build must live on a server; see `docs/MONETIZATION.md`.

## UI shell

`src/ui/App.tsx` owns screen navigation. Gameplay stays on a full-screen canvas; menus are overlays. Development builds expose `window.__mallrats` and a Dev fixtures screen. Production builds (`import.meta.env.DEV === false` and no `VITE_ENABLE_MOCK_PROVIDERS`) construct disabled ad / unconfigured billing providers and hide the fixtures.

## Tests

- **Vitest** (`src/**/*.test.ts`): player physics, scoring, security, BFS fairness, generator transitions, drop director, economy, migrations, ads/IAP.
- **Long simulations**: `fairness.test.ts` (planning bot, minutes of play), `dropDirector.sim.test.ts` (bag cadence), `economyReport.test.ts` (typical earnings).
- **Playwright** (`e2e/`): menu, shop preview/cancel, purchase, wardrobe presets, duplicate sales, tutorial skip, results, cash shop.
