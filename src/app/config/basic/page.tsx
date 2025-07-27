"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectServerConfig,
  selectMarkerConfig,
  selectMarkerGroupingConfig,
  selectShotBoundaryConfig,
  setFullConfig,
} from "@/store/slices/configSlice";
import {
  selectAvailableTags,
  loadAvailableTags,
} from "@/store/slices/markerSlice";
import type { AppConfig } from "@/serverConfig";
import { TagAutocomplete } from "@/components/marker/TagAutocomplete";

export default function ServerConfigPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const serverConfig = useAppSelector(selectServerConfig);
  const markerConfig = useAppSelector(selectMarkerConfig);
  const markerGroupingConfig = useAppSelector(selectMarkerGroupingConfig);
  const shotBoundaryConfig = useAppSelector(selectShotBoundaryConfig);
  const availableTags = useAppSelector(selectAvailableTags);

  const [formData, setFormData] = useState({
    serverConfig: { url: "", apiKey: "" },
    markerConfig: {
      statusConfirmed: "",
      statusRejected: "",
      sourceManual: "",
      aiReviewed: "",
    },
    markerGroupingConfig: { markerGroupParent: "" },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [tagsLoaded, setTagsLoaded] = useState(false);

  // Load current config into form
  useEffect(() => {
    // Check if this is initial setup (all configs are empty)
    const isEmpty =
      !serverConfig.url &&
      !serverConfig.apiKey &&
      !markerConfig.statusConfirmed &&
      !markerConfig.statusRejected;
    setIsInitialSetup(isEmpty);

    setFormData({
      serverConfig,
      markerConfig,
      markerGroupingConfig,
    });
  }, [serverConfig, markerConfig, markerGroupingConfig]);

  // Load tags and test connection when server config is available
  useEffect(() => {
    if (serverConfig.url && serverConfig.apiKey && !tagsLoaded) {
      const loadTags = async () => {
        try {
          // Apply current config to StashappService so it can make API calls
          const appConfig = {
            serverConfig,
            markerConfig,
            markerGroupingConfig,
            shotBoundaryConfig,
          };
          const { stashappService } = await import(
            "@/services/StashappService"
          );
          stashappService.applyConfig(appConfig);

          await dispatch(loadAvailableTags()).unwrap();
        } catch (error) {
          console.error("Failed to automatically load tags:", error);
        }
      };

      // Also test connection automatically
      const testConnectionOnLoad = async () => {
        try {
          const testQuery = `
            query Version {
              version {
                version
              }
            }
          `;

          const response = await fetch(`${serverConfig.url}/graphql`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ApiKey: serverConfig.apiKey,
            },
            body: JSON.stringify({ query: testQuery }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.data?.version?.version) {
              setConnectionStatus(
                `Connection successful! Stash version: ${result.data.version.version}`
              );
            }
          }
        } catch (error) {
          // Silently fail on page load - user can manually test if needed
          console.log("Auto connection test failed:", error);
        }
      };

      loadTags();
      testConnectionOnLoad();
      setTagsLoaded(true);
    }
  }, [
    serverConfig,
    markerConfig,
    markerGroupingConfig,
    shotBoundaryConfig,
    tagsLoaded,
    dispatch,
  ]);

  const handleInputChange = (section: string, field: string, value: string) => {
    setFormData((prev) => ({
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
      // Get current config to preserve keyboard shortcuts
      const configResponse = await fetch("/api/config");
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      // Convert form data to AppConfig format with normalized URL
      const appConfig: AppConfig = {
        ...(existingConfig as AppConfig), // Preserve existing config (like keyboardShortcuts and shotBoundaryConfig)
        ...formData,
        serverConfig: {
          ...formData.serverConfig,
          url: normalizeUrl(formData.serverConfig.url),
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
      dispatch(setFullConfig(appConfig));

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
    let normalized = url.replace(/\/+$/, "");

    // Ensure it starts with http:// or https://
    if (!normalized.match(/^https?:\/\//)) {
      normalized = `http://${normalized}`;
    }

    return normalized;
  };

  const handleTestConnection = async () => {
    if (!formData.serverConfig.url || !formData.serverConfig.apiKey) {
      setConnectionStatus(
        "Please enter both URL and API key to test connection"
      );
      return;
    }

    setConnectionStatus("Testing connection...");
    try {
      // Normalize the URL to handle common issues
      const normalizedUrl = normalizeUrl(formData.serverConfig.url);

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
          ApiKey: formData.serverConfig.apiKey,
        },
        body: JSON.stringify({ query: testQuery }),
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response body:", errorText);
        setConnectionStatus(
          `Connection failed: HTTP ${response.status} - ${errorText.substring(
            0,
            200
          )}...`
        );
        return;
      }

      const result = await response.json();
      console.log("GraphQL response:", result);

      if (result.errors) {
        setConnectionStatus(
          `GraphQL error: ${result.errors[0]?.message || "Unknown error"}`
        );
        return;
      }

      if (result.data?.version?.version) {
        setConnectionStatus(
          `Connection successful! Stash version: ${result.data.version.version}`
        );
      } else {
        setConnectionStatus(
          "Connection successful but unexpected response format"
        );
      }
    } catch (error) {
      console.error("Connection test error:", error);
      setConnectionStatus(
        "Connection test failed: " + (error as Error).message
      );
    }
  };

  return (
    <div className="space-y-8">
      {isInitialSetup && (
        <div className="bg-blue-900 border border-blue-700 p-4 rounded-lg">
          <p className="text-blue-100">
            Welcome to Stash Marker Studio! Please configure your Stash server
            connection and tag settings to get started.
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-md transition-colors font-medium"
        >
          {isSaving
            ? "Saving..."
            : isInitialSetup
            ? "Complete Setup"
            : "Save Configuration"}
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes("Error") || message.includes("failed")
              ? "bg-red-900 border border-red-700 text-red-100"
              : "bg-green-900 border border-green-700 text-green-100"
          }`}
        >
          {message}
        </div>
      )}

      {/* Server Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Server Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Stash URL</label>
            <input
              type="url"
              value={formData.serverConfig.url}
              onChange={(e) =>
                handleInputChange("serverConfig", "url", e.target.value)
              }
              placeholder="http://localhost:9999"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            {formData.serverConfig.url && (
              <p className="text-xs text-gray-400 mt-1">
                Will be saved as: {normalizeUrl(formData.serverConfig.url)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">API Key</label>
            <input
              type="password"
              value={formData.serverConfig.apiKey}
              onChange={(e) =>
                handleInputChange("serverConfig", "apiKey", e.target.value)
              }
              placeholder="Your Stash API key"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleTestConnection}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Test Connection
          </button>
          <span
            className={`text-sm min-h-[1.25rem] ${
              connectionStatus
                ? connectionStatus.includes("successful")
                  ? "text-green-400"
                  : "text-red-400"
                : "text-transparent"
            }`}
          >
            {connectionStatus}
          </span>
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
              value={formData.markerConfig.statusConfirmed}
              onChange={(tagId) =>
                handleInputChange("markerConfig", "statusConfirmed", tagId)
              }
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
              value={formData.markerConfig.statusRejected}
              onChange={(tagId) =>
                handleInputChange("markerConfig", "statusRejected", tagId)
              }
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
              value={formData.markerConfig.sourceManual}
              onChange={(tagId) =>
                handleInputChange("markerConfig", "sourceManual", tagId)
              }
              availableTags={availableTags}
              placeholder="Search for manual source tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Reviewed Tag ID
            </label>
            <TagAutocomplete
              value={formData.markerConfig.aiReviewed}
              onChange={(tagId) =>
                handleInputChange("markerConfig", "aiReviewed", tagId)
              }
              availableTags={availableTags}
              placeholder="Search for Reviewed tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
