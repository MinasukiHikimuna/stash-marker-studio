import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ConfigState {
  server: {
    url: string;
    apiKey: string;
  };
  markerStatus: {
    confirmed: string;
    rejected: string;
    sourceManual: string;
    aiReviewed: string;
  };
  markerGrouping: {
    parentId: string;
  };
  shotBoundary: {
    marker: string;
    sourceDetection: string;
    aiTagged: string;
    processed: string;
  };
  isLoaded: boolean;
}

const initialState: ConfigState = {
  server: {
    url: '',
    apiKey: '',
  },
  markerStatus: {
    confirmed: '',
    rejected: '',
    sourceManual: '',
    aiReviewed: '',
  },
  markerGrouping: {
    parentId: '',
  },
  shotBoundary: {
    marker: '',
    sourceDetection: '',
    aiTagged: '',
    processed: '',
  },
  isLoaded: false,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setServerConfig: (state, action: PayloadAction<Partial<ConfigState['server']>>) => {
      state.server = { ...state.server, ...action.payload };
    },
    setMarkerStatusConfig: (state, action: PayloadAction<Partial<ConfigState['markerStatus']>>) => {
      state.markerStatus = { ...state.markerStatus, ...action.payload };
    },
    setMarkerGroupingConfig: (state, action: PayloadAction<Partial<ConfigState['markerGrouping']>>) => {
      state.markerGrouping = { ...state.markerGrouping, ...action.payload };
    },
    setShotBoundaryConfig: (state, action: PayloadAction<Partial<ConfigState['shotBoundary']>>) => {
      state.shotBoundary = { ...state.shotBoundary, ...action.payload };
    },
    setFullConfig: (state, action: PayloadAction<Omit<ConfigState, 'isLoaded'>>) => {
      return { ...action.payload, isLoaded: true };
    },
  },
});

export const { 
  setServerConfig,
  setMarkerStatusConfig,
  setMarkerGroupingConfig,
  setShotBoundaryConfig,
  setFullConfig,
} = configSlice.actions;

// Selectors for each group
export const selectServerConfig = (state: { config: ConfigState }) => state.config.server;
export const selectMarkerStatusConfig = (state: { config: ConfigState }) => state.config.markerStatus;
export const selectMarkerGroupingConfig = (state: { config: ConfigState }) => state.config.markerGrouping;
export const selectShotBoundaryConfig = (state: { config: ConfigState }) => state.config.shotBoundary;

// Individual selectors for common access patterns
export const selectStashUrl = (state: { config: ConfigState }) => state.config.server.url;
export const selectStashApiKey = (state: { config: ConfigState }) => state.config.server.apiKey;
export const selectMarkerGroupParentId = (state: { config: ConfigState }) => state.config.markerGrouping.parentId;
export const selectMarkerStatusConfirmed = (state: { config: ConfigState }) => state.config.markerStatus.confirmed;
export const selectMarkerStatusRejected = (state: { config: ConfigState }) => state.config.markerStatus.rejected;
export const selectMarkerSourceManual = (state: { config: ConfigState }) => state.config.markerStatus.sourceManual;
export const selectMarkerAiReviewed = (state: { config: ConfigState }) => state.config.markerStatus.aiReviewed;
export const selectMarkerShotBoundary = (state: { config: ConfigState }) => state.config.shotBoundary.marker;

export default configSlice.reducer;