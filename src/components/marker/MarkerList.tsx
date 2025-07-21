"use client";

import React from "react";
import { SceneMarker } from "../../services/StashappService";
import { MarkerListItem } from "./MarkerListItem";
import { type Tag } from "../../services/StashappService";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";

interface MarkerListProps {
  markers: SceneMarker[] | null;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  editingTagId: string;
  availableTags: Tag[];
  incorrectMarkers: IncorrectMarker[];
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  getActionMarkers: () => SceneMarker[];
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
  getActionMarkers,
  onMarkerClick,
  onEditMarker,
  onSaveEditWithTagId,
  onCancelEdit,
  setEditingTagId,
}: MarkerListProps) {
  if (getActionMarkers().length === 0) {
    return (
      <div className="text-gray-400 text-center py-4">
        No markers
      </div>
    );
  }

  return (
    <>
      {getActionMarkers().map((marker: SceneMarker) => (
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
          getActionMarkers={getActionMarkers}
          onMarkerClick={onMarkerClick}
          onEditMarker={onEditMarker}
          onSaveEditWithTagId={onSaveEditWithTagId}
          onCancelEdit={onCancelEdit}
          setEditingTagId={setEditingTagId}
        />
      ))}
    </>
  );
}