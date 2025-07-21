import React from "react";
import type { IncorrectMarker } from "@/utils/incorrectMarkerStorage";
import { useConfig } from "@/contexts/ConfigContext";
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
  const { STASH_URL, STASH_API_KEY } = useConfig();

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
        video.src = `${STASH_URL}/scene/${currentSceneId}/stream?apikey=${STASH_API_KEY}`;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 flex-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">
              Collect AI Feedback
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              disabled={isCollecting}
            >
              <svg
                className="w-6 h-6"
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
          <p className="text-gray-300 mb-4">
            The following markers in this scene have been marked as incorrect
            and will be collected for feedback.
          </p>
        </div>

        <div className="flex-1 overflow-auto px-6">
          <table className="w-full">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Tag</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {currentSceneMarkers.map((marker) => (
                <tr key={marker.markerId} className="border-t border-gray-700">
                  <td className="py-3 font-mono">
                    {formatTime(marker.startTime)}
                    {marker.endTime && ` - ${formatTime(marker.endTime)}`}
                  </td>
                  <td className="py-3">{marker.tagName}</td>
                  <td className="py-3 text-right">
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
                  </td>
                </tr>
              ))}
              {currentSceneMarkers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    No incorrect markers to collect in this scene
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Press{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
                Enter
              </kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Y</kbd>{" "}
              to confirm,{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd>{" "}
              or{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">N</kbd>{" "}
              to cancel
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-sm"
                disabled={isCollecting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isCollecting || currentSceneMarkers.length === 0}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                ) : (
                  "Collect and Export"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
