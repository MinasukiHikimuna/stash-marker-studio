"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectAvailableTags } from "@/store/slices/markerSlice";
import { ConfigTagAutocomplete } from "@/components/settings/ConfigTagAutocomplete";

interface SlotDefinition {
  id: string;
  stashappTagId: number;
  slotLabel: string;
  genderHint: string | null;
  displayOrder: number;
  createdAt: string;
}

export default function SlotDefinitionSettings() {
  const availableTags = useAppSelector(selectAvailableTags);
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Form state for creating new slot definition
  const [selectedTagId, setSelectedTagId] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [genderHint, setGenderHint] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingGenderHint, setEditingGenderHint] = useState("");

  // Drag state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!selectedTagId || !slotLabel.trim()) {
      setMessage('Please select a tag and enter a slot label');
      return;
    }

    setIsCreating(true);
    setMessage('');

    try {
      const response = await fetch('/api/slot-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stashappTagId: parseInt(selectedTagId),
          slotLabel: slotLabel.trim(),
          genderHint: genderHint.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create slot definition');
      }

      await loadSlotDefinitions();
      setSelectedTagId('');
      setSlotLabel('');
      setGenderHint('');
      setMessage('Slot definition created successfully!');
    } catch (error) {
      setMessage('Error creating slot definition: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (slot: SlotDefinition) => {
    setEditingId(slot.id);
    setEditingLabel(slot.slotLabel);
    setEditingGenderHint(slot.genderHint || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingLabel('');
    setEditingGenderHint('');
  };

  const handleUpdate = async (slotId: string) => {
    if (!editingLabel.trim()) {
      setMessage('Please enter a slot label');
      return;
    }

    setMessage('');

    try {
      const response = await fetch(`/api/slot-definitions/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotLabel: editingLabel.trim(),
          genderHint: editingGenderHint.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update slot definition');
      }

      await loadSlotDefinitions();
      cancelEditing();
      setMessage('Slot definition updated successfully!');
    } catch (error) {
      setMessage('Error updating slot definition: ' + (error as Error).message);
    }
  };

  const handleDelete = async (slotId: string, slotLabel: string) => {
    if (!confirm(`Are you sure you want to delete slot "${slotLabel}"? This action cannot be undone.`)) {
      return;
    }

    setMessage('');

    try {
      const response = await fetch(`/api/slot-definitions/${slotId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete slot definition');
      }

      await loadSlotDefinitions();
      setMessage(`Deleted slot definition: ${slotLabel}`);
    } catch (error) {
      setMessage('Error deleting slot definition: ' + (error as Error).message);
    }
  };

  const handleDragStart = (e: React.DragEvent, slotId: string) => {
    setDraggedItem(slotId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(slotId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();

    if (!draggedItem || draggedItem === targetSlotId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    setMessage('');

    try {
      const draggedSlot = slotDefinitions.find(s => s.id === draggedItem);
      const targetSlot = slotDefinitions.find(s => s.id === targetSlotId);

      if (!draggedSlot || !targetSlot) {
        throw new Error('Could not find slots to reorder');
      }

      // Only allow reordering within the same tag
      if (draggedSlot.stashappTagId !== targetSlot.stashappTagId) {
        setMessage('Cannot reorder slots across different tags');
        setDraggedItem(null);
        setDragOverItem(null);
        return;
      }

      // Get all slots for this tag
      const tagSlots = slotDefinitions.filter(s => s.stashappTagId === draggedSlot.stashappTagId);
      const draggedIndex = tagSlots.findIndex(s => s.id === draggedItem);
      const targetIndex = tagSlots.findIndex(s => s.id === targetSlotId);

      // Reorder
      const [removed] = tagSlots.splice(draggedIndex, 1);
      tagSlots.splice(targetIndex, 0, removed);

      // Update display orders
      const updatePromises = tagSlots.map((slot, index) =>
        fetch(`/api/slot-definitions/${slot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayOrder: index }),
        })
      );

      await Promise.all(updatePromises);
      await loadSlotDefinitions();
      setMessage('Slot definitions reordered successfully!');
    } catch (error) {
      setMessage('Error reordering slot definitions: ' + (error as Error).message);
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const getTagName = (tagId: number): string => {
    const tag = availableTags.find(t => t.id === tagId.toString());
    return tag?.name || `Tag ID: ${tagId}`;
  };

  // Group slot definitions by tag
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
            message.includes("Error") || message.includes("failed") || message.includes("Cannot")
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

        {/* Create New Slot Definition */}
        <div className="mb-6 p-4 bg-gray-700 rounded-md border border-gray-600">
          <h3 className="text-lg font-medium text-white mb-3">Create New Slot Definition</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tag
              </label>
              <ConfigTagAutocomplete
                value={selectedTagId}
                onChange={setSelectedTagId}
                availableTags={availableTags}
                placeholder="Select a tag..."
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Slot Label
              </label>
              <input
                type="text"
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                placeholder="e.g., 'giver', 'receiver', 'performer'"
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isCreating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating) {
                    handleCreate();
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Gender Hint (Optional)
              </label>
              <input
                type="text"
                value={genderHint}
                onChange={(e) => setGenderHint(e.target.value)}
                placeholder="e.g., 'male', 'female', 'any'"
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isCreating}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={isCreating || !selectedTagId || !slotLabel.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md transition-colors font-medium"
            >
              {isCreating ? "Creating..." : "Create Slot Definition"}
            </button>
          </div>
        </div>

        {/* Existing Slot Definitions */}
        <div>
          <h3 className="text-lg font-medium text-white mb-3">
            Existing Slot Definitions ({slotDefinitions.length})
          </h3>
          {isLoading ? (
            <div className="p-3 bg-gray-700 rounded-md">
              <p className="text-gray-400">Loading slot definitions...</p>
            </div>
          ) : slotDefinitions.length === 0 ? (
            <div className="p-3 bg-gray-700 rounded-md border border-gray-600">
              <p className="text-gray-400">No slot definitions yet. Create one above!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(slotsByTag).map(([tagId, slots]) => (
                <div key={tagId} className="bg-gray-700 p-4 rounded-md">
                  <h4 className="text-lg font-medium text-white mb-3">
                    {getTagName(parseInt(tagId))}
                  </h4>
                  <div className="space-y-2">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`p-3 bg-gray-600 rounded-md border-l-4 transition-all duration-200 ${
                          draggedItem === slot.id ? "opacity-50 border-yellow-500" :
                          dragOverItem === slot.id ? "border-green-500 bg-gray-500" : "border-blue-500"
                        } ${editingId !== slot.id ? "cursor-move" : ""}`}
                        draggable={editingId !== slot.id}
                        onDragStart={(e) => handleDragStart(e, slot.id)}
                        onDragOver={(e) => handleDragOver(e, slot.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, slot.id)}
                      >
                        {editingId === slot.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Slot Label
                              </label>
                              <input
                                type="text"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="w-full p-2 bg-gray-500 border border-gray-400 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdate(slot.id);
                                  } else if (e.key === 'Escape') {
                                    cancelEditing();
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Gender Hint
                              </label>
                              <input
                                type="text"
                                value={editingGenderHint}
                                onChange={(e) => setEditingGenderHint(e.target.value)}
                                className="w-full p-2 bg-gray-500 border border-gray-400 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdate(slot.id)}
                                disabled={!editingLabel.trim()}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-sm text-sm font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-sm text-sm font-medium transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-gray-400 cursor-move" title="Drag to reorder">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-white font-medium">{slot.slotLabel}</p>
                                {slot.genderHint && (
                                  <p className="text-sm text-gray-400">Gender hint: {slot.genderHint}</p>
                                )}
                                <p className="text-xs text-gray-500">Display order: {slot.displayOrder}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditing(slot)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-medium transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(slot.id, slot.slotLabel)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-sm font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
