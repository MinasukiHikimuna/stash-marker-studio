"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectMarkerGroups,
  selectMarkerGroupsLoading,
  selectMarkerGroupsError,
  selectMarkerGroupTagSorting,
  loadMarkerGroups,
  loadChildTags,
  setMarkerGroupTagSorting,
  type MarkerGroupTag
} from "@/store/slices/configSlice";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import { stashappService } from "@/services/StashappService";

export default function MarkerGroupSettings() {
  const dispatch = useAppDispatch();
  const availableTags = useAppSelector(selectAvailableTags);
  const reduxMarkerGroups = useAppSelector(selectMarkerGroups);
  const isLoadingGroups = useAppSelector(selectMarkerGroupsLoading);
  const groupsError = useAppSelector(selectMarkerGroupsError);
  const tagSorting = useAppSelector(selectMarkerGroupTagSorting);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [message, setMessage] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [draggedChildTag, setDraggedChildTag] = useState<string | null>(null);
  const [dragOverChildTag, setDragOverChildTag] = useState<string | null>(null);

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
    if (availableTags.length > 0) {
      dispatch(loadMarkerGroups());
    }
  }, [availableTags.length, dispatch]);

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

    setIsCreating(true);
    setMessage("");

    try {
      const nextNumber = getNextMarkerGroupNumber();
      const tagName = `Marker Group: ${nextNumber}. ${newGroupName.trim()}`;

      // Create the tag without parents (no parent tag required anymore)
      await stashappService.createTag(tagName);

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

  const toggleGroupExpansion = async (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      // Load child tags if not already loaded
      const group = reduxMarkerGroups.find(g => g.id === groupId);
      if (group && !group.childTags) {
        await dispatch(loadChildTags(groupId));
      }
    }
    setExpandedGroups(newExpanded);
  };

  const handleChildTagDragStart = (e: React.DragEvent, childTagId: string) => {
    console.log("🔄 [DRAG] Starting drag for child tag:", childTagId);
    setDraggedChildTag(childTagId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleChildTagDragOver = (e: React.DragEvent, childTagId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverChildTag !== childTagId) {
      console.log("🎯 [DRAG] Drag over child tag:", childTagId);
      setDragOverChildTag(childTagId);
    }
  };

  const handleChildTagDragLeave = () => {
    console.log("🚫 [DRAG] Drag leave");
    setDragOverChildTag(null);
  };

  const handleChildTagDrop = async (e: React.DragEvent, targetTagId: string, markerGroupId: string) => {
    e.preventDefault();
    
    console.log("🎯 [DROP] Drop attempted - dragged:", draggedChildTag, "target:", targetTagId);
    
    if (!draggedChildTag || draggedChildTag === targetTagId) {
      console.log("🚫 [DROP] Cancelled - same tag or no dragged tag");
      setDraggedChildTag(null);
      setDragOverChildTag(null);
      return;
    }

    setMessage("");

    try {
      const markerGroup = reduxMarkerGroups.find(g => g.id === markerGroupId);
      if (!markerGroup?.childTags) {
        throw new Error("Child tags not loaded");
      }

      console.log("📋 [DROP] Current child tags:", markerGroup.childTags.map(t => ({ id: t.id, name: t.name })));

      // Use the DISPLAYED order (which includes current sort order) instead of raw childTags
      const currentDisplayOrder = markerGroup.childTags
        .slice() // Create a copy to avoid mutating the original
        .sort((a, b) => {
          // Sort using the sort order from app config
          const sortOrder = tagSorting[markerGroupId] || [];
          if (sortOrder.length > 0) {
            const aIndex = sortOrder.indexOf(a.id);
            const bIndex = sortOrder.indexOf(b.id);
            
            // If both are in sort order, use that order
            if (aIndex !== -1 && bIndex !== -1) {
              return aIndex - bIndex;
            }
            // If only one is in sort order, put it first
            if (aIndex !== -1 && bIndex === -1) {
              return -1;
            }
            if (aIndex === -1 && bIndex !== -1) {
              return 1;
            }
          }
          // Fallback to alphabetical
          return a.name.localeCompare(b.name);
        });

      console.log("📋 [DROP] Current display order:", currentDisplayOrder.map(t => ({ id: t.id, name: t.name })));

      const draggedIndex = currentDisplayOrder.findIndex(tag => tag.id === draggedChildTag);
      const targetIndex = currentDisplayOrder.findIndex(tag => tag.id === targetTagId);

      console.log("📍 [DROP] Indices - dragged:", draggedIndex, "target:", targetIndex);

      if (draggedIndex === -1 || targetIndex === -1) {
        throw new Error("Could not find tags to reorder");
      }

      // Remove dragged item and insert at target position
      const [removed] = currentDisplayOrder.splice(draggedIndex, 1);
      currentDisplayOrder.splice(targetIndex, 0, removed);

      console.log("📋 [DROP] New order:", currentDisplayOrder.map(t => ({ id: t.id, name: t.name })));

      // Create complete sort order from all child tags
      const sortOrderIds = currentDisplayOrder.map(tag => tag.id);

      console.log("💾 [DROP] New sort order:", sortOrderIds);

      // Update the sort order in Redux state
      dispatch(setMarkerGroupTagSorting({ markerGroupId, sortOrder: sortOrderIds }));

      // Save the updated sorting to database
      const saveResponse = await fetch('/api/marker-group-tag-sorting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markerGroupId, tagIds: sortOrderIds })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save tag sorting');
      }

      console.log("✅ [DROP] Drop completed successfully");
      setMessage("Child tags reordered successfully!");
    } catch (error) {
      console.error("❌ [DROP] Drop failed:", error);
      setMessage("Error reordering child tags: " + (error as Error).message);
    } finally {
      setDraggedChildTag(null);
      setDragOverChildTag(null);
    }
  };

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
        <h2 className="text-xl font-semibold mb-4">Marker Group Settings</h2>

        <div className="space-y-6">
          {/* Marker Groups Display */}
          {isLoadingTags ? (
            <div className="p-3 bg-gray-700 rounded-md">
              <p className="text-gray-400">Loading available tags...</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Marker Groups ({reduxMarkerGroups.length})
              </label>
              <p className="text-sm text-gray-400 mb-2">Note: Marker groups are identified by the &ldquo;Marker Group:&rdquo; naming convention. Changes are saved directly to Stashapp.</p>
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
                              onClick={() => toggleGroupExpansion(group.id)}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-sm font-medium transition-colors"
                              title={`${expandedGroups.has(group.id) ? 'Hide' : 'Show'} child tags`}
                            >
                              {expandedGroups.has(group.id) ? '▼' : '▶'} Tags
                            </button>
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
                      
                      {/* Child Tags Display */}
                      {expandedGroups.has(group.id) && (
                        <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-600">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            Child Tags ({group.childTags?.length || 0})
                          </h4>
                          {group.childTags ? (
                            group.childTags.length > 0 ? (
                              <div className="space-y-1">
                                {group.childTags
                                  .slice() // Create a copy to avoid mutating the original
                                  .sort((a, b) => {
                                    // Sort using the sort order from app config
                                    const sortOrder = tagSorting[group.id] || [];
                                    if (sortOrder.length > 0) {
                                      const aIndex = sortOrder.indexOf(a.id);
                                      const bIndex = sortOrder.indexOf(b.id);
                                      
                                      // If both are in sort order, use that order
                                      if (aIndex !== -1 && bIndex !== -1) {
                                        return aIndex - bIndex;
                                      }
                                      // If only one is in sort order, put it first
                                      if (aIndex !== -1 && bIndex === -1) {
                                        return -1;
                                      }
                                      if (aIndex === -1 && bIndex !== -1) {
                                        return 1;
                                      }
                                    }
                                    // Fallback to alphabetical
                                    return a.name.localeCompare(b.name);
                                  })
                                  .map((childTag, index) => (
                                  <div key={childTag.id} className="relative">
                                    {/* Drop indicator above */}
                                    {dragOverChildTag === childTag.id && draggedChildTag !== childTag.id && (
                                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-green-400 z-10 rounded-full"></div>
                                    )}
                                    
                                    <div 
                                      className={`p-2 bg-gray-600 rounded transition-all duration-200 ${
                                        draggedChildTag === childTag.id ? "opacity-50" : ""
                                      } cursor-move`}
                                      draggable
                                      onDragStart={(e) => handleChildTagDragStart(e, childTag.id)}
                                      onDragOver={(e) => handleChildTagDragOver(e, childTag.id)}
                                      onDragLeave={handleChildTagDragLeave}
                                      onDrop={(e) => handleChildTagDrop(e, childTag.id, group.id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="text-gray-400 cursor-move" title="Drag to reorder">
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                                          </svg>
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-white text-sm font-medium">{childTag.name}</p>
                                          <p className="text-xs text-gray-400">Position: {index + 1}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">No child tags found for this marker group.</p>
                            )
                          ) : (
                            <p className="text-sm text-gray-400">Loading child tags...</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-gray-700 rounded-md border border-gray-600">
                  <p className="text-gray-400">No marker groups found.</p>
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