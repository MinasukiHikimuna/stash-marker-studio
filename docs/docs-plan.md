# Stash Marker Studio Documentation Plan

## Audience & Goals

- **Primary audience**: Stashapp power users reviewing and curating scene markers.
- **Secondary audience**: Stash Marker Studio maintainer (internal developer) for context while keeping focus on user-facing needs.
- **Top goals**: Help users configure the app, understand marker and tag workflows, and resolve day-to-day tasks without developer assistance.

## Documentation Principles

- Organize content using the [Diátaxis](https://diataxis.fr/) model: Tutorials, How-to Guides, Reference, Explanation.
- Prioritize user workflows and decision points over implementation detail.
- Surface prerequisites, keyboard shortcuts, and configuration requirements early so users can self-serve.
- Keep content in `docs/` as Markdown/MDX with consistent frontmatter for future site generation.

## Documentation Structure (Draft)

### Tutorials (learning-oriented)
- **Get Started with Stash Marker Studio**: Install, connect to Stashapp, tour the UI.
- **Review Your First Scene**: Step-by-step marker review and confirmation workflow.
- **Import Shot Boundaries from PySceneDetect**: Guided walkthrough with prerequisite setup.
- **Configure Tag Metadata**: Set up tag mappings and derived markers for a sample library.

### How-to Guides (task-oriented)
- **Bulk Confirm or Reject AI Markers**: Keyboard-driven workflow and best practices.
- **Resolve Tag Conflicts**: Handling mismatched tag metadata or missing slots.
- **Manage Shot Boundaries**: Create, edit, and delete boundaries for a scene.
- **Troubleshoot Stashapp Connection Issues**: Checklist for API auth, version compatibility, and config reloads.

### Reference (information-oriented)
- **Keyboard Shortcuts Catalog**: Comprehensive shortcut list with contexts.
- **Configuration Reference**: Fields in `app-config.json` / runtime config, validation rules, sample JSON snippets.
- **Marker States & Tag Metadata**: Definitions for statuses, sources, derived markers, and slot mapping expectations.
- **API Endpoints & Data Sync**: Overview of relevant Next.js API routes, expected inputs/outputs for power users.

### Explanation (understanding-oriented)
- **Marker Review Philosophy**: Rationale behind marker states, queue prioritization, and workflow choices.
- **Shot Boundaries vs Markers**: Why they are separate, how the Postgres integration works conceptually.
- **Derived Marker Strategy**: How tag ontologies influence automation and what trade-offs exist.
- **Keyboard-First Interaction Model**: Design reasoning for shortcut emphasis and UI implications.

## Terminology & Glossary Strategy

- Maintain a dedicated `docs/glossary.md` that defines core terms (marker, derived marker, shot boundary, tag metadata, stash scene, queue states).
- Reuse terminology consistently across documents; avoid synonyms for key concepts (e.g., always “shot boundary” not “scene cut”).
- Capture keyboard shortcuts in a structured table for cross-linking (e.g., YAML frontmatter + Markdown table for tooling support).
- Note Stashapp-specific jargon and clarify differences where Stash Marker Studio diverges (e.g., Stashapp parent tags vs derived markers).

## Operational Notes

- Store shared artifacts (diagrams, screenshots) in `docs/media/` with descriptive names.
- Add contribution guidelines in `docs/CONTRIBUTING.md` once documentation workflow formalizes.
- Use TODO comments in documents to flag missing steps or screenshots during incremental drafting.
- Plan to wire documentation into the Next.js site (e.g., `/docs` route) after initial Markdown drafts stabilize.

## Next Steps

1. Validate this outline with stakeholders and adjust priorities.
2. Stand up `docs/glossary.md` and seed with core definitions.
3. Draft “Get Started with Stash Marker Studio” tutorial as the first canonical user journey.
