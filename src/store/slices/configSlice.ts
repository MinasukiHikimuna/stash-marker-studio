import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppConfig } from '@/serverConfig';

export interface ConfigState extends AppConfig {
  isLoaded: boolean;
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
  shotBoundaryConfig: {
    aiTagged: '',
    shotBoundary: '',
    sourceShotBoundaryAnalysis: '',
    shotBoundaryProcessed: '',
  },
  isLoaded: false,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setFullConfig: (state, action: PayloadAction<AppConfig>) => {
      return { ...action.payload, isLoaded: true };
    },
    setMarkerGroupingConfig: (state, action: PayloadAction<{ markerGroupParent: string }>) => {
      state.markerGroupingConfig = action.payload;
    },
    setShotBoundaryConfig: (state, action: PayloadAction<{ 
      aiTagged: string; 
      shotBoundary: string; 
      sourceShotBoundaryAnalysis: string; 
      shotBoundaryProcessed: string; 
    }>) => {
      state.shotBoundaryConfig = action.payload;
    },
  },
});

export const { setFullConfig, setMarkerGroupingConfig, setShotBoundaryConfig } = configSlice.actions;

// Selectors for each group
export const selectServerConfig = (state: { config: ConfigState }) => state.config.serverConfig;
export const selectMarkerConfig = (state: { config: ConfigState }) => state.config.markerConfig;
export const selectMarkerGroupingConfig = (state: { config: ConfigState }) => state.config.markerGroupingConfig;
export const selectShotBoundaryConfig = (state: { config: ConfigState }) => state.config.shotBoundaryConfig;

// Individual selectors for common access patterns
export const selectStashUrl = (state: { config: ConfigState }) => state.config.serverConfig.url;
export const selectStashApiKey = (state: { config: ConfigState }) => state.config.serverConfig.apiKey;
export const selectMarkerGroupParentId = (state: { config: ConfigState }) => state.config.markerGroupingConfig.markerGroupParent;
export const selectMarkerStatusConfirmed = (state: { config: ConfigState }) => state.config.markerConfig.statusConfirmed;
export const selectMarkerStatusRejected = (state: { config: ConfigState }) => state.config.markerConfig.statusRejected;
export const selectMarkerSourceManual = (state: { config: ConfigState }) => state.config.markerConfig.sourceManual;
export const selectMarkerAiReviewed = (state: { config: ConfigState }) => state.config.markerConfig.aiReviewed;
export const selectMarkerShotBoundary = (state: { config: ConfigState }) => state.config.shotBoundaryConfig.shotBoundary;

export default configSlice.reducer;