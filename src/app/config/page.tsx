"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectServerConfig,
  selectMarkerStatusConfig,
  selectMarkerGroupingConfig,
  selectShotBoundaryConfig,
  setFullConfig,
} from "@/store/slices/configSlice";
import { selectAvailableTags, loadAvailableTags } from "@/store/slices/markerSlice";
import type { AppConfig } from "@/serverConfig";
import { TagAutocomplete } from "@/components/marker/TagAutocomplete";

export default function ConfigPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const serverConfig = useAppSelector(selectServerConfig);
  const markerStatusConfig = useAppSelector(selectMarkerStatusConfig);
  const markerGroupingConfig = useAppSelector(selectMarkerGroupingConfig);
  const shotBoundaryConfig = useAppSelector(selectShotBoundaryConfig);
  const availableTags = useAppSelector(selectAvailableTags);

  const [formData, setFormData] = useState({
    server: { url: "", apiKey: "" },
    markerStatus: { confirmed: "", rejected: "", sourceManual: "", aiReviewed: "" },
    markerGrouping: { parentId: "" },
    shotBoundary: { marker: "", sourceDetection: "", aiTagged: "", processed: "" },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [tagsLoaded, setTagsLoaded] = useState(false);

  // Load current config into form
  useEffect(() => {
    // Check if this is initial setup (all configs are empty)
    const isEmpty = !serverConfig.url && !serverConfig.apiKey && 
                   !markerStatusConfig.confirmed && !markerStatusConfig.rejected;
    setIsInitialSetup(isEmpty);
    
    setFormData({
      server: serverConfig,
      markerStatus: markerStatusConfig,
      markerGrouping: markerGroupingConfig,
      shotBoundary: shotBoundaryConfig,
    });
  }, [serverConfig, markerStatusConfig, markerGroupingConfig, shotBoundaryConfig]);

  // Load tags when server config is available
  useEffect(() => {
    if (serverConfig.url && serverConfig.apiKey && !tagsLoaded) {
      const loadTags = async () => {
        try {
          // Apply current config to StashappService so it can make API calls
          const appConfig = {
            serverConfig,
            markerConfig: markerStatusConfig,
            markerGroupingConfig,
            shotBoundaryConfig,
          };
          const { stashappService } = await import("@/services/StashappService");
          stashappService.applyConfig(appConfig);
          
          await dispatch(loadAvailableTags()).unwrap();
        } catch (error) {
          console.error("Failed to automatically load tags:", error);
        }
      };
      loadTags();
      setTagsLoaded(true);
    }
  }, [serverConfig, markerStatusConfig, markerGroupingConfig, shotBoundaryConfig, tagsLoaded, dispatch]);

  const handleInputChange = (section: string, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Convert form data to AppConfig format with normalized URL
      const appConfig: AppConfig = {
        serverConfig: {
          url: normalizeUrl(formData.server.url),
          apiKey: formData.server.apiKey,
        },
        markerConfig: {
          statusConfirmed: formData.markerStatus.confirmed,
          statusRejected: formData.markerStatus.rejected,
          sourceManual: formData.markerStatus.sourceManual,
          aiReviewed: formData.markerStatus.aiReviewed,
        },
        markerGroupingConfig: {
          markerGroupParent: formData.markerGrouping.parentId,
        },
        shotBoundaryConfig: {
          aiTagged: formData.shotBoundary.aiTagged,
          shotBoundary: formData.shotBoundary.marker,
          sourceShotBoundaryAnalysis: formData.shotBoundary.sourceDetection,
          shotBoundaryProcessed: formData.shotBoundary.processed,
        },
      };

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      // Update Redux store
      dispatch(setFullConfig({
        server: formData.server,
        markerStatus: formData.markerStatus,
        markerGrouping: formData.markerGrouping,
        shotBoundary: formData.shotBoundary,
      }));

      // Apply config to StashappService
      const { stashappService } = await import("@/services/StashappService");
      stashappService.applyConfig(appConfig);

      setMessage("Configuration saved successfully!");
      
      // If this was initial setup, redirect to search after a short delay
      if (isInitialSetup) {
        setTimeout(() => {
          router.push("/search");
        }, 1500);
      }
    } catch (error) {
      setMessage("Error saving configuration: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const normalizeUrl = (url: string): string => {
    // Remove trailing slash if present
    let normalized = url.replace(/\/+$/, '');
    
    // Ensure it starts with http:// or https://
    if (!normalized.match(/^https?:\/\//)) {
      normalized = `http://${normalized}`;
    }
    
    return normalized;
  };

  const handleTestConnection = async () => {
    if (!formData.server.url || !formData.server.apiKey) {
      setMessage("Please enter both URL and API key to test connection");
      return;
    }

    setMessage("Testing connection...");
    try {
      // Normalize the URL to handle common issues
      const normalizedUrl = normalizeUrl(formData.server.url);
      
      // Test connection directly from client side for better debugging
      const testQuery = `
        query Version {
          version {
            version
          }
        }
      `;

      const response = await fetch(`${normalizedUrl}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ApiKey: formData.server.apiKey,
        },
        body: JSON.stringify({ query: testQuery }),
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response body:", errorText);
        setMessage(`Connection failed: HTTP ${response.status} - ${errorText.substring(0, 200)}...`);
        return;
      }

      const result = await response.json();
      console.log("GraphQL response:", result);

      if (result.errors) {
        setMessage(`GraphQL error: ${result.errors[0]?.message || "Unknown error"}`);
        return;
      }

      if (result.data?.version?.version) {
        setMessage(`Connection successful! Stash version: ${result.data.version.version}`);
      } else {
        setMessage("Connection successful but unexpected response format");
      }
    } catch (error) {
      console.error("Connection test error:", error);
      setMessage("Connection test failed: " + (error as Error).message);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          {isInitialSetup ? "Welcome to Stash Marker Studio" : "Configuration"}
        </h1>
        {isInitialSetup && (
          <p className="text-gray-300 mb-8">
            Please configure your Stash server connection and tag settings to get started.
          </p>
        )}
        
        {message && (
          <div className={`mb-6 p-4 rounded ${
            message.includes("Error") || message.includes("failed") 
              ? "bg-red-900 border border-red-700" 
              : "bg-green-900 border border-green-700"
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-8">
          {/* Server Configuration */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Server Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Stash URL
                </label>
                <input
                  type="url"
                  value={formData.server.url}
                  onChange={(e) => handleInputChange("server", "url", e.target.value)}
                  placeholder="http://localhost:9999"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
                {formData.server.url && (
                  <p className="text-xs text-gray-400 mt-1">
                    Will be saved as: {normalizeUrl(formData.server.url)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.server.apiKey}
                  onChange={(e) => handleInputChange("server", "apiKey", e.target.value)}
                  placeholder="Your Stash API key"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-4">
              <button
                onClick={handleTestConnection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Test Connection
              </button>
              <button
                onClick={async () => {
                  if (formData.server.url && formData.server.apiKey) {
                    setMessage("Loading tags from Stash...");
                    try {
                      // Temporarily apply config to StashappService so it can make API calls
                      const { stashappService } = await import("@/services/StashappService");
                      const tempConfig = {
                        serverConfig: {
                          url: normalizeUrl(formData.server.url),
                          apiKey: formData.server.apiKey,
                        },
                        markerConfig: {
                          statusConfirmed: "",
                          statusRejected: "",
                          sourceManual: "",
                          aiReviewed: "",
                        },
                        markerGroupingConfig: {
                          markerGroupParent: "",
                        },
                        shotBoundaryConfig: {
                          aiTagged: "",
                          shotBoundary: "",
                          sourceShotBoundaryAnalysis: "",
                          shotBoundaryProcessed: "",
                        },
                      };
                      stashappService.applyConfig(tempConfig);
                      
                      // Now load the tags
                      const result = await dispatch(loadAvailableTags()).unwrap();
                      setMessage(`Tags loaded successfully! Found ${result.length} tags.`);
                    } catch (error) {
                      setMessage("Failed to load tags: " + (error as Error).message);
                    }
                  } else {
                    setMessage("Please enter URL and API key first");
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
              >
                Load Tags
              </button>
            </div>
          </div>

          {/* Marker Status Configuration */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Marker Status Tags</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Confirmed Status Tag ID
                </label>
                <TagAutocomplete
                  value={formData.markerStatus.confirmed}
                  onChange={(tagId) => handleInputChange("markerStatus", "confirmed", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for confirmed status tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Rejected Status Tag ID
                </label>
                <TagAutocomplete
                  value={formData.markerStatus.rejected}
                  onChange={(tagId) => handleInputChange("markerStatus", "rejected", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for rejected status tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Manual Source Tag ID
                </label>
                <TagAutocomplete
                  value={formData.markerStatus.sourceManual}
                  onChange={(tagId) => handleInputChange("markerStatus", "sourceManual", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for manual source tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  AI Reviewed Tag ID
                </label>
                <TagAutocomplete
                  value={formData.markerStatus.aiReviewed}
                  onChange={(tagId) => handleInputChange("markerStatus", "aiReviewed", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for AI reviewed tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Marker Grouping Configuration */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Marker Grouping</h2>
            <div>
              <label className="block text-sm font-medium mb-2">
                Marker Group Parent Tag ID
              </label>
              <TagAutocomplete
                value={formData.markerGrouping.parentId}
                onChange={(tagId) => handleInputChange("markerGrouping", "parentId", tagId)}
                availableTags={availableTags}
                placeholder="Search for marker group parent tag..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Shot Boundary Configuration */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Shot Boundary Detection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Shot Boundary Tag ID
                </label>
                <TagAutocomplete
                  value={formData.shotBoundary.marker}
                  onChange={(tagId) => handleInputChange("shotBoundary", "marker", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for shot boundary tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Source Detection Tag ID
                </label>
                <TagAutocomplete
                  value={formData.shotBoundary.sourceDetection}
                  onChange={(tagId) => handleInputChange("shotBoundary", "sourceDetection", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for source detection tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  AI Tagged ID
                </label>
                <TagAutocomplete
                  value={formData.shotBoundary.aiTagged}
                  onChange={(tagId) => handleInputChange("shotBoundary", "aiTagged", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for AI tagged tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Processed Tag ID
                </label>
                <TagAutocomplete
                  value={formData.shotBoundary.processed}
                  onChange={(tagId) => handleInputChange("shotBoundary", "processed", tagId)}
                  availableTags={availableTags}
                  placeholder="Search for processed tag..."
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-md transition-colors text-lg font-medium"
            >
              {isSaving ? "Saving..." : (isInitialSetup ? "Complete Setup" : "Save Configuration")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}