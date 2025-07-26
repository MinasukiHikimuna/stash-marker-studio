import React from "react";
import type { IncorrectMarker } from "@/utils/incorrectMarkerStorage";
import { useAppSelector } from "@/store/hooks";
import { selectStashUrl, selectStashApiKey } from "@/store/slices/configSlice";
import JSZip from "jszip";

interface IncorrectMarkerCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  markers: IncorrectMarker[];
  onConfirm: () => Promise<void>;
  onRemoveMarker: (markerId: string) => void;
  currentSceneId: string;
  refreshMarkersOnly: () => Promise<void>;
}

// Helper function to format time as mm:ss.zzz
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const milliseconds = Math.round((remainingSeconds % 1) * 1000);

  return `${minutes.toString().padStart(2, "0")}:${Math.floor(remainingSeconds)
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
};

export const IncorrectMarkerCollectionModal: React.FC<
  IncorrectMarkerCollectionModalProps
> = ({
  isOpen,
  onClose,
  markers,
  onConfirm,
  onRemoveMarker,
  currentSceneId,
  refreshMarkersOnly,
}) => {
  const [isCollecting, setIsCollecting] = React.useState(false);
  const stashUrl = useAppSelector(selectStashUrl);
  const stashApiKey = useAppSelector(selectStashApiKey);

  // Filter markers to only show those from the current scene
  const currentSceneMarkers = markers.filter(
    (marker) => marker.sceneId === currentSceneId
  );

  const handleConfirm = async () => {
    try {
      setIsCollecting(true);

      // Create a new zip file
      const zip = new JSZip();

      // Add metadata JSON with only essential fields
      const simplifiedMetadata = currentSceneMarkers.map((marker) => ({
        tagName: marker.tagName,
        startTime: marker.startTime,
        endTime: marker.endTime,
      }));
      const data = JSON.stringify(simplifiedMetadata, null, 2);
      zip.file("metadata.json", data);

      // Create a folder for frames
      const framesFolder = zip.folder("frames");
      if (!framesFolder) {
        throw new Error("Failed to create frames folder in zip");
      }

      // Extract frames for each marker
      for (const marker of currentSceneMarkers) {
        // Create a subfolder for this tag if it doesn't exist
        const tagFolder = framesFolder.folder(marker.tagName);
        if (!tagFolder) {
          throw new Error(`Failed to create folder for tag ${marker.tagName}`);
        }

        const timestamps = [];
        const duration = marker.endTime ? marker.endTime - marker.startTime : 0;

        // Calculate timestamps to capture based on duration
        if (duration === 0) {
          timestamps.push(marker.startTime);
        } else if (duration < 30) {
          timestamps.push(marker.startTime + 4);
        } else if (duration < 60) {
          timestamps.push(marker.startTime + 4, marker.startTime + 20);
        } else if (duration < 120) {
          timestamps.push(
            marker.startTime + 4,
            marker.startTime + 20,
            marker.startTime + 50
          );
        } else {
          timestamps.push(
            marker.startTime + 4,
            marker.startTime + 20,
            marker.startTime + 50,
            marker.startTime + 100
          );
        }

        // Create a video element to extract frames
        const video = document.createElement("video");
        video.src = `${stashUrl}/scene/${currentSceneId}/stream?apikey=${stashApiKey}`;
        video.crossOrigin = "anonymous";

        for (const timestamp of timestamps) {
          await new Promise<void>((resolve, reject) => {
            video.currentTime = timestamp;
            video.onseeked = () => {
              try {
                // Create a canvas to draw the video frame
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  reject(new Error("Failed to get canvas context"));
                  return;
                }

                // Draw the video frame to canvas
                ctx.drawImage(video, 0, 0);

                // Convert canvas to blob and add to zip
                canvas.toBlob(
                  async (blob) => {
                    if (!blob) {
                      reject(new Error("Failed to convert canvas to blob"));
                      return;
                    }

                    const arrayBuffer = await blob.arrayBuffer();
                    tagFolder.file(
                      `${marker.markerId}_${timestamp}.jpg`,
                      arrayBuffer
                    );
                    resolve();
                  },
                  "image/jpeg",
                  0.95
                );
              } catch (error) {
                reject(error);
              }
            };
            video.onerror = () => reject(new Error("Failed to load video"));
          });
        }
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download zip file
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `incorrect-markers-${currentSceneId}-${new Date().toISOString()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await onConfirm();

      // Refresh the markers in the UI
      await refreshMarkersOnly();

      onClose();
    } catch (error) {
      console.error("Error collecting frames:", error);
    } finally {
      setIsCollecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Collect AI Feedback</h3>
        {currentSceneMarkers.length > 0 ? (
          <>
            <p className="mb-4">The following markers will be collected for feedback:</p>
            <div className="max-h-96 overflow-y-auto mb-4">
              {currentSceneMarkers.map((marker) => (
                <div
                  key={marker.markerId}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded-sm mb-2"
                >
                  <div>
                    <span className="font-bold">{marker.tagName}</span>
                    <span className="text-sm text-gray-400 ml-2">
                      {formatTime(marker.startTime)}
                      {marker.endTime && ` - ${formatTime(marker.endTime)}`}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveMarker(marker.markerId)}
                    className="text-red-400 hover:text-red-300"
                    title="Remove from collection"
                    disabled={isCollecting}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-2">No incorrect markers to collect</p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              To collect AI feedback, first mark some markers as incorrect using keyboard shortcuts.
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
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
              disabled={isCollecting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-sm text-white transition-colors flex items-center ${
                currentSceneMarkers.length > 0 && !isCollecting
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-600 cursor-not-allowed opacity-50"
              }`}
              disabled={isCollecting || currentSceneMarkers.length === 0}
            >
              {isCollecting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Collecting...
                </>
              ) : currentSceneMarkers.length > 0 ? (
                `Collect ${currentSceneMarkers.length} Marker${currentSceneMarkers.length !== 1 ? "s" : ""}`
              ) : (
                "No Markers to Collect"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
