import React, { useState, useEffect } from "react";
import { keyboardShortcutService } from "../../services/KeyboardShortcutService";
import { KeyboardShortcut, ShortcutCategory } from "../../types/keyboard";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  'marker.review': 'Marker Review',
  'marker.create': 'Marker Creation',
  'marker.edit': 'Marker Editing',
  'navigation': 'Navigation',
  'video.playback': 'Video Playback',
  'video.jump': 'Video Jump',
  'system': 'System Actions'
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  'marker.review',
  'marker.create', 
  'marker.edit',
  'navigation',
  'video.playback',
  'video.jump',
  'system'
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);

  useEffect(() => {
    if (isOpen) {
      const allShortcuts = keyboardShortcutService.getAllShortcuts().filter(s => s.enabled);
      setShortcuts(allShortcuts);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = CATEGORY_ORDER.reduce((acc, category) => {
    const categoryShortcuts = shortcuts.filter(s => s.category === category);
    if (categoryShortcuts.length > 0) {
      acc[category] = categoryShortcuts;
    }
    return acc;
  }, {} as Record<ShortcutCategory, KeyboardShortcut[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9000] p-4">
      <div className="bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
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
        </div>

        <div className="px-6 pb-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="space-y-2">
                <h3 className="font-semibold text-blue-400 mb-3">
                  {CATEGORY_LABELS[category as ShortcutCategory]}
                </h3>
                <div className="space-y-1">
                  {categoryShortcuts.map((shortcut) => (
                    <div key={shortcut.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300 flex-1">
                        {shortcut.description}
                      </span>
                      <div className="flex gap-2 ml-4">
                        {shortcut.bindings.map((binding, index) => (
                          <span
                            key={index}
                            className="font-mono bg-gray-700 px-2 py-0.5 rounded text-xs text-white"
                          >
                            {keyboardShortcutService.getBindingDisplayString(binding)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-600">
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-400">
                <strong>Tip:</strong> Logical groupings - Left hand for marker actions, right hand for time/video, arrows for spatial navigation.
              </p>
              <a
                href="/config"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
                onClick={onClose}
              >
                Customize shortcuts →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
