# Workflow Notes

- Start each task by reading .github/copilot-instructions.md and .github/memory/index.md, then open the relevant memory files.
- For code changes, validate with npm run build and npm run lint when relevant.
- For visual or rendering changes, include manual browser verification notes because build and lint do not validate scene quality.
- Preserve the overall visual intent described in README unless the task explicitly calls for a redesign.
- Preserve mobile and lower-tier GPU behavior unless the task explicitly changes quality targets.
- Update README when setup, controls, rendering features, or performance characteristics materially change.
- Prefer clean changes over quick patches, and remove or update obsolete code when it is directly relevant.
- Keep memory notes concise and focused on stable project facts, not task-specific chatter.
