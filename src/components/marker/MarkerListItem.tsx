"use client";

import React from "react";
import { SceneMarker } from "../../services/StashappService";
import { formatSeconds, isMarkerConfirmed, isMarkerRejected } from "../../core/marker/markerLogic";
import { TagAutocomplete } from "./TagAutocomplete";
import { TempMarkerForm } from "./TempMarkerForm";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setMarkers,
  setSelectedMarkerId,
  setCreatingMarker,
  setDuplicatingMarker,
  setError,
  createMarker,
  selectDerivedMarkerIds,
  selectSourceMarkerIds,
} from "../../store/slices/markerSlice";
import { selectMarkerStatusConfirmed, selectMarkerStatusRejected } from "@/store/slices/configSlice";
import { type Tag } from "../../services/StashappService";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";

interface MarkerListItemProps {
  marker: SceneMarker;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  editingTagId: string;
  availableTags: Tag[];
  incorrectMarkers: IncorrectMarker[];
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  markers: SceneMarker[] | null;
  onMarkerClick: (marker: SceneMarker) => void;
  onEditMarker: (marker: SceneMarker) => void;
  onSaveEditWithTagId: (marker: SceneMarker, tagId?: string) => Promise<void>;
  onCancelEdit: () => void;
  setEditingTagId: (tagId: string) => void;
}

