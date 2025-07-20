import React from "react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 flex-none">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
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

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-semibold text-green-400 mt-3 mb-1">
                LEFT HAND - Marker Actions
              </h4>
              <ul className="space-y-0.5 text-xs">
                <li>
                  <strong>Review:</strong>
                </li>
                <li>Z: Accept/Confirm</li>
                <li>X: Reject</li>
                <li>Shift+X: Delete rejected</li>
                <li>C: Mark/unmark incorrect marker</li>
                <li>Shift+C: Collect incorrect markers</li>
                <li>
                  <strong>Create:</strong>
                </li>
                <li>A: New marker</li>
                <li>S: Split marker</li>
                <li>D: Duplicate marker</li>
                <li>V: Split Video Cut marker</li>
                <li>
                  <strong>Edit:</strong>
                </li>
                <li>Q: Edit tag</li>
                <li>W: Set start time</li>
                <li>E: Set end time</li>
                <li>T: Copy marker times</li>
                <li>Shift+T: Paste marker times</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-blue-400 mb-1">
                RIGHT HAND - Navigation & Playback
              </h4>

              <ul className="space-y-0.5 text-xs mb-4">
                <li>↑↓: Move between swimlanes (same time)</li>
                <li>Shift+↑↓: Move between swimlanes (any time)</li>
                <li>←→: Move within swimlane</li>
                <li>Shift+←→: Chronological order</li>
              </ul>

              <ul className="space-y-0.5 text-xs mb-4">
                <li>
                  <strong>View:</strong>
                </li>
                <li>H: Center on playhead</li>
                <li>
                  <strong>Playback:</strong>
                </li>
                <li>Space: Play/pause</li>
                <li>J: Seek backward</li>
                <li>K: Pause</li>
                <li>L: Seek forward</li>
                <li>,: Frame backward</li>
                <li>.: Frame forward</li>
                <li>
                  <strong>Jump:</strong>
                </li>
                <li>I: Jump to marker start</li>
                <li>Shift+I: Jump to scene start</li>
                <li>O: Jump to marker end</li>
                <li>Shift+O: Jump to scene end</li>
                <li>
                  <strong>Navigation:</strong>
                </li>
                <li>N: Previous unprocessed (swimlane)</li>
                <li>M: Next unprocessed (swimlane)</li>
                <li>Shift+N: Previous unprocessed (global)</li>
                <li>Shift+M: Next unprocessed (global)</li>
                <li>
                  <strong>Shots:</strong>
                </li>
                <li>Y: Previous shot</li>
                <li>U: Next shot</li>
              </ul>

              <h4 className="font-semibold text-orange-400 mt-3 mb-1">
                System
              </h4>
              <ul className="space-y-0.5 text-xs">
                <li>Enter: Play from marker</li>
                <li>Escape: Cancel operation</li>
                <li>F: Filter by current swimlane</li>
                <li>R: Refresh markers</li>
                <li>
                  <strong>Zoom:</strong>
                </li>
                <li>+/=: Zoom in</li>
                <li>-/_: Zoom out (min: fit to window)</li>
                <li>0: Reset to fit window</li>
              </ul>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-gray-600">
            <p className="text-xs text-gray-400">
              <strong>Tip:</strong> Logical groupings - Left hand for marker
              actions, right hand for time/video, arrows for spatial navigation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
