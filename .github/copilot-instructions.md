## Critical Instructions
- ALWAYS read the copilot instructions before starting a task.
- ALWAYS read .github/memory/index.md at the start of every task, then read any relevant memory files listed there before proceeding.
- Always follow the coding style and guidelines outlined below.
- Always think through the request and approach before making changes.
- Prefer clean changes over quick patches. Remove or update obsolete code when it is directly relevant to the task.
- When changing or generating code, create a numbered list of implementation steps.
- The final steps for code changes should include:
	- Adding or updating key validation or tests where practical
	- Create an unbiased sub agent to review the changes against these instructions and the project memory, fixing any issues found
- Use the .github/memory folder to store concise, useful project knowledge discovered during work. Keep notes short, organized, and relevant.
- At the end of each task, consider whether a memory file should be added or updated.

## Project Overview
- This repo is a client-side React 19, Vite, and TypeScript project focused on real-time 3D rendering and game-like scene experimentation.
- Rendering is built around React Three Fiber, Drei, Three.js, and post-processing utilities.
- State is managed with Zustand.
- There is no backend or GraphQL layer in this repo. Do not assume API, server, database, or dependency-injection patterns unless they are explicitly added later.
- Performance matters. Prefer changes that preserve frame rate, especially on mobile and lower GPU tiers.

## Architecture Guidelines
- Keep scene composition in scenes, reusable visual objects in entities, shared logic in systems or utility modules, and shared state in the Zustand store.
- Prefer extending existing patterns under src/game, src/render, and src/app before introducing a new architectural layer.
- Keep rendering code and gameplay state separate where practical. Avoid burying stateful logic inside deeply nested visual components when it belongs in the store or a system.
- When adding frame-loop logic, avoid unnecessary allocations, repeated object creation, and expensive work inside useFrame.
- Reuse existing helpers for transforms, shadows, GPU-tier decisions, and shared scene behavior when possible.

## Coding Style
- Follow the existing TypeScript and React style already present in the repo.
- Prefer small, focused components and utilities with one clear responsibility.
- Keep comments short and only where they clarify non-obvious rendering, timing, or math behavior.
- Prefer removing dead code and duplication over layering new abstractions on top of obsolete code.
- Extract repeated constants, scene settings, and magic values into named constants when that improves readability.
- Avoid adding dependencies unless they clearly improve the implementation and fit the existing stack.
- For state changes, prefer the existing Zustand patterns over introducing a new state-management approach.

## 3D And Performance Guidance
- Treat mobile support and GPU-tier-aware quality as first-class constraints.
- Be cautious with HDR assets, cube cameras, shadow map sizes, post-processing, and particle counts; these have direct performance impact.
- Prefer changes that degrade gracefully across device tiers instead of maximizing desktop-only fidelity.
- When changing lighting, materials, or post-processing, preserve the overall visual intent described in the README unless the task explicitly calls for a visual redesign.
- When working with Three.js or React Three Fiber objects, keep object lifetime and cleanup in mind.

## Validation
- For code changes, validate with npm run build and npm run lint when relevant.
- For visual changes, also describe any manual checks that should be performed in the browser because automated validation is limited for rendering behavior.
- Update README notes when a change materially affects controls, rendering features, performance characteristics, or setup.
