"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AppConfig } from "@/serverConfig";
import { stashappService } from "@/services/StashappService";
import { keyboardShortcutService } from "@/services/KeyboardShortcutService";
import { useAppDispatch } from "@/store/hooks";
import { setFullConfig } from "@/store/slices/configSlice";

interface ConfigContextValue {
  config: AppConfig | null;
  isConfigured: boolean;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export function useConfig(): AppConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx || !ctx.config) {
    throw new Error(
      "Config has not been loaded yet. Make sure your component is wrapped in <ConfigProvider />"
    );
  }
  return ctx.config;
}

interface ConfigProviderProps {
  children: React.ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      
      if (res.status === 404) {
        // No configuration found - redirect to config page unless already there
        setIsConfigured(false);
        setIsLoading(false);
        if (pathname !== "/config") {
          router.push("/config");
        }
        return;
      }
      
      if (res.status === 500) {
        // Server error (corrupted config) - show error and don't retry
        const errorData = await res.json();
        console.error("Configuration error:", errorData.error);
        setConfigError(errorData.error || "Configuration file is corrupted");
        setIsConfigured(false);
        setIsLoading(false);
        // Don't redirect - show error state
        return;
      }
      
      if (!res.ok) {
        throw new Error("Failed to fetch config");
      }
      
      const json = (await res.json()) as AppConfig;
      stashappService.applyConfig(json);
      
      // Initialize keyboard shortcut service with user config
      await keyboardShortcutService.initialize(json.keyboardShortcuts);
      
      setConfig(json);
      setIsConfigured(true);
      
      // Dispatch config directly to Redux store 
      dispatch(setFullConfig(json));
    } catch (err) {
      console.error("Failed to load configuration", err);
      setIsConfigured(false);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, router, pathname]);

  useEffect(() => {
    loadConfig();
  }, [dispatch, router, pathname, loadConfig]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Loading configuration...</div>
      </div>
    );
  }

  // Show error state for corrupted config
  if (configError) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto p-8">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Configuration Error</h1>
          <p className="mb-4 text-gray-300">{configError}</p>
          <div className="bg-gray-800 p-4 rounded-lg text-left text-sm">
            <p className="font-semibold mb-2">To fix this issue:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-400">
              <li>Stop the server</li>
              <li>Delete the corrupted app-config.json file</li>
              <li>Copy app-config.sample.json to app-config.json</li>
              <li>Restart the server and configure through the UI</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // If not configured and not on config page, show setup message
  if (!isConfigured && pathname !== "/config") {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Configuration Required</h1>
          <p className="mb-4">Redirecting to configuration page...</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigContext.Provider value={{ config, isConfigured }}>
      {children}
    </ConfigContext.Provider>
  );
}
