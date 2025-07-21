"use client";

import { useCallback } from "react";
import type { SceneMarker } from "../../services/StashappService";

interface MarkerSummaryStats {
  confirmed: number;
  rejected: number;
  unknown: number;
}

interface MarkerSummaryProps {
  filteredSwimlane: string | null;
  markerSummary: MarkerSummaryStats;
  shotBoundariesCount: number;
  markers: SceneMarker[] | null;
  isCreatingMarker: boolean;
  isDuplicatingMarker: boolean;
  selectedMarkerId: string | null;
  onClearFilter: () => void;
  onCreateMarker: () => void;
  onSplitMarker: () => void;
  onShowShortcuts: () => void;
  getActionMarkers: () => SceneMarker[];
  createOrDuplicateMarker: (sourceMarker?: SceneMarker) => void;
}

export function MarkerSummary({
  filteredSwimlane,
  markerSummary,
  shotBoundariesCount,
  markers,
  isCreatingMarker,
  isDuplicatingMarker,
  selectedMarkerId,
  onClearFilter,
  onCreateMarker,
  onSplitMarker,
  onShowShortcuts,
  getActionMarkers,
  createOrDuplicateMarker,
}: MarkerSummaryProps) {
  const handleDuplicateClick = useCallback(() => {
    const actionMarkers = getActionMarkers();
    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) {
      console.log(
        "Cannot duplicate marker: No current marker found"
      );
      return;
    }
    createOrDuplicateMarker(currentMarker);
  }, [getActionMarkers, selectedMarkerId, createOrDuplicateMarker]);

  const isMarkerActionDisabled = isCreatingMarker ||
    isDuplicatingMarker ||
    markers?.some((m) => m.id.startsWith("temp-"));

  return (
    <div
      className="bg-gray-700 p-4 mb-4 rounded-none flex items-center justify-between sticky top-0 z-10"
      data-testid="marker-summary"
    >
      <div className="flex items-center space-x-4">
        {filteredSwimlane && (
          <div className="flex items-center bg-yellow-600 text-yellow-100 px-2 py-1 rounded-sm text-xs">
            <span className="mr-1">🔍</span>
            <span>Filtered: {filteredSwimlane}</span>
            <button
              onClick={onClearFilter}
              className="ml-2 text-yellow-200 hover:text-white"
              title="Clear filter"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center">
          <span className="text-green-400 mr-1">✓</span>
          <span className="text-white">
            {markerSummary.confirmed}
          </span>
        </div>
        <div className="flex items-center">
          <span className="text-red-400 mr-1">✗</span>
          <span className="text-white">
            {markerSummary.rejected}
          </span>
        </div>
        <div className="flex items-center">
          <span className="text-yellow-400 mr-1">?</span>
          <span className="text-white">
            {markerSummary.unknown}
          </span>
        </div>
        {shotBoundariesCount > 0 && (
          <div className="flex items-center">
            <span className="text-gray-400 mr-1">🎥</span>
            <span className="text-white text-xs">
              {shotBoundariesCount} shots
            </span>
          </div>
        )}
      </div>
      {/* Compact marker action buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onCreateMarker}
          disabled={isMarkerActionDisabled}
          title="Create New Marker (A)"
          className={`px-2 py-1 rounded-sm text-xs flex items-center ${
            isMarkerActionDisabled
              ? "bg-gray-500 cursor-not-allowed text-gray-300"
              : "bg-green-500 hover:bg-green-700 text-white"
          }`}
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 0v3m0-3h3m-3 0H9m9 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          New
        </button>
        <button
          onClick={onSplitMarker}
          title="Split Current Marker (S)"
          className="bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded-sm text-xs flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
          Split
        </button>
        <button
          onClick={handleDuplicateClick}
          disabled={isMarkerActionDisabled}
          title="Duplicate Current Marker (D)"
          className={`px-2 py-1 rounded-sm text-xs flex items-center ${
            isMarkerActionDisabled
              ? "bg-gray-500 cursor-not-allowed text-gray-300"
              : "bg-indigo-500 hover:bg-indigo-700 text-white"
          }`}
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <rect
              x="9"
              y="9"
              width="13"
              height="13"
              rx="2"
              ry="2"
            />
            <rect
              x="1"
              y="1"
              width="13"
              height="13"
              rx="2"
              ry="2"
            />
          </svg>
          Duplicate
        </button>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={onShowShortcuts}
          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-sm text-sm transition-colors flex items-center space-x-1"
          title="Show keyboard shortcuts"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <span>Shortcuts</span>
        </button>
      </div>
    </div>
  );
}