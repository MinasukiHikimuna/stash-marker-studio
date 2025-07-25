import { KeyboardShortcut, KeyBinding, KeyboardShortcutConfig, ShortcutLookupMap } from '../types/keyboard';
import { defaultShortcuts, createKeyCombo } from '../config/defaultKeyboardShortcuts';

class KeyboardShortcutService {
  private shortcuts: KeyboardShortcut[] = [];
  private lookupMap: ShortcutLookupMap = {};
  private initialized = false;

  /**
   * Initialize the service with user configuration
   */
  async initialize(userConfig?: KeyboardShortcutConfig): Promise<void> {
    this.shortcuts = this.mergeWithUserConfig(defaultShortcuts, userConfig);
    this.buildLookupMap();
    this.initialized = true;
  }

  /**
   * Get action ID for a key binding
   */
  getActionForKeyBinding(key: string, modifiers?: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean }): string | null {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return null;
    }

    const keyCombo = createKeyCombo(key, modifiers);
    return this.lookupMap[keyCombo] || null;
  }

  /**
   * Get all bindings for a specific action
   */
  getBindingsForAction(actionId: string): KeyBinding[] {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return [];
    }

    const shortcut = this.shortcuts.find(s => s.id === actionId);
    return shortcut?.enabled ? shortcut.bindings : [];
  }

  /**
   * Get shortcut definition for an action
   */
  getShortcut(actionId: string): KeyboardShortcut | null {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return null;
    }

    return this.shortcuts.find(s => s.id === actionId) || null;
  }

  /**
   * Get all shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return [];
    }

    return [...this.shortcuts];
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return [];
    }

    return this.shortcuts.filter(s => s.category === category);
  }

  /**
   * Update a shortcut's bindings
   */
  updateShortcut(actionId: string, bindings: KeyBinding[], enabled = true): boolean {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return false;
    }

    const shortcutIndex = this.shortcuts.findIndex(s => s.id === actionId);
    if (shortcutIndex === -1) {
      console.warn(`Shortcut with ID ${actionId} not found`);
      return false;
    }

    // Validate no conflicts
    const conflicts = this.findConflicts(bindings, actionId);
    if (conflicts.length > 0) {
      console.warn(`Conflicts found for ${actionId}:`, conflicts);
      return false;
    }

    // Update the shortcut
    this.shortcuts[shortcutIndex] = {
      ...this.shortcuts[shortcutIndex],
      bindings,
      enabled
    };

    // Rebuild lookup map
    this.buildLookupMap();
    return true;
  }

  /**
   * Reset a shortcut to its default
   */
  resetShortcut(actionId: string): boolean {
    if (!this.initialized) {
      console.warn('KeyboardShortcutService not initialized');
      return false;
    }

    const defaultShortcut = defaultShortcuts.find(s => s.id === actionId);
    if (!defaultShortcut) {
      console.warn(`Default shortcut with ID ${actionId} not found`);
      return false;
    }

    const shortcutIndex = this.shortcuts.findIndex(s => s.id === actionId);
    if (shortcutIndex === -1) {
      console.warn(`Shortcut with ID ${actionId} not found`);
      return false;
    }

    // Reset to default
    this.shortcuts[shortcutIndex] = { ...defaultShortcut };
    
    // Rebuild lookup map
    this.buildLookupMap();
    return true;
  }

  /**
   * Reset all shortcuts to defaults
   */
  resetAllShortcuts(): void {
    this.shortcuts = defaultShortcuts.map(s => ({ ...s }));
    this.buildLookupMap();
  }

  /**
   * Find conflicts for given bindings
   */
  findConflicts(bindings: KeyBinding[], excludeActionId?: string): Array<{ actionId: string; binding: KeyBinding }> {
    const conflicts: Array<{ actionId: string; binding: KeyBinding }> = [];

    for (const binding of bindings) {
      const keyCombo = createKeyCombo(binding.key, binding.modifiers);
      
      for (const shortcut of this.shortcuts) {
        if (excludeActionId && shortcut.id === excludeActionId) continue;
        if (!shortcut.enabled) continue;

        for (const existingBinding of shortcut.bindings) {
          const existingKeyCombo = createKeyCombo(existingBinding.key, existingBinding.modifiers);
          if (keyCombo === existingKeyCombo) {
            conflicts.push({ actionId: shortcut.id, binding: existingBinding });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Export current configuration for saving
   */
  exportConfig(): KeyboardShortcutConfig {
    const config: KeyboardShortcutConfig = {};

    for (const shortcut of this.shortcuts) {
      // Export all shortcuts (including defaults)
      config[shortcut.id] = {
        bindings: shortcut.bindings,
        enabled: shortcut.enabled
      };
    }

    return config;
  }

  /**
   * Validate a key binding
   */
  validateBinding(binding: KeyBinding): { valid: boolean; error?: string } {
    if (!binding.key || binding.key.trim() === '') {
      return { valid: false, error: 'Key cannot be empty' };
    }

    // Check for reserved keys that shouldn't be overridden
    const reservedKeys = ['Tab', 'F5', 'F12'];
    if (reservedKeys.includes(binding.key)) {
      return { valid: false, error: `Key ${binding.key} is reserved and cannot be used` };
    }

    return { valid: true };
  }

  /**
   * Get formatted display string for a binding
   */
  getBindingDisplayString(binding: KeyBinding): string {
    const parts: string[] = [];
    
    if (binding.modifiers?.ctrl) parts.push('Ctrl');
    if (binding.modifiers?.alt) parts.push('Alt');
    if (binding.modifiers?.shift) parts.push('Shift');
    if (binding.modifiers?.meta) parts.push('Cmd');
    
    // Format special keys
    let key = binding.key;
    if (key === ' ') key = 'Space';
    else if (key === 'ArrowUp') key = '↑';
    else if (key === 'ArrowDown') key = '↓';
    else if (key === 'ArrowLeft') key = '←';
    else if (key === 'ArrowRight') key = '→';
    
    parts.push(key);
    
    return parts.join(' + ');
  }

  /**
   * Merge default shortcuts with user configuration
   */
  private mergeWithUserConfig(defaults: KeyboardShortcut[], userConfig?: KeyboardShortcutConfig): KeyboardShortcut[] {
    if (!userConfig) return defaults.map(s => ({ ...s }));

    return defaults.map(defaultShortcut => {
      const userOverride = userConfig[defaultShortcut.id];
      if (!userOverride) return { ...defaultShortcut };

      return {
        ...defaultShortcut,
        bindings: userOverride.bindings || defaultShortcut.bindings,
        enabled: userOverride.enabled !== undefined ? userOverride.enabled : defaultShortcut.enabled
      };
    });
  }

  /**
   * Build lookup map for efficient key -> action resolution
   */
  private buildLookupMap(): void {
    this.lookupMap = {};

    for (const shortcut of this.shortcuts) {
      if (!shortcut.enabled) continue;

      for (const binding of shortcut.bindings) {
        const keyCombo = createKeyCombo(binding.key, binding.modifiers);
        
        // Warn about conflicts but allow the last one to win
        // Skip conflict warnings for non-editable shortcuts (known system conflicts)
        if (this.lookupMap[keyCombo]) {
          const existingShortcut = this.shortcuts.find(s => s.id === this.lookupMap[keyCombo]);
          const isExistingNonEditable = existingShortcut && !existingShortcut.editable;
          const isCurrentNonEditable = !shortcut.editable;
          
          if (!isExistingNonEditable && !isCurrentNonEditable) {
            console.warn(`Key combination conflict: ${keyCombo} mapped to both ${this.lookupMap[keyCombo]} and ${shortcut.id}`);
          }
        }
        
        this.lookupMap[keyCombo] = shortcut.id;
      }
    }
  }

  /**
   * Compare two binding arrays for equality
   */
  private areBindingsEqual(a: KeyBinding[], b: KeyBinding[]): boolean {
    if (a.length !== b.length) return false;

    // Sort both arrays by key combo for comparison
    const sortFn = (x: KeyBinding, y: KeyBinding) => 
      createKeyCombo(x.key, x.modifiers).localeCompare(createKeyCombo(y.key, y.modifiers));
    
    const sortedA = [...a].sort(sortFn);
    const sortedB = [...b].sort(sortFn);

    return sortedA.every((bindingA, index) => {
      const bindingB = sortedB[index];
      return createKeyCombo(bindingA.key, bindingA.modifiers) === 
             createKeyCombo(bindingB.key, bindingB.modifiers);
    });
  }
}

// Export singleton instance
export const keyboardShortcutService = new KeyboardShortcutService();