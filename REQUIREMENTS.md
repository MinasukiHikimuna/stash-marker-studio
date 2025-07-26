# Requirements Documentation

## Marker page

### Unprocessed Marker Navigation

#### Overview

The unprocessed marker navigation system provides keyboard shortcuts for efficiently navigating between markers that need review (unprocessed markers) in the timeline. The system respects swimlane organization and implements strict boundary behavior.

#### Key Concepts

- **Unprocessed markers**: Markers that have not been confirmed or rejected by the user
- **Swimlane-scoped navigation**: Navigation within the currently selected marker's swimlane only
- **Global navigation**: Cross-swimlane navigation that searches all swimlanes in order
- **No rollover**: Navigation stops at boundaries instead of wrapping around to the beginning/end

#### Navigation Shortcuts

##### Previous Unprocessed (Swimlane Scoped)

- **Default key**: `N`
- **Function**: Navigate to the previous unprocessed marker within the current swimlane
- **Scope**: Current swimlane only
- **Boundary behavior**: If already at the first unprocessed marker in the swimlane, selection remains unchanged
- **Search direction**: Backwards in time within the swimlane

##### Next Unprocessed (Swimlane Scoped)

- **Default key**: `M`
- **Function**: Navigate to the next unprocessed marker within the current swimlane
- **Scope**: Current swimlane only
- **Boundary behavior**: If already at the last unprocessed marker in the swimlane, selection remains unchanged
- **Search direction**: Forwards in time within the swimlane

##### Previous Unprocessed (Global)

- **Default key**: `Shift+N`
- **Function**: Navigate to the previous unprocessed marker across all swimlanes
- **Scope**: All swimlanes
- **Search pattern**: Searches backwards through swimlanes (bottom-to-top in UI, right-to-left in time)
- **Boundary behavior**: Stops at the first unprocessed marker globally, no wrap-around

##### Next Unprocessed (Global)

- **Default key**: `Shift+M`
- **Function**: Navigate to the next unprocessed marker across all swimlanes
- **Scope**: All swimlanes
- **Search pattern**: Searches forwards through swimlanes (top-to-bottom in UI, left-to-right in time)
- **Boundary behavior**: Stops at the last unprocessed marker globally, no wrap-around

#### Behavior Specifications

##### Initial Selection

- On page load, automatically selects the first unprocessed marker found in swimlane order
- Waits for timeline data to be fully loaded before attempting selection
- Does not fall back to chronological selection if swimlane data is unavailable

##### Search Order

- **Within swimlanes**: Markers are ordered by timestamp (earliest to latest)
- **Between swimlanes**: Follows the visual swimlane order (top-to-bottom in UI)
- **Global navigation**: Respects both temporal order within swimlanes and swimlane hierarchy

##### Edge Cases

- If no unprocessed markers exist, navigation commands have no effect
- If current marker is the only unprocessed marker in scope, selection remains unchanged
- When current swimlane has no additional unprocessed markers, global navigation continues to adjacent swimlanes

#### Expected User Experience

1. Users can quickly review unprocessed markers within a specific category using N/M keys
2. Users can jump between categories to find the next unprocessed marker using Shift+N/M
3. Navigation is predictable and never "wraps around" unexpectedly
4. The system provides efficient workflow for marker review tasks
