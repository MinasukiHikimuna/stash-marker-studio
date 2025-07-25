"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { KeyBinding, KeyboardShortcut, ShortcutCategory } from '@/types/keyboard';
import { keyboardShortcutService } from '@/services/KeyboardShortcutService';
import { saveKeyboardShortcutsConfig } from '@/utils/configUtils';
import { ShortcutCaptureInput } from './ShortcutCaptureInput';
import { ShortcutCaptureProvider } from '@/contexts/ShortcutCaptureContext';

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  'marker.review': 'Marker Review',
  'marker.create': 'Marker Creation',
  'marker.edit': 'Marker Editing',
  'navigation': 'Navigation',
  'video.playback': 'Video Playback',
  'video.jump': 'Video Jump',
  'system': 'System Actions'
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  'marker.review',
  'marker.create', 
  'marker.edit',
  'navigation',
  'video.playback',
  'video.jump',
  'system'
];

interface ConflictInfo {
  actionId: string;
  binding: KeyBinding;
}

interface KeyboardShortcutsSettingsProps {
  compact?: boolean;
  showHeader?: boolean;
  showControls?: boolean;
}

export function KeyboardShortcutsSettings({ 
  compact = false, 
  showHeader = true, 
  showControls = true 
}: KeyboardShortcutsSettingsProps = {}) {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load shortcuts on mount
  useEffect(() => {
    const loadShortcuts = async () => {
      // Initialize service if not already initialized
      try {
        const configResponse = await fetch('/api/config');
        if (configResponse.ok) {
          const config = await configResponse.json();
          await keyboardShortcutService.initialize(config.keyboardShortcuts);
        } else {
          // If no config, initialize with defaults and save them
          await keyboardShortcutService.initialize();
          // Auto-save defaults to config file
          try {
            const result = await saveKeyboardShortcutsConfig();
            if (result.success) {
              console.log('Successfully saved default shortcuts to config');
            } else {
              console.error('Failed to save default shortcuts:', result.error);
            }
          } catch (error) {
            console.error('Error saving default shortcuts:', error);
          }
        }
      } catch (error) {
        console.error('Failed to initialize keyboard shortcut service:', error);
        // Initialize with defaults as fallback and try to save
        await keyboardShortcutService.initialize();
        try {
          const result = await saveKeyboardShortcutsConfig();
          if (result.success) {
            console.log('Successfully saved default shortcuts to config (fallback)');
          } else {
            console.error('Failed to save default shortcuts (fallback):', result.error);
          }
        } catch (saveError) {
          console.error('Error saving default shortcuts (fallback):', saveError);
        }
      }
      
      const allShortcuts = keyboardShortcutService.getAllShortcuts();
      setShortcuts(allShortcuts);
    };

    loadShortcuts();
  }, []);

  // Filter shortcuts based on search and category
  const filteredShortcuts = shortcuts.filter(shortcut => {
    const matchesSearch = !searchTerm || 
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.bindings.some(binding => 
        keyboardShortcutService.getBindingDisplayString(binding).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    
    // Only show editable shortcuts
    return matchesSearch && matchesCategory && shortcut.editable;
  });

  // Group shortcuts by category
  const groupedShortcuts = CATEGORY_ORDER.reduce((acc, category) => {
    const categoryShortcuts = filteredShortcuts.filter(s => s.category === category);
    if (categoryShortcuts.length > 0) {
      acc[category] = categoryShortcuts;
    }
    return acc;
  }, {} as Record<ShortcutCategory, KeyboardShortcut[]>);

  // Update shortcut bindings
  const updateShortcutBindings = useCallback((actionId: string, bindings: KeyBinding[]) => {
    // Find conflicts before updating
    const newConflicts = keyboardShortcutService.findConflicts(bindings, actionId);
    
    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      return false;
    }

    // Update the service
    const success = keyboardShortcutService.updateShortcut(actionId, bindings);
    if (success) {
      // Update local state
      setShortcuts(keyboardShortcutService.getAllShortcuts());
      setConflicts([]);
      return true;
    }
    
    return false;
  }, []);

  // Reset shortcut to default
  const resetShortcut = useCallback((actionId: string) => {
    const success = keyboardShortcutService.resetShortcut(actionId);
    if (success) {
      setShortcuts(keyboardShortcutService.getAllShortcuts());
      setConflicts([]);
    }
  }, []);

  // Reset all shortcuts to defaults
  const resetAllShortcuts = useCallback(() => {
    if (confirm('Are you sure you want to reset all keyboard shortcuts to their defaults? This cannot be undone.')) {
      keyboardShortcutService.resetAllShortcuts();
      setShortcuts(keyboardShortcutService.getAllShortcuts());
      setConflicts([]);
    }
  }, []);

  // Save shortcuts to config file
  const saveShortcuts = useCallback(async () => {
    try {
      const result = await saveKeyboardShortcutsConfig();
      if (!result.success) {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save shortcuts' });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'success', text: 'Shortcuts saved successfully' });
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (error) {
      console.error('Error saving shortcuts:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save shortcuts' });
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }, []);


  return (
    <ShortcutCaptureProvider>
      <div className={compact ? "" : "p-6 bg-gray-900 text-white"}>
        <div className={compact ? "" : "max-w-6xl mx-auto"}>
        {/* Header */}
        {showHeader && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Keyboard Shortcuts</h1>
            <p className="text-gray-400">
              Customize keyboard shortcuts for all actions. Click on a shortcut field to capture new key combinations.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={saveShortcuts}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors font-medium"
          >
            Save Shortcuts
          </button>
        </div>

        {/* Controls */}
        {showControls && (
          <div className="mb-6 flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ShortcutCategory | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {CATEGORY_ORDER.map(category => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={resetAllShortcuts}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>
        )}

        {/* Save message */}
        {saveMessage && (
          <div className={`mb-4 p-3 rounded-md ${
            saveMessage.type === 'success' 
              ? 'bg-green-900 border border-green-700 text-green-100'
              : 'bg-red-900 border border-red-700 text-red-100'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Conflicts warning */}
        {conflicts.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900 border border-yellow-700 text-yellow-100 rounded-md">
            <strong>Conflicts detected:</strong>
            <ul className="mt-1 list-disc list-inside">
              {conflicts.map((conflict, index) => (
                <li key={index}>
                  Key combination already used by action: {conflict.actionId}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Shortcuts */}
        <div>
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="bg-gray-800 rounded-lg pb-4">
              <h2 className="text-xl font-semibold mb-4 text-blue-400">
                {CATEGORY_LABELS[category as ShortcutCategory]}
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {categoryShortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="p-3 bg-gray-700 rounded-md space-y-2">
                    {/* Description */}
                    <div>
                      <div className="font-medium text-sm">{shortcut.description}</div>
                      <div className="text-xs text-gray-400 font-mono">{shortcut.id}</div>
                    </div>

                    {/* Shortcuts */}
                    <div>
                      <ShortcutCaptureInput
                        bindings={shortcut.bindings}
                        onBindingsChange={(bindings) => updateShortcutBindings(shortcut.id, bindings)}
                        onReset={shortcut.editable ? () => resetShortcut(shortcut.id) : undefined}
                        disabled={!shortcut.editable}
                      />
                    </div>

                    {/* Status badges */}
                    <div className="flex gap-1">
                      {!shortcut.enabled && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-900 text-red-100 rounded">
                          Disabled
                        </span>
                      )}
                      
                      {!shortcut.editable && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-300 rounded">
                          System
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {Object.keys(groupedShortcuts).length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No shortcuts found matching your criteria.</p>
          </div>
        )}
        </div>
      </div>
    </ShortcutCaptureProvider>
  );
}