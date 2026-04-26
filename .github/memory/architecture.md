# Architecture Notes

- Stack: React 19, Vite, TypeScript, React Three Fiber, Drei, Three.js, Zustand.
- Repo is client-side only; do not assume backend, API, database, GraphQL, or dependency-injection layers.
- Repo root is ../ (one folder higher than this folder). Paths are generally relative to the repository root.
- Main game code lives under src/game.
- Scene composition belongs in src/game/scenes.
- Reusable 3D objects and scene actors belong in src/game/entities.
- Shared state belongs in src/game/state.
- Frame-step and input logic belong in src/game/systems.
- Rendering and post-processing helpers belong in src/render.
- Keep rendering code and gameplay state separate when practical; avoid hiding reusable stateful logic deep inside visual components.
- Prefer reusing existing GPU-tier, transform, and shadow utilities before adding new abstractions.
- Mobile support and GPU-tier-aware quality are first-class constraints.
- Be careful with per-frame allocations, HDR assets, shadow quality, cube cameras, and post-processing cost.
