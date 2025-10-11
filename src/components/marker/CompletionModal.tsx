"use client";

import React, { useState, useEffect } from "react";
import { Tag } from "../../services/StashappService";
import { CompletionDefaults } from "../../serverConfig";

interface CompletionModalProps {
  isOpen: boolean;
  completionWarnings: string[];
  hasAiReviewedTag: boolean;
  primaryTagsToAdd: Tag[];
  tagsToRemove: Tag[];
  exportPreview?: {
    creates: number;
    updates: number;
    deletes: number;
  } | null;
  isLoadingExportPreview?: boolean;
  isExporting?: boolean;
  onCancel: () => void;
  onConfirm: (selectedActions: CompletionDefaults) => void;
}

export function CompletionModal({
  isOpen,
  completionWarnings,
  hasAiReviewedTag,
  primaryTagsToAdd,
  tagsToRemove,
  exportPreview,
  isLoadingExportPreview = false,
  isExporting = false,
  onCancel,
  onConfirm,
}: CompletionModalProps) {
  const [selectedActions, setSelectedActions] = useState<CompletionDefaults>({
    generateMarkers: true,
    addAiReviewedTag: true,
    addPrimaryTags: true,
    removeCorrespondingTags: true,
  });

  useEffect(() => {
    // Load defaults from config when modal opens
    if (isOpen) {
      loadDefaults();
    }
  }, [isOpen]);

  const loadDefaults = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        if (config.completionDefaults) {
          setSelectedActions(config.completionDefaults);
        }
      }
    } catch (error) {
      console.warn('Failed to load completion defaults:', error);
    }
  };

  const saveDefaults = async () => {
    try {
      const response = await fetch('/api/config');
      let config = {};
      if (response.ok) {
        config = await response.json();
      }
      
      const updatedConfig = {
        ...config,
        completionDefaults: selectedActions,
      };

      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
    } catch (error) {
      console.error('Failed to save completion defaults:', error);
    }
  };

  const handleActionToggle = (action: keyof CompletionDefaults) => {
    setSelectedActions(prev => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const handleConfirm = () => {
    onConfirm(selectedActions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full relative">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">
            Complete Scene Processing
          </h3>
          <button
            onClick={saveDefaults}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm text-sm"
          >
            Save as Default
          </button>
        </div>

        {completionWarnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
            <div className="flex items-center text-yellow-200 text-sm">
              <span className="mr-2">⚠️</span>
              <span>Warning! {completionWarnings[0]}. It is not recommended to complete the review.</span>
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-3">Select which actions to perform:</p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="generateMarkers"
                checked={selectedActions.generateMarkers}
                onChange={() => handleActionToggle('generateMarkers')}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="generateMarkers" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Generate markers (screenshots and previews)</span>
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="addAiReviewedTag"
                checked={selectedActions.addAiReviewedTag}
                onChange={() => handleActionToggle('addAiReviewedTag')}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="addAiReviewedTag" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Add &quot;AI_Reviewed&quot; tag to the scene</span>
                {hasAiReviewedTag ? (
                  <span className="text-gray-400"> (already present)</span>
                ) : (
                  <span className="text-green-300"> (will be added)</span>
                )}
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="addPrimaryTags"
                checked={selectedActions.addPrimaryTags}
                onChange={() => handleActionToggle('addPrimaryTags')}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="addPrimaryTags" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Add tags from confirmed markers to the scene</span>
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
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="removeCorrespondingTags"
                checked={selectedActions.removeCorrespondingTags}
                onChange={() => handleActionToggle('removeCorrespondingTags')}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="removeCorrespondingTags" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Remove tags with corresponding tag metadata from the scene</span>
                {tagsToRemove.length > 0 ? (
                  <span className="text-red-300">
                    {" "}
                    ({tagsToRemove.length} tag
                    {tagsToRemove.length !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-gray-500"> (none found)</span>
                )}
              </label>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Note: Console logging will be provided for detailed information about marker deletion and tag changes.
          </div>

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

          {tagsToRemove.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded">
              <h4 className="font-semibold text-red-200 mb-2">
                🗑️ Tags to be removed from the scene:
              </h4>
              <div className="flex flex-wrap gap-2">
                {tagsToRemove.map((tag) => (
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

          {/* Export Preview Section */}
          {isLoadingExportPreview && (
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded">
              <div className="flex items-center text-blue-200 text-sm">
                <span className="mr-2">⏳</span>
                <span>Loading marker sync preview...</span>
              </div>
            </div>
          )}

          {exportPreview && !isLoadingExportPreview && (
            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/50 rounded">
              <h4 className="font-semibold text-blue-200 mb-2">
                🔄 Marker Sync to Stashapp:
              </h4>
              <div className="space-y-1 text-sm">
                {exportPreview.creates > 0 && (
                  <div className="flex justify-between text-green-200">
                    <span>Create new markers:</span>
                    <span className="font-bold">{exportPreview.creates}</span>
                  </div>
                )}
                {exportPreview.updates > 0 && (
                  <div className="flex justify-between text-blue-200">
                    <span>Update existing markers:</span>
                    <span className="font-bold">{exportPreview.updates}</span>
                  </div>
                )}
                {exportPreview.deletes > 0 && (
                  <div className="flex justify-between text-red-200">
                    <span>Delete orphaned markers:</span>
                    <span className="font-bold">{exportPreview.deletes}</span>
                  </div>
                )}
                {exportPreview.creates === 0 && exportPreview.updates === 0 && exportPreview.deletes === 0 && (
                  <div className="text-gray-300">
                    All markers already synced with Stashapp
                  </div>
                )}
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
              disabled={isExporting}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isExporting}
              className={`px-4 py-2 rounded-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                completionWarnings.length > 0
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isExporting
                ? "Exporting..."
                : completionWarnings.length > 0
                ? "Proceed Anyway"
                : "Complete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
