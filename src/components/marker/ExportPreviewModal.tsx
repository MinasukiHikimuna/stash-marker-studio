"use client";

import React from "react";

interface ExportPreviewModalProps {
  isOpen: boolean;
  creates: number;
  updates: number;
  deletes: number;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExportPreviewModal({
  isOpen,
  creates,
  updates,
  deletes,
  isLoading,
  onCancel,
  onConfirm,
}: ExportPreviewModalProps) {
  if (!isOpen) return null;

  const totalOperations = creates + updates + deletes;
  const hasNoChanges = totalOperations === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full relative">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">
            Export Markers to Stashapp
          </h3>
        </div>

        {hasNoChanges ? (
          <div className="mb-4 p-3 bg-gray-900/30 border border-gray-600/50 rounded">
            <div className="flex items-center text-gray-300 text-sm">
              <span className="mr-2">ℹ️</span>
              <span>All markers are already synced with Stashapp. No changes to export.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="mb-3">The following changes will be made to Stashapp:</p>
              <div className="space-y-2">
                {creates > 0 && (
                  <div className="flex items-center justify-between p-3 bg-green-900/30 border border-green-600/50 rounded">
                    <div className="flex items-center">
                      <span className="text-green-200 mr-2">✓</span>
                      <span className="text-green-200 font-medium">Create new markers</span>
                    </div>
                    <span className="text-green-200 font-bold">{creates}</span>
                  </div>
                )}

                {updates > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-900/30 border border-blue-600/50 rounded">
                    <div className="flex items-center">
                      <span className="text-blue-200 mr-2">↻</span>
                      <span className="text-blue-200 font-medium">Update existing markers</span>
                    </div>
                    <span className="text-blue-200 font-bold">{updates}</span>
                  </div>
                )}

                {deletes > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-900/30 border border-red-600/50 rounded">
                    <div className="flex items-center">
                      <span className="text-red-200 mr-2">✗</span>
                      <span className="text-red-200 font-medium">Delete orphaned markers</span>
                    </div>
                    <span className="text-red-200 font-bold">{deletes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded">
              <div className="flex items-start text-yellow-200 text-sm">
                <span className="mr-2 mt-0.5">⚠️</span>
                <div>
                  <p className="font-medium mb-1">This operation will modify your Stashapp database:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>New markers will be created in Stashapp</li>
                    <li>Existing markers will be updated with local database values</li>
                    <li>Markers not in local database will be permanently deleted from Stashapp</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}

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
              disabled={isLoading}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading || hasNoChanges}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-sm font-medium"
            >
              {isLoading ? "Exporting..." : hasNoChanges ? "No Changes" : "Export to Stashapp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
