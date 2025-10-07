"use client";

import { useState } from "react";
import { type Tag, type SceneMarker, type Performer } from "../../services/StashappService";
import { formatTimeColonDot, parseTimeColonDot } from "../../core/marker/markerLogic";
import { TagAutocomplete } from "./TagAutocomplete";
import { MarkerSlotsEditor } from "./MarkerSlotsEditor";

interface SlotValue {
  slotDefinitionId: string;
  performerId: string | null;
}

interface TempMarkerFormProps {
  marker: SceneMarker;
  availableTags: Tag[];
  availablePerformers: Performer[];
  videoElement: HTMLVideoElement | null;
  onSave: (start: number, end: number | null, tagId: string, slots: SlotValue[]) => void;
  onCancel: () => void;
  isDuplicate?: boolean;
}

export function TempMarkerForm({
  marker,
  availableTags,
  availablePerformers,
  videoElement,
  onSave,
  onCancel,
  isDuplicate = false,
}: TempMarkerFormProps) {
  const [start, setStart] = useState(formatTimeColonDot(marker.seconds));
  const [end, setEnd] = useState(
    marker.end_seconds !== undefined
      ? formatTimeColonDot(marker.end_seconds)
      : ""
  );
  const [tagId, setTagId] = useState(marker.primary_tag.id);
  const [slots, setSlots] = useState<SlotValue[]>([]);

  const handleTimeKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    isStart: boolean
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentTime = isStart
        ? parseTimeColonDot(start)
        : parseTimeColonDot(end);
      const increment = e.key === "ArrowUp" ? 0.1 : -0.1;
      const newTime = Math.max(0, currentTime + increment);

      if (isStart) {
        setStart(formatTimeColonDot(newTime));
      } else {
        setEnd(formatTimeColonDot(newTime));
      }

      if (videoElement) {
        videoElement.currentTime = newTime;
      }
    }
  };

  const handleTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isStart: boolean
  ) => {
    const value = e.target.value;
    // Only allow digits, dots, and colons
    if (/^[\d:.]*$/.test(value)) {
      if (isStart) {
        setStart(value);
      } else {
        setEnd(value);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        <span className="text-blue-300 mr-2 font-bold">*</span>
        <div className="flex items-center space-x-2 flex-1">
          <input
            type="text"
            className="w-20 bg-gray-700 text-white px-1 py-1 rounded-sm text-xs"
            value={start}
            onChange={(e) => handleTimeChange(e, true)}
            onKeyDown={(e) => handleTimeKeyDown(e, true)}
            placeholder="start"
            title="Start time (mm:ss.zzz)"
          />
          <span className="text-gray-400 text-xs">-</span>
          <input
            type="text"
            className="w-20 bg-gray-700 text-white px-1 py-1 rounded-sm text-xs"
            value={end}
            onChange={(e) => handleTimeChange(e, false)}
            onKeyDown={(e) => handleTimeKeyDown(e, false)}
            placeholder="end"
            title="End time (mm:ss.zzz)"
          />
          <TagAutocomplete
            value={tagId}
            onChange={setTagId}
            availableTags={availableTags}
            placeholder={
              isDuplicate
                ? `Duplicating: ${marker.primary_tag.name}`
                : "Type to search tags..."
            }
            className="flex-1"
            autoFocus={true}
            onSave={(selectedTagId) => {
              if (selectedTagId) {
                onSave(
                  parseTimeColonDot(start),
                  end === "" ? null : parseTimeColonDot(end),
                  selectedTagId,
                  slots
                );
              }
            }}
          />
          <button
            className="bg-green-500 hover:bg-green-700 text-white px-2 py-1 rounded-sm text-xs"
            onClick={() => {
              onSave(
                parseTimeColonDot(start),
                end === "" ? null : parseTimeColonDot(end),
                tagId,
                slots
              );
            }}
          >
            Save
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white px-2 py-1 rounded-sm text-xs"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
      <MarkerSlotsEditor
        primaryTagId={tagId}
        availablePerformers={availablePerformers}
        initialSlots={slots}
        onChange={setSlots}
        className="ml-8"
      />
    </div>
  );
}