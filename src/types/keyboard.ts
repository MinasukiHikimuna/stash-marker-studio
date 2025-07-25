export interface KeyBinding {
  key: string;                 // Main key (e.g., "z", "Space", "ArrowUp")
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

export type ShortcutCategory = 
  | "marker.review"
  | "marker.create"
  | "marker.edit"
  | "navigation"
  | "video.playback"
  | "video.jump"
  | "system";

export interface ShortcutAction {
  type: "redux" | "function" | "composite";
  reduxAction?: string;        // Redux action type
  functionName?: string;       // Function to call
  params?: unknown;           // Additional parameters
}

export interface KeyboardShortcut {
  id: string;                  // Unique identifier (e.g., "marker.confirm", "video.playPause")
  bindings: KeyBinding[];      // Multiple key combinations for the same action
  description: string;         // Human-readable description
  category: ShortcutCategory;  // For grouping in UI
  action: ShortcutAction;      // What to execute
  enabled: boolean;            // Can be disabled
  editable: boolean;          // Some shortcuts might be system-critical
}

export interface KeyboardShortcutConfig {
  [actionId: string]: {
    bindings: KeyBinding[];
    enabled?: boolean;
  };
}

export interface ShortcutLookupMap {
  [keyCombo: string]: string; // keyCombo -> actionId
}