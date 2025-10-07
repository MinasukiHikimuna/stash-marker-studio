"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import { ConfigTagAutocomplete } from "@/components/settings/ConfigTagAutocomplete";
import { type GenderHint, type SlotDefinition } from "@/core/slot/types";

interface SlotFormData {
  id?: string; // For existing slots
  slotLabel: string;
  genderHint: GenderHint | '';
}

const GENDER_HINT_LABELS: Record<GenderHint, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  TRANSGENDER_MALE: 'Transgender Male',
  TRANSGENDER_FEMALE: 'Transgender Female',
};

const GENDER_HINT_OPTIONS: GenderHint[] = ['MALE', 'FEMALE', 'TRANSGENDER_MALE', 'TRANSGENDER_FEMALE'];

export default function SlotDefinitionSettings() {
  const dispatch = useAppDispatch();
  const availableTags = useAppSelector(selectAvailableTags);
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Selected tag for viewing/editing
  const [selectedTagId, setSelectedTagId] = useState("");

  // Editing state - array of slots being edited
  const [isEditing, setIsEditing] = useState(false);
  const [editingSlots, setEditingSlots] = useState<SlotFormData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (availableTags.length === 0) {
      dispatch(loadAvailableTags());
    }
  }, [dispatch, availableTags.length]);

  useEffect(() => {
    loadSlotDefinitions();
  }, []);

  const loadSlotDefinitions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/slot-definitions');
      if (!response.ok) {
        throw new Error('Failed to load slot definitions');
      }
      const data = await response.json();
      setSlotDefinitions(data.slotDefinitions);
    } catch (error) {
      setMessage('Error loading slot definitions: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getTagName = (tagId: number): string => {
    const tag = availableTags.find(t => t.id === tagId.toString());
    return tag?.name || `Tag ID: ${tagId}`;
  };

  // Get slots for currently selected tag
  const currentTagSlots = selectedTagId
    ? slotDefinitions.filter(s => s.stashappTagId === parseInt(selectedTagId))
    : [];

  const handleTagChange = (tagId: string) => {
    setSelectedTagId(tagId);
    setIsEditing(false);
    setEditingSlots([]);
  };

  const startEditing = () => {
    // Load existing slots into editing state
    const slots: SlotFormData[] = currentTagSlots
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(slot => ({
        id: slot.id,
        slotLabel: slot.slotLabel,
        genderHint: (slot.genderHint as GenderHint) || '',
      }));

    // If no slots exist, start with one empty slot
    if (slots.length === 0) {
      slots.push({ slotLabel: '', genderHint: '' });
    }

    setEditingSlots(slots);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingSlots([]);
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
    if (!selectedTagId) {
      setMessage('Please select a tag');
      return;
    }

    // Validate all slots have labels
    const validSlots = editingSlots.filter(s => s.slotLabel.trim());
    if (validSlots.length === 0) {
      setMessage('Please add at least one slot with a label');
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const tagId = parseInt(selectedTagId);

      // Delete all existing slots for this tag
      const deletePromises = currentTagSlots.map(slot =>
        fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Create new slots with proper display order
      const createPromises = validSlots.map((slot, index) =>
        fetch('/api/slot-definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stashappTagId: tagId,
            slotLabel: slot.slotLabel.trim(),
            genderHint: slot.genderHint || null,
            displayOrder: index,
          }),
        })
      );
      await Promise.all(createPromises);

      await loadSlotDefinitions();
      setIsEditing(false);
      setEditingSlots([]);
      setMessage('Slot definitions saved successfully!');
    } catch (error) {
      setMessage('Error saving slot definitions: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllSlots = async () => {
    if (!selectedTagId || currentTagSlots.length === 0) return;

    const tagName = getTagName(parseInt(selectedTagId));
    if (!confirm(`Are you sure you want to delete all slot definitions for "${tagName}"? This action cannot be undone.`)) {
      return;
    }

    setMessage('');

    try {
      const deletePromises = currentTagSlots.map(slot =>
        fetch(`/api/slot-definitions/${slot.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      await loadSlotDefinitions();
      setMessage(`Deleted all slot definitions for ${tagName}`);
    } catch (error) {
      setMessage('Error deleting slot definitions: ' + (error as Error).message);
    }
  };

  // Group slot definitions by tag for the summary view
  const slotsByTag = slotDefinitions.reduce((acc, slot) => {
    const tagId = slot.stashappTagId;
    if (!acc[tagId]) {
      acc[tagId] = [];
    }
    acc[tagId].push(slot);
    return acc;
  }, {} as Record<number, SlotDefinition[]>);

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes("Error") || message.includes("failed")
              ? "bg-red-900 border border-red-700 text-red-100"
              : "bg-green-900 border border-green-700 text-green-100"
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Slot Definitions</h2>
        <p className="text-sm text-gray-400 mb-6">
          Define performer slots for marker tags. For example, a &quot;BJ&quot; tag might have &quot;giver&quot; and &quot;receiver&quot; slots.
        </p>

        {/* Tag Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Tag to Configure Slots
          </label>
          <ConfigTagAutocomplete
            value={selectedTagId}
            onChange={handleTagChange}
            availableTags={availableTags}
            placeholder="Type to search for a tag..."
            className="w-full"
            onTagCreated={async () => {
              await dispatch(loadAvailableTags());
            }}
          />
        </div>

        {/* Slot Editor for Selected Tag */}
        {selectedTagId && (
          <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                Slots for {getTagName(parseInt(selectedTagId))}
              </h3>
              {!isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
                  >
                    {currentTagSlots.length > 0 ? 'Edit Slots' : 'Add Slots'}
                  </button>
                  {currentTagSlots.length > 0 && (
                    <button
                      onClick={handleDeleteAllSlots}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium"
                    >
                      Delete All
                    </button>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                {editingSlots.map((slot, index) => (
                  <div key={index} className="bg-gray-600 p-3 rounded-md">
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
                            Slot Label
                          </label>
                          <input
                            type="text"
                            value={slot.slotLabel}
                            onChange={(e) => updateSlot(index, 'slotLabel', e.target.value)}
                            placeholder="e.g., 'giver', 'receiver', 'performer'"
                            className="w-full p-2 bg-gray-500 border border-gray-400 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Gender Hint (Optional)
                          </label>
                          <select
                            value={slot.genderHint}
                            onChange={(e) => updateSlot(index, 'genderHint', e.target.value)}
                            className="w-full p-2 bg-gray-500 border border-gray-400 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md transition-colors font-medium border border-dashed border-gray-400"
                >
                  + Add Slot
                </button>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md transition-colors font-medium"
                  >
                    {isSaving ? 'Saving...' : 'Save All Slots'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white rounded-md transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : currentTagSlots.length > 0 ? (
              <div className="space-y-2">
                {currentTagSlots
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((slot, index) => (
                    <div key={slot.id} className="bg-gray-600 p-3 rounded-md">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-mono text-sm">{index + 1}.</span>
                        <div className="flex-1">
                          <p className="text-white font-medium">{slot.slotLabel}</p>
                          {slot.genderHint && (
                            <p className="text-sm text-gray-400">
                              Gender hint: {GENDER_HINT_LABELS[slot.genderHint as GenderHint]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No slots defined for this tag yet.</p>
            )}
          </div>
        )}

        {/* Summary: Tags with Slots Defined */}
        {!selectedTagId && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-white mb-3">
              Tags with Slot Definitions ({Object.keys(slotsByTag).length})
            </h3>
            {isLoading ? (
              <div className="p-3 bg-gray-700 rounded-md">
                <p className="text-gray-400">Loading slot definitions...</p>
              </div>
            ) : Object.keys(slotsByTag).length === 0 ? (
              <div className="p-3 bg-gray-700 rounded-md border border-gray-600">
                <p className="text-gray-400">No slot definitions yet. Select a tag above to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(slotsByTag)
                  .sort(([, a], [, b]) => b.length - a.length)
                  .map(([tagId, slots]) => (
                    <div key={tagId} className="bg-gray-700 p-3 rounded-md flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{getTagName(parseInt(tagId))}</p>
                        <p className="text-sm text-gray-400">
                          {slots.length} slot{slots.length !== 1 ? 's' : ''}: {' '}
                          {slots.sort((a, b) => a.displayOrder - b.displayOrder).map(s => s.slotLabel).join(', ')}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedTagId(tagId)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-medium transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
