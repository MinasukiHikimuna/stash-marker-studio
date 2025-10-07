"use client";

import React, { useEffect, useState } from "react";
import { type GenderHint, type SlotDefinition } from "@/core/slot/types";

interface SlotFormData {
  id?: string; // For existing slots
  slotLabel: string;
  genderHint: GenderHint | '';
}

interface SlotDefinitionDialogProps {
  tagId: string;
  tagName: string;
  onClose: () => void;
  onSave?: () => void;
}

const GENDER_HINT_LABELS: Record<GenderHint, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  TRANSGENDER_MALE: 'Transgender Male',
  TRANSGENDER_FEMALE: 'Transgender Female',
};

const GENDER_HINT_OPTIONS: GenderHint[] = ['MALE', 'FEMALE', 'TRANSGENDER_MALE', 'TRANSGENDER_FEMALE'];

export function SlotDefinitionDialog({
  tagId,
  tagName,
  onClose,
  onSave,
}: SlotDefinitionDialogProps) {
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlots, setEditingSlots] = useState<SlotFormData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSlotDefinitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId]);

  const loadSlotDefinitions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/slot-definitions?tagId=${tagId}`);
      if (!response.ok) {
        throw new Error('Failed to load slot definitions');
      }
      const data = await response.json();
      const definitions = data.slotDefinitions || [];
      setSlotDefinitions(definitions);

      // Initialize editing state with existing slots or one empty slot
      const slots: SlotFormData[] = definitions
        .sort((a: SlotDefinition, b: SlotDefinition) => a.displayOrder - b.displayOrder)
        .map((slot: SlotDefinition) => ({
          id: slot.id,
          slotLabel: slot.slotLabel || '',
          genderHint: (slot.genderHint as GenderHint) || '',
        }));

      // If no slots exist, start with one empty slot
      if (slots.length === 0) {
        slots.push({ slotLabel: '', genderHint: '' });
      }

      setEditingSlots(slots);
    } catch (error) {
      setMessage('Error loading slot definitions: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const addSlot = () => {
    setEditingSlots([...editingSlots, { slotLabel: '', genderHint: '' }]);
  };

  const removeSlot = (index: number) => {
    setEditingSlots(editingSlots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof SlotFormData, value: string) => {
    const updated = [...editingSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSlots(updated);
  };

  const moveSlot = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editingSlots.length) return;

    const updated = [...editingSlots];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setEditingSlots(updated);
  };

  const handleSave = async () => {
    // At least one slot must exist
    if (editingSlots.length === 0) {
      setMessage('Please add at least one slot');
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const tagIdNum = parseInt(tagId);

      // Separate existing slots (with id) from new slots (without id)
      const existingSlots = editingSlots.filter(s => s.id);
      const newSlots = editingSlots.filter(s => !s.id);

      // Find slots to delete (slots that existed but are no longer in editingSlots)
      const slotsToDelete = slotDefinitions.filter(
        existing => !existingSlots.find(editing => editing.id === existing.id)
      );

      // Delete removed slots
      if (slotsToDelete.length > 0) {
        const deletePromises = slotsToDelete.map(slot =>
          fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
        );
        await Promise.all(deletePromises);
      }

      // Update existing slots
      const updatePromises = existingSlots.map((slot) =>
        fetch(`/api/slot-definitions/${slot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slotLabel: slot.slotLabel.trim() || null,
            genderHint: slot.genderHint || null,
            displayOrder: editingSlots.indexOf(slot),
          }),
        })
      );
      await Promise.all(updatePromises);

      // Create new slots
      if (newSlots.length > 0) {
        const createPromises = newSlots.map((slot) =>
          fetch('/api/slot-definitions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stashappTagId: tagIdNum,
              slotLabel: slot.slotLabel.trim() || null,
              genderHint: slot.genderHint || null,
              displayOrder: editingSlots.indexOf(slot),
            }),
          })
        );
        await Promise.all(createPromises);
      }

      setMessage('Slot definitions saved successfully!');

      // Call onSave callback if provided
      if (onSave) {
        onSave();
      }

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      setMessage('Error saving slot definitions: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllSlots = async () => {
    if (slotDefinitions.length === 0) return;

    if (!confirm(`Are you sure you want to delete all slot definitions for "${tagName}"? This action cannot be undone.`)) {
      return;
    }

    setMessage('');

    try {
      const deletePromises = slotDefinitions.map(slot =>
        fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      await loadSlotDefinitions();
      setMessage(`Deleted all slot definitions for ${tagName}`);
    } catch (error) {
      setMessage('Error deleting slot definitions: ' + (error as Error).message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Slot Definitions for {tagName}
          </h2>
          {slotDefinitions.length > 0 && (
            <button
              onClick={handleDeleteAllSlots}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              disabled={isSaving}
            >
              Delete All
            </button>
          )}
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg mb-4 text-sm ${
              message.includes("Error") || message.includes("failed")
                ? "bg-red-900 border border-red-700 text-red-100"
                : "bg-green-900 border border-green-700 text-green-100"
            }`}
          >
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="text-gray-400 py-8 text-center">
            Loading slot definitions...
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {editingSlots.map((slot, index) => (
              <div key={index} className="bg-gray-700 p-3 rounded-md">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-2">
                    <button
                      onClick={() => moveSlot(index, 'up')}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveSlot(index, 'down')}
                      disabled={index === editingSlots.length - 1}
                      className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Slot Label <span className="text-gray-500">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={slot.slotLabel}
                        onChange={(e) => updateSlot(index, 'slotLabel', e.target.value)}
                        placeholder="e.g., 'giver', 'receiver', 'performer' (leave blank if not needed)"
                        className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">
                        Gender Hint (Optional)
                      </label>
                      <select
                        value={slot.genderHint}
                        onChange={(e) => updateSlot(index, 'genderHint', e.target.value)}
                        className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No preference</option>
                        {GENDER_HINT_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {GENDER_HINT_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => removeSlot(index)}
                    className="text-red-400 hover:text-red-300 p-2 mt-6"
                    title="Remove slot"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addSlot}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors font-medium border border-dashed border-gray-500"
            >
              + Add Slot
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={isSaving || isLoading || editingSlots.length === 0}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-2 text-center">
          Press Esc to cancel, Cmd/Ctrl+Enter to save
        </div>
      </div>
    </div>
  );
}
