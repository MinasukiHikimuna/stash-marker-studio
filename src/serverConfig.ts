// Configuration interfaces only - no environment variable handling
// Configuration is now managed through JSON files and the UI

import { KeyboardShortcutConfig } from './types/keyboard';

export interface AppConfig {
  serverConfig: ServerConfig;
  markerConfig: MarkerConfig;
  markerGroupingConfig: MarkerGroupingConfig;
  shotBoundaryConfig: ShotBoundaryConfig;
  keyboardShortcuts?: KeyboardShortcutConfig;
  completionDefaults?: CompletionDefaults;
}

export interface CompletionDefaults {
  deleteVideoCutMarkers: boolean;
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

export interface ShotBoundaryConfig {
  // Tag for scenes which have been AI analyzed.
  aiTagged: string;
  
  // Tag for markers which indicate a shot boundary.
  shotBoundary: string;
  
  // Tag for markers to indicate that the source of the marker is shot boundary analysis and not e.g. manual or AI.
  sourceShotBoundaryAnalysis: string;
  
  // Tag for scenes which have been processed with shot boundary analysis.
  shotBoundaryProcessed: string;
}
