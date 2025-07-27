"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { 
  selectMarkerGroupingConfig,
  selectMarkerGroups,
  selectMarkerGroupsLoading,
  selectMarkerGroupsError,
  loadMarkerGroups,
  setMarkerGroupingConfig,
  setFullConfig,
  type MarkerGroupTag
} from "@/store/slices/configSlice";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import { TagAutocomplete } from "@/components/marker/TagAutocomplete";
import type { AppConfig } from "@/serverConfig";
import { stashappService } from "@/services/StashappService";

export default function MarkerGroupSettings() {
  const dispatch = useAppDispatch();
  const markerGroupingConfig = useAppSelector(selectMarkerGroupingConfig);
  const availableTags = useAppSelector(selectAvailableTags);
  const reduxMarkerGroups = useAppSelector(selectMarkerGroups);
  const isLoadingGroups = useAppSelector(selectMarkerGroupsLoading);
  const groupsError = useAppSelector(selectMarkerGroupsError);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    markerGroupParent: ""
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  // Sync form data with Redux state
  useEffect(() => {
    setFormData({
      markerGroupParent: markerGroupingConfig.markerGroupParent || ""
    });
  }, [markerGroupingConfig]);
  
  // Load available tags on mount if not already loaded
  useEffect(() => {
    console.log("useEffect triggered - availableTags.length:", availableTags.length);
    if (availableTags.length === 0) {
      console.log("Loading tags...");
      setIsLoadingTags(true);
      dispatch(loadAvailableTags()).finally(() => {
        console.log("Tags loaded!");
        setIsLoadingTags(false);
      });
    }
  }, [dispatch, availableTags.length]);

  useEffect(() => {
    console.log("loadMarkerGroups useEffect - parent:", markerGroupingConfig.markerGroupParent, "tags:", availableTags.length);
    if (markerGroupingConfig.markerGroupParent && availableTags.length > 0) {
      console.log("Dispatching loadMarkerGroups...");
      dispatch(loadMarkerGroups());
    }
  }, [markerGroupingConfig.markerGroupParent, availableTags.length, dispatch]);

  const handleParentChange = (parentId: string) => {
    setFormData({ markerGroupParent: parentId });
    // Also update Redux immediately for UI responsiveness
    dispatch(setMarkerGroupingConfig({ markerGroupParent: parentId }));
  };

  const handleClearParent = () => {
    setFormData({ markerGroupParent: "" });
    // Also update Redux immediately for UI responsiveness
    dispatch(setMarkerGroupingConfig({ markerGroupParent: "" }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Get current full config to preserve other settings
      const configResponse = await fetch('/api/config');
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      // Create updated config with new marker grouping settings
      const appConfig: AppConfig = {
        ...(existingConfig as AppConfig),
        markerGroupingConfig: {
          markerGroupParent: formData.markerGroupParent
        }
      };

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      // Update Redux store
      dispatch(setFullConfig(appConfig));

      setMessage("Configuration saved successfully!");
    } catch (error) {
      setMessage("Error saving configuration: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const getNextMarkerGroupNumber = () => {
    if (reduxMarkerGroups.length === 0) return 1;
    
    const numbers = reduxMarkerGroups
      .map(group => group.orderNumber)
      .filter(num => num !== 999) // Exclude invalid numbers
      .sort((a, b) => a - b);
    
    // Find the first gap or return next number
    for (let i = 1; i <= numbers.length + 1; i++) {
      if (!numbers.includes(i)) {
        return i;
      }
    }
    return numbers.length + 1;
  };

  const handleCreateMarkerGroup = async () => {
    if (!newGroupName.trim()) {
      setMessage("Please enter a name for the marker group.");
      return;
    }

    if (!formData.markerGroupParent) {
      setMessage("Please select a parent tag first.");
      return;
    }

    setIsCreating(true);
    setMessage("");

    try {
      const nextNumber = getNextMarkerGroupNumber();
      const tagName = `Marker Group: ${nextNumber}. ${newGroupName.trim()}`;
      
      // Create the tag with the parent
      await stashappService.createTag(tagName, undefined, [formData.markerGroupParent]);
      
      // Reload available tags and marker groups
      await dispatch(loadAvailableTags());
      await dispatch(loadMarkerGroups());
      
      setNewGroupName("");
      setMessage(`Created marker group: ${tagName}`);
    } catch (error) {
      setMessage("Error creating marker group: " + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMarkerGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingGroupId(groupId);
    setMessage("");

    try {
      await stashappService.deleteTag(groupId);
      
      // Reload available tags and marker groups
      await dispatch(loadAvailableTags());
      await dispatch(loadMarkerGroups());
      
      setMessage(`Deleted marker group: ${groupName}`);
    } catch (error) {
      setMessage("Error deleting marker group: " + (error as Error).message);
    } finally {
      setDeletingGroupId(null);
    }
  };

  const startEditingGroup = (group: MarkerGroupTag) => {
    setEditingGroupId(group.id);
    // Extract just the user-provided name part after "Marker Group: X. "
    const match = group.name.match(/^Marker Group: \d+\. (.+)$/);
    setEditingGroupName(match ? match[1] : group.name);
  };

  const cancelEditingGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  const handleUpdateMarkerGroup = async (groupId: string, currentName: string) => {
    if (!editingGroupName.trim()) {
      setMessage("Please enter a name for the marker group.");
      return;
    }

    setMessage("");

    try {
      // Extract the number from the current name
      const match = currentName.match(/^Marker Group: (\d+)\./);
      const number = match ? match[1] : "1";
      
      const newTagName = `Marker Group: ${number}. ${editingGroupName.trim()}`;
      
      // Update the tag name
      await stashappService.updateTag(groupId, newTagName);
      
      // Reload available tags and marker groups
      await dispatch(loadAvailableTags());
      await dispatch(loadMarkerGroups());
      
      setEditingGroupId(null);
      setEditingGroupName("");
      setMessage(`Updated marker group to: ${newTagName}`);
    } catch (error) {
      setMessage("Error updating marker group: " + (error as Error).message);
    }
  };

  const handleDragStart = (e: React.DragEvent, groupId: string) => {
    setDraggedItem(groupId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(groupId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetGroupId) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    setMessage("");

    try {
      // Find the dragged and target groups
      const draggedGroup = reduxMarkerGroups.find(g => g.id === draggedItem);
      const targetGroup = reduxMarkerGroups.find(g => g.id === targetGroupId);
      
      if (!draggedGroup || !targetGroup) {
        throw new Error("Could not find groups to reorder");
      }

      // Create a copy of the groups array for reordering
      const groupsCopy = [...reduxMarkerGroups];
      const draggedIndex = groupsCopy.findIndex(g => g.id === draggedItem);
      const targetIndex = groupsCopy.findIndex(g => g.id === targetGroupId);

      // Remove dragged item and insert at target position
      const [removed] = groupsCopy.splice(draggedIndex, 1);
      groupsCopy.splice(targetIndex, 0, removed);

      // Update all groups with new sequential numbers and extract user names
      const updatePromises = groupsCopy.map(async (group, index) => {
        const newNumber = index + 1;
        
        // Extract user-provided name part
        const nameMatch = group.name.match(/^Marker Group: \d+\. (.+)$/);
        const userProvidedName = nameMatch ? nameMatch[1] : group.name;
        
        const newTagName = `Marker Group: ${newNumber}. ${userProvidedName}`;
        
        // Only update if the name actually changed
        if (group.name !== newTagName) {
          await stashappService.updateTag(group.id, newTagName);
        }
      });

      // Execute all updates
      await Promise.all(updatePromises);
      
      // Reload available tags and marker groups
      await dispatch(loadAvailableTags());
      await dispatch(loadMarkerGroups());
      
      setMessage("Marker groups reordered successfully!");
    } catch (error) {
      setMessage("Error reordering marker groups: " + (error as Error).message);
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-md transition-colors font-medium"
        >
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

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
        <h2 className="text-xl font-semibold mb-4">Marker Group Settings</h2>
        
        <div className="space-y-6">
          {/* Parent Tag Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Marker Group Parent Tag
            </label>
            <div className="flex gap-2">
              <TagAutocomplete
                value={formData.markerGroupParent || ""}
                onChange={handleParentChange}
                availableTags={availableTags}
                placeholder="Type to search for a parent tag..."
                className="flex-1"
              />
              {formData.markerGroupParent && (
                <button
                  onClick={handleClearParent}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-sm font-medium transition-colors"
                  title="Clear selected parent tag"
                >
                  Clear
                </button>
              )}
            </div>
            {isLoadingTags && (
              <p className="text-sm text-gray-400 mt-1">Loading available tags...</p>
            )}
          </div>

          {/* Marker Groups Display */}
          {formData.markerGroupParent && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Child Marker Groups ({reduxMarkerGroups.length})
              </label>
              <p>Note: Editing or ordering of child marker groups doesn&quot;t require Save Configuration as these are saved directly to Stashapp.</p>
              {isLoadingGroups ? (
                <div className="p-3 bg-gray-700 rounded-md">
                  <p className="text-gray-400">Loading marker groups...</p>
                </div>
              ) : groupsError ? (
                <div className="p-3 bg-red-900/20 border border-red-500 rounded-md">
                  <p className="text-red-400">Error: {groupsError}</p>
                </div>
              ) : reduxMarkerGroups.length > 0 ? (
                <div className="grid gap-2">
                  {reduxMarkerGroups.map(group => (
                    <div 
                      key={group.id} 
                      className={`p-3 bg-gray-700 rounded-md border-l-4 transition-all duration-200 ${
                        draggedItem === group.id ? "opacity-50 border-yellow-500" : 
                        dragOverItem === group.id ? "border-green-500 bg-gray-600" : "border-blue-500"
                      } ${editingGroupId !== group.id ? "cursor-move" : ""}`}
                      draggable={editingGroupId !== group.id}
                      onDragStart={(e) => handleDragStart(e, group.id)}
                      onDragOver={(e) => handleDragOver(e, group.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, group.id)}
                    >
                      {editingGroupId === group.id ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter marker group name"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateMarkerGroup(group.id, group.name);
                                } else if (e.key === 'Escape') {
                                  cancelEditingGroup();
                                }
                              }}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              Will be: &ldquo;Marker Group: {group.orderNumber}. {editingGroupName || '[name]'}&rdquo;
                            </p>
                          </div>
                          <button
                            onClick={() => handleUpdateMarkerGroup(group.id, group.name)}
                            disabled={!editingGroupName.trim()}
                            className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-sm text-sm font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditingGroup}
                            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-sm text-sm font-medium transition-colors"
                          >
                            Cancel
                          </button>
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
                              <p className="text-white font-medium">{group.name}</p>
                              <p className="text-sm text-gray-400">Order: {group.orderNumber}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingGroup(group)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-medium transition-colors"
                              title={`Edit ${group.name}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMarkerGroup(group.id, group.name)}
                              disabled={deletingGroupId === group.id}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-sm text-sm font-medium transition-colors"
                              title={`Delete ${group.name}`}
                            >
                              {deletingGroupId === group.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-gray-700 rounded-md border border-gray-600">
                  <p className="text-gray-400">No marker groups found for this parent tag.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Use the form below to create your first marker group.
                  </p>
                </div>
              )}

              {/* Create New Marker Group */}
              <div className="mt-4 p-4 bg-gray-700 rounded-md border border-gray-600">
                <h3 className="text-lg font-medium text-white mb-3">Create New Marker Group</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Enter marker group name (e.g., 'Intro', 'Main Action', 'Outro')"
                      className="w-full p-3 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isCreating}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isCreating) {
                          handleCreateMarkerGroup();
                        }
                      }}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Will be created as: &ldquo;Marker Group: {getNextMarkerGroupNumber()}. {newGroupName || '[name]'}&rdquo;
                    </p>
                  </div>
                  <button
                    onClick={handleCreateMarkerGroup}
                    disabled={isCreating || !newGroupName.trim()}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md transition-colors font-medium"
                  >
                    {isCreating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}