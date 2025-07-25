import { AppConfig } from '@/serverConfig';
import { keyboardShortcutService } from '@/services/KeyboardShortcutService';

/**
 * Save keyboard shortcuts configuration to the server
 */
export async function saveKeyboardShortcutsConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current config from server
    const configResponse = await fetch('/api/config');
    if (!configResponse.ok) {
      return { success: false, error: 'Failed to load current configuration' };
    }
    
    const currentConfig: AppConfig = await configResponse.json();
    
    // Ensure service is initialized before exporting
    if (!keyboardShortcutService.getAllShortcuts().length) {
      console.log('Service not initialized, initializing with current config...');
      await keyboardShortcutService.initialize(currentConfig.keyboardShortcuts);
    }
    
    // Export current shortcuts config
    const shortcutsConfig = keyboardShortcutService.exportConfig();
    console.log('Exporting shortcuts config:', shortcutsConfig);
    console.log('All shortcuts from service:', keyboardShortcutService.getAllShortcuts());
    
    // Update config with new shortcuts
    const updatedConfig: AppConfig = {
      ...currentConfig,
      keyboardShortcuts: shortcutsConfig
    };
    console.log('Updated config:', updatedConfig);
    
    // Save to server
    const saveResponse = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedConfig),
    });
    
    if (!saveResponse.ok) {
      const errorData = await saveResponse.json();
      return { success: false, error: errorData.error || 'Failed to save configuration' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving keyboard shortcuts config:', error);
    return { success: false, error: 'Network error occurred while saving' };
  }
}

/**
 * Load and apply keyboard shortcuts configuration
 */
export async function loadKeyboardShortcutsConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    const configResponse = await fetch('/api/config');
    if (!configResponse.ok) {
      return { success: false, error: 'Failed to load configuration' };
    }
    
    const config: AppConfig = await configResponse.json();
    
    // Initialize keyboard shortcut service with loaded config
    await keyboardShortcutService.initialize(config.keyboardShortcuts);
    
    return { success: true };
  } catch (error) {
    console.error('Error loading keyboard shortcuts config:', error);
    return { success: false, error: 'Network error occurred while loading' };
  }
}