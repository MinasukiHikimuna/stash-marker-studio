import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ConfigState {
  markerGroupParentId: string;
  stashUrl: string;
  stashApiKey: string;
}

const initialState: ConfigState = {
  markerGroupParentId: '',
  stashUrl: '',
  stashApiKey: '',
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setMarkerGroupParentId: (state, action: PayloadAction<string>) => {
      state.markerGroupParentId = action.payload;
    },
    setStashUrl: (state, action: PayloadAction<string>) => {
      state.stashUrl = action.payload;
    },
    setStashApiKey: (state, action: PayloadAction<string>) => {
      state.stashApiKey = action.payload;
    },
    setConfig: (state, action: PayloadAction<Partial<ConfigState>>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const { setMarkerGroupParentId, setStashUrl, setStashApiKey, setConfig } = configSlice.actions;
export default configSlice.reducer;