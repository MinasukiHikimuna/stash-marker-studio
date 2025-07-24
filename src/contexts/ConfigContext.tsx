"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { AppConfig } from "@/serverConfig";
import { stashappService } from "@/services/StashappService";
import { useAppDispatch } from "@/store/hooks";
import { setConfig as setReduxConfig } from "@/store/slices/configSlice";

interface ConfigContextValue {
  config: AppConfig | null;
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
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Failed to fetch config");
        const json = (await res.json()) as AppConfig;
        stashappService.applyConfig(json);
        setConfig(json);
        
        // Dispatch config to Redux store
        dispatch(setReduxConfig({
          markerGroupParentId: json.MARKER_GROUP_PARENT_ID,
          stashUrl: json.STASH_URL,
          stashApiKey: json.STASH_API_KEY,
        }));
      } catch (err) {
        console.error("Failed to load configuration", err);
      }
    }
    load();
  }, [dispatch]);

  if (!config) return null; // or loading indicator

  return (
    <ConfigContext.Provider value={{ config }}>
      {children}
    </ConfigContext.Provider>
  );
}
