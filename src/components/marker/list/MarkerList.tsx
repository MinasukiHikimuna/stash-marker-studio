import { useEffect, useRef } from "react";
import { useAppSelector } from "../../../store/hooks";
import { selectMarkers, selectFilteredSwimlane, selectSelectedMarkerId } from "../../../store/slices/markerSlice";
import { getActionMarkers } from "../../../core/marker/markerLogic";
import { MarkerItem } from "./MarkerItem";

type MarkerListProps = {
  className?: string;
};

export function MarkerList({ className = "" }: MarkerListProps) {
  const markers = useAppSelector(selectMarkers);
  const filteredSwimlane = useAppSelector(selectFilteredSwimlane);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const listRef = useRef<HTMLDivElement>(null);

  const actionMarkers = getActionMarkers(
    markers || [],
    filteredSwimlane
  );

  // Scroll selected marker into view
  useEffect(() => {
    if (listRef.current && selectedMarkerId) {
      // Longer delay to ensure all state updates have completed and DOM has updated
      const timeoutId = setTimeout(() => {
        if (listRef.current) {
          const selectedElement = listRef.current.querySelector(
            `[data-marker-id="${selectedMarkerId}"]`
          ) as HTMLElement;

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
  }, [selectedMarkerId]);

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
      {actionMarkers.map((marker) => (
        <MarkerItem
          key={marker.id}
          marker={marker}
          isSelected={marker.id === selectedMarkerId}
        />
      ))}
    </div>
  );
}
