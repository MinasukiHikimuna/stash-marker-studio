// Configuration interfaces only - no environment variable handling
// Configuration is now managed through JSON files and the UI

import { KeyboardShortcutConfig } from './types/keyboard';

export interface AppConfig {
  serverConfig: ServerConfig;
  markerConfig: MarkerConfig;
  markerGroupingConfig: MarkerGroupingConfig;
  markerGroupTagSorting?: MarkerGroupTagSorting;
  videoPlaybackConfig?: VideoPlaybackConfig;
  keyboardShortcuts?: KeyboardShortcutConfig;
  completionDefaults?: CompletionDefaults;
  derivedMarkers?: DerivedMarkerConfig[];
}

export interface CompletionDefaults {
  generateMarkers: boolean;
  addAiReviewedTag: boolean;
  addPrimaryTags: boolean;
  removeCorrespondingTags: boolean;
}

export interface ServerConfig {
  // Stashapp URL.
  url: string;

  // Stashapp API key.
  apiKey: string;
}

export interface MarkerConfig {
  // Tag for markers which have been confirmed.
  statusConfirmed: string;

  // Tag for markers which have been rejected.
  statusRejected: string;

  // Tag for markers which have been created manually.
  sourceManual: string;

  // Tag for scenes which AI analysis has been reviewed.
  aiReviewed: string;
}

export interface MarkerGroupingConfig {
  // Parent tag for marker group tags.
  markerGroupParent: string;
}

export interface MarkerGroupTagSorting {
  // Map of marker group tag IDs to arrays of child tag IDs in desired sort order
  [markerGroupId: string]: string[];
}

export interface VideoPlaybackConfig {
  // Time interval in seconds for small seeks (default: 5)
  smallSeekTime: number;

  // Time interval in seconds for medium seeks (default: 10)
  mediumSeekTime: number;

  // Time interval in seconds for long seeks (default: 30)
  longSeekTime: number;

  // Frame count for small frame steps (default: 1)
  smallFrameStep: number;

  // Frame count for medium frame steps (default: 10)
  mediumFrameStep: number;

  // Frame count for long frame steps (default: 30)
  longFrameStep: number;
}

export interface DerivedMarkerConfig {
  sourceTagId: string;
  derivedTagId: string;
  relationshipType: 'implies' | 'conflicts';
  slotMapping?: Record<string, string>;
}
