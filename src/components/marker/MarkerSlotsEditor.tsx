"use client";

import { useEffect, useState } from "react";
import { type Performer } from "@/services/StashappService";
import { type SlotDefinition } from "@/core/slot/types";
import { PerformerAutocomplete } from "./PerformerAutocomplete";

interface SlotValue {
  slotDefinitionId: string;
  performerId: string | null;
}

interface MarkerSlotsEditorProps {
  primaryTagId: string | null;
  availablePerformers: Performer[];
  initialSlots?: SlotValue[];
  onChange: (slots: SlotValue[]) => void;
  className?: string;
}

export function MarkerSlotsEditor({
  primaryTagId,
  availablePerformers,
  initialSlots = [],
  onChange,
  className = "",
}: MarkerSlotsEditorProps) {
  const [slotDefinitions, setSlotDefinitions] = useState<SlotDefinition[]>([]);
  const [slotValues, setSlotValues] = useState<SlotValue[]>(initialSlots);
  const [loading, setLoading] = useState(false);

  // Load slot definitions when primary tag changes
  useEffect(() => {
    if (!primaryTagId) {
      setSlotDefinitions([]);
      setSlotValues([]);
      onChange([]);
      return;
    }

    const loadSlotDefinitions = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/slot-definitions?tagId=${primaryTagId}`
        );
        if (response.ok) {
          const data = await response.json();
          const definitions = data.slotDefinitions || [];
          setSlotDefinitions(definitions);

          // Initialize slot values for each definition
          const newSlotValues = definitions.map((def: SlotDefinition) => {
            const existing = slotValues.find(
              (sv) => sv.slotDefinitionId === def.id
            );
            return {
              slotDefinitionId: def.id,
              performerId: existing?.performerId || null,
            };
          });
          setSlotValues(newSlotValues);
          onChange(newSlotValues);
        }
      } catch (error) {
        console.error("Failed to load slot definitions:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadSlotDefinitions();
  }, [primaryTagId]);

  const handleSlotChange = (slotDefinitionId: string, performerId: string | null) => {
    const newSlotValues = slotValues.map((sv) =>
      sv.slotDefinitionId === slotDefinitionId
        ? { ...sv, performerId }
        : sv
    );
    setSlotValues(newSlotValues);
    onChange(newSlotValues);
  };

  if (!primaryTagId) {
    return null;
  }

  if (loading) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        Loading slot definitions...
      </div>
    );
  }

  if (slotDefinitions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs text-gray-400 font-semibold">Performer Slots:</div>
      {slotDefinitions.map((definition) => {
        const slotValue = slotValues.find(
          (sv) => sv.slotDefinitionId === definition.id
        );
        return (
          <div key={definition.id} className="flex items-center gap-2">
            <label className="text-xs text-gray-300 w-24 flex-shrink-0">
              {definition.slotLabel}
              {definition.genderHint && (
                <span className="text-gray-500 ml-1">
                  ({definition.genderHint})
                </span>
              )}
            </label>
            <PerformerAutocomplete
              value={slotValue?.performerId || null}
              onChange={(performerId) =>
                handleSlotChange(definition.id, performerId)
              }
              availablePerformers={availablePerformers}
              genderHint={definition.genderHint}
              placeholder="Select performer..."
              className="flex-1"
              allowEmpty={true}
            />
          </div>
        );
      })}
    </div>
  );
}
