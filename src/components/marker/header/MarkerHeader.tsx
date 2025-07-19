import { useMarker } from "../../../contexts/MarkerContext";
import { useConfig } from "@/contexts/ConfigContext";
import { useRouter } from "next/navigation";
import { useMarkerOperations } from "@/hooks/useMarkerOperations";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../../core/marker/markerLogic";

interface MarkerHeaderProps {
  className?: string;
}

export function MarkerHeader({ className = "" }: MarkerHeaderProps) {
  const { state, dispatch } = useMarker();
  const { STASH_URL } = useConfig();
  const router = useRouter();
  const { deleteRejectedMarkers } = useMarkerOperations({ state, dispatch });

  const handleDeleteRejectedMarkers = async () => {
    if (state.markers?.some(isMarkerRejected)) {
      await deleteRejectedMarkers();
    }
  };

  const handleAIConversion = () => {
    dispatch({ type: "SET_AI_CONVERSION_MODAL_OPEN", payload: true });
  };

  const handleComplete = () => {
    dispatch({ type: "SET_GENERATING_MARKERS", payload: true });
  };

  return (
    <div
      className={`bg-gray-900 text-white px-6 py-4 border-b border-gray-700 flex-shrink-0 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">
              {state.scene ? state.scene.title : "Scene Markers"}
            </h1>
            {state.scene && (
              <a
                href={`${STASH_URL}/scenes/${state.scene.id}`}
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
            disabled={state.isLoading || !state.markers?.some(isMarkerRejected)}
            title="Delete All Rejected Markers"
            className="bg-red-500 hover:bg-red-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Delete Rejected
          </button>
          <button
            onClick={() =>
              dispatch({ type: "SET_COLLECTING_MODAL_OPEN", payload: true })
            }
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors
              ${
                state.incorrectMarkers.length > 0
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-600"
              } text-white`}
            disabled={state.incorrectMarkers.length === 0}
          >
            Collect AI Feedback{" "}
            {state.incorrectMarkers.length > 0 &&
              `(${state.incorrectMarkers.length})`}
          </button>
          <button
            onClick={handleAIConversion}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-sm transition-colors"
          >
            Convert AI Tags
          </button>
          <button
            onClick={handleComplete}
            disabled={state.isLoading}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              !state.markers?.every(
                (m) => isMarkerRejected(m) || isMarkerConfirmed(m)
              )
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
            title={
              !state.markers?.every(
                (m) => isMarkerRejected(m) || isMarkerConfirmed(m)
              )
                ? "Complete scene (some markers not approved - warnings will be shown)"
                : "Complete scene (generate markers, mark as reviewed, and clean up AI tags)"
            }
          >
            {!state.markers?.every(
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
