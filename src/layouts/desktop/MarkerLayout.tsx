import { VideoPlayer } from "../../components/marker/video/VideoPlayer";
import { MarkerList } from "../../components/marker/list/MarkerList";
import { MarkerHeader } from "../../components/marker/header/MarkerHeader";
import { MarkerSummary } from "../../components/marker/summary/MarkerSummary";
import Timeline from "../../components/Timeline";
import { getActionMarkers } from "../../core/marker/markerLogic";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import {
  selectScene,
  selectMarkers,
  selectSelectedMarkerId,
  selectVideoDuration,
  selectCurrentVideoTime,
  selectIsCreatingMarker,
  selectNewMarkerStartTime,
  selectNewMarkerEndTime,
  selectIsEditingMarker,
  selectFilteredSwimlane,
  setSelectedMarkerId,
  setFilteredSwimlane,
} from "../../store/slices/markerSlice";

import { SceneMarker } from "../../services/StashappService";

export function MarkerLayout() {
  const dispatch = useAppDispatch();
  const scene = useAppSelector(selectScene);
  const markers = useAppSelector(selectMarkers);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const videoDuration = useAppSelector(selectVideoDuration);
  const currentTime = useAppSelector(selectCurrentVideoTime);
  const _isCreatingMarker = useAppSelector(selectIsCreatingMarker);
  const _newMarkerStartTime = useAppSelector(selectNewMarkerStartTime);
  const _newMarkerEndTime = useAppSelector(selectNewMarkerEndTime);
  const _isEditingMarker = useAppSelector(selectIsEditingMarker);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);

  if (!scene || videoDuration === null) {
    return null;
  }

  const actionMarkers = getActionMarkers(markers || [], filteredSwimlane);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <MarkerHeader />

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar with marker list */}
        <div className="w-1/3 flex flex-col border-r border-gray-300 min-h-0">
          <MarkerSummary />
          <MarkerList />
        </div>

        {/* Video player area */}
        <div className="w-2/3 p-6 flex flex-col min-h-0">
          <VideoPlayer />
        </div>
      </div>

      {/* Timeline at the bottom */}
      <div className="border-t border-gray-300 flex-shrink-0">
        <Timeline
          markers={markers || []}
          actionMarkers={actionMarkers}
          videoDuration={videoDuration}
          currentTime={currentTime}
          onMarkerClick={(marker: SceneMarker) => {
            dispatch(setSelectedMarkerId(marker.id));
          }}
          selectedMarkerId={selectedMarkerId}
          filteredSwimlane={filteredSwimlane}
          onSwimlaneFilter={(swimlane: string | null) => {
            dispatch(setFilteredSwimlane(swimlane));
          }}
          scene={scene}
          zoom={1} // We'll handle zoom state in a separate component
        />
      </div>
    </div>
  );
}
