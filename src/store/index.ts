import { configureStore } from '@reduxjs/toolkit';
import searchReducer from './slices/searchSlice';
import markerReducer from './slices/markerSlice';
import { persistenceMiddleware } from './middleware/persistenceMiddleware';

export const store = configureStore({
  reducer: {
    search: searchReducer,
    marker: markerReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['payload.element'],
        // Ignore these paths in the state
        ignoredPaths: ['marker.video.element'],
      },
    }).concat(persistenceMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;