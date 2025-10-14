"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectStashUrl } from "@/store/slices/configSlice";
import type { Scene, SceneMarker } from "../../services/StashappService";
import { isMarkerRejected, isMarkerConfirmed } from "../../core/marker/markerLogic";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";
import { navigationPersistence } from "@/utils/navigationPersistence";
import Link from "next/link";

interface MarkerPageHeaderProps {
  scene: Scene | null;
  markers: SceneMarker[] | null;
  incorrectMarkers: IncorrectMarker[];
  isLoading: boolean;
  selectedMarkerId: string | null;
  derivedMarkersCount: number;
  hideDerivedMarkers: boolean;
  checkAllMarkersApproved: () => boolean;
  onDeleteRejected: () => void;
  onOpenCollectModal: () => void;
  onCorrespondingTagConversion: () => void;
  onMaterializeDerived: () => void;
  onComplete: () => void;
  onImportMarkers: () => void;
  onToggleHideDerivedMarkers: () => void;
  onAutoAssignPerformers: () => void;
  onAutoMaterialize: () => void;
}

export function MarkerPageHeader({
  scene,
  markers,
  incorrectMarkers,
  isLoading,
  selectedMarkerId,
  derivedMarkersCount,
  hideDerivedMarkers,
  checkAllMarkersApproved,
  onDeleteRejected,
  onOpenCollectModal,
  onCorrespondingTagConversion,
  onMaterializeDerived,
  onComplete,
  onImportMarkers,
  onToggleHideDerivedMarkers,
  onAutoAssignPerformers,
  onAutoMaterialize,
}: MarkerPageHeaderProps) {
  const router = useRouter();
  const stashUrl = useAppSelector(selectStashUrl);
  
  // Calculate counts for button display
  const rejectedMarkersCount = markers?.filter(isMarkerRejected).length || 0;
  
  // Count confirmed markers that have corresponding tag metadata (simplified check)
  const correspondingTagsCount = markers?.filter(marker => {
    const isConfirmed = isMarkerConfirmed(marker);
    // Check if primary tag description contains "Corresponding Tag:" (case insensitive)
    const description = marker.primary_tag.description || '';
    const hasCorrespondingTag = description.toLowerCase().includes('corresponding tag:');
    
    return isConfirmed && hasCorrespondingTag;
  }).length || 0;

  const handleSwitchScene = useCallback(() => {
    router.push("/search");
  }, [router]);

  const handleSettingsClick = useCallback(() => {
    // Store current page before navigating to settings
    const currentPath = window.location.pathname + window.location.search;
    const title = scene ? `Marker Review - ${scene.title}` : 'Marker Review';
    navigationPersistence.storePreviousPage(currentPath, title);
  }, [scene]);

  const handleDeleteRejectedClick = useCallback(() => {
    // Always open the modal - it will show empty state if no rejected markers
    onDeleteRejected();
  }, [onDeleteRejected]);

  const handleCollectFeedbackClick = useCallback(() => {
    // Always open the modal - it will show empty state if no incorrect markers
    onOpenCollectModal();
  }, [onOpenCollectModal]);

  return (
    <div className="bg-gray-900 text-white px-6 py-4 border-b border-gray-700 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">
              {scene ? scene.title : "Scene Markers"}
            </h1>
            {scene && (
              <a
                href={`${stashUrl}/scenes/${scene.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                View in Stash ↗
              </a>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSwitchScene}
              className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors"
              title="Switch to a different scene"
            >
              Switch Scene
            </button>
            <button
              onClick={onImportMarkers}
              disabled={isLoading || !scene}
              className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Import markers from Stashapp to local database"
            >
              Import Markers
            </button>
            <button
              onClick={onAutoAssignPerformers}
              disabled={isLoading || !scene}
              className="bg-purple-500 hover:bg-purple-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Auto-assign performers to markers with single valid match"
            >
              Auto-Assign Performers
            </button>
            <button
              onClick={onAutoMaterialize}
              disabled={isLoading || !scene}
              className="bg-indigo-500 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              title="Materialize all derived markers at once"
            >
              Auto-Materialize
            </button>
            <button
              onClick={handleDeleteRejectedClick}
              disabled={isLoading}
              title="Delete All Rejected Markers"
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                rejectedMarkersCount > 0
                  ? "bg-red-500 hover:bg-red-700 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              } disabled:bg-gray-600 disabled:cursor-not-allowed`}
            >
              Delete Rejected{" "}
              {rejectedMarkersCount > 0 && `(${rejectedMarkersCount})`}
            </button>
            <button
              onClick={handleCollectFeedbackClick}
              className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
                ${
                  incorrectMarkers.length > 0
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-600 hover:bg-gray-500"
                } text-white`}
            >
              Collect AI Feedback{" "}
              {incorrectMarkers.length > 0 &&
                `(${incorrectMarkers.length})`}
            </button>
            <button
              onClick={onCorrespondingTagConversion}
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                correspondingTagsCount > 0
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              }`}
            >
              Convert Corresponding Tags{" "}
              {correspondingTagsCount > 0 && `(${correspondingTagsCount})`}
            </button>
            <button
              onClick={onMaterializeDerived}
              disabled={!selectedMarkerId || derivedMarkersCount === 0}
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                derivedMarkersCount > 0
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              } disabled:bg-gray-600 disabled:cursor-not-allowed`}
              title={selectedMarkerId ? "Materialize derived markers for selected marker" : "Select a marker first"}
            >
              Materialize{" "}
              {derivedMarkersCount > 0 && `(${derivedMarkersCount})`}
            </button>
            <label className="flex items-center space-x-2 px-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hideDerivedMarkers}
                onChange={onToggleHideDerivedMarkers}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-white">Hide Derived</span>
            </label>
            <button
              onClick={onComplete}
              disabled={isLoading}
              className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                !checkAllMarkersApproved()
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              } disabled:bg-gray-600 disabled:cursor-not-allowed`}
              title={
                !checkAllMarkersApproved()
                  ? "Complete scene (some markers not approved - warnings will be shown)"
                  : "Complete scene (generate markers, mark as reviewed, and clean up tags)"
              }
            >
              {!checkAllMarkersApproved() ? "⚠️ Complete" : "Complete"}
            </button>
          </div>
        </div>
        <div className="flex items-center">
          <Link
            href="/config"
            onClick={handleSettingsClick}
            className="flex items-center justify-center w-10 h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Configuration"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}