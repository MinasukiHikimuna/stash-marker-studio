"use client";

import { useEffect, useState, useMemo } from "react";
import { type SceneMarker, type Scene } from "@/services/StashappService";
import { type SlotDefinition } from "@/core/slot/types";
import { PerformerAutocomplete } from "./PerformerAutocomplete";

interface SlotValue {
  slotDefinitionId: string;
  performerId: string | null;
}

interface MarkerSlotsDialogProps {
  marker: SceneMarker;
  scene: Scene;
  onSave: (slots: SlotValue[]) => Promise<void>;
  onCancel: () => void;
}

export function MarkerSlotsDialog({
  marker,
  scene,
  onSave,
  onCancel,
}: MarkerSlotsDialogProps) {
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [slotValues, setSlotValues] = useState<SlotValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter performers to only those assigned to this scene
  const scenePerformers = useMemo(() => {
    return scene.performers || [];
  }, [scene.performers]);

  // Load slot definitions and existing slot assignments
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load slot definitions for this tag
        const response = await fetch(
          `/api/slot-definitions?tagId=${marker.primary_tag.id}`
        );
        if (response.ok) {
          const data = await response.json();
          const definitions = data.slotDefinitions || [];
          setSlotDefinitions(definitions);

          // Initialize slot values with existing assignments or empty
          const existingSlots = marker.slots || [];
          const newSlotValues = definitions.map((def: SlotDefinition) => {
            const existing = existingSlots.find(
              (s) => s.slotDefinitionId === def.id
            );
            return {
              slotDefinitionId: def.id,
              performerId: existing?.stashappPerformerId?.toString() || null,
            };
          });
          setSlotValues(newSlotValues);
        }
      } catch (error) {
        console.error("Failed to load slot definitions:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [marker.primary_tag.id, marker.slots]);

  const handleSlotChange = (slotDefinitionId: string, performerId: string | null) => {
    setSlotValues((prev) =>
      prev.map((sv) =>
        sv.slotDefinitionId === slotDefinitionId
          ? { ...sv, performerId }
          : sv
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(slotValues);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSave();
    }
  };

  return (
    <>
      <div
        className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 max-w-2xl w-full mx-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-6"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-xl font-bold text-white mb-4">
          Assign Performers to Slots
        </h2>

        <div className="mb-4">
          <div className="text-sm text-gray-400">
            Marker: <span className="text-white font-semibold">{marker.primary_tag.name}</span>
          </div>
          <div className="text-xs text-gray-500">
            {marker.seconds.toFixed(1)}s
            {marker.end_seconds && ` - ${marker.end_seconds.toFixed(1)}s`}
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400 py-8 text-center">
            Loading slot definitions...
          </div>
        ) : slotDefinitions.length === 0 ? (
          <div className="text-gray-400 py-8 text-center">
            No performer slots defined for this tag.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {slotDefinitions.map((definition) => {
              const slotValue = slotValues.find(
                (sv) => sv.slotDefinitionId === definition.id
              );
              return (
                <div key={definition.id} className="flex items-center gap-3">
                  <label className="text-sm text-gray-300 w-32 flex-shrink-0">
                    {definition.slotLabel}
                    {definition.genderHint && (
                      <span className="text-gray-500 ml-1 text-xs">
                        ({definition.genderHint})
                      </span>
                    )}
                  </label>
                  <PerformerAutocomplete
                    value={slotValue?.performerId || null}
                    onChange={(performerId) =>
                      handleSlotChange(definition.id, performerId)
                    }
                    availablePerformers={scenePerformers}
                    genderHint={definition.genderHint}
                    placeholder="Select performer..."
                    className="flex-1"
                    allowEmpty={true}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={saving || loading || slotDefinitions.length === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-2 text-center">
          Press Esc to cancel, Cmd/Ctrl+Enter to save
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onCancel}
      />
    </>
  );
}
