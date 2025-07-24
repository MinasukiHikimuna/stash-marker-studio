/**
 * Platform detection utilities for handling OS-specific behavior
 */

/**
 * Detects if the current platform is macOS
 * @returns true if running on macOS, false otherwise
 */
export function isMac(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side rendering
  }
  
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform) || 
         /Mac/.test(navigator.userAgent);
}

/**
 * Gets the appropriate modifier key name for the current platform
 * @returns 'Option' for Mac, 'Alt' for other platforms
 */
export function getModifierKeyName(): string {
  return isMac() ? 'Option' : 'Alt';
}

/**
 * Checks if the appropriate modifier key is pressed for the current platform
 * On Mac: checks for Option key (altKey)
 * On other platforms: checks for Alt key (altKey)
 * @param event KeyboardEvent to check
 * @returns true if the platform-appropriate modifier is pressed
 */
export function isPlatformModifierPressed(event: KeyboardEvent): boolean {
  // Both Mac Option and PC Alt map to event.altKey
  return event.altKey;
}