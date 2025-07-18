import { SceneMarker } from "../../../services/StashappService";
import { useMarker } from "../../../contexts/MarkerContext";
import {
  formatSeconds,
  isMarkerConfirmed,
  isMarkerRejected,
  isMarkerManual,
} from "../../../core/marker/markerLogic";

interface MarkerItemProps {
  marker: SceneMarker;
  index: number;
  isSelected: boolean;
}

export function MarkerItem({ marker, index, isSelected }: MarkerItemProps) {
  const { state, dispatch } = useMarker();

  const handleClick = () => {
    dispatch({ type: "SET_SELECTED_MARKER_INDEX", payload: index });
    if (state.videoElement) {
      state.videoElement.currentTime = marker.seconds;
    }
  };

  const getMarkerStatusClass = () => {
    if (isMarkerRejected(marker)) {
      return "bg-red-900 text-red-100";
    }
    if (isMarkerConfirmed(marker) || isMarkerManual(marker)) {
      return "bg-green-900 text-green-100";
    }
    return "bg-gray-700 text-gray-100";
  };

  const getMarkerStatusIcon = () => {
    if (isMarkerRejected(marker)) {
      return "✗";
    }
    if (isMarkerConfirmed(marker) || isMarkerManual(marker)) {
      return "✓";
    }
    return "?";
  };

  return (
    <div
      className={`p-3 mb-2 rounded-sm cursor-pointer transition-colors ${getMarkerStatusClass()} ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm">
            {formatSeconds(marker.seconds, true)}
          </span>
          {marker.end_seconds && (
            <>
              <span>-</span>
              <span className="font-mono text-sm">
                {formatSeconds(marker.end_seconds, true)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`text-sm font-medium ${
              marker.primary_tag.name.endsWith("_AI")
                ? "text-purple-300"
                : "text-white"
            }`}
          >
            {marker.primary_tag.name}
          </span>
          <span
            className={`ml-2 ${
              isMarkerRejected(marker)
                ? "text-red-300"
                : isMarkerConfirmed(marker) || isMarkerManual(marker)
                ? "text-green-300"
                : "text-gray-300"
            }`}
          >
            {getMarkerStatusIcon()}
          </span>
        </div>
      </div>
    </div>
  );
}
