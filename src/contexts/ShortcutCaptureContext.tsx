"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface ShortcutCaptureContextValue {
  activeCapture: string | null;
  startCapture: (id: string) => void;
  stopCapture: (id: string) => void;
  stopAllCapture: () => void;
  isCapturing: (id: string) => boolean;
}

const ShortcutCaptureContext = createContext<ShortcutCaptureContextValue | undefined>(undefined);

export function useShortcutCapture() {
  const context = useContext(ShortcutCaptureContext);
  if (!context) {
    throw new Error('useShortcutCapture must be used within a ShortcutCaptureProvider');
  }
  return context;
}

interface ShortcutCaptureProviderProps {
  children: React.ReactNode;
}

export function ShortcutCaptureProvider({ children }: ShortcutCaptureProviderProps) {
  const [activeCapture, setActiveCapture] = useState<string | null>(null);

  const startCapture = useCallback((id: string) => {
    // Only allow one capture at a time
    setActiveCapture(id);
  }, []);

  const stopCapture = useCallback((id: string) => {
    setActiveCapture(current => current === id ? null : current);
  }, []);

  const stopAllCapture = useCallback(() => {
    setActiveCapture(null);
  }, []);

  const isCapturing = useCallback((id: string) => {
    return activeCapture === id;
  }, [activeCapture]);

  // Global click handler to stop capture when clicking outside
  useEffect(() => {
    if (!activeCapture) return;

    const handleGlobalClick = (event: MouseEvent) => {
      // Check if the click is on a shortcut capture input or its children
      const target = event.target as Element;
      const captureInput = target.closest('[data-keyboard-capture]');
      
      // If clicking outside any capture input, stop all capture
      if (!captureInput) {
        stopAllCapture();
      }
    };

    // Add listener with a small delay to allow focus events to process first
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [activeCapture, stopAllCapture]);

  return (
    <ShortcutCaptureContext.Provider value={{
      activeCapture,
      startCapture,
      stopCapture,
      stopAllCapture,
      isCapturing
    }}>
      {children}
    </ShortcutCaptureContext.Provider>
  );
}