import { useRef, useEffect } from "react";
import { useMarker } from "../../../contexts/MarkerContext";
import { getActionMarkers } from "../../../core/marker/markerLogic";
import { MarkerItem } from "./MarkerItem";

interface MarkerListProps {
  className?: string;
}

export function MarkerList({ className = "" }: MarkerListProps) {
  const { state } = useMarker();
  const listRef = useRef<HTMLDivElement>(null);

  const actionMarkers = getActionMarkers(
    state.markers || [],
    state.filteredSwimlane
  );

  // Scroll selected marker into view
  useEffect(() => {
    if (listRef.current && state.selectedMarkerIndex >= 0) {
      // Longer delay to ensure all state updates have completed and DOM has updated
      const timeoutId = setTimeout(() => {
        if (listRef.current) {
          const markerElements = listRef.current.children;
          const selectedElement = markerElements[
            state.selectedMarkerIndex
          ] as HTMLElement;

          if (selectedElement) {
            selectedElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [state.selectedMarkerIndex, actionMarkers.length]);

  if (!actionMarkers.length) {
    return (
      <div className={`text-gray-400 text-center py-4 ${className}`}>
        No markers
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={`overflow-y-auto flex-1 px-4 min-h-0 ${className}`}
      data-testid="marker-list"
    >
      {actionMarkers.map((marker, index) => (
        <MarkerItem
          key={marker.id}
          marker={marker}
          index={index}
          isSelected={index === state.selectedMarkerIndex}
        />
      ))}
    </div>
  );
}
