"use client";

import React, { useEffect, useState, useCallback } from "react";
import { type GenderHint, type SlotDefinition } from "@/core/slot/types";
import { MarkerGroupAutocomplete } from "./MarkerGroupAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import type { Tag } from "@/services/StashappService";

interface SlotFormData {
  id?: string;
  slotLabel: string;
  genderHint: GenderHint | '';
}

interface MarkerGroupReassignDialogProps {
  tagId: string;
  tagName: string;
  correspondingTagRelationships?: Array<{
    tagId: string;
    tagName: string;
    correspondingTagName: string;
  }>;
  availableTags: Tag[];
  onReassignMarkerGroup: (tagId: string, newMarkerGroupId: string) => Promise<void>;
  onSetCorrespondingTag: (tagId: string, correspondingTagId: string | null) => Promise<void>;
  onClose: () => void;
  onSlotsSaved?: () => void;
}

const GENDER_HINT_LABELS: Record<GenderHint, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  TRANSGENDER_MALE: 'Transgender Male',
  TRANSGENDER_FEMALE: 'Transgender Female',
};

const GENDER_HINT_OPTIONS: GenderHint[] = ['MALE', 'FEMALE', 'TRANSGENDER_MALE', 'TRANSGENDER_FEMALE'];

export function MarkerGroupReassignDialog({
  tagId,
  tagName,
  correspondingTagRelationships,
  availableTags,
  onReassignMarkerGroup,
  onSetCorrespondingTag,
  onClose,
  onSlotsSaved,
}: MarkerGroupReassignDialogProps) {
  const [correspondingTagId, setCorrespondingTagId] = useState<string>("");

  // Slot definition state
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [editingSlots, setEditingSlots] = useState<SlotFormData[]>([]);
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const [slotMessage, setSlotMessage] = useState("");

  const loadSlotDefinitions = useCallback(async () => {
    try {
      setIsLoadingSlots(true);
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
      setSlotMessage('Error loading slot definitions: ' + (error as Error).message);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [tagId]);

  useEffect(() => {
    loadSlotDefinitions();
  }, [loadSlotDefinitions]);

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

  const handleSaveSlots = async () => {
    // At least one slot must exist
    if (editingSlots.length === 0) {
      setSlotMessage('Please add at least one slot');
      return;
    }

    setIsSavingSlots(true);
    setSlotMessage('');

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

      setSlotMessage('Slot definitions saved successfully!');

      // Call onSlotsSaved callback if provided
      if (onSlotsSaved) {
        onSlotsSaved();
      }

      // Reload slot definitions to refresh state
      await loadSlotDefinitions();

      // Clear message after a short delay
      setTimeout(() => {
        setSlotMessage('');
      }, 2000);
    } catch (error) {
      setSlotMessage('Error saving slot definitions: ' + (error as Error).message);
    } finally {
      setIsSavingSlots(false);
    }
  };

  const handleDeleteAllSlots = async () => {
    if (slotDefinitions.length === 0) return;

    if (!confirm(`Are you sure you want to delete all slot definitions for "${tagName}"? This action cannot be undone.`)) {
      return;
    }

    setSlotMessage('');

    try {
      const deletePromises = slotDefinitions.map(slot =>
        fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      await loadSlotDefinitions();
      setSlotMessage(`Deleted all slot definitions for ${tagName}`);
    } catch (error) {
      setSlotMessage('Error deleting slot definitions: ' + (error as Error).message);
    }
  };

  const checkSlotDefinitionConflict = useCallback(async (correspondingTagId: string): Promise<boolean> => {
    try {
      // Load slot definitions for the corresponding tag
      const response = await fetch(`/api/slot-definitions?tagId=${correspondingTagId}`);
      if (!response.ok) return false;

      const data = await response.json();
      const correspondingSlots = data.slotDefinitions || [];

      if (correspondingSlots.length === 0) return false;

      // Check if current tag has slot definitions
      if (slotDefinitions.length === 0) return false;

      // Compare slot definitions - check if they're identical
      if (correspondingSlots.length !== slotDefinitions.length) return true;

      // Sort both arrays by displayOrder for comparison
      const sortedCorresponding = [...correspondingSlots].sort((a, b) => a.displayOrder - b.displayOrder);
      const sortedCurrent = [...slotDefinitions].sort((a, b) => a.displayOrder - b.displayOrder);

      // Compare each slot
      for (let i = 0; i < sortedCorresponding.length; i++) {
        if (
          sortedCorresponding[i].slotLabel !== sortedCurrent[i].slotLabel ||
          sortedCorresponding[i].genderHint !== sortedCurrent[i].genderHint
        ) {
          return true; // Found a difference, conflict exists
        }
      }

      return false; // No conflict, slots are identical
    } catch (error) {
      console.error('Error checking slot definition conflict:', error);
      return false;
    }
  }, [slotDefinitions]);

  const copySlotDefinitions = useCallback(async (fromTagId: string, toTagId: string) => {
    try {
      // Load slot definitions from source tag
      const response = await fetch(`/api/slot-definitions?tagId=${fromTagId}`);
      if (!response.ok) {
        throw new Error('Failed to load source slot definitions');
      }

      const data = await response.json();
      const sourceSlots = data.slotDefinitions || [];

      if (sourceSlots.length === 0) return; // Nothing to copy

      // Delete existing slot definitions for target tag
      if (slotDefinitions.length > 0) {
        const deletePromises = slotDefinitions.map(slot =>
          fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
        );
        await Promise.all(deletePromises);
      }

      // Create new slot definitions for target tag
      const toTagIdNum = parseInt(toTagId);
      const createPromises = sourceSlots.map((slot: SlotDefinition) =>
        fetch('/api/slot-definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stashappTagId: toTagIdNum,
            slotLabel: slot.slotLabel,
            genderHint: slot.genderHint,
            displayOrder: slot.displayOrder,
          }),
        })
      );
      await Promise.all(createPromises);

      // Reload slot definitions
      await loadSlotDefinitions();
      setSlotMessage('Slot definitions copied successfully!');
      setTimeout(() => setSlotMessage(''), 2000);
    } catch (error) {
      setSlotMessage('Error copying slot definitions: ' + (error as Error).message);
    }
  }, [slotDefinitions, loadSlotDefinitions]);

  const handleSetCorrespondingTagWrapper = useCallback(async (correspondingTagId: string | null) => {
    if (!correspondingTagId) {
      // Removing corresponding tag, no need to copy slots
      await onSetCorrespondingTag(tagId, null);
      return;
    }

    // Check for slot definition conflicts
    const hasConflict = await checkSlotDefinitionConflict(correspondingTagId);

    if (hasConflict) {
      const correspondingTag = availableTags.find(t => t.id === correspondingTagId);
      const confirmed = confirm(
        `"${tagName}" already has different slot definitions than "${correspondingTag?.name}". ` +
        `Do you want to overwrite "${tagName}"'s slot definitions with those from "${correspondingTag?.name}"?`
      );

      if (!confirmed) return;
    }

    // Set the corresponding tag
    await onSetCorrespondingTag(tagId, correspondingTagId);

    // Copy slot definitions if the corresponding tag has any
    await copySlotDefinitions(correspondingTagId, tagId);
  }, [tagId, tagName, availableTags, onSetCorrespondingTag, checkSlotDefinitionConflict, copySlotDefinitions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <>
      <div
        className="fixed z-[9001] bg-gray-900 rounded-lg shadow-lg border border-gray-600 w-[600px] max-h-[85vh] overflow-y-auto left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10">
          <h2 className="text-lg font-bold text-white">
            Reassign &ldquo;{tagName}&rdquo;
          </h2>
        </div>

        <div className="p-4 space-y-6">
          {/* Marker Group Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-300">
              Select new marker group:
            </div>
            <MarkerGroupAutocomplete
              value=""
              onChange={(newMarkerGroupId) => {
                void onReassignMarkerGroup(tagId, newMarkerGroupId);
              }}
              availableTags={availableTags}
              placeholder="Search marker groups..."
              autoFocus={true}
              onCancel={onClose}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700"></div>

          {/* Corresponding Tag Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-300">
              Set corresponding tag:
            </div>

            {/* State 2: Show list of tags that point to this base tag as corresponding */}
            {correspondingTagRelationships ? (
              <div className="space-y-2">
                <div className="text-xs text-blue-300 mb-2">
                  {tagName} has the following corresponding tags:
                </div>
                {correspondingTagRelationships.map((relationship) => (
                  <div key={relationship.tagId} className="flex items-center justify-between bg-gray-700 px-3 py-2 rounded">
                    <span className="text-sm text-gray-200">
                      - {relationship.tagName}
                    </span>
                    <button
                      className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                      onClick={() => {
                        void onSetCorrespondingTag(relationship.tagId, null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* State 1: Show autocomplete for setting corresponding tag */
              <div className="space-y-2">
                <TagAutocomplete
                  value={correspondingTagId}
                  onChange={setCorrespondingTagId}
                  availableTags={availableTags}
                  placeholder="Search for corresponding tag..."
                  onSave={(tagId) => {
                    void handleSetCorrespondingTagWrapper(tagId || null);
                  }}
                  onCancel={onClose}
                />
                <div className="text-xs text-gray-500">
                  Set a corresponding tag that will be converted upon completion of review.
                </div>
                <div className="text-xs text-gray-500">
                  Note! This will overwrite the existing description of this tag with &ldquo;Corresponding Tag: Target Tag&rdquo;. Target tag is not modified.
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700"></div>

          {/* Slot Definitions Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-300">
                Slot Definitions
              </div>
              {slotDefinitions.length > 0 && (
                <button
                  onClick={handleDeleteAllSlots}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                  disabled={isSavingSlots}
                >
                  Delete All
                </button>
              )}
            </div>

            {slotMessage && (
              <div
                className={`p-2 rounded text-xs ${
                  slotMessage.includes("Error") || slotMessage.includes("failed")
                    ? "bg-red-900 border border-red-700 text-red-100"
                    : "bg-green-900 border border-green-700 text-green-100"
                }`}
              >
                {slotMessage}
              </div>
            )}

            {isLoadingSlots ? (
              <div className="text-gray-400 py-4 text-center text-sm">
                Loading slot definitions...
              </div>
            ) : (
              <div className="space-y-3">
                {editingSlots.map((slot, index) => (
                  <div key={index} className="bg-gray-800 p-3 rounded">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1 pt-2">
                        <button
                          onClick={() => moveSlot(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSlot(index, 'down')}
                          disabled={index === editingSlots.length - 1}
                          className="text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Gender Hint (Optional)
                          </label>
                          <select
                            value={slot.genderHint}
                            onChange={(e) => updateSlot(index, 'genderHint', e.target.value)}
                            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="text-red-400 hover:text-red-300 p-2 mt-5"
                        title="Remove slot"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addSlot}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors font-medium border border-dashed border-gray-600"
                >
                  + Add Slot
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Press Esc to close
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              onClick={onClose}
              disabled={isSavingSlots}
            >
              Close
            </button>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSaveSlots}
              disabled={isSavingSlots || isLoadingSlots || editingSlots.length === 0}
            >
              {isSavingSlots ? "Saving..." : "Save Slots"}
            </button>
          </div>
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="fixed inset-0 z-[9000]"
        onClick={onClose}
      />
    </>
  );
}
