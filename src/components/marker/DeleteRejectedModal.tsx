"use client";

import React from "react";
import { SceneMarker } from "../../services/StashappService";
import { formatSeconds } from "../../core/marker/markerLogic";

interface DeleteRejectedModalProps {
  isOpen: boolean;
  rejectedMarkers: SceneMarker[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteRejectedModal({
  isOpen,
  rejectedMarkers,
  onCancel,
  onConfirm,
}: DeleteRejectedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Delete Rejected Markers</h3>
        <p className="mb-4">The following markers will be deleted:</p>
        <div className="max-h-96 overflow-y-auto mb-4">
          {rejectedMarkers.map((marker) => (
            <div
              key={marker.id}
              className="flex items-center justify-between p-2 bg-gray-700 rounded-sm mb-2"
            >
              <div>
                <span className="font-bold">{marker.primary_tag.name}</span>
                <span className="text-sm text-gray-400 ml-2">
                  {marker.end_seconds
                    ? `${formatSeconds(
                        marker.seconds,
                        true
                      )} - ${formatSeconds(marker.end_seconds, true)}`
                    : formatSeconds(marker.seconds, true)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
              Enter
            </kbd>{" "}
            or{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Y</kbd>{" "}
            to confirm,{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
              Esc
            </kbd>{" "}
            or{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">N</kbd>{" "}
            to cancel
          </div>
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-sm"
            >
              Delete {rejectedMarkers.length} Marker
              {rejectedMarkers.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}