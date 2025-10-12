"use client";

import React from "react";
import type { DerivedMarkerConfig } from "@/serverConfig";
import type { SlotDefinitionSet } from "@/core/slot/types";

interface ChainNode {
  tagId: string;
  tagName: string;
  slots: Array<{ id: string; label: string }>;
  children: Map<string, { node: ChainNode; rule: DerivedMarkerConfig }>;
  rules: DerivedMarkerConfig[];
}

interface DerivedMarkersTreeViewProps {
  derivedMarkers: DerivedMarkerConfig[];
  slotDefinitionSets: Record<string, SlotDefinitionSet>;
  availableTags: Array<{ id: string; name: string }>;
  onEditSlots: (rule: DerivedMarkerConfig, ruleIndex: number) => void;
  onRemoveRule: (ruleIndex: number) => void;
  getRuleIndex: (rule: DerivedMarkerConfig) => number;
}

export default function DerivedMarkersTreeView({
  derivedMarkers,
  slotDefinitionSets,
  availableTags,
  onEditSlots,
  onRemoveRule,
  getRuleIndex,
}: DerivedMarkersTreeViewProps) {
  const getTagName = (tagId: string) => {
    const tag = availableTags.find(t => t.id === tagId);
    return tag ? tag.name : `Tag ${tagId}`;
  };

  const getSlotLabel = (tagId: string, slotDefId: string) => {
    const slotSet = slotDefinitionSets[tagId];
    if (!slotSet) return `Slot ${slotDefId.slice(0, 8)}...`;

    const slotDef = slotSet.slotDefinitions?.find(sd => sd.id === slotDefId);
    return slotDef?.slotLabel || `Slot ${slotDefId.slice(0, 8)}...`;
  };

  const getTagSlots = (tagId: string): Array<{ id: string; label: string }> => {
    const slotSet = slotDefinitionSets[tagId];
    if (!slotSet || !slotSet.slotDefinitions) return [];

    return slotSet.slotDefinitions.map(sd => ({
      id: sd.id,
      label: sd.slotLabel || `Slot ${sd.id.slice(0, 8)}...`,
    }));
  };

  // Build tree structure from flat derivation rules - inverted to show general->specific
  const buildTree = (): ChainNode[] => {
    const roots: ChainNode[] = [];
    const nodeMap = new Map<string, ChainNode>();

    // Create nodes for all tags
    const allTagIds = new Set<string>();
    derivedMarkers.forEach(rule => {
      allTagIds.add(rule.sourceTagId);
      allTagIds.add(rule.derivedTagId);
    });

    allTagIds.forEach(tagId => {
      if (tagId) {
        nodeMap.set(tagId, {
          tagId,
          tagName: getTagName(tagId),
          slots: getTagSlots(tagId),
          children: new Map(),
          rules: [],
        });
      }
    });

    // Build relationships - INVERTED: derived (general) tag contains source (specific) tag as child
    derivedMarkers.forEach(rule => {
      if (!rule.sourceTagId || !rule.derivedTagId) return;

      const sourceNode = nodeMap.get(rule.sourceTagId);
      const derivedNode = nodeMap.get(rule.derivedTagId);

      if (sourceNode && derivedNode) {
        // The derived (general) tag shows the source (specific) tag as its child
        derivedNode.children.set(rule.sourceTagId, { node: sourceNode, rule });
        derivedNode.rules.push(rule);
      }
    });

    // Find root nodes (most general tags - those that are derived but not sources)
    const sourceTagIds = new Set<string>();
    derivedMarkers.forEach(rule => {
      if (rule.sourceTagId) {
        sourceTagIds.add(rule.sourceTagId);
      }
    });

    nodeMap.forEach((node, tagId) => {
      // A root is a tag that has children but is not a source (leaf) tag
      if (node.children.size > 0 && !sourceTagIds.has(tagId)) {
        roots.push(node);
      }
    });

    return roots;
  };

  const renderSlotMappings = (
    rule: DerivedMarkerConfig,
    sourceSlots: Array<{ id: string; label: string }>
  ) => {
    if (sourceSlots.length === 0) {
      return <div className="text-xs text-gray-500 ml-8">No slots available</div>;
    }

    return (
      <div className="ml-8 space-y-1">
        <div className="text-xs text-gray-400 mb-1">Slot Mapping:</div>
        {sourceSlots.map(slot => {
          const mappings = (rule.slotMapping || []).filter(m => m.sourceSlotId === slot.id);
          const isMapped = mappings.length > 0;

          return (
            <div key={slot.id} className="flex items-start gap-2 text-xs">
              <span className="text-gray-300 w-32 truncate" title={slot.label}>
                {slot.label}
              </span>
              <span className="text-gray-500">→</span>
              {isMapped ? (
                <div className="flex-1 space-y-0.5">
                  {mappings.map((mapping, idx) => (
                    <div key={idx} className="text-green-400 flex items-center gap-1">
                      {idx > 0 && <span className="text-gray-600 mr-1">+</span>}
                      {getSlotLabel(rule.derivedTagId, mapping.derivedSlotId)} ✓
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-600 flex items-center gap-1">(unmapped) ○</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNode = (node: ChainNode, depth: number = 0, visited: Set<string> = new Set()): React.ReactNode => {
    // Prevent duplication by tracking visited nodes
    if (visited.has(node.tagId)) {
      return null;
    }
    visited.add(node.tagId);

    const indent = depth * 2;
    const treeSymbol = depth === 0 ? "┌─" : "└─";

    return (
      <div key={node.tagId} className="font-mono text-sm">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-gray-600" style={{ marginLeft: `${indent}rem` }}>
            {treeSymbol}
          </span>
          <div className="flex-1">
            <div className="text-gray-200 font-semibold">
              {node.tagName}{" "}
              <span className="text-gray-500 font-normal text-xs">
                [{node.slots.length} {node.slots.length === 1 ? "slot" : "slots"}
                {node.slots.length > 0 && ": " + node.slots.map(s => s.label).join(", ")}]
              </span>
            </div>
          </div>
        </div>

        {node.children.size > 0 && (
          <div style={{ marginLeft: `${indent + 1}rem` }}>
            {Array.from(node.children.values()).map(({ node: childNode, rule }) => {
              const ruleIndex = getRuleIndex(rule);
              const sourceSlots = getTagSlots(rule.sourceTagId); // The specific tag's slots

              return (
                <div key={`${node.tagId}-${childNode.tagId}`} className="mb-4 border-l-2 border-gray-700 pl-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-gray-600">├─</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200 font-semibold">
                          {childNode.tagName}
                        </span>
                        <span className="text-gray-500 text-xs">
                          [{sourceSlots.length} {sourceSlots.length === 1 ? "slot" : "slots"}
                          {sourceSlots.length > 0 && ": " + sourceSlots.map(s => s.label).join(", ")}]
                        </span>
                        <button
                          onClick={() => onEditSlots(rule, ruleIndex)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-sm text-xs font-sans"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onRemoveRule(ruleIndex)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-sm text-xs font-sans"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>

                  {renderSlotMappings(rule, sourceSlots)}

                  {childNode.children.size > 0 && (
                    <div className="ml-4 mt-3">{renderNode(childNode, depth + 1, visited)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const chains = buildTree();

  if (chains.length === 0) {
    return (
      <div className="p-4 bg-gray-700 rounded-md border border-gray-600">
        <p className="text-gray-400">No derivation rules configured.</p>
        <p className="text-sm text-gray-500 mt-1">
          Click &quot;Add Rule&quot; to create your first derivation rule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">
          Derivation Chain View ({derivedMarkers.length} rules in {chains.length} chain
          {chains.length !== 1 ? "s" : ""})
        </h3>
        <div className="text-xs text-gray-500">
          Legend: <span className="text-green-400">✓</span> = mapped{" "}
          <span className="text-gray-600">○</span> = unmapped
        </div>
      </div>

      <div className="space-y-8">
        {chains.map(chain => (
          <div key={chain.tagId}>{renderNode(chain)}</div>
        ))}
      </div>
    </div>
  );
}
