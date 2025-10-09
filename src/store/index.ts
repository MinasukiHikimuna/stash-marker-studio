import { configureStore } from '@reduxjs/toolkit';
import { enableMapSet } from 'immer';
import searchReducer from './slices/searchSlice';
import markerReducer from './slices/markerSlice';
import configReducer from './slices/configSlice';
import { persistenceMiddleware } from './middleware/persistenceMiddleware';

// Enable Map and Set support in Immer (required for correspondingTagMappings)
enableMapSet();

export const store = configureStore({
  reducer: {
    search: searchReducer,
    marker: markerReducer,
    config: configReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore Map in state (correspondingTagMappings)
        ignoredPaths: ['config.correspondingTagMappings'],
      },
    }).concat(persistenceMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;