import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Scene, Tag, SceneMarker } from '@/services/StashappService';
import { loadSearchParams, matchSavedTagsWithLoadedTags } from '../utils/localStorage';

// Types
export type SceneWithMarkers = Scene & {
  scene_markers?: SceneMarker[];
};

export type TagType = 'included' | 'excluded';

export type SelectedTag = Tag & {
  type: TagType;
};

export type SortField = 
  | 'bitrate' | 'created_at' | 'code' | 'date' | 'file_count' | 'filesize' 
  | 'duration' | 'file_mod_time' | 'framerate' | 'group_scene_number' | 'id' 
  | 'interactive' | 'interactive_speed' | 'last_o_at' | 'last_played_at' 
  | 'movie_scene_number' | 'o_counter' | 'organized' | 'performer_count' 
  | 'play_count' | 'play_duration' | 'resume_time' | 'path' | 'perceptual_similarity' 
  | 'random' | 'rating' | 'tag_count' | 'title' | 'updated_at';

export type MarkerFilter = 'all' | 'none' | 'has_unconfirmed' | 'has_unfilled_slots';

export interface SearchState {
  // Search parameters
  query: string;
  selectedTags: SelectedTag[];
  sortField: SortField;
  sortDirection: 'ASC' | 'DESC';
  markerFilter: MarkerFilter;

  // Tag management
  allTags: Tag[];
  tagSearchQuery: string;
  tagSuggestions: Tag[];

  // Results
  scenes: SceneWithMarkers[];

  // UI state
  loading: boolean;
  error: string | null;
  tagsLoading: boolean;
  tagsError: string | null;

  // Initialization state
  initialized: boolean;
  initializing: boolean;
  initializationError: string | null;

  // Search state tracking
  hasSearched: boolean;
}

const initialState: SearchState = {
  query: '',
  selectedTags: [],
  sortField: 'title',
  sortDirection: 'ASC',
  markerFilter: 'all',
  allTags: [],
  tagSearchQuery: '',
  tagSuggestions: [],
  scenes: [],
  loading: false,
  error: null,
  tagsLoading: false,
  tagsError: null,
  initialized: false,
  initializing: false,
  initializationError: null,
  hasSearched: false,
};

// Async thunks
export const loadAllTags = createAsyncThunk(
  'search/loadAllTags',
  async () => {
    const response = await fetch('/api/tags');
    if (!response.ok) {
      throw new Error('Failed to load tags');
    }
    const data = await response.json();
    return data.tags;
  }
);

// New comprehensive initialization thunk
export const initializeSearch = createAsyncThunk(
  'search/initializeSearch',
  async () => {
    // First load all tags from local database
    const tagsResponse = await fetch('/api/tags');
    if (!tagsResponse.ok) {
      throw new Error('Failed to load tags');
    }
    const tagsData = await tagsResponse.json();
    const allTags = tagsData.tags;

    // Try to load saved search parameters
    const savedParams = loadSearchParams();
    let restoredParams = null;

    if (savedParams) {
      // Match saved tag IDs with loaded tag data
      const matchedTags = matchSavedTagsWithLoadedTags(savedParams.tags, allTags);

      restoredParams = {
        query: savedParams.query,
        selectedTags: matchedTags,
        sortField: savedParams.sortField,
        sortDirection: savedParams.sortDirection,
      };
    }

    return {
      allTags,
      restoredParams,
    };
  }
);

