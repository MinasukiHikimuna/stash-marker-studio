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

### Marker Confirmation and Rejection

#### Overview

The marker confirmation and rejection system allows users to approve or reject markers during review. The system uses toggle behavior where repeated presses of the same key cycle between the action state and unprocessed.

#### Key Concepts

- **Confirmed markers**: Markers approved by the user, tagged with MARKER_STATUS_CONFIRMED
- **Rejected markers**: Markers rejected by the user, tagged with MARKER_STATUS_REJECTED
- **Toggle behavior**: Repeated confirm/reject actions toggle the marker back to unprocessed
- **State cycling**: Actions cycle through states rather than being idempotent

#### Confirmation/Rejection Shortcuts

##### Confirm Marker

- **Default key**: `Z`
- **Function**: Toggle marker between confirmed and unprocessed states
- **Behavior**: 
  - Unprocessed → Confirmed (adds MARKER_STATUS_CONFIRMED tag)
  - Confirmed → Unprocessed (removes MARKER_STATUS_CONFIRMED tag)
  - Rejected → Confirmed (removes MARKER_STATUS_REJECTED, adds MARKER_STATUS_CONFIRMED)

##### Reject Marker

- **Default key**: `X`
- **Function**: Toggle marker between rejected and unprocessed states
- **Behavior**: 
  - Unprocessed → Rejected (adds MARKER_STATUS_REJECTED tag)
  - Rejected → Unprocessed (removes MARKER_STATUS_REJECTED tag)
  - Confirmed → Rejected (removes MARKER_STATUS_CONFIRMED, adds MARKER_STATUS_REJECTED)

#### Behavior Specifications

##### State Transitions

- **From Unprocessed**: Z confirms, X rejects
- **From Confirmed**: Z toggles back to unprocessed, X changes to rejected
- **From Rejected**: X toggles back to unprocessed, Z changes to confirmed
- **Toggle behavior**: Repeated presses of the same key toggle between that state and unprocessed

##### Expected User Experience

1. Users can quickly confirm markers they approve using Z
2. Users can quickly reject markers they disapprove using X
3. Users can toggle markers back to unprocessed by pressing the same key again
4. State changes follow predictable toggle patterns
5. Users can easily correct mistakes by repeating the same action
