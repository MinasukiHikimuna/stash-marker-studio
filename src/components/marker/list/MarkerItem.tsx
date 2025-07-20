import { useAppDispatch } from "../../../store/hooks";
import { setSelectedMarkerId } from "../../../store/slices/markerSlice";
import { type SceneMarker } from "../../../services/StashappService";
import { getMarkerStatus } from "../../../core/marker/markerLogic";
import { MarkerStatus } from "../../../core/marker/types";
import { formatSeconds } from "../../../core/marker/markerLogic";

type MarkerItemProps = {
  marker: SceneMarker;
  isSelected: boolean;
};

export function MarkerItem({ marker, isSelected }: MarkerItemProps) {
  const dispatch = useAppDispatch();

  const handleClick = () => {
    console.log("Selecting marker:", {
      markerId: marker.id,
      markerTag: marker.primary_tag.name,
      markerStart: marker.seconds,
      markerEnd: marker.end_seconds,
      reason: "marker list click",
    });
    dispatch(setSelectedMarkerId(marker.id));
  };

  const getMarkerStatusClass = () => {
    const status = getMarkerStatus(marker);
    switch (status) {
      case MarkerStatus.REJECTED:
        return "bg-red-900 text-red-100";
      case MarkerStatus.CONFIRMED:
      case MarkerStatus.MANUAL:
        return "bg-green-900 text-green-100";
      default:
        return "bg-gray-700 text-gray-100";
    }
  };

  const getMarkerStatusIcon = () => {
    const status = getMarkerStatus(marker);
    switch (status) {
      case MarkerStatus.REJECTED:
        return "✗";
      case MarkerStatus.CONFIRMED:
      case MarkerStatus.MANUAL:
        return "✓";
      default:
        return "?";
    }
  };

  return (
    <div
      data-marker-id={marker.id}
      className={`p-2 border-l-4 ${
        isSelected
          ? "bg-gray-700 text-white border-blue-500"
          : "hover:bg-gray-600 hover:text-white border-transparent"
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center">
        <span className={`mr-2 ${getMarkerStatusClass()}`}>
          {getMarkerStatusIcon()}
        </span>
        <span className="font-bold">{marker.primary_tag.name}</span>
        <span className="text-sm text-gray-400 ml-2">
          {marker.end_seconds
            ? `${formatSeconds(marker.seconds, true)} - ${formatSeconds(
                marker.end_seconds,
                true
              )}`
            : formatSeconds(marker.seconds, true)}
        </span>
      </div>
    </div>
  );
}
