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
        {rejectedMarkers.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="text-center py-12 mb-4">
            <div className="text-gray-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-2">No rejected markers to delete</p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              To delete markers, first reject some markers using the reject button or keyboard shortcuts.
            </p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
              Enter
            </kbd>{" "}
            to confirm,{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
              Esc
            </kbd>{" "}
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
              className={`px-4 py-2 rounded-sm text-white transition-colors ${
                rejectedMarkers.length > 0
                  ? "bg-red-500 hover:bg-red-700"
                  : "bg-gray-600 cursor-not-allowed opacity-50"
              }`}
              disabled={rejectedMarkers.length === 0}
            >
              {rejectedMarkers.length > 0
                ? `Delete ${rejectedMarkers.length} Marker${rejectedMarkers.length !== 1 ? "s" : ""}`
                : "No Markers to Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}