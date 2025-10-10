/**
 * Utility for persisting marker-related user preferences in localStorage
 */

const HIDE_DERIVED_MARKERS_KEY = 'stash-marker-studio-hide-derived-markers';

export const markerPreferences = {
  /**
   * Get the stored preference for hiding derived markers
   * @returns boolean - true if derived markers should be hidden, false otherwise
   */
  getHideDerivedMarkers: (): boolean => {
    try {
      const stored = localStorage.getItem(HIDE_DERIVED_MARKERS_KEY);
      return stored === 'true';
    } catch (error) {
      console.error('Error loading hideDerivedMarkers preference:', error);
      return false;
    }
  },

  /**
   * Save the preference for hiding derived markers
   * @param hide - true to hide derived markers, false to show them
   */
  setHideDerivedMarkers: (hide: boolean): void => {
    try {
      localStorage.setItem(HIDE_DERIVED_MARKERS_KEY, String(hide));
    } catch (error) {
      console.error('Error saving hideDerivedMarkers preference:', error);
    }
  },
};
