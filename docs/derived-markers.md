# Derived Markers

## Overview

Derived markers are automatically generated markers based on tag ontology relationships. They allow you to define hierarchical relationships between tags, where a more specific tag (source) automatically implies a more general tag (derived).

## Concept

When you have a marker with a specific tag like "Blowjob", the system can automatically generate derived markers with more general tags like "Oral Sex". This prevents manual duplication and ensures consistent tagging across hierarchies.

### Example

Given a marker tagged with "Reverse Cowgirl (DP)" with slots:
- Vaginal Giver: Performer A
- Anal Giver: Performer B
- Receiver: Performer C

The system can automatically derive:
- "Reverse Cowgirl" marker (Vaginal Giver: A, Receiver: C)
- "Vaginal Sex" marker (Vaginal Giver: A, Receiver: C)
- "Vaginal Penetration" marker (Vaginal Giver: A, Receiver: C)
- "Anal Reverse Cowgirl" marker (Anal Giver: B, Receiver: C)
- "Anal Sex" marker (Anal Giver: B, Receiver: C)
- "Anal Penetration" marker (Anal Giver: B, Receiver: C)

## Configuration

Derived marker relationships are defined in `app-config.json` under the `derivedMarkers` array:

```json
{
  "derivedMarkers": [
    {
      "sourceTagId": "5318",
      "derivedTagId": "6619",
      "relationshipType": "implies",
      "slotMapping": {
        "Giver": "Giver",
        "Receiver": "Receiver"
      }
    }
  ]
}
```

### Properties

- **sourceTagId**: The more specific tag ID (e.g., "Blowjob")
- **derivedTagId**: The more general tag ID that is implied (e.g., "Oral Sex")
- **relationshipType**: Type of relationship (currently only "implies" is supported)
- **slotMapping**: Maps slot labels from source tag to derived tag
  - Key: slot label in source tag
  - Value: slot label in derived tag
  - Only mapped slots are included in derived markers

## Graph Traversal

The ontology forms a directed acyclic graph (DAG) that can be traversed in two directions:

### Upward Traversal (Source → Derived)
Starting from a specific tag, find all implied general tags:
- "Blowjob" → "Oral Sex" → "Sex Act"
- Use case: Auto-generate parent markers from specific markers

### Downward Traversal (Derived → Source)
Starting from a general tag, find all more specific tags:
- "Oral Sex" → "Blowjob", "Cunnilingus", "Rimming", etc.
- Use case: Tag suggestion, discovery, refinement UI

## Implementation Status

**Current**: Configuration structure defined in `app-config.json`

**Planned**:
- Config loading and validation
- Graph traversal utilities
- UI to display derived markers
- Option to materialize derived markers

## Terminology

**Derived Markers** vs **Stashapp Parent Tags**:
- Derived markers are computed markers based on tag ontology (this feature)
- Stashapp parent tags are Stashapp's built-in tag hierarchy (different system)
- These are separate concepts and should not be confused

## Multi-Level Derivation

The system supports chaining derived markers across multiple levels. For example:
- "Reverse Cowgirl (DP)" → "Reverse Cowgirl" → "Vaginal Sex" → "Vaginal Penetration"

### Configuration

Uses a flat array with automatic chaining detection:

```json
{
  "derivedMarkers": [
    {"sourceTagId": "6890", "derivedTagId": "5120", ...},
    {"sourceTagId": "5120", "derivedTagId": "XXXX", ...}
  ],
  "maxDerivationDepth": 3
}
```

The system processes derivations in multiple passes, automatically detecting when a `derivedTagId` matches another rule's `sourceTagId`.

## Storage

### Tag Ontology Configuration
Tag ontology rules are stored as static configuration in `app-config.json`. This is version-controlled and requires redeployment to update.

### Derivation Graph Database (Option 4: Separate Derivation Graph Table)

Tracks the actual derivation relationships between materialized markers:

```prisma
model Marker {
  id              String
  derivations     MarkerDerivation[] @relation("source")
  derivedFrom     MarkerDerivation[] @relation("derived")
}

model MarkerDerivation {
  id              String   @id @default(cuid())
  sourceMarkerId  String
  derivedMarkerId String
  ruleId          String   // Which config rule created this
  depth           Int      // Level in derivation chain (0=direct, 1=second-level, etc.)
  createdAt       DateTime @default(now())
  source          Marker   @relation("source")
  derived         Marker   @relation("derived")
  @@unique([sourceMarkerId, derivedMarkerId])
}
```

**Benefits**:
- Explicit relationship tracking with full audit trail
- Easy queries: "what derived from this marker?" or "what is this derived from?"
- Tracks which configuration rule created each derivation
- Supports depth tracking for multi-level chains
- No complex recursive queries needed

**Implementation Plan**:
1. Add `MarkerDerivation` table to Prisma schema
2. Update derivation logic to record relationships when materializing markers
3. Add depth tracking during multi-pass derivation processing
4. Support querying derivation chains for display/debugging
