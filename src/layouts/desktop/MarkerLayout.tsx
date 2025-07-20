import { VideoPlayer } from "../../components/marker/video/VideoPlayer";
import { MarkerList } from "../../components/marker/list/MarkerList";
import { MarkerHeader } from "../../components/marker/header/MarkerHeader";
import { MarkerSummary } from "../../components/marker/summary/MarkerSummary";
import Timeline from "../../components/Timeline";
import { useMarker } from "../../contexts/MarkerContext";
import { getActionMarkers } from "../../core/marker/markerLogic";

import { SceneMarker } from "../../services/StashappService";

export function MarkerLayout() {
  const { state, dispatch } = useMarker();

  if (!state.scene) {
    return null;
  }

  const actionMarkers = getActionMarkers(
    state.markers || [],
    state.filteredSwimlane
  );

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
          markers={state.markers || []}
          actionMarkers={actionMarkers}
          selectedMarker={
            actionMarkers && actionMarkers.length > 0 && state.selectedMarkerId
              ? actionMarkers.find((m) => m.id === state.selectedMarkerId) ||
                null
              : null
          }
          videoDuration={state.videoDuration}
          currentTime={state.currentVideoTime}
          onMarkerClick={(marker: SceneMarker) => {
            dispatch({ type: "SET_SELECTED_MARKER_ID", payload: marker.id });
          }}
          selectedMarkerId={state.selectedMarkerId}
          isCreatingMarker={state.isCreatingMarker}
          newMarkerStartTime={state.newMarkerStartTime}
          newMarkerEndTime={state.newMarkerEndTime}
          isEditingMarker={state.isEditingMarker}
          filteredSwimlane={state.filteredSwimlane}
          onSwimlaneFilter={(swimlane: string | null) => {
            dispatch({ type: "SET_FILTERED_SWIMLANE", payload: swimlane });
          }}
          scene={state.scene}
          zoom={1} // We'll handle zoom state in a separate component
        />
      </div>
    </div>
  );
}
