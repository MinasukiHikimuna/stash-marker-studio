"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectAvailableTags,
  loadAvailableTags,
} from "@/store/slices/markerSlice";
import {
  selectMarkerGroupingConfig,
  setMarkerGroupingConfig,
} from "@/store/slices/configSlice";
import { TagAutocomplete } from "@/components/marker/TagAutocomplete";
import { stashappService } from "@/services/StashappService";
import type { Tag } from "@/services/StashappService";

type MarkerGroupTag = {
  id: string;
  name: string;
  orderNumber: number;
};

export default function MarkerGroupSettings() {
  const dispatch = useAppDispatch();
  const markerGroupingConfig = useAppSelector(selectMarkerGroupingConfig);
  const availableTags = useAppSelector(selectAvailableTags);
  
  const [markerGroupParent, setMarkerGroupParent] = useState("");
  const [markerGroupTags, setMarkerGroupTags] = useState<MarkerGroupTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Load current config
  useEffect(() => {
    setMarkerGroupParent(markerGroupingConfig.markerGroupParent);
  }, [markerGroupingConfig]);

  // Load available tags on component mount if not already loaded
  useEffect(() => {
    if (availableTags.length === 0) {
      setIsLoadingTags(true);
      dispatch(loadAvailableTags()).finally(() => {
        setIsLoadingTags(false);
      });
    }
  }, [dispatch, availableTags.length]);

  // Load marker group tags when parent changes
  useEffect(() => {
    const loadMarkerGroupTags = async () => {
      if (!markerGroupParent) return;
      
      setIsLoading(true);
      try {
        // Find all tags that have the marker group parent as their parent
        // and start with "Marker Group: "
        const groupTags = availableTags
          .filter(tag => 
            tag.parents?.some(parent => parent.id === markerGroupParent) &&
            tag.name.startsWith("Marker Group: ")
          )
          .map(tag => {
            // Extract order number from name like "Marker Group: 1. Position Name"
            const match = tag.name.match(/Marker Group: (\d+)\./);
            const orderNumber = match ? parseInt(match[1], 10) : 999;
            
            return {
              id: tag.id,
              name: tag.name,
              orderNumber,
            };
          })
          .sort((a, b) => {
            // Use natural sorting on the full name to handle numeric ordering properly
            return a.name.localeCompare(b.name, undefined, { 
              numeric: true, 
              sensitivity: 'base' 
            });
          });
          
        setMarkerGroupTags(groupTags);
      } catch (error) {
        console.error("Failed to load marker group tags:", error);
        setMessage("Failed to load marker group tags");
      } finally {
        setIsLoading(false);
      }
    };

    if (markerGroupParent) {
      loadMarkerGroupTags();
    } else {
      setMarkerGroupTags([]);
    }
  }, [markerGroupParent, availableTags]);

  const loadMarkerGroupTags = async () => {
    if (!markerGroupParent) return;
    
    setIsLoading(true);
    try {
      // Find all tags that have the marker group parent as their parent
      // and start with "Marker Group: "
      const groupTags = availableTags
        .filter(tag => 
          tag.parents?.some(parent => parent.id === markerGroupParent) &&
          tag.name.startsWith("Marker Group: ")
        )
        .map(tag => {
          // Extract order number from name like "Marker Group: 1. Position Name"
          const match = tag.name.match(/Marker Group: (\d+)\./);
          const orderNumber = match ? parseInt(match[1], 10) : 999;
          
          return {
            id: tag.id,
            name: tag.name,
            orderNumber,
          };
        })
        .sort((a, b) => {
          // Use natural sorting on the full name to handle numeric ordering properly
          return a.name.localeCompare(b.name, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
        });
        
      setMarkerGroupTags(groupTags);
    } catch (error) {
      console.error("Failed to load marker group tags:", error);
      setMessage("Failed to load marker group tags");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveParentTag = async (newParentValue?: string) => {
    const parentValue = newParentValue ?? markerGroupParent;
    
    try {
      setIsLoading(true);
      
      // Update Redux store
      dispatch(setMarkerGroupingConfig({ markerGroupParent: parentValue }));
      
      // Save to server config
      const configResponse = await fetch('/api/config');
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      const updatedConfig = {
        ...existingConfig,
        markerGroupingConfig: { markerGroupParent: parentValue },
      };

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      setMessage("Parent tag configuration saved!");
    } catch (error) {
      setMessage("Failed to save parent tag: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const addNewMarkerGroup = () => {
    if (!markerGroupParent) {
      setMessage("Please set a marker group parent tag first");
      return;
    }

    setIsCreatingNew(true);
  };

  const createMarkerGroup = async (groupName: string) => {
    try {
      setIsLoading(true);
      
      const nextOrderNumber = markerGroupTags.length > 0 
        ? Math.max(...markerGroupTags.map(tag => tag.orderNumber)) + 1 
        : 1;

      const newTagName = `Marker Group: ${nextOrderNumber}. ${groupName.trim()}`;
      
      // Create the tag with the parent
      await stashappService.createTag(
        newTagName,
        `Marker group ${nextOrderNumber}`,
        [markerGroupParent]
      );
      
      // Refresh the tag list
      await loadMarkerGroupTags();
      await dispatch(loadAvailableTags());
      
      setIsCreatingNew(false);
    } catch (error) {
      setMessage("Failed to create marker group: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelCreateMarkerGroup = () => {
    setIsCreatingNew(false);
  };

  const removeMarkerGroup = async (tagId: string) => {
    try {
      setIsLoading(true);
      
      await stashappService.deleteTag(tagId);
      
      // Refresh the tag lists
      await loadMarkerGroupTags();
      await dispatch(loadAvailableTags());
      
    } catch (error) {
      setMessage("Failed to delete marker group: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };


  const renameMarkerGroup = async (tagId: string, newDisplayName: string) => {
    try {
      setIsLoading(true);
      
      const tag = markerGroupTags.find(t => t.id === tagId);
      if (!tag) return;

      const newTagName = `Marker Group: ${tag.orderNumber}. ${newDisplayName}`;
      
      await stashappService.updateTag(tagId, newTagName, "", [markerGroupParent]);
      
      // Refresh the tag lists
      await loadMarkerGroupTags();
      await dispatch(loadAvailableTags());
      
      setMessage(`Renamed marker group to: ${newDisplayName}`);
    } catch (error) {
      setMessage("Failed to rename marker group: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, tagId: string) => {
    setDraggedItem(tagId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetTagId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetTagId) {
      setDraggedItem(null);
      return;
    }

    await reorderMarkerGroups(draggedItem, targetTagId);
    setDraggedItem(null);
  };

  const reorderMarkerGroups = async (draggedTagId: string, targetTagId: string) => {
    try {
      setIsLoading(true);

      const draggedIndex = markerGroupTags.findIndex(t => t.id === draggedTagId);
      const targetIndex = markerGroupTags.findIndex(t => t.id === targetTagId);
      
      if (draggedIndex === -1 || targetIndex === -1) return;

      // Create new order array
      const newOrder = [...markerGroupTags];
      const draggedTag = newOrder.splice(draggedIndex, 1)[0];
      newOrder.splice(targetIndex, 0, draggedTag);

      // Update all affected tags with new order numbers
      const updatePromises = newOrder.map(async (tag, index) => {
        const newOrderNumber = index + 1;
        const displayName = tag.name.replace(/^Marker Group: \d+\.\s*/, "");
        const newTagName = `Marker Group: ${newOrderNumber}. ${displayName}`;
        
        if (tag.name !== newTagName) {
          await stashappService.updateTag(tag.id, newTagName, "", [markerGroupParent]);
        }
      });

      await Promise.all(updatePromises);
      
      // Refresh the tag lists
      await loadMarkerGroupTags();
      await dispatch(loadAvailableTags());
      
      setMessage("Marker groups reordered successfully");
    } catch (error) {
      setMessage("Failed to reorder marker groups: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get corresponding tag relationships
  const getCorrespondingTagRelationships = () => {
    const relationships: { baseTag: Tag; correspondingTags: Tag[] }[] = [];
    
    // Find all tags that have corresponding tag descriptions
    const tagsWithCorrespondingTags = availableTags.filter(tag => 
      tag.description?.includes("Corresponding Tag: ")
    );

    // Group by the corresponding tag they point to
    const correspondingMap = new Map<string, Tag[]>();
    
    tagsWithCorrespondingTags.forEach(tag => {
      if (tag.description?.includes("Corresponding Tag: ")) {
        const correspondingTagName = tag.description
          .split("Corresponding Tag: ")[1]
          .trim();
        
        const baseTag = availableTags.find(t => t.name === correspondingTagName);
        if (baseTag) {
          if (!correspondingMap.has(baseTag.name)) {
            correspondingMap.set(baseTag.name, []);
          }
          correspondingMap.get(baseTag.name)?.push(tag);
        }
      }
    });

    // Convert map to array format
    correspondingMap.forEach((correspondingTags, baseTagName) => {
      const baseTag = availableTags.find(t => t.name === baseTagName);
      if (baseTag) {
        relationships.push({ baseTag, correspondingTags });
      }
    });

    return relationships;
  };

  // Helper function to find tags that can have corresponding tags set
  const getTagsWithoutCorrespondingTags = () => {
    const relationships = getCorrespondingTagRelationships();
    const tagsWithCorrespondingTags = new Set();
    const tagsUsedAsCorresponding = new Set();

    // Track which tags already have corresponding relationships
    relationships.forEach(({ baseTag, correspondingTags }) => {
      tagsUsedAsCorresponding.add(baseTag.name);
      correspondingTags.forEach(tag => {
        tagsWithCorrespondingTags.add(tag.name);
      });
    });

    // Find tags that don't have corresponding tags and aren't used as corresponding tags
    return availableTags.filter(tag => 
      !tagsWithCorrespondingTags.has(tag.name) && 
      !tagsUsedAsCorresponding.has(tag.name) &&
      !tag.description?.includes("Corresponding Tag: ")
    );
  };

  // Handle removing a corresponding tag relationship
  const removeCorrespondingTag = async (tagId: string) => {
    try {
      setIsLoading(true);
      
      const tag = availableTags.find(t => t.id === tagId);
      if (!tag) return;

      let newDescription = tag.description || '';
      
      // Remove existing "Corresponding Tag: " entry
      newDescription = newDescription.replace(/Corresponding Tag: [^\n]*/g, '').trim();
      
      await stashappService.updateTag(tagId, undefined, newDescription);
      
      // Refresh tags to reflect the change
      dispatch(loadAvailableTags());
      
      setMessage(`Removed corresponding tag relationship for: ${tag.name}`);
    } catch (error) {
      setMessage("Failed to remove corresponding tag: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle setting a corresponding tag
  const setCorrespondingTag = async (baseTagId: string, correspondingTagId: string) => {
    try {
      setIsLoading(true);
      
      const correspondingTag = availableTags.find(tag => tag.id === correspondingTagId);
      const baseTag = availableTags.find(tag => tag.id === baseTagId);
      
      if (!correspondingTag || !baseTag) {
        setMessage("Tag not found");
        return;
      }

      let newDescription = correspondingTag.description || '';
      
      // Remove existing "Corresponding Tag: " entry if it exists
      newDescription = newDescription.replace(/Corresponding Tag: [^\n]*/g, '').trim();
      
      // Add new corresponding tag
      if (newDescription) {
        newDescription += '\n';
      }
      newDescription += `Corresponding Tag: ${baseTag.name}`;

      await stashappService.updateTag(correspondingTagId, undefined, newDescription);
      
      // Refresh tags to reflect the change
      dispatch(loadAvailableTags());
      
      setMessage(`Set ${correspondingTag.name} to correspond to ${baseTag.name}`);
    } catch (error) {
      setMessage("Failed to set corresponding tag: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while tags are being loaded
  if (isLoadingTags) {
    return (
      <div className="space-y-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading available tags...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes("Failed") || message.includes("Error")
              ? "bg-red-900 border border-red-700 text-red-100"
              : "bg-green-900 border border-green-700 text-green-100"
          }`}
        >
          {message}
        </div>
      )}

      {/* Marker Group Parent Tag Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Marker Group Parent Tag</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Parent Tag for Marker Groups
            </label>
            <TagAutocomplete
              value={markerGroupParent}
              onChange={(newValue) => {
                setMarkerGroupParent(newValue);
                handleSaveParentTag(newValue);
              }}
              availableTags={availableTags}
              placeholder="Search for marker group parent tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-2">
              This tag will be the parent of all marker group tags.
            </p>
          </div>
        </div>
      </div>

      {/* Marker Group Tags Management */}
      {markerGroupParent && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Marker Group Tags</h2>
            <button
              onClick={addNewMarkerGroup}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Add New Group
            </button>
          </div>

          <p>Marker group tags will automatically be prefixed with &ldquo;Marker Group: x.&rdquo; to support easy sorting in the timeline.</p>
          
          {isLoading ? (
            <div className="text-center py-4">Loading marker groups...</div>
          ) : markerGroupTags.length === 0 && !isCreatingNew ? (
            <div className="text-center py-8 text-gray-400">
              No marker group tags found. Click &quot;Add New Group&quot; to create your first marker group.
            </div>
          ) : (
            <div className="space-y-3">
              {isCreatingNew && (
                <NewMarkerGroupItem
                  onSave={createMarkerGroup}
                  onCancel={cancelCreateMarkerGroup}
                  nextOrderNumber={markerGroupTags.length > 0 
                    ? Math.max(...markerGroupTags.map(tag => tag.orderNumber)) + 1 
                    : 1}
                />
              )}
              {markerGroupTags.map((tag) => (
                <MarkerGroupTagItem
                  key={tag.id}
                  tag={tag}
                  isDragging={draggedItem === tag.id}
                  onRename={(newDisplayName) => renameMarkerGroup(tag.id, newDisplayName)}
                  onRemove={() => removeMarkerGroup(tag.id)}
                  onDragStart={(e) => handleDragStart(e, tag.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, tag.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Corresponding Tag Relationships */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Corresponding Tag Relationships</h2>
        
        {(() => {
          const relationships = getCorrespondingTagRelationships();
          const availableForCorrespondingTags = getTagsWithoutCorrespondingTags();
          
          return (
            <div className="space-y-6">
              {/* Show existing relationships */}
              {relationships.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Current Relationships</h3>
                  {relationships.map(({ baseTag, correspondingTags }) => (
                    <div key={baseTag.id} className="bg-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-300 mb-2">
                        <span className="font-medium text-white">{baseTag.name}</span> has the following corresponding tags:
                      </div>
                      <div className="space-y-2">
                        {correspondingTags.map(tag => (
                          <div key={tag.id} className="flex items-center justify-between bg-gray-600 px-3 py-2 rounded">
                            <span className="text-sm text-gray-200">- {tag.name}</span>
                            <button
                              onClick={() => removeCorrespondingTag(tag.id)}
                              className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                              disabled={isLoading}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show tags that can have corresponding tags set */}
              {availableForCorrespondingTags.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Set Corresponding Tags</h3>
                  <p className="text-sm text-gray-400">
                    These tags don&apos;t have corresponding tag relationships. You can set a corresponding tag for any of them.
                  </p>
                  {availableForCorrespondingTags.map(tag => (
                    <CorrespondingTagSetter
                      key={tag.id}
                      tag={tag}
                      availableTags={availableTags.filter(t => 
                        t.id !== tag.id && 
                        !availableForCorrespondingTags.some(at => at.id === t.id)
                      )}
                      onSet={(baseTagId) => setCorrespondingTag(baseTagId, tag.id)}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              )}

              {relationships.length === 0 && availableForCorrespondingTags.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  All tags have corresponding tag relationships defined.
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

interface CorrespondingTagSetterProps {
  tag: Tag;
  availableTags: Tag[];
  onSet: (baseTagId: string) => void;
  isLoading: boolean;
}

function CorrespondingTagSetter({ tag, availableTags, onSet, isLoading }: CorrespondingTagSetterProps) {
  const [selectedBaseTagId, setSelectedBaseTagId] = useState("");

  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <div className="space-y-3">
        <div className="text-sm">
          <span className="font-medium text-white">{tag.name}</span>
          <span className="text-gray-400"> corresponds to:</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TagAutocomplete
              value={selectedBaseTagId}
              onChange={setSelectedBaseTagId}
              availableTags={availableTags}
              placeholder="Search for base tag..."
            />
          </div>
          <button
            onClick={() => {
              if (selectedBaseTagId) {
                onSet(selectedBaseTagId);
                setSelectedBaseTagId("");
              }
            }}
            disabled={!selectedBaseTagId || isLoading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
          >
            Set
          </button>
        </div>
      </div>
    </div>
  );
}

interface NewMarkerGroupItemProps {
  onSave: (groupName: string) => void;
  onCancel: () => void;
  nextOrderNumber: number;
}

function NewMarkerGroupItem({ onSave, onCancel, nextOrderNumber }: NewMarkerGroupItemProps) {
  const [groupName, setGroupName] = useState("");

  const handleSave = () => {
    if (groupName.trim()) {
      onSave(groupName.trim());
    }
  };

  const handleCancel = () => {
    setGroupName("");
    onCancel();
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border-2 border-green-500">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="text-gray-400 select-none">
              ⋮⋮
            </div>
            <span className="text-sm text-gray-400 font-mono">
              {nextOrderNumber}.
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              className="flex-1 p-2 bg-gray-600 border border-gray-500 rounded text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Enter group name..."
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!groupName.trim()}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              Create
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MarkerGroupTagItemProps {
  tag: MarkerGroupTag;
  isDragging: boolean;
  onRename: (newDisplayName: string) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function MarkerGroupTagItem({ 
  tag, 
  isDragging, 
  onRename, 
  onRemove, 
  onDragStart, 
  onDragOver, 
  onDrop 
}: MarkerGroupTagItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");

  // Extract display name from full tag name
  const displayName = tag.name.replace(/^Marker Group: \d+\.\s*/, "");

  const startEditing = () => {
    setEditingName(displayName);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (editingName.trim() && editingName !== displayName) {
      onRename(editingName.trim());
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingName("");
  };

  return (
    <div 
      className={`flex items-center justify-between p-4 bg-gray-700 rounded-lg cursor-move transition-opacity ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } hover:bg-gray-600`}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="text-gray-400 cursor-move select-none" title="Drag to reorder">
              ⋮⋮
            </div>
            <span className="text-sm text-gray-400 font-mono">
              {tag.orderNumber}.
            </span>
          </div>
          {isEditing ? (
            <div className="flex items-center space-x-2 flex-1">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className="flex-1 p-2 bg-gray-600 border border-gray-500 rounded text-sm focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveEdit}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex-1">
              <span className="font-medium">{displayName}</span>
            </div>
          )}
        </div>
      </div>
      
      {!isEditing && (
        <div className="flex items-center space-x-2">
          <button
            onClick={startEditing}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
          >
            Rename
          </button>
          <button
            onClick={onRemove}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}