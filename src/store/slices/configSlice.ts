import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ConfigState {
  markerGroupParentId: string;
}

const initialState: ConfigState = {
  markerGroupParentId: '',
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setMarkerGroupParentId: (state, action: PayloadAction<string>) => {
      state.markerGroupParentId = action.payload;
    },
    setConfig: (state, action: PayloadAction<Partial<ConfigState>>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const { setMarkerGroupParentId, setConfig } = configSlice.actions;
export default configSlice.reducer;