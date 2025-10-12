"use client";

import React, { useState, useEffect } from "react";
import type { SlotDefinitionSet, GenderHint } from "@/core/slot/types";

interface SlotDefEditorRow {
  slotLabel: string;
  genderHints: GenderHint[];
}

interface SlotDefinitionEditorProps {
  tagId: string;
  tagName: string;
  initialSlotDefinitionSet?: SlotDefinitionSet | null;
  onSave?: (slotDefinitionSet: SlotDefinitionSet) => void | Promise<void>;
  showSaveButton?: boolean;
  className?: string;
  compact?: boolean;
}

const GENDER_HINT_OPTIONS: GenderHint[] = ['MALE', 'FEMALE', 'TRANSGENDER_MALE', 'TRANSGENDER_FEMALE'];

export function SlotDefinitionEditor({
  tagId,
  tagName,
  initialSlotDefinitionSet,
  onSave,
  showSaveButton = true,
  className = "",
  compact = false,
}: SlotDefinitionEditorProps) {
  const [slots, setSlots] = useState<SlotDefEditorRow[]>([]);
  const [allowSamePerformerInMultipleSlots, setAllowSamePerformerInMultipleSlots] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load initial slot definitions
  useEffect(() => {
    if (initialSlotDefinitionSet?.slotDefinitions) {
      const sortedDefs = [...initialSlotDefinitionSet.slotDefinitions].sort((a, b) => a.order - b.order);
      setSlots(
        sortedDefs.map((def) => ({
          slotLabel: def.slotLabel || "",
          genderHints: def.genderHints || [],
        }))
      );
      setAllowSamePerformerInMultipleSlots(initialSlotDefinitionSet.allowSamePerformerInMultipleSlots);
    } else {
      // Start with 2 empty slots
      setSlots([
        { slotLabel: "", genderHints: [] },
        { slotLabel: "", genderHints: [] },
      ]);
    }
  }, [initialSlotDefinitionSet]);

  const handleAddSlot = () => {
    setSlots([...slots, { slotLabel: "", genderHints: [] }]);
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const handleSlotLabelChange = (index: number, label: string) => {
    const updated = [...slots];
    updated[index].slotLabel = label;
    setSlots(updated);
  };

  const handleGenderHintToggle = (index: number, hint: GenderHint) => {
    const updated = [...slots];
    const currentHints = updated[index].genderHints;

    if (currentHints.includes(hint)) {
      updated[index].genderHints = currentHints.filter((h) => h !== hint);
    } else {
      updated[index].genderHints = [...currentHints, hint];
    }

    setSlots(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/slot-definition-sets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stashappTagId: tagId,
          allowSamePerformerInMultipleSlots,
          slots,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save slot definitions");
      }

      const result = await response.json();
      setMessage("Slot definitions saved successfully!");

      if (onSave && result.slotDefinitionSet) {
        await onSave(result.slotDefinitionSet);
      }
    } catch (error) {
      setMessage("Error saving slot definitions: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const getGenderHintLabel = (hint: GenderHint): string => {
    switch (hint) {
      case 'MALE': return 'M';
      case 'FEMALE': return 'F';
      case 'TRANSGENDER_MALE': return 'TM';
      case 'TRANSGENDER_FEMALE': return 'TF';
    }
  };

  return (
    <div className={className}>
      {!compact && (
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-300 mb-1">
            Slot Definitions for <span className="text-white">{tagName}</span>
          </div>
          <p className="text-xs text-gray-400">
            Define performer slots (roles) and their gender hints for this tag.
          </p>
        </div>
      )}

      {/* Allow same performer checkbox */}
      <div className="mb-3">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowSamePerformerInMultipleSlots}
            onChange={(e) => setAllowSamePerformerInMultipleSlots(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Allow same performer in multiple slots
        </label>
      </div>

      {/* Slot definitions */}
      <div className="space-y-2 mb-3">
        {slots.map((slot, index) => (
          <div key={index} className="flex items-start gap-2 bg-gray-700 p-3 rounded">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={slot.slotLabel}
                onChange={(e) => handleSlotLabelChange(index, e.target.value)}
                placeholder={`Slot ${index + 1} label (e.g., Giver, Receiver)`}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Gender hints:</span>
                {GENDER_HINT_OPTIONS.map((hint) => (
                  <button
                    key={hint}
                    onClick={() => handleGenderHintToggle(index, hint)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      slot.genderHints.includes(hint)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                    }`}
                  >
                    {getGenderHintLabel(hint)}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => handleRemoveSlot(index)}
              disabled={slots.length <= 1}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium"
              title="Remove slot"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddSlot}
        className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-medium transition-colors mb-3"
      >
        + Add Slot
      </button>

      {message && (
        <div
          className={`p-2 rounded text-sm mb-3 ${
            message.includes("Error") || message.includes("Failed")
              ? "bg-red-900 border border-red-700 text-red-100"
              : "bg-green-900 border border-green-700 text-green-100"
          }`}
        >
          {message}
        </div>
      )}

      {showSaveButton && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
        >
          {isSaving ? "Saving..." : "Save Slot Definitions"}
        </button>
      )}
    </div>
  );
}
