"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import type { Scene, SceneMarker } from "../../services/StashappService";
import { isMarkerRejected } from "../../core/marker/markerLogic";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";

interface MarkerPageHeaderProps {
  scene: Scene | null;
  markers: SceneMarker[] | null;
  incorrectMarkers: IncorrectMarker[];
  isLoading: boolean;
  checkAllMarkersApproved: () => boolean;
  onDeleteRejected: () => void;
  onOpenCollectModal: () => void;
  onAIConversion: () => void;
  onComplete: () => void;
}

export function MarkerPageHeader({
  scene,
  markers,
  incorrectMarkers,
  isLoading,
  checkAllMarkersApproved,
  onDeleteRejected,
  onOpenCollectModal,
  onAIConversion,
  onComplete,
}: MarkerPageHeaderProps) {
  const router = useRouter();
  const stashUrl = useAppSelector((state) => state.config.stashUrl);

  const handleSwitchScene = useCallback(() => {
    router.push("/search");
  }, [router]);

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
              onClick={onDeleteRejected}
              disabled={
                isLoading || !markers?.some(isMarkerRejected)
              }
              title="Delete All Rejected Markers"
              className="bg-red-500 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors"
            >
              Delete Rejected
            </button>
            <button
              onClick={onOpenCollectModal}
              className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
                ${
                  incorrectMarkers.length > 0
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-600"
                } text-white`}
              disabled={incorrectMarkers.length === 0}
            >
              Collect AI Feedback{" "}
              {incorrectMarkers.length > 0 &&
                `(${incorrectMarkers.length})`}
            </button>
            <button
              onClick={onAIConversion}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-sm transition-colors"
            >
              Convert AI Tags
            </button>
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
                  : "Complete scene (generate markers, mark as reviewed, and clean up AI tags)"
              }
            >
              {!checkAllMarkersApproved() ? "⚠️ Complete" : "Complete"}
            </button>
          </div>
        </div>
        <div className="flex items-center">
          {/* Space reserved for hamburger menu */}
          <div className="w-10"></div>
        </div>
      </div>
    </div>
  );
}