import React from "react";
import { SceneMarker, Tag } from "@/services/StashappService";

interface AITagConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  markers: { aiMarker: SceneMarker; correspondingTag: Tag }[];
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

export const AITagConversionModal: React.FC<AITagConversionModalProps> = ({
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
        message: "AI markers have been converted to their corresponding tags.",
      });
      onClose();
    } catch {
      setToastMessage({
        type: "error",
        message: "Failed to convert AI markers. Please try again.",
      });
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 flex-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Convert AI Markers</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              disabled={isConverting}
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
            The following confirmed AI markers will be converted to their
            corresponding tags:
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="sticky top-0 bg-gray-800">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    AI Tag
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Corresponding Tag
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    End Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {markers.map(({ aiMarker, correspondingTag }) => (
                  <tr key={aiMarker.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300">
                      {aiMarker.primary_tag.name}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300">
                      {correspondingTag.name}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-mono">
                      {formatTime(aiMarker.seconds)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-gray-300 font-mono">
                      {aiMarker.end_seconds
                        ? formatTime(aiMarker.end_seconds)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-none">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              disabled={isConverting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center ${
                isConverting ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={isConverting}
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
              ) : (
                "Convert"
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
