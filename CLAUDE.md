# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stash Marker Studio is a companion app for Stashapp that makes working with video markers and tags easier. It's designed primarily for reviewing AI-generated markers (from Skier's NSFW AI model) but works with any markers. The app provides an opinionated workflow for marker review and tag management.

## Core Development Commands

- `npm run dev` - Start development server (Next.js)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run Jest in watch mode

## Architecture

### Framework & Tech Stack

- Next.js 15 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- GraphQL for API communication with Stashapp
- Jest for testing

### Core Architecture Patterns

**State Management**: Uses Redux Toolkit (`src/store/`) for global state management. All marker operations flow through Redux slices and thunks. Prefer Redux over local state for any shared application state.

**Service Layer**: `StashappService` (`src/services/StashappService.ts`) handles all GraphQL communication with Stashapp backend. Configuration is injected at runtime via `applyConfig()` method.

**Marker Logic**: Core business logic in `src/core/marker/markerLogic.ts` handles marker status tracking (confirmed/rejected/unprocessed), filtering, and calculations. Key concepts:

- Markers have status tags: CONFIRMED, REJECTED, or unprocessed
- Shot boundary markers (from PySceneDetect) are filtered out of action markers
- AI tags ending with "\_AI" can be converted to corresponding real tags

### Key Domain Concepts

**Marker States**:

- Unprocessed: New markers needing review
- Confirmed: Approved markers with MARKER_STATUS_CONFIRMED tag
- Rejected: Rejected markers with MARKER_STATUS_REJECTED tag

**Marker Sources**:

- Manual: Created in app (MARKER_SOURCE_MANUAL tag)
- AI-generated: From external AI models
- PySceneDetect: Shot boundary detection (MARKER_SHOT_BOUNDARY tag)

**AI Tag Conversion**: AI tags (ending "\_AI") can be converted to real tags via description field "Corresponding Tag: {TagName}"

### Component Structure

- `src/components/` - Reusable UI components
- `src/components/marker/` - Marker-specific components (list, form, header, summary, video)
- `src/hooks/` - Custom hooks for keyboard shortcuts, video controls, marker operations
- `src/layouts/` - Layout components
- `src/app/` - Next.js App Router pages and API routes

### Important Files

- `src/core/marker/types.ts` - Core TypeScript types for markers and state
- `src/hooks/useDynamicKeyboardShortcuts.ts` - Dynamic keyboard shortcut handling
- `src/components/Timeline.tsx` - Main timeline visualization component
- `src/serverConfig.ts` - Runtime configuration structure
- `.plan.md` - Current refactoring/development plan (keep this in mind when making changes)

## Development Notes

### Git commit messages

Keep the git commit messages as brief as possible while still giving enough details. Tell what the state would have been without this change and how does this change make it better. Avoid repetition in the commit message.

### Planning and Architecture

- **Current Plan**: Always check `.plan.md` for the current refactoring or development plan before making significant changes
- **State Management**: Use Redux for all shared application state. Avoid local state for data that could be shared between components
- **Component Design**: Follow the component architecture outlined in the current plan when creating or modifying components

### Configuration

The app requires runtime configuration injection for Stashapp connection and tag IDs. Environment variables are loaded via `/api/config` route and injected into `StashappService`.

### Testing

- Use linting: npm run lint
- Use Jest for unit tests: npm run test
- Test files: `*.test.ts` pattern
- Mocks available in `__mocks__/` directories

### Keyboard-First Design

The app is heavily keyboard-driven. Many features are only accessible via keyboard shortcuts. Left hand modifies, right hand navigates.

### Docker Support

Includes Dockerfile for containerized deployment. Uses Node.js 22+ requirement.

## External Dependencies

- **Stashapp**: Requires version 0.28+ for marker start/end time support
- **PySceneDetect**: Optional integration for shot boundary detection via `src/scripts/pyscenedetect-process.js`
