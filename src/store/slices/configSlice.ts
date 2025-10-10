import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { AppConfig } from '@/serverConfig';

export type MarkerGroupTag = {
  id: string;
  name: string;
  orderNumber: number;
  description?: string | null;
  childTags?: ChildTag[];
};

export type ChildTag = {
  id: string;
  name: string;
  description?: string | null;
};

export interface ConfigState extends AppConfig {
  isLoaded: boolean;
  markerGroups: {
    tags: MarkerGroupTag[];
    isLoading: boolean;
    error: string | null;
  };
  correspondingTagMappings: Record<number, number>; // sourceTagId -> correspondingTagId
}

const initialState: ConfigState = {
  serverConfig: {
    url: '',
    apiKey: '',
  },
  markerConfig: {
    statusConfirmed: '',
    statusRejected: '',
    sourceManual: '',
    aiReviewed: '',
  },
  markerGroupingConfig: {
    markerGroupParent: '',
  },
  markerGroupTagSorting: {},
  videoPlaybackConfig: {
    smallSeekTime: 5,
    mediumSeekTime: 10,
    longSeekTime: 30,
    smallFrameStep: 1,
    mediumFrameStep: 10,
    longFrameStep: 30,
  },
  isLoaded: false,
  markerGroups: {
    tags: [],
    isLoading: false,
    error: null,
  },
  correspondingTagMappings: {},
};

// Async thunk to load marker group tags
export const loadMarkerGroups = createAsyncThunk(
  'config/loadMarkerGroups',
  async (_, { getState }) => {
    const state = getState() as { config: ConfigState; marker: { availableTags: Array<{ id: string; name: string; description?: string | null; parents?: Array<{ id: string }> }> } };
    const markerGroupParent = state.config.markerGroupingConfig.markerGroupParent;
    const availableTags = state.marker.availableTags;
    
    if (!markerGroupParent || !availableTags.length) {
      return [];
    }

    // Filter and transform marker group tags from existing tags
    const groupTags = availableTags
      .filter(tag => 
        tag.parents?.some(parent => parent.id === markerGroupParent) &&
        tag.name.startsWith("Marker Group: ")
      )
      .map(tag => {
        const match = tag.name.match(/Marker Group: (\d+)\./);
        const orderNumber = match ? parseInt(match[1], 10) : 999;
        
        return {
          id: tag.id,
          name: tag.name,
          orderNumber,
          description: tag.description,
        };
      })
      .sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { 
          numeric: true, 
          sensitivity: 'base' 
        });
      });

    return groupTags;
  }
);

// Async thunk to load child tags for a specific marker group
export const loadChildTags = createAsyncThunk(
  'config/loadChildTags',
  async (markerGroupId: string, { getState }) => {
    const state = getState() as { config: ConfigState; marker: { availableTags: Array<{ id: string; name: string; description?: string | null; parents?: Array<{ id: string }> }> } };
    const availableTags = state.marker.availableTags;

    if (!availableTags.length) {
      return { markerGroupId, childTags: [] };
    }

    // Filter child tags that have this marker group as parent
    const childTags = availableTags
      .filter(tag =>
        tag.parents?.some(parent => parent.id === markerGroupId) &&
        !tag.name.startsWith("Marker Group: ") // Exclude other marker groups
      )
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { markerGroupId, childTags };
  }
);

