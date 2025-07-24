"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AppConfig } from "@/serverConfig";
import { stashappService } from "@/services/StashappService";
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
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const loadConfig = async () => {
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
      
      if (!res.ok) {
        throw new Error("Failed to fetch config");
      }
      
      const json = (await res.json()) as AppConfig;
      stashappService.applyConfig(json);
      setConfig(json);
      setIsConfigured(true);
      
      // Dispatch config to Redux store with grouped structure
      dispatch(setFullConfig({
        server: {
          url: json.serverConfig.url,
          apiKey: json.serverConfig.apiKey,
        },
        markerStatus: {
          confirmed: json.markerConfig.statusConfirmed,
          rejected: json.markerConfig.statusRejected,
          sourceManual: json.markerConfig.sourceManual,
          aiReviewed: json.markerConfig.aiReviewed,
        },
        markerGrouping: {
          parentId: json.markerGroupingConfig.markerGroupParent,
        },
        shotBoundary: {
          marker: json.shotBoundaryConfig.shotBoundary,
          sourceDetection: json.shotBoundaryConfig.sourceShotBoundaryAnalysis,
          aiTagged: json.shotBoundaryConfig.aiTagged,
          processed: json.shotBoundaryConfig.shotBoundaryProcessed,
        },
      }));
    } catch (err) {
      console.error("Failed to load configuration", err);
      setIsConfigured(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [dispatch, router, pathname]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div>Loading configuration...</div>
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
