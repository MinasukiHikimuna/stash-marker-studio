"use client";

import React, { useEffect, useState, useCallback } from "react";
import { type GenderHint } from "@/core/slot/types";
import { MarkerGroupAutocomplete } from "./MarkerGroupAutocomplete";
import { TagAutocomplete } from "./TagAutocomplete";
import type { Tag } from "@/services/StashappService";

interface SlotFormData {
  slotLabel: string;
  genderHints: GenderHint[];
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

  // Marker group reassignment state
  const [selectedMarkerGroupId, setSelectedMarkerGroupId] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignMessage, setReassignMessage] = useState("");

  // Slot definition state
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [editingSlots, setEditingSlots] = useState<SlotFormData[]>([]);
  const [allowSamePerformer, setAllowSamePerformer] = useState(false);
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const [slotMessage, setSlotMessage] = useState("");

  const loadSlotDefinitions = useCallback(async () => {
    try {
      setIsLoadingSlots(true);
      const response = await fetch(`/api/slot-definition-sets?tagId=${tagId}`);
      if (!response.ok) {
        throw new Error('Failed to load slot definitions');
      }
      const data = await response.json();
      const sets = data.slotDefinitionSets || [];

      if (sets.length > 0) {
        const set = sets[0];
        setAllowSamePerformer(set.allowSamePerformerInMultipleSlots);

        const slots: SlotFormData[] = set.slotDefinitions
          .sort((a: any, b: any) => a.order - b.order)
          .map((slot: any) => ({
            slotLabel: slot.slotLabel || '',
            genderHints: slot.genderHints.map((gh: any) => gh.genderHint as GenderHint),
          }));

        setEditingSlots(slots.length > 0 ? slots : [{ slotLabel: '', genderHints: [] }]);
      } else {
        // No slot definition set exists yet
        setEditingSlots([{ slotLabel: '', genderHints: [] }]);
        setAllowSamePerformer(false);
      }
    } catch (error) {
      setSlotMessage('Error loading slot definitions: ' + (error as Error).message);
      setEditingSlots([{ slotLabel: '', genderHints: [] }]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [tagId]);

  useEffect(() => {
    loadSlotDefinitions();
  }, [loadSlotDefinitions]);

  const addSlot = () => {
    setEditingSlots([...editingSlots, { slotLabel: '', genderHints: [] }]);
  };

  const removeSlot = (index: number) => {
    if (editingSlots.length === 1) {
      setSlotMessage('At least one slot is required');
      return;
    }
    setEditingSlots(editingSlots.filter((_, i) => i !== index));
  };

  const updateSlotLabel = (index: number, value: string) => {
    const updated = [...editingSlots];
    updated[index] = { ...updated[index], slotLabel: value };
    setEditingSlots(updated);
  };

  const toggleGenderHint = (slotIndex: number, genderHint: GenderHint) => {
    const updated = [...editingSlots];
    const slot = updated[slotIndex];

    if (slot.genderHints.includes(genderHint)) {
      slot.genderHints = slot.genderHints.filter(gh => gh !== genderHint);
    } else {
      slot.genderHints = [...slot.genderHints, genderHint];
    }

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
    setIsSavingSlots(true);
    setSlotMessage('');

    try {
      const response = await fetch('/api/slot-definition-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappTagId: parseInt(tagId),
          allowSamePerformerInMultipleSlots: allowSamePerformer,
          slots: editingSlots,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save slot definitions');
      }

      setSlotMessage('Slot definitions saved successfully');
      await loadSlotDefinitions();

      if (onSlotsSaved) {
        onSlotsSaved();
      }
    } catch (error) {
      setSlotMessage('Error: ' + (error as Error).message);
    } finally {
      setIsSavingSlots(false);
    }
  };

  const handleDeleteAllSlots = async () => {
    if (!confirm(`Delete all slot definitions for "${tagName}"?`)) {
      return;
    }

    setIsSavingSlots(true);
    setSlotMessage('');

    try {
      const response = await fetch(`/api/slot-definition-sets?tagId=${tagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete slot definitions');
      }

      setSlotMessage('Slot definitions deleted');
      setEditingSlots([{ slotLabel: '', genderHints: [] }]);
      setAllowSamePerformer(false);

      if (onSlotsSaved) {
        onSlotsSaved();
      }
    } catch (error) {
      setSlotMessage('Error: ' + (error as Error).message);
    } finally {
      setIsSavingSlots(false);
    }
  };

  const handleReassignMarkerGroup = async () => {
    if (!selectedMarkerGroupId) {
      setReassignMessage("Please select a marker group");
      return;
    }

    setIsReassigning(true);
    setReassignMessage("");

    try {
      await onReassignMarkerGroup(tagId, selectedMarkerGroupId);
      setReassignMessage("Marker group reassigned successfully");
      setSelectedMarkerGroupId("");
    } catch (error) {
      setReassignMessage("Error: " + (error as Error).message);
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSetCorrespondingTag = async () => {
    setReassignMessage("");

    try {
      await onSetCorrespondingTag(tagId, correspondingTagId || null);
      setReassignMessage("Corresponding tag updated successfully");
    } catch (error) {
      setReassignMessage("Error: " + (error as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-white">
            Configure Tag: {tagName}
          </h2>

          {/* Marker Group Reassignment Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-white">Reassign Marker Group</h3>
            <p className="text-sm text-gray-400 mb-3">
              Reassign all markers with this tag to a different marker group tag
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <MarkerGroupAutocomplete
                  value={selectedMarkerGroupId}
                  onChange={setSelectedMarkerGroupId}
                  availableTags={availableTags}
                  placeholder="Select marker group..."
                />
              </div>
              <button
                onClick={handleReassignMarkerGroup}
                disabled={isReassigning || !selectedMarkerGroupId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded"
              >
                {isReassigning ? "Reassigning..." : "Reassign"}
              </button>
            </div>
            {reassignMessage && (
              <div className={`mt-2 p-2 rounded ${
                reassignMessage.includes('Error') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
              }`}>
                {reassignMessage}
              </div>
            )}
          </div>

          {/* Corresponding Tag Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-white">Set Corresponding Tag</h3>
            <p className="text-sm text-gray-400 mb-3">
              When converting markers, replace this tag with the corresponding tag
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <TagAutocomplete
                  value={correspondingTagId}
                  onChange={setCorrespondingTagId}
                  availableTags={availableTags}
                  placeholder="Select corresponding tag..."
                />
              </div>
              <button
                onClick={handleSetCorrespondingTag}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Set
              </button>
            </div>
          </div>

          {/* Slot Definitions Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Slot Definitions</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={allowSamePerformer}
                    onChange={(e) => setAllowSamePerformer(e.target.checked)}
                    className="rounded"
                  />
                  Allow same performer in multiple slots
                </label>
                <button
                  onClick={handleDeleteAllSlots}
                  disabled={isSavingSlots}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded text-sm"
                >
                  Delete All
                </button>
              </div>
            </div>

            {isLoadingSlots ? (
              <div className="text-gray-400">Loading slot definitions...</div>
            ) : (
              <div className="space-y-3">
                {editingSlots.map((slot, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-300 mb-1">
                          Slot Label (optional)
                        </label>
                        <input
                          type="text"
                          value={slot.slotLabel}
                          onChange={(e) => updateSlotLabel(index, e.target.value)}
                          placeholder="e.g., Giver, Receiver, Person 1"
                          className="w-full px-3 py-2 bg-gray-600 text-white rounded"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => moveSlot(index, 'up')}
                          disabled={index === 0}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded text-xs"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSlot(index, 'down')}
                          disabled={index === editingSlots.length - 1}
                          className="px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded text-xs"
                        >
                          ↓
                        </button>
                      </div>

                      <button
                        onClick={() => removeSlot(index)}
                        disabled={editingSlots.length === 1}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded"
                      >
                        Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-2">
                        Gender Hints (select all that apply, or none for any gender)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {GENDER_HINT_OPTIONS.map((hint) => (
                          <label
                            key={hint}
                            className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                              slot.genderHints.includes(hint)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={slot.genderHints.includes(hint)}
                              onChange={() => toggleGenderHint(index, hint)}
                              className="sr-only"
                            />
                            {GENDER_HINT_LABELS[hint]}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addSlot}
                  className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                >
                  + Add Slot
                </button>
              </div>
            )}

            {slotMessage && (
              <div className={`mt-3 p-2 rounded ${
                slotMessage.includes('Error') ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'
              }`}>
                {slotMessage}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveSlots}
                disabled={isSavingSlots}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-medium"
              >
                {isSavingSlots ? 'Saving...' : 'Save Slot Definitions'}
              </button>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