export const searchScenes = createAsyncThunk(
  'search/searchScenes',
  async (params: {
    query: string;
    selectedTags: SelectedTag[];
    sortField: SortField;
    sortDirection: 'ASC' | 'DESC';
    markerFilter: MarkerFilter;
  }) => {
    const includedTagIds = params.selectedTags
      .filter(tag => tag.type === 'included')
      .map(tag => tag.id);
    const excludedTagIds = params.selectedTags
      .filter(tag => tag.type === 'excluded')
      .map(tag => tag.id);

    // Build query parameters
    const queryParams = new URLSearchParams({
      query: params.query,
      sortField: params.sortField,
      sortDirection: params.sortDirection,
    });

    if (includedTagIds.length > 0) {
      queryParams.set('includedTagIds', includedTagIds.join(','));
    }
    if (excludedTagIds.length > 0) {
      queryParams.set('excludedTagIds', excludedTagIds.join(','));
    }
    if (params.markerFilter !== 'all') {
      queryParams.set('markerFilter', params.markerFilter);
    }

    const response = await fetch(`/api/scenes/search?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to search scenes');
    }
    const data = await response.json();
    return data.scenes;
  }
);

// Create slice
const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    
    setSortField: (state, action: PayloadAction<SortField>) => {
      state.sortField = action.payload;
    },
    
    setSortDirection: (state, action: PayloadAction<'ASC' | 'DESC'>) => {
      state.sortDirection = action.payload;
    },
    
    toggleSortDirection: (state) => {
      state.sortDirection = state.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    },

    setMarkerFilter: (state, action: PayloadAction<MarkerFilter>) => {
      state.markerFilter = action.payload;
    },

    addSelectedTag: (state, action: PayloadAction<Tag & { type?: TagType }>) => {
      const { type = 'included', ...tag } = action.payload;
      if (!state.selectedTags.some(t => t.id === tag.id)) {
        state.selectedTags.push({ ...tag, type });
      }
    },
    
    toggleTagType: (state, action: PayloadAction<string>) => {
      const tagIndex = state.selectedTags.findIndex(tag => tag.id === action.payload);
      if (tagIndex !== -1) {
        state.selectedTags[tagIndex].type = 
          state.selectedTags[tagIndex].type === 'included' ? 'excluded' : 'included';
      }
    },
    
    removeSelectedTag: (state, action: PayloadAction<string>) => {
      state.selectedTags = state.selectedTags.filter(tag => tag.id !== action.payload);
    },
    
    setSelectedTags: (state, action: PayloadAction<SelectedTag[]>) => {
      state.selectedTags = action.payload;
    },
    
    setTagSearchQuery: (state, action: PayloadAction<string>) => {
      state.tagSearchQuery = action.payload;
    },
    
    updateTagSuggestions: (state) => {
      if (state.tagSearchQuery) {
        state.tagSuggestions = state.allTags
          .filter(tag => 
            tag.name.toLowerCase().includes(state.tagSearchQuery.toLowerCase()) &&
            !state.selectedTags.some(selected => selected.id === tag.id)
          )
          .slice(0, 10);
      } else {
        state.tagSuggestions = [];
      }
    },
    
    clearTagSuggestions: (state) => {
      state.tagSuggestions = [];
    },
    
    // Load saved search parameters
    loadSavedParams: (state, action: PayloadAction<{
      query: string;
      tags: SelectedTag[];
      sortField: SortField;
      sortDirection: 'ASC' | 'DESC';
    }>) => {
      const { query, tags, sortField, sortDirection } = action.payload;
      state.query = query;
      state.selectedTags = tags;
      state.sortField = sortField;
      state.sortDirection = sortDirection;
    },
    
    clearError: (state) => {
      state.error = null;
    },
  },
  
  extraReducers: (builder) => {
    // Initialize search (comprehensive initialization)
    builder
      .addCase(initializeSearch.pending, (state) => {
        state.initializing = true;
        state.initializationError = null;
      })
      .addCase(initializeSearch.fulfilled, (state, action) => {
        state.initializing = false;
        state.initialized = true;
        state.allTags = action.payload.allTags;
        
        // Restore saved parameters if available
        if (action.payload.restoredParams) {
          const { query, selectedTags, sortField, sortDirection } = action.payload.restoredParams;
          state.query = query;
          state.selectedTags = selectedTags;
          state.sortField = sortField;
          state.sortDirection = sortDirection;
          // Don't set hasSearched here - let it be set when the actual search starts
        }
      })
      .addCase(initializeSearch.rejected, (state, action) => {
        state.initializing = false;
        state.initializationError = action.error.message || 'Failed to initialize search';
      });
    
    // Load all tags (keep for backward compatibility)
    builder
      .addCase(loadAllTags.pending, (state) => {
        state.tagsLoading = true;
        state.tagsError = null;
      })
      .addCase(loadAllTags.fulfilled, (state, action) => {
        state.tagsLoading = false;
        state.allTags = action.payload;
      })
      .addCase(loadAllTags.rejected, (state, action) => {
        state.tagsLoading = false;
        state.tagsError = action.error.message || 'Failed to load tags';
      });
      
    // Search scenes
    builder
      .addCase(searchScenes.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.hasSearched = true; // Mark that a search has been attempted
        // Clear previous results immediately when starting a new search
        state.scenes = [];
      })
      .addCase(searchScenes.fulfilled, (state, action) => {
        state.loading = false;
        state.scenes = action.payload;
      })
      .addCase(searchScenes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to search scenes';
        // Keep scenes empty on error so user doesn't see stale results
        state.scenes = [];
      });
  },
});

// Export actions
export const {
  setQuery,
  setSortField,
  setSortDirection,
  toggleSortDirection,
  setMarkerFilter,
  addSelectedTag,
  toggleTagType,
  removeSelectedTag,
  setSelectedTags,
  setTagSearchQuery,
  updateTagSuggestions,
  clearTagSuggestions,
  loadSavedParams,
  clearError,
} = searchSlice.actions;

// Export selectors
export const selectSearchState = (state: { search: SearchState }) => state.search;
export const selectQuery = (state: { search: SearchState }) => state.search.query;
export const selectSelectedTags = (state: { search: SearchState }) => state.search.selectedTags;
export const selectSortField = (state: { search: SearchState }) => state.search.sortField;
export const selectSortDirection = (state: { search: SearchState }) => state.search.sortDirection;
export const selectMarkerFilter = (state: { search: SearchState }) => state.search.markerFilter;
export const selectAllTags = (state: { search: SearchState }) => state.search.allTags;
export const selectTagSearchQuery = (state: { search: SearchState }) => state.search.tagSearchQuery;
export const selectTagSuggestions = (state: { search: SearchState }) => state.search.tagSuggestions;
export const selectScenes = (state: { search: SearchState }) => state.search.scenes;
export const selectLoading = (state: { search: SearchState }) => state.search.loading;
export const selectError = (state: { search: SearchState }) => state.search.error;
export const selectTagsLoading = (state: { search: SearchState }) => state.search.tagsLoading;
export const selectInitialized = (state: { search: SearchState }) => state.search.initialized;
export const selectInitializing = (state: { search: SearchState }) => state.search.initializing;
export const selectInitializationError = (state: { search: SearchState }) => state.search.initializationError;
export const selectHasSearched = (state: { search: SearchState }) => state.search.hasSearched;

export default searchSlice.reducer;