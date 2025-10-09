"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { type SceneMarker, type Scene } from "@/services/StashappService";
import { type SlotDefinition } from "@/core/slot/types";
import { PerformerAutocomplete } from "./PerformerAutocomplete";
import {
  generateAssignmentCombinations,
  type AssignmentCombination,
} from "@/core/slot/autoAssignment";

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
  const dialogRef = useRef<HTMLDivElement>(null);

  // Filter performers to only those assigned to this scene
  const scenePerformers = useMemo(() => {
    return scene.performers || [];
  }, [scene.performers]);

  // Load slot definitions and existing slot assignments
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load slot definitions for this tag from slot definition sets
        const response = await fetch(
          `/api/slot-definition-sets?tagId=${marker.primary_tag.id}`
        );
        if (response.ok) {
          const data = await response.json();
          const sets = data.slotDefinitionSets || [];

          // Get slot definitions from the first set (there should only be one per tag)
          const definitions: SlotDefinition[] = sets.length > 0
            ? sets[0].slotDefinitions.map((slot: any) => ({
                id: slot.id,
                slotDefinitionSetId: slot.slotDefinitionSetId,
                slotLabel: slot.slotLabel,
                genderHints: slot.genderHints.map((gh: any) => gh.genderHint),
                order: slot.order,
                createdAt: slot.createdAt,
                updatedAt: slot.updatedAt,
              }))
            : [];

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

  // Auto-focus the dialog when it mounts
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

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

  // Calculate all possible assignment combinations
  const assignmentCombinations = useMemo(() => {
    const currentAssignments = new Map<string, string | null>();
    slotValues.forEach((sv) => {
      currentAssignments.set(sv.slotDefinitionId, sv.performerId);
    });

    return generateAssignmentCombinations(
      slotDefinitions,
      scenePerformers,
      currentAssignments
    );
  }, [slotValues, slotDefinitions, scenePerformers]);

  const handleApplyAssignment = (combination: AssignmentCombination) => {
    const newSlotValues = slotValues.map((sv) => {
      const assignment = combination.assignments.find(
        (a) => a.slotDefinitionId === sv.slotDefinitionId
      );
      if (assignment) {
        return {
          ...sv,
          performerId: assignment.performerId,
        };
      }
      return sv;
    });

    setSlotValues(newSlotValues);
  };

  const handleApplyAndSave = async (combination: AssignmentCombination) => {
    const newSlotValues = slotValues.map((sv) => {
      const assignment = combination.assignments.find(
        (a) => a.slotDefinitionId === sv.slotDefinitionId
      );
      if (assignment) {
        return {
          ...sv,
          performerId: assignment.performerId,
        };
      }
      return sv;
    });

    setSaving(true);
    try {
      await onSave(newSlotValues);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      void handleSave();
    } else if (e.key >= "1" && e.key <= "9") {
      const index = parseInt(e.key, 10) - 1;
      if (index < assignmentCombinations.length) {
        e.preventDefault();
        void handleApplyAndSave(assignmentCombinations[index]);
      }
    }
  };

  return (
    <>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="fixed z-50 bg-gray-800 rounded-lg shadow-xl border border-gray-600 max-w-2xl w-full mx-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-6 outline-none"
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

        {assignmentCombinations.length > 0 && (
          <div className="mb-4 bg-gray-700 p-3 rounded">
            <div className="text-sm font-semibold text-green-400 mb-2">
              Auto-assignment Options
            </div>
            <div className="space-y-2">
              {assignmentCombinations.map((combination, index) => (
                <button
                  key={index}
                  className="w-full text-left px-2 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors"
                  onClick={() => handleApplyAssignment(combination)}
                  disabled={saving || loading}
                >
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-green-600 text-white rounded font-bold mr-2 text-[10px]">
                    {index + 1}
                  </span>
                  <span className="text-gray-200">{combination.description}</span>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Press number keys 1-{Math.min(assignmentCombinations.length, 9)} to apply
            </div>
          </div>
        )}

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
                    {definition.genderHints.length > 0 && (
                      <span className="text-gray-500 ml-1 text-xs">
                        ({definition.genderHints.join('/')})
                      </span>
                    )}
                  </label>
                  <PerformerAutocomplete
                    value={slotValue?.performerId || null}
                    onChange={(performerId) =>
                      handleSlotChange(definition.id, performerId)
                    }
                    availablePerformers={scenePerformers}
                    genderHints={definition.genderHints}
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
          <kbd className="px-1 bg-gray-700 rounded">Esc</kbd> to cancel, <kbd className="px-1 bg-gray-700 rounded">Cmd/Ctrl+Enter</kbd> to save
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
