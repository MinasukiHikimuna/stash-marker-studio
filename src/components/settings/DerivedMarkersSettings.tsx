"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import { setFullConfig } from "@/store/slices/configSlice";
import { ConfigTagAutocomplete } from "@/components/settings/ConfigTagAutocomplete";
import DerivedMarkersTreeView from "@/components/settings/DerivedMarkersTreeView";
import { SlotDefinitionEditor } from "@/components/settings/SlotDefinitionEditor";
import type { AppConfig, DerivedMarkerConfig } from "@/serverConfig";
import type { SlotDefinitionSet } from "@/core/slot/types";

export default function DerivedMarkersSettings() {
  const dispatch = useAppDispatch();
  const availableTags = useAppSelector(selectAvailableTags);

  const [derivedMarkers, setDerivedMarkers] = useState<DerivedMarkerConfig[]>([]);
  const [maxDerivationDepth, setMaxDerivationDepth] = useState<number>(3);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [message, setMessage] = useState("");
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState<DerivedMarkerConfig>({
    sourceTagId: "",
    derivedTagId: "",
    relationshipType: "implies",
    slotMapping: {},
  });

  // Cache slot definitions per tag
  const [slotDefinitionSets, setSlotDefinitionSets] = useState<Record<string, SlotDefinitionSet>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});

  // Editing state for slot mappings
  const [editSourceSlotId, setEditSourceSlotId] = useState<string>("");
  const [editDerivedSlotId, setEditDerivedSlotId] = useState<string>("");

  // State for inline slot definition editing
  const [showSourceSlotEditor, setShowSourceSlotEditor] = useState(false);
  const [showDerivedSlotEditor, setShowDerivedSlotEditor] = useState(false);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const config: AppConfig = await response.json();
          setDerivedMarkers(config.derivedMarkers || []);
          setMaxDerivationDepth(config.maxDerivationDepth || 3);
        }
      } catch (error) {
        console.error("Failed to load configuration:", error);
        setMessage("Error loading configuration: " + (error as Error).message);
      }
    };

    loadConfig();
  }, []);

  // Load available tags on mount
  useEffect(() => {
    if (availableTags.length === 0) {
      setIsLoadingTags(true);
      dispatch(loadAvailableTags()).finally(() => {
        setIsLoadingTags(false);
      });
    }
  }, [dispatch, availableTags.length]);

  // Load slot definitions for all tags used in derivation rules
  useEffect(() => {
    const tagIds = new Set<string>();
    derivedMarkers.forEach(rule => {
      if (rule.sourceTagId) tagIds.add(rule.sourceTagId);
      if (rule.derivedTagId) tagIds.add(rule.derivedTagId);
    });

    tagIds.forEach(tagId => {
      loadSlotDefinitionsForTag(tagId);
    });
  }, [derivedMarkers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load slot definitions for a tag
  const loadSlotDefinitionsForTag = async (tagId: string) => {
    if (slotDefinitionSets[tagId] || loadingSlots[tagId]) {
      return; // Already loaded or loading
    }

    setLoadingSlots(prev => ({ ...prev, [tagId]: true }));

    try {
      const response = await fetch(`/api/slot-definition-sets?tagId=${tagId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.slotDefinitionSets && data.slotDefinitionSets.length > 0) {
          setSlotDefinitionSets(prev => ({
            ...prev,
            [tagId]: data.slotDefinitionSets[0]
          }));
        }
      }
    } catch (error) {
      console.error(`Failed to load slot definitions for tag ${tagId}:`, error);
    } finally {
      setLoadingSlots(prev => ({ ...prev, [tagId]: false }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Get current full config to preserve other settings
      const configResponse = await fetch("/api/config");
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      // Create updated config with new derived markers settings
      const appConfig: AppConfig = {
        ...(existingConfig as AppConfig),
        derivedMarkers,
        maxDerivationDepth,
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

  const openAddRuleDialog = () => {
    setNewRule({
      sourceTagId: "",
      derivedTagId: "",
      relationshipType: "implies",
      slotMapping: {},
    });
    setShowAddRuleDialog(true);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const closeAddRuleDialog = () => {
    setShowAddRuleDialog(false);
  };

  const saveNewRule = () => {
    if (!newRule.sourceTagId || !newRule.derivedTagId) {
      setMessage("Error: Both source and derived tags must be selected");
      return;
    }
    setDerivedMarkers([...derivedMarkers, newRule]);
    setShowAddRuleDialog(false);
    setMessage("Rule added successfully. Click 'Save Configuration' to persist changes.");
  };

  const removeRule = (index: number) => {
    setDerivedMarkers(derivedMarkers.filter((_, i) => i !== index));
    setMessage("Rule removed. Click 'Save Configuration' to persist changes.");
  };

  const startEditingSlots = (rule: DerivedMarkerConfig, index: number) => {
    setEditingRuleIndex(index);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
    setShowSourceSlotEditor(false);
    setShowDerivedSlotEditor(false);

    // Load slot definitions for both tags, then auto-match slots
    Promise.all([
      rule.sourceTagId ? loadSlotDefinitionsForTag(rule.sourceTagId) : Promise.resolve(),
      rule.derivedTagId ? loadSlotDefinitionsForTag(rule.derivedTagId) : Promise.resolve(),
    ]).then(() => {
      autoMatchSlots(rule, index);
    });
  };

  const autoMatchSlots = (rule: DerivedMarkerConfig, index: number) => {
    const sourceSlotSet = rule.sourceTagId ? slotDefinitionSets[rule.sourceTagId] : null;
    const derivedSlotSet = rule.derivedTagId ? slotDefinitionSets[rule.derivedTagId] : null;

    if (!sourceSlotSet?.slotDefinitions || !derivedSlotSet?.slotDefinitions) {
      return;
    }

    const existingMapping = rule.slotMapping || {};
    const newMapping: Record<string, string> = { ...existingMapping };

    // Auto-match slots with identical labels
    sourceSlotSet.slotDefinitions.forEach(sourceSlot => {
      // Skip if already mapped
      if (existingMapping[sourceSlot.id]) {
        return;
      }

      const sourceLabel = sourceSlot.slotLabel?.trim().toLowerCase();
      if (!sourceLabel) return;

      // Find matching derived slot by label
      const matchingDerivedSlot = derivedSlotSet.slotDefinitions?.find(
        derivedSlot => derivedSlot.slotLabel?.trim().toLowerCase() === sourceLabel
      );

      if (matchingDerivedSlot) {
        newMapping[sourceSlot.id] = matchingDerivedSlot.id;
      }
    });

    // Update mappings if any auto-matches were found
    if (Object.keys(newMapping).length > Object.keys(existingMapping).length) {
      const updated = [...derivedMarkers];
      updated[index].slotMapping = newMapping;
      setDerivedMarkers(updated);
    }
  };

  const cancelEditingSlots = () => {
    setEditingRuleIndex(null);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const saveSlots = () => {
    setEditingRuleIndex(null);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const addSlotMapping = (index: number) => {
    if (!editSourceSlotId || !editDerivedSlotId) {
      return;
    }

    const updated = [...derivedMarkers];
    const currentMapping = updated[index].slotMapping || {};

    updated[index].slotMapping = {
      ...currentMapping,
      [editSourceSlotId]: editDerivedSlotId,
    };

    setDerivedMarkers(updated);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const removeSlotMapping = (index: number, sourceSlotId: string) => {
    const updated = [...derivedMarkers];
    const currentMapping = { ...updated[index].slotMapping };
    delete currentMapping[sourceSlotId];
    updated[index].slotMapping = currentMapping;
    setDerivedMarkers(updated);
  };

  const getTagName = (tagId: string) => {
    const tag = availableTags.find(t => t.id === tagId);
    return tag ? tag.name : tagId;
  };

  const getSlotLabel = (tagId: string, slotDefId: string) => {
    const slotSet = slotDefinitionSets[tagId];
    if (!slotSet) return slotDefId;

    const slotDef = slotSet.slotDefinitions?.find(sd => sd.id === slotDefId);
    return slotDef?.slotLabel || `Slot ${slotDefId.slice(0, 8)}...`;
  };

  const handleSlotDefinitionSaved = async (tagId: string, slotDefinitionSet: SlotDefinitionSet) => {
    // Update the cached slot definition set
    setSlotDefinitionSets(prev => ({
      ...prev,
      [tagId]: slotDefinitionSet
    }));

    // If we're editing a rule, re-run auto-matching with new slot definitions
    if (editingRuleIndex !== null) {
      const rule = derivedMarkers[editingRuleIndex];
      setTimeout(() => autoMatchSlots(rule, editingRuleIndex), 100);
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

      {isLoadingTags && (
        <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-md">
          <p className="text-blue-100 text-sm">Loading available tags...</p>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Derived Markers Configuration</h2>

        <div className="space-y-6">
          {/* Max Derivation Depth */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Derivation Depth
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxDerivationDepth}
              onChange={(e) => setMaxDerivationDepth(parseInt(e.target.value, 10) || 3)}
              className="w-32 p-2 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Controls how many levels deep derivation chains can go (default: 3)
            </p>
          </div>

          {/* Derivation Rules */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-300">
                Derivation Rules ({derivedMarkers.length})
              </label>
              <button
                onClick={openAddRuleDialog}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-medium transition-colors"
              >
                + Add Rule
              </button>
            </div>

            {/* Tree View */}
            <DerivedMarkersTreeView
              derivedMarkers={derivedMarkers}
              slotDefinitionSets={slotDefinitionSets}
              availableTags={availableTags}
              onEditSlots={startEditingSlots}
              onRemoveRule={removeRule}
              getRuleIndex={(rule) => derivedMarkers.indexOf(rule)}
            />
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">About Derived Markers</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            Derived markers are automatically generated based on tag ontology relationships.
            When you have a marker with a specific tag, the system can automatically derive more general tags.
          </p>
          <p>
            <strong>Example:</strong> A marker tagged &quot;Blowjob&quot; can automatically derive &quot;Oral Sex&quot; and &quot;Sex Act&quot; markers.
          </p>
          <p>
            <strong>Slot Mapping:</strong> Maps performer slot UUIDs from the source tag to the derived tag.
            This ensures mappings remain valid even if slot labels are renamed. Only mapped slots are included in derived markers.
          </p>
          <p>
            <strong>Multi-level Derivation:</strong> The system supports chaining across multiple levels
            (e.g., &quot;Reverse Cowgirl (DP)&quot; → &quot;Reverse Cowgirl&quot; → &quot;Vaginal Sex&quot;).
          </p>
        </div>
      </div>

      {/* Add Rule Dialog */}
      {showAddRuleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Derivation Rule</h3>

            <div className="space-y-4">
              {/* Source Tag */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Source Tag (specific)
                </label>
                <ConfigTagAutocomplete
                  value={newRule.sourceTagId}
                  onChange={(tagId) => {
                    setNewRule({ ...newRule, sourceTagId: tagId });
                    if (tagId) loadSlotDefinitionsForTag(tagId);
                  }}
                  availableTags={availableTags}
                  placeholder="Select source tag..."
                  className="w-full"
                />
              </div>

              {/* Relationship Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Relationship
                </label>
                <select
                  value={newRule.relationshipType}
                  onChange={(e) => setNewRule({ ...newRule, relationshipType: e.target.value as "implies" | "conflicts" })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="implies">implies</option>
                  <option value="conflicts">conflicts</option>
                </select>
              </div>

              {/* Derived Tag */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Derived Tag (general)
                </label>
                <ConfigTagAutocomplete
                  value={newRule.derivedTagId}
                  onChange={(tagId) => {
                    setNewRule({ ...newRule, derivedTagId: tagId });
                    if (tagId) loadSlotDefinitionsForTag(tagId);
                  }}
                  availableTags={availableTags}
                  placeholder="Select derived tag..."
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeAddRuleDialog}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={saveNewRule}
                disabled={!newRule.sourceTagId || !newRule.derivedTagId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Slots Dialog */}
      {editingRuleIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Slot Mappings</h3>

            {(() => {
              const rule = derivedMarkers[editingRuleIndex];
              const sourceSlotSet = rule.sourceTagId ? slotDefinitionSets[rule.sourceTagId] : null;
              const derivedSlotSet = rule.derivedTagId ? slotDefinitionSets[rule.derivedTagId] : null;

              return (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-700 rounded-md">
                    <p className="text-sm text-gray-300">
                      <strong>Rule:</strong> {getTagName(rule.sourceTagId)} {rule.relationshipType} {getTagName(rule.derivedTagId)}
                    </p>
                  </div>

                  {/* Slot Definitions Side-by-Side */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Source Tag Slot Definitions */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-blue-400">
                          Source: {getTagName(rule.sourceTagId)}
                        </h4>
                        <button
                          onClick={() => setShowSourceSlotEditor(!showSourceSlotEditor)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium"
                        >
                          {showSourceSlotEditor ? "Hide Editor" : "Edit Slots"}
                        </button>
                      </div>

                      {showSourceSlotEditor ? (
                        <SlotDefinitionEditor
                          tagId={rule.sourceTagId}
                          tagName={getTagName(rule.sourceTagId)}
                          initialSlotDefinitionSet={sourceSlotSet}
                          onSave={(slotDefSet) => handleSlotDefinitionSaved(rule.sourceTagId, slotDefSet)}
                          showSaveButton={true}
                          compact={true}
                          className="bg-gray-800 p-3 rounded"
                        />
                      ) : (
                        <div className="space-y-1">
                          {sourceSlotSet?.slotDefinitions && sourceSlotSet.slotDefinitions.length > 0 ? (
                            [...sourceSlotSet.slotDefinitions]
                              .sort((a, b) => a.order - b.order)
                              .map((slot, idx) => {
                                const genderHintLabels = Array.isArray(slot.genderHints)
                                  ? slot.genderHints.map(h => typeof h === 'string' ? h : h.genderHint).join('/')
                                  : '';
                                return (
                                  <div key={slot.id} className="text-sm text-gray-300 p-2 bg-gray-800 rounded">
                                    {idx + 1}. {slot.slotLabel || "Unnamed slot"}
                                    {genderHintLabels && (
                                      <span className="text-gray-500 ml-2 text-xs">
                                        ({genderHintLabels})
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-xs text-yellow-400">
                              No slot definitions. Click &quot;Edit Slots&quot; to add them.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Derived Tag Slot Definitions */}
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-green-400">
                          Derived: {getTagName(rule.derivedTagId)}
                        </h4>
                        <button
                          onClick={() => setShowDerivedSlotEditor(!showDerivedSlotEditor)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium"
                        >
                          {showDerivedSlotEditor ? "Hide Editor" : "Edit Slots"}
                        </button>
                      </div>

                      {showDerivedSlotEditor ? (
                        <SlotDefinitionEditor
                          tagId={rule.derivedTagId}
                          tagName={getTagName(rule.derivedTagId)}
                          initialSlotDefinitionSet={derivedSlotSet}
                          onSave={(slotDefSet) => handleSlotDefinitionSaved(rule.derivedTagId, slotDefSet)}
                          showSaveButton={true}
                          compact={true}
                          className="bg-gray-800 p-3 rounded"
                        />
                      ) : (
                        <div className="space-y-1">
                          {derivedSlotSet?.slotDefinitions && derivedSlotSet.slotDefinitions.length > 0 ? (
                            [...derivedSlotSet.slotDefinitions]
                              .sort((a, b) => a.order - b.order)
                              .map((slot, idx) => {
                                const genderHintLabels = Array.isArray(slot.genderHints)
                                  ? slot.genderHints.map(h => typeof h === 'string' ? h : h.genderHint).join('/')
                                  : '';
                                return (
                                  <div key={slot.id} className="text-sm text-gray-300 p-2 bg-gray-800 rounded">
                                    {idx + 1}. {slot.slotLabel || "Unnamed slot"}
                                    {genderHintLabels && (
                                      <span className="text-gray-500 ml-2 text-xs">
                                        ({genderHintLabels})
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                          ) : (
                            <p className="text-xs text-yellow-400">
                              No slot definitions. Click &quot;Edit Slots&quot; to add them.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Existing mappings */}
                  {Object.keys(rule.slotMapping || {}).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-300 font-medium">Existing Mappings:</p>
                      {Object.entries(rule.slotMapping || {}).map(([sourceId, derivedId]) => (
                        <div key={sourceId} className="flex items-center gap-2 bg-gray-700 p-3 rounded">
                          <span className="text-sm flex-1">
                            {getSlotLabel(rule.sourceTagId, sourceId)} → {getSlotLabel(rule.derivedTagId, derivedId)}
                          </span>
                          <button
                            onClick={() => removeSlotMapping(editingRuleIndex, sourceId)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-sm"
                            title="Remove mapping"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new mapping */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300 font-medium">Add New Mapping:</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={editSourceSlotId}
                        onChange={(e) => setEditSourceSlotId(e.target.value)}
                        className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                        disabled={!sourceSlotSet}
                      >
                        <option value="">Select source slot...</option>
                        {sourceSlotSet?.slotDefinitions?.map(slot => (
                          <option key={slot.id} value={slot.id}>
                            {slot.slotLabel || `Slot ${slot.id.slice(0, 8)}...`}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray-400">→</span>
                      <select
                        value={editDerivedSlotId}
                        onChange={(e) => setEditDerivedSlotId(e.target.value)}
                        className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-sm focus:border-blue-500 focus:outline-none"
                        disabled={!derivedSlotSet}
                      >
                        <option value="">Select derived slot...</option>
                        {derivedSlotSet?.slotDefinitions?.map(slot => (
                          <option key={slot.id} value={slot.id}>
                            {slot.slotLabel || `Slot ${slot.id.slice(0, 8)}...`}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => addSlotMapping(editingRuleIndex)}
                        disabled={!editSourceSlotId || !editDerivedSlotId}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-sm text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                    {(!sourceSlotSet || !derivedSlotSet) && (
                      <p className="text-xs text-yellow-400">
                        {loadingSlots[rule.sourceTagId] || loadingSlots[rule.derivedTagId]
                          ? "Loading slot definitions..."
                          : "No slot definitions found for one or both tags. Use the editors above to add them."}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      onClick={cancelEditingSlots}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSlots}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