export function MarkerListItem({
  marker,
  selectedMarkerId,
  editingMarkerId,
  editingTagId,
  availableTags,
  incorrectMarkers,
  videoElementRef,
  markers,
  onMarkerClick,
  onEditMarker,
  onSaveEditWithTagId,
  onCancelEdit,
  setEditingTagId,
}: MarkerListItemProps) {
  const dispatch = useAppDispatch();
  const markerStatusConfirmed = useAppSelector(selectMarkerStatusConfirmed);
  const markerStatusRejected = useAppSelector(selectMarkerStatusRejected);
  const derivedMarkerIds = useAppSelector(selectDerivedMarkerIds);
  const sourceMarkerIds = useAppSelector(selectSourceMarkerIds);

  const isEditing = editingMarkerId === marker.id;
  const isSelected = marker.id === selectedMarkerId;
  const isTemp = marker.id === "temp-new" || marker.id === "temp-duplicate";
  const isDerivedFromSelected = sourceMarkerIds.has(marker.id);
  const isSourceForSelected = derivedMarkerIds.has(marker.id);


  // Determine status-based highlighting for derived markers
  const isConfirmed = isMarkerConfirmed(marker);
  const isRejected = isMarkerRejected(marker);

  const getDerivedHighlightClasses = () => {
    if (isRejected) {
      return "bg-red-800 border-red-500 hover:bg-red-700";
    } else if (isConfirmed) {
      return "bg-green-800 border-green-500 hover:bg-green-700";
    } else {
      // Unprocessed
      return "bg-yellow-800 border-yellow-500 hover:bg-yellow-700";
    }
  };

  // Determine which CSS classes to apply
  let appliedClasses = "";
  if (isTemp) {
    appliedClasses = "bg-blue-800 border-blue-400";
  } else if (isSelected) {
    appliedClasses = "bg-gray-700 text-white border-blue-500";
  } else if (isSourceForSelected || isDerivedFromSelected) {
    appliedClasses = getDerivedHighlightClasses();
  } else if (incorrectMarkers.some((m) => m.markerId === marker.id)) {
    appliedClasses = "bg-purple-900/50 border-purple-500 hover:bg-purple-800";
  } else {
    appliedClasses = "hover:bg-gray-600 hover:text-white border-transparent";
  }

  return (
    <div
      key={marker.id}
      data-marker-id={marker.id}
      className={`p-2 border-l-4 ${appliedClasses}`}
      onClick={() => onMarkerClick(marker)}
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
    >
      {isTemp ? (
        <TempMarkerForm
          marker={marker}
          availableTags={availableTags}
          videoElement={videoElementRef.current}
          onSave={async (newStart, newEnd, newTagId) => {
            try {
              // Remove temp markers first
              const realMarkers = (markers || []).filter(
                (m) => !m.id.startsWith("temp-")
              );
              dispatch(setMarkers(realMarkers));

              // Create marker using Redux thunk (selection is handled automatically)
              await dispatch(createMarker({
                sceneId: marker.scene.id,
                startTime: newStart,
                endTime: newEnd ?? null,
                tagId: newTagId,
              })).unwrap();

              // Clear UI flags
              dispatch(setCreatingMarker(false));
              dispatch(setDuplicatingMarker(false));
            } catch (error) {
              console.error("Error creating marker:", error);
              dispatch(setError(`Failed to create marker: ${error}`));

              // Clean up on error - remove temp markers and clear flags
              const realMarkers = (markers || []).filter(
                (m) => !m.id.startsWith("temp-")
              );
              dispatch(setMarkers(realMarkers));
              dispatch(setCreatingMarker(false));
              dispatch(setDuplicatingMarker(false));
            }
          }}
          onCancel={() => {
            // Remove temp marker
            const realMarkers = (markers || []).filter(
              (m) => !m.id.startsWith("temp-")
            );
            dispatch(setMarkers(realMarkers));
            // Reset selected marker to first marker
            if (realMarkers.length > 0) {
              dispatch(setSelectedMarkerId(realMarkers[0].id));
            } else {
              dispatch(setSelectedMarkerId(null));
            }
            dispatch(setCreatingMarker(false));
            dispatch(setDuplicatingMarker(false));
          }}
          isDuplicate={marker.id === "temp-duplicate"}
        />
      ) : (
        <div className="flex items-center justify-between">
          <div
            className="flex-1 cursor-pointer"
            onClick={() => !isEditing && onMarkerClick(marker)}
          >
            <div className="flex items-center">
              {isMarkerRejected(marker) && (
                <span className="text-red-500 mr-2">✗</span>
              )}
              {!isMarkerRejected(marker) && isMarkerConfirmed(marker) && (
                <span className="text-green-500 mr-2">✓</span>
              )}
              {!isMarkerRejected(marker) && !isMarkerConfirmed(marker) && (
                <span className="text-yellow-500 mr-2">?</span>
              )}

              {isEditing ? (
                <div className="flex items-center space-x-2 flex-1">
                  <TagAutocomplete
                    value={editingTagId}
                    onChange={setEditingTagId}
                    availableTags={availableTags}
                    placeholder="Type to search tags..."
                    className="flex-1"
                    autoFocus={isEditing}
                    onSave={(tagId) => void onSaveEditWithTagId(marker, tagId)}
                    onCancel={onCancelEdit}
                  />
                </div>
              ) : (
                <>
                  <span className="font-bold mr-2">
                    {marker.primary_tag.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {marker.end_seconds
                      ? `${formatSeconds(marker.seconds, true)} - ${formatSeconds(
                          marker.end_seconds,
                          true
                        )}`
                      : formatSeconds(marker.seconds, true)}
                  </span>
                </>
              )}
            </div>
            {!isEditing && (
              <>
                <p className="text-xs mt-1 text-gray-600">
                  {marker.tags
                    .filter(
                      (tag) =>
                        tag.id !== markerStatusConfirmed &&
                        tag.id !== markerStatusRejected
                    )
                    .map((tag) => tag.name)
                    .join(", ")}
                </p>
                {marker.slots && marker.slots.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {marker.slots.map((slot, index) => (
                      <span
                        key={slot.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-200 rounded text-xs"
                        title={`${slot.slotLabel || `Slot ${index + 1}`}${slot.genderHints.length > 0 ? ` (${slot.genderHints.join('/')})` : ''}`}
                      >
                        {slot.slotLabel && <span className="text-blue-400">{slot.slotLabel}:</span>}
                        <span>{slot.performer?.name || '—'}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditMarker(marker);
                }}
                className="text-gray-400 hover:text-white p-1"
                title="Edit marker (Q)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}