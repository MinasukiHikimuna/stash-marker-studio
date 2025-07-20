import { Middleware } from '@reduxjs/toolkit';
import { saveSearchParams } from '../utils/localStorage';
import type { SearchState } from '../slices/searchSlice';

// Define the app state shape that the middleware needs to know about
interface AppState {
  search: SearchState;
}

// Actions that should trigger localStorage persistence
const PERSISTENCE_ACTIONS = [
  'search/setQuery',
  'search/setSortField', 
  'search/setSortDirection',
  'search/toggleSortDirection',
  'search/addSelectedTag',
  'search/removeSelectedTag',
  'search/setSelectedTags',
  'search/initializeSearch/fulfilled', // Also save after initialization
];

export const persistenceMiddleware: Middleware<object, AppState> = (store) => (next) => (action) => {
  // Call the next middleware/reducer first
  const result = next(action);
  
  // Check if this action should trigger persistence
  if (typeof action === 'object' && action && 'type' in action && typeof action.type === 'string' && PERSISTENCE_ACTIONS.includes(action.type)) {
    const state = store.getState();
    const searchState = state.search;
    
    // Only persist if we have tags loaded (initialization completed)
    if (searchState.initialized && searchState.allTags.length > 0) {
      saveSearchParams({
        query: searchState.query,
        tags: searchState.selectedTags,
        sortField: searchState.sortField,
        sortDirection: searchState.sortDirection,
      });
    }
  }
  
  return result;
};