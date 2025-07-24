import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectMarkers,
  selectScene,
  selectMarkerLoading,
  selectIncorrectMarkers,
  deleteRejectedMarkers,
  setAIConversionModalOpen,
  setCollectingModalOpen,
  setGeneratingMarkers,
  selectSceneId,
} from "@/store/slices/markerSlice";
import { selectStashUrl } from "@/store/slices/configSlice";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../../core/marker/markerLogic";

interface MarkerHeaderProps {
  className?: string;
}

export function MarkerHeader({ className = "" }: MarkerHeaderProps) {
  const dispatch = useAppDispatch();
  const stashUrl = useAppSelector(selectStashUrl);
  const router = useRouter();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const sceneId = useAppSelector(selectSceneId);
  const isLoading = useAppSelector(selectMarkerLoading);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);

  const handleDeleteRejectedMarkers = async () => {
    const rejectedMarkerIds = markers
      .filter(isMarkerRejected)
      .map(m => m.id);
      
    if (rejectedMarkerIds.length > 0 && sceneId) {
      await dispatch(deleteRejectedMarkers({ sceneId, rejectedMarkerIds }));
    }
  };

  const handleAIConversion = () => {
    dispatch(setAIConversionModalOpen(true));
  };

  const handleComplete = () => {
    dispatch(setGeneratingMarkers(true));
  };

  return (
    <div
      className={`bg-gray-900 text-white px-6 py-4 border-b border-gray-700 flex-shrink-0 ${className}`}
    >
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

          <button
            onClick={() => router.push("/search")}
            className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors"
            title="Switch to a different scene"
          >
            Switch Scene
          </button>
          <button
            onClick={handleDeleteRejectedMarkers}
            disabled={isLoading || !markers?.some(isMarkerRejected)}
            title="Delete All Rejected Markers"
            className="bg-red-500 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Delete Rejected
          </button>
          <button
            onClick={() => dispatch(setCollectingModalOpen(true))}
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
            onClick={handleAIConversion}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-sm transition-colors"
          >
            Convert AI Tags
          </button>
          <button
            onClick={handleComplete}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              !markers?.every(
                (m) => isMarkerRejected(m) || isMarkerConfirmed(m)
              )
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
            title={
              !markers?.every(
                (m) => isMarkerRejected(m) || isMarkerConfirmed(m)
              )
                ? "Complete scene (some markers not approved - warnings will be shown)"
                : "Complete scene (generate markers, mark as reviewed, and clean up AI tags)"
            }
          >
            {!markers?.every(
              (m) => isMarkerRejected(m) || isMarkerConfirmed(m)
            )
              ? "⚠️ Complete"
              : "Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
