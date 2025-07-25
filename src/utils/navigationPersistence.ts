/**
 * Utility for persisting navigation state to enable back navigation from settings
 */

const PREVIOUS_PAGE_KEY = 'stash-marker-studio-previous-page';

export interface PreviousPageData {
  path: string;
  title?: string;
  timestamp: number;
}

export const navigationPersistence = {
  /**
   * Store the current page before navigating to settings
   */
  storePreviousPage(path: string, title?: string): void {
    const data: PreviousPageData = {
      path,
      title,
      timestamp: Date.now(),
    };
    
    try {
      sessionStorage.setItem(PREVIOUS_PAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to store previous page:', error);
    }
  },

  /**
   * Get the previously stored page data
   */
  getPreviousPage(): PreviousPageData | null {
    try {
      const stored = sessionStorage.getItem(PREVIOUS_PAGE_KEY);
      if (!stored) return null;
      
      const data: PreviousPageData = JSON.parse(stored);
      
      // Check if data is too old (older than 1 hour)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - data.timestamp > oneHour) {
        this.clearPreviousPage();
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Failed to get previous page:', error);
      return null;
    }
  },

  /**
   * Clear the stored previous page data
   */
  clearPreviousPage(): void {
    try {
      sessionStorage.removeItem(PREVIOUS_PAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear previous page:', error);
    }
  },

  /**
   * Get a user-friendly page title for display
   */
  getPageTitle(path: string): string {
    if (path.startsWith('/marker')) return 'Marker Review';
    if (path.startsWith('/search')) return 'Scene Search';
    if (path === '/') return 'Home';
    return 'Previous Page';
  },
};