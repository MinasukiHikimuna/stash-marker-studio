import React from "react";
import { SceneMarker, Tag } from "@/services/StashappService";

interface CorrespondingTagConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  markers: { sourceMarker: SceneMarker; correspondingTag: Tag }[];
  onConfirm: () => Promise<void>;
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

export const CorrespondingTagConversionModal: React.FC<CorrespondingTagConversionModalProps> = ({
  isOpen,
  onClose,
  markers,
  onConfirm,
}) => {
  const [isConverting, setIsConverting] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleConfirm = async () => {
    try {
      setIsConverting(true);
      await onConfirm();
      setToastMessage({
        type: "success",
        message: "Markers have been converted to their corresponding tags.",
      });
      onClose();
    } catch {
      setToastMessage({
        type: "error",
        message: "Failed to convert markers. Please try again.",
      });
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">Convert Corresponding Tag Markers</h3>
        {markers.length > 0 ? (
          <>
            <p className="mb-4">The following markers will be converted:</p>
            <div className="max-h-96 overflow-y-auto mb-4">
              {markers.map(({ sourceMarker, correspondingTag }) => (
                <div
                  key={sourceMarker.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded-sm mb-2"
                >
                  <div>
                    <span className="font-bold">{sourceMarker.primary_tag.name}</span>
                    <span className="text-sm text-gray-400 ml-2">→ {correspondingTag.name}</span>
                    <span className="text-sm text-gray-400 ml-2">
                      {formatTime(sourceMarker.seconds)}
                      {sourceMarker.end_seconds && ` - ${formatTime(sourceMarker.end_seconds)}`}
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-2">No markers to convert</p>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              To convert markers, first confirm some markers that have corresponding tag metadata.
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
              disabled={isConverting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-sm text-white transition-colors flex items-center ${
                markers.length > 0 && !isConverting
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-600 cursor-not-allowed opacity-50"
              }`}
              disabled={isConverting || markers.length === 0}
            >
              {isConverting ? (
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
                  Converting...
                </>
              ) : markers.length > 0 ? (
                `Convert ${markers.length} Marker${markers.length !== 1 ? "s" : ""}`
              ) : (
                "No Markers to Convert"
              )}
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
            toastMessage.type === "success" ? "bg-green-500" : "bg-red-500"
          } text-white`}
        >
          {toastMessage.message}
        </div>
      )}
    </div>
  );
};
