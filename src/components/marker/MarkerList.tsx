"use client";

import React, { useMemo } from "react";
import { SceneMarker, type Tag } from "../../services/StashappService";
import { MarkerListItem } from "./MarkerListItem";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";
import { useAppSelector } from "../../store/hooks";
import { selectMarkerGroups, selectMarkerGroupTagSorting, selectCorrespondingTagMappings } from "../../store/slices/configSlice";
import { groupMarkersByTags, getMarkerGroupName } from "../../core/marker/markerGrouping";
import { selectAllTags } from "../../store/slices/searchSlice";

interface MarkerListProps {
  markers: SceneMarker[] | null;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  editingTagId: string;
  availableTags: Tag[];
  incorrectMarkers: IncorrectMarker[];
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  onMarkerClick: (marker: SceneMarker) => void;
  onEditMarker: (marker: SceneMarker) => void;
  onSaveEditWithTagId: (marker: SceneMarker, tagId?: string) => Promise<void>;
  onCancelEdit: () => void;
  setEditingTagId: (tagId: string) => void;
}

export function MarkerList({
  markers,
  selectedMarkerId,
  editingMarkerId,
  editingTagId,
  availableTags,
  incorrectMarkers,
  videoElementRef,
  onMarkerClick,
  onEditMarker,
  onSaveEditWithTagId,
  onCancelEdit,
  setEditingTagId,
}: MarkerListProps) {
  const markerGroups = useAppSelector(selectMarkerGroups);
  const tagSorting = useAppSelector(selectMarkerGroupTagSorting);
  const correspondingTagMappings = useAppSelector(selectCorrespondingTagMappings);
  const allTags = useAppSelector(selectAllTags);

  // Memoize tagGroups to prevent unnecessary re-sorting
  const tagGroups = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    return groupMarkersByTags(markers, null, markerGroups, tagSorting, correspondingTagMappings, allTags);
  }, [markers, markerGroups, tagSorting, correspondingTagMappings, allTags]);

  if (!markers || markers.length === 0) {
    return (
      <div className="text-gray-400 text-center py-4">
        No markers
      </div>
    );
  }

  return (
    <>
      {tagGroups.map((group) => {
        const markerGroup = getMarkerGroupName(group.markers[0]);

        return (
          <div key={group.name}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-2 py-1 mb-2 text-sm text-gray-300 bg-gray-800 rounded">
              {markerGroup && (
                <span className="text-xs text-blue-300">
                  {markerGroup.displayName}:
                </span>
              )}
              <span className="font-medium">
                {group.name}
                {group.isRejected && " (Rejected)"}
              </span>
              <span className="text-xs text-gray-400">
                ({group.markers.length} marker{group.markers.length !== 1 ? 's' : ''})
              </span>
            </div>

            {/* Markers in this group - already sorted by time in groupMarkersByTags */}
            {group.markers.map((marker: SceneMarker) => (
              <MarkerListItem
                key={marker.id}
                marker={marker}
                selectedMarkerId={selectedMarkerId}
                editingMarkerId={editingMarkerId}
                editingTagId={editingTagId}
                availableTags={availableTags}
                incorrectMarkers={incorrectMarkers}
                videoElementRef={videoElementRef}
                markers={markers}
                onMarkerClick={onMarkerClick}
                onEditMarker={onEditMarker}
                onSaveEditWithTagId={onSaveEditWithTagId}
                onCancelEdit={onCancelEdit}
                setEditingTagId={setEditingTagId}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}