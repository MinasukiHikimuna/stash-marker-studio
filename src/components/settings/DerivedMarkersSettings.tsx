"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import { setFullConfig } from "@/store/slices/configSlice";
import { ConfigTagAutocomplete } from "@/components/settings/ConfigTagAutocomplete";
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
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Cache slot definitions per tag
  const [slotDefinitionSets, setSlotDefinitionSets] = useState<Record<string, SlotDefinitionSet>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});

  // Editing state for slot mappings
  const [editSourceSlotId, setEditSourceSlotId] = useState<string>("");
  const [editDerivedSlotId, setEditDerivedSlotId] = useState<string>("");

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

  const addNewRule = () => {
    const newRule: DerivedMarkerConfig = {
      sourceTagId: "",
      derivedTagId: "",
      relationshipType: "implies",
      slotMapping: {},
    };
    setDerivedMarkers([...derivedMarkers, newRule]);
  };

  const removeRule = (index: number) => {
    setDerivedMarkers(derivedMarkers.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof DerivedMarkerConfig, value: string) => {
    const updated = [...derivedMarkers];
    if (field === "relationshipType") {
      updated[index][field] = value as "implies" | "conflicts";
    } else if (field === "sourceTagId" || field === "derivedTagId") {
      updated[index][field] = value;

      // Load slot definitions when a tag is selected
      if (value) {
        loadSlotDefinitionsForTag(value);
      }
    }
    setDerivedMarkers(updated);
  };

  const startEditingSlots = (index: number) => {
    const ruleId = `rule-${index}`;
    setEditingRuleId(ruleId);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const cancelEditingSlots = () => {
    setEditingRuleId(null);
    setEditSourceSlotId("");
    setEditDerivedSlotId("");
  };

  const saveSlots = () => {
    setEditingRuleId(null);
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
                onClick={addNewRule}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-medium transition-colors"
              >
                + Add Rule
              </button>
            </div>

            {derivedMarkers.length === 0 ? (
              <div className="p-4 bg-gray-700 rounded-md border border-gray-600">
                <p className="text-gray-400">No derivation rules configured.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Click &quot;Add Rule&quot; to create your first derivation rule.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {derivedMarkers.map((rule, index) => {
                  const ruleId = `rule-${index}`;
                  const isEditing = editingRuleId === ruleId;
                  const sourceSlotSet = rule.sourceTagId ? slotDefinitionSets[rule.sourceTagId] : null;
                  const derivedSlotSet = rule.derivedTagId ? slotDefinitionSets[rule.derivedTagId] : null;

                  return (
                    <div key={index} className="p-4 bg-gray-700 rounded-md border border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {/* Source Tag */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Source Tag (specific)
                          </label>
                          <ConfigTagAutocomplete
                            value={rule.sourceTagId}
                            onChange={(tagId) => updateRule(index, "sourceTagId", tagId)}
                            availableTags={availableTags}
                            placeholder="Select source tag..."
                            className="w-full"
                          />
                        </div>

                        {/* Relationship Type */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Relationship
                          </label>
                          <select
                            value={rule.relationshipType}
                            onChange={(e) => updateRule(index, "relationshipType", e.target.value)}
                            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-white focus:border-blue-500 focus:outline-none"
                          >
                            <option value="implies">implies</option>
                            <option value="conflicts">conflicts</option>
                          </select>
                        </div>

                        {/* Derived Tag */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            Derived Tag (general)
                          </label>
                          <ConfigTagAutocomplete
                            value={rule.derivedTagId}
                            onChange={(tagId) => updateRule(index, "derivedTagId", tagId)}
                            availableTags={availableTags}
                            placeholder="Select derived tag..."
                            className="w-full"
                          />
                        </div>
                      </div>

                      {/* Slot Mapping */}
                      <div className="mt-4 p-3 bg-gray-800 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-400">
                            Slot Mapping (UUID-based)
                          </label>
                          {!isEditing && rule.sourceTagId && rule.derivedTagId && (
                            <button
                              onClick={() => startEditingSlots(index)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-xs font-medium transition-colors"
                            >
                              Edit Slots
                            </button>
                          )}
                        </div>

                        {!rule.sourceTagId || !rule.derivedTagId ? (
                          <p className="text-xs text-gray-500">Select both source and derived tags first</p>
                        ) : !isEditing ? (
                          // Display mode
                          <div>
                            {Object.keys(rule.slotMapping || {}).length === 0 ? (
                              <p className="text-xs text-gray-500">No slot mappings configured</p>
                            ) : (
                              <div className="space-y-1">
                                {Object.entries(rule.slotMapping || {}).map(([sourceId, derivedId]) => (
                                  <div key={sourceId} className="text-xs text-gray-300">
                                    <span className="font-mono bg-gray-700 px-1 rounded">
                                      {getSlotLabel(rule.sourceTagId, sourceId)}
                                    </span>
                                    {" → "}
                                    <span className="font-mono bg-gray-700 px-1 rounded">
                                      {getSlotLabel(rule.derivedTagId, derivedId)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Edit mode
                          <div className="space-y-3">
                            {/* Existing mappings */}
                            {Object.keys(rule.slotMapping || {}).length > 0 && (
                              <div className="space-y-2 mb-3">
                                <p className="text-xs text-gray-400">Existing Mappings:</p>
                                {Object.entries(rule.slotMapping || {}).map(([sourceId, derivedId]) => (
                                  <div key={sourceId} className="flex items-center gap-2 bg-gray-700 p-2 rounded">
                                    <span className="text-xs flex-1">
                                      {getSlotLabel(rule.sourceTagId, sourceId)} → {getSlotLabel(rule.derivedTagId, derivedId)}
                                    </span>
                                    <button
                                      onClick={() => removeSlotMapping(index, sourceId)}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs"
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
                              <p className="text-xs text-gray-400">Add New Mapping:</p>
                              <div className="flex items-center gap-2">
                                <select
                                  value={editSourceSlotId}
                                  onChange={(e) => setEditSourceSlotId(e.target.value)}
                                  className="flex-1 p-1 bg-gray-700 border border-gray-600 rounded text-xs focus:border-blue-500 focus:outline-none"
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
                                  className="flex-1 p-1 bg-gray-700 border border-gray-600 rounded text-xs focus:border-blue-500 focus:outline-none"
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
                                  onClick={() => addSlotMapping(index)}
                                  disabled={!editSourceSlotId || !editDerivedSlotId}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-sm text-xs font-medium"
                                >
                                  Add
                                </button>
                              </div>
                              {(!sourceSlotSet || !derivedSlotSet) && (
                                <p className="text-xs text-yellow-400">
                                  {loadingSlots[rule.sourceTagId] || loadingSlots[rule.derivedTagId]
                                    ? "Loading slot definitions..."
                                    : "No slot definitions found for one or both tags. Configure them in Slot Definitions first."}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={saveSlots}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-sm text-xs font-medium"
                              >
                                Done
                              </button>
                              <button
                                onClick={cancelEditingSlots}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-sm text-xs font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rule Preview */}
                      {rule.sourceTagId && rule.derivedTagId && (
                        <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700 rounded text-xs text-blue-200">
                          <strong>Rule:</strong> {getTagName(rule.sourceTagId)} {rule.relationshipType} {getTagName(rule.derivedTagId)}
                          {Object.keys(rule.slotMapping || {}).length > 0 && (
                            <span className="ml-2">({Object.keys(rule.slotMapping || {}).length} slot mapping{Object.keys(rule.slotMapping || {}).length !== 1 ? 's' : ''})</span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => removeRule(index)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-sm font-medium transition-colors"
                        >
                          Remove Rule
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
    </div>
  );
}