// Async thunk to load corresponding tag mappings from database
export const loadCorrespondingTagMappings = createAsyncThunk(
  'config/loadCorrespondingTagMappings',
  async () => {
    const response = await fetch('/api/corresponding-tag-mappings');
    if (!response.ok) {
      throw new Error('Failed to load corresponding tag mappings');
    }
    const mappings = await response.json() as Array<{ sourceTagId: number; correspondingTagId: number }>;

    // Convert to plain object for Redux serialization
    const mappingObject: Record<number, number> = {};
    for (const mapping of mappings) {
      mappingObject[mapping.sourceTagId] = mapping.correspondingTagId;
    }

    return mappingObject;
  }
);

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setFullConfig: (state, action: PayloadAction<AppConfig>) => {
      const markerGroups = state.markerGroups; // Preserve marker groups state
      const correspondingTagMappings = state.correspondingTagMappings; // Preserve mappings state
      return { ...action.payload, isLoaded: true, markerGroups, correspondingTagMappings };
    },
    setMarkerGroupingConfig: (state, action: PayloadAction<{ markerGroupParent: string }>) => {
      state.markerGroupingConfig = action.payload;
      // Clear marker groups when parent changes
      state.markerGroups.tags = [];
    },
    clearMarkerGroups: (state) => {
      state.markerGroups.tags = [];
      state.markerGroups.error = null;
    },
    setMarkerGroupTagSorting: (state, action: PayloadAction<{ markerGroupId: string; sortOrder: string[] }>) => {
      const { markerGroupId, sortOrder } = action.payload;
      if (!state.markerGroupTagSorting) {
        state.markerGroupTagSorting = {};
      }
      state.markerGroupTagSorting[markerGroupId] = sortOrder;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMarkerGroups.pending, (state) => {
        state.markerGroups.isLoading = true;
        state.markerGroups.error = null;
      })
      .addCase(loadMarkerGroups.fulfilled, (state, action) => {
        state.markerGroups.isLoading = false;
        state.markerGroups.tags = action.payload;
      })
      .addCase(loadMarkerGroups.rejected, (state, action) => {
        state.markerGroups.isLoading = false;
        state.markerGroups.error = action.payload as string;
      })
      .addCase(loadChildTags.fulfilled, (state, action) => {
        const { markerGroupId, childTags } = action.payload;
        const markerGroup = state.markerGroups.tags.find(group => group.id === markerGroupId);
        if (markerGroup) {
          markerGroup.childTags = childTags;
        }
      })
      .addCase(loadCorrespondingTagMappings.fulfilled, (state, action) => {
        state.correspondingTagMappings = action.payload;
      });
  },
});

export const { setFullConfig, setMarkerGroupingConfig, clearMarkerGroups, setMarkerGroupTagSorting } = configSlice.actions;

// Selectors for each group
export const selectServerConfig = (state: { config: ConfigState }) => state.config.serverConfig;
export const selectMarkerConfig = (state: { config: ConfigState }) => state.config.markerConfig;
export const selectMarkerGroupingConfig = (state: { config: ConfigState }) => state.config.markerGroupingConfig;
export const selectVideoPlaybackConfig = (state: { config: ConfigState }) => state.config.videoPlaybackConfig;

// Marker groups selectors
export const selectMarkerGroups = (state: { config: ConfigState }) => state.config.markerGroups.tags;
export const selectMarkerGroupsLoading = (state: { config: ConfigState }) => state.config.markerGroups.isLoading;
export const selectMarkerGroupsError = (state: { config: ConfigState }) => state.config.markerGroups.error;

// Individual selectors for common access patterns
export const selectStashUrl = (state: { config: ConfigState }) => state.config.serverConfig.url;
export const selectStashApiKey = (state: { config: ConfigState }) => state.config.serverConfig.apiKey;
export const selectMarkerGroupParentId = (state: { config: ConfigState }) => state.config.markerGroupingConfig.markerGroupParent;
export const selectMarkerStatusConfirmed = (state: { config: ConfigState }) => state.config.markerConfig.statusConfirmed;
export const selectMarkerStatusRejected = (state: { config: ConfigState }) => state.config.markerConfig.statusRejected;
export const selectMarkerSourceManual = (state: { config: ConfigState }) => state.config.markerConfig.sourceManual;
export const selectMarkerAiReviewed = (state: { config: ConfigState }) => state.config.markerConfig.aiReviewed;
export const selectMarkerGroupTagSorting = (state: { config: ConfigState }) => state.config.markerGroupTagSorting || {};
export const selectCorrespondingTagMappings = (state: { config: ConfigState }) => state.config.correspondingTagMappings;
export const selectDerivedMarkers = (state: { config: ConfigState }) => state.config.derivedMarkers || [];
export const selectMaxDerivationDepth = (state: { config: ConfigState }) => state.config.maxDerivationDepth || 3;

export default configSlice.reducer;
