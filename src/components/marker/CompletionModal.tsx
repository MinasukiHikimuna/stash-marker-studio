"use client";

import React from "react";
import { SceneMarker, Tag } from "../../services/StashappService";

interface CompletionModalProps {
  isOpen: boolean;
  completionWarnings: string[];
  videoCutMarkersToDelete: SceneMarker[];
  hasAiReviewedTag: boolean;
  primaryTagsToAdd: Tag[];
  aiTagsToRemove: Tag[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function CompletionModal({
  isOpen,
  completionWarnings,
  videoCutMarkersToDelete,
  hasAiReviewedTag,
  primaryTagsToAdd,
  aiTagsToRemove,
  onCancel,
  onConfirm,
}: CompletionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">
          Complete Scene Processing
        </h3>

        {completionWarnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
            <h4 className="font-semibold text-yellow-200 mb-2">
              ⚠️ Warnings:
            </h4>
            <ul className="text-yellow-100 text-sm">
              {completionWarnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-3">This will perform the following actions:</p>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            <li>
              Delete Video Cut markers
              {videoCutMarkersToDelete.length > 0 ? (
                <span className="text-red-300">
                  {" "}
                  ({videoCutMarkersToDelete.length} marker
                  {videoCutMarkersToDelete.length !== 1 ? "s" : ""})
                </span>
              ) : (
                <span className="text-gray-500"> (none found)</span>
              )}
            </li>
            <li>Generate markers (screenshots and previews)</li>
            <li>
              Add &quot;AI_Reviewed&quot; tag to the scene
              {hasAiReviewedTag ? (
                <span className="text-gray-400"> (already present)</span>
              ) : (
                <span className="text-green-300"> (will be added)</span>
              )}
            </li>
            <li>
              Add tags from confirmed markers to the scene
              {primaryTagsToAdd.length > 0 ? (
                <span className="text-green-300">
                  {" "}
                  ({primaryTagsToAdd.length} new tag
                  {primaryTagsToAdd.length !== 1 ? "s" : ""})
                </span>
              ) : (
                <span className="text-gray-400">
                  {" "}
                  (all already present)
                </span>
              )}
            </li>
            <li>
              Remove corresponding AI tags from the scene
              {aiTagsToRemove.length > 0 ? (
                <span className="text-red-300">
                  {" "}
                  ({aiTagsToRemove.length} tag
                  {aiTagsToRemove.length !== 1 ? "s" : ""})
                </span>
              ) : (
                <span className="text-gray-500"> (none found)</span>
              )}
            </li>
            <li className="text-xs text-gray-400 ml-4">
              Note: Opens browser console for detailed logging of Video Cut
              marker deletion and AI tag removal
            </li>
          </ul>

          {primaryTagsToAdd.length > 0 && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-600/50 rounded">
              <h4 className="font-semibold text-green-200 mb-2">
                ✅ New primary tags from the markers to be added to the
                scene:
              </h4>
              <div className="flex flex-wrap gap-2">
                {primaryTagsToAdd.map((tag) => (
                  <span
                    key={`add-${tag.id}`}
                    className="px-2 py-1 bg-green-800/50 text-green-200 rounded-sm text-xs font-mono"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {primaryTagsToAdd.length === 0 && hasAiReviewedTag && (
            <div className="mt-4 p-3 bg-gray-900/30 border border-gray-600/50 rounded">
              <h4 className="font-semibold text-gray-300 mb-2">
                ℹ️ No new tags to add
              </h4>
              <p className="text-gray-400 text-sm">
                All primary tags from confirmed markers and the AI_Reviewed
                tag are already present on the scene.
              </p>
            </div>
          )}

          {aiTagsToRemove.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded">
              <h4 className="font-semibold text-red-200 mb-2">
                🗑️ AI tags to be removed from the scene:
              </h4>
              <div className="flex flex-wrap gap-2">
                {aiTagsToRemove.map((tag) => (
                  <span
                    key={`remove-${tag.id}`}
                    className="px-2 py-1 bg-red-800/50 text-red-200 rounded-sm text-xs font-mono"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
              Enter
            </kbd>{" "}
            to proceed,{" "}
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
              className={`px-4 py-2 rounded-sm font-medium ${
                completionWarnings.length > 0
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {completionWarnings.length > 0
                ? "Proceed Anyway"
                : "Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}