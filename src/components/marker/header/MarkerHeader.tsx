import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectMarkers,
  selectScene,
  selectMarkerLoading,
  selectIncorrectMarkers,
  setGeneratingMarkers,
  openCollectingModal,
  openDeleteRejectedModal,
  openCorrespondingTagConversionModal,
  setError,
} from "@/store/slices/markerSlice";
import { selectStashUrl, selectCorrespondingTagMappings } from "@/store/slices/configSlice";
import {
  isMarkerConfirmed,
  isMarkerRejected,
} from "../../../core/marker/markerLogic";
import { stashappService } from "../../../services/StashappService";

interface MarkerHeaderProps {
  className?: string;
}

export function MarkerHeader({ className = "" }: MarkerHeaderProps) {
  const dispatch = useAppDispatch();
  const stashUrl = useAppSelector(selectStashUrl);
  const correspondingTagMappings = useAppSelector(selectCorrespondingTagMappings);
  const router = useRouter();

  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const isLoading = useAppSelector(selectMarkerLoading);
  const incorrectMarkers = useAppSelector(selectIncorrectMarkers);
  
  // Handle corresponding tag conversion
  const handleCorrespondingTagConversion = async () => {
    if (!markers || markers.length === 0) return;

    try {
      const markersToConvert = await stashappService.convertConfirmedMarkersWithCorrespondingTags(
        markers
      );
      dispatch(openCorrespondingTagConversionModal({ markers: markersToConvert }));
    } catch (err) {
      console.error("Error preparing corresponding tag conversion:", err);
      dispatch(setError("Failed to prepare markers for conversion"));
    }
  };
  
  // Calculate counts for button display
  const rejectedMarkersCount = markers?.filter(isMarkerRejected).length || 0;

  // Count confirmed markers that have corresponding tag mappings in database
  const correspondingTagsCount = markers?.filter(marker => {
    const isConfirmed = isMarkerConfirmed(marker);
    // Check if this tag has a corresponding tag mapping in the database
    const tagId = parseInt(marker.primary_tag.id);
    const hasCorrespondingTag = tagId in correspondingTagMappings;

    return isConfirmed && hasCorrespondingTag;
  }).length || 0;

  const handleDeleteRejectedClick = () => {
    // Always open the modal - it will show empty state if no rejected markers
    const rejectedMarkers = markers.filter(isMarkerRejected);
    dispatch(openDeleteRejectedModal({ rejectedMarkers }));
  };

  const handleCollectFeedbackClick = () => {
    // Always open the modal - it will show empty state if no incorrect markers
    dispatch(openCollectingModal());
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
            onClick={handleCorrespondingTagConversion}
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
                : "Complete scene (generate markers, mark as reviewed, and clean up tags)"
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
