"use client";

import React from "react";
import { KeyboardShortcutsSettings } from "@/components/settings/KeyboardShortcutsSettings";

export default function KeyboardConfigPage() {
  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
        <p className="text-gray-400 mb-6">
          Customize keyboard shortcuts for all actions. Changes are saved automatically when you modify any shortcut.
        </p>
        
        <KeyboardShortcutsSettings 
          compact={true} 
          showHeader={false} 
          showControls={true} 
        />
      </div>
    </div>
  );
}