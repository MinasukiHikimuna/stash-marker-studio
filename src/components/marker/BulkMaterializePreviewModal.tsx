"use client";

import { useState } from "react";
import type {
  MarkerMaterialization,
  AlreadyMaterializedMarker,
} from "@/core/marker/bulkMaterialization";

interface BulkMaterializePreviewModalProps {
  isOpen: boolean;
  materializableMarkers: MarkerMaterialization[];
  alreadyMaterializedMarkers: AlreadyMaterializedMarker[];
  skippedMarkers: {
    markerId: string;
    markerTag: string;
    markerTime: string;
    reason: string;
  }[];
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function BulkMaterializePreviewModal({
  isOpen,
  materializableMarkers,
  alreadyMaterializedMarkers,
  skippedMarkers,
  isLoading,
  onConfirm,
  onCancel,
}: BulkMaterializePreviewModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAlreadyMaterialized, setShowAlreadyMaterialized] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate total new derivations count
  const totalNewDerivations = materializableMarkers.reduce(
    (sum, m) => sum + m.newDerivationsCount,
    0
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onCancel} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            Auto-Materialize Derived Markers Preview
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isLoading
              ? "Analyzing markers..."
              : `Found ${materializableMarkers.length} marker(s) with ${totalNewDerivations} new derivation(s)`}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Analyzing markers for materialization...</p>
            </div>
          ) : materializableMarkers.length === 0 &&
            alreadyMaterializedMarkers.length === 0 &&
            skippedMarkers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg mb-2">No markers found</p>
              <p className="text-sm">Import markers first to analyze derivations.</p>
            </div>
          ) : (
            <>
              {/* Materializable Markers */}
              {materializableMarkers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-green-400 mb-3">
                    Will Materialize ({materializableMarkers.length})
                  </h3>
                  <div className="space-y-3">
                    {materializableMarkers.map((marker) => (
                      <div
                        key={marker.markerId}
                        className="bg-gray-700 rounded p-3 border border-gray-600"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-semibold text-white">
                              {marker.markerTag}
                            </span>
                            <span className="text-gray-400 text-sm ml-2">
                              @ {marker.markerTime}
                            </span>
                          </div>
                          <span className="text-xs text-green-300 bg-green-900 px-2 py-1 rounded">
                            {marker.newDerivationsCount} new
                            {marker.totalDerivationsCount > marker.newDerivationsCount &&
                              ` (${marker.totalDerivationsCount - marker.newDerivationsCount} existing)`}
                          </span>
                        </div>
                        <div className="text-sm text-gray-300">
                          <span className="text-gray-500">Will create: </span>
                          {marker.derivedTags.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already Materialized Markers Toggle */}
              {alreadyMaterializedMarkers.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowAlreadyMaterialized(!showAlreadyMaterialized)}
                    className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
                  >
                    <span>
                      {showAlreadyMaterialized ? "▼" : "▶"} Already materialized (
                      {alreadyMaterializedMarkers.length})
                    </span>
                  </button>
                </div>
              )}

              {/* Already Materialized Markers */}
              {showAlreadyMaterialized && alreadyMaterializedMarkers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-400 mb-3">
                    Already Materialized ({alreadyMaterializedMarkers.length})
                  </h3>
                  <div className="space-y-2">
                    {alreadyMaterializedMarkers.map((marker) => (
                      <div
                        key={marker.markerId}
                        className="bg-gray-700 rounded p-3 border border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-semibold text-white">
                              {marker.markerTag}
                            </span>
                            <span className="text-gray-400 text-sm ml-2">
                              @ {marker.markerTime}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                            {marker.existingDerivationsCount} existing
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Markers Toggle */}
              {skippedMarkers.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowSkipped(!showSkipped)}
                    className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
                  >
                    <span>
                      {showSkipped ? "▼" : "▶"} Skipped markers (
                      {skippedMarkers.length})
                    </span>
                  </button>
                </div>
              )}

              {/* Skipped Markers */}
              {showSkipped && skippedMarkers.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                    Skipped Markers ({skippedMarkers.length})
                  </h3>
                  <div className="space-y-2">
                    {skippedMarkers.map((marker) => (
                      <div
                        key={marker.markerId}
                        className="bg-gray-700 rounded p-3 border border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-semibold text-white">
                              {marker.markerTag}
                            </span>
                            <span className="text-gray-400 text-sm ml-2">
                              @ {marker.markerTime}
                            </span>
                          </div>
                          <span className="text-xs text-yellow-300 bg-yellow-900 px-2 py-1 rounded">
                            {marker.reason}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || isLoading || materializableMarkers.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? "Materializing..."
              : `Materialize ${materializableMarkers.length} Marker${materializableMarkers.length !== 1 ? "s" : ""} (${totalNewDerivations} new)`}
          </button>
        </div>
      </div>
    </>
  );
}
