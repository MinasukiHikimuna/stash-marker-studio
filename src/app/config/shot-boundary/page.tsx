"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectServerConfig,
  selectShotBoundaryConfig,
  setShotBoundaryConfig,
} from "@/store/slices/configSlice";
import {
  selectAvailableTags,
  loadAvailableTags,
} from "@/store/slices/markerSlice";
import { ConfigTagAutocomplete } from "@/components/settings/ConfigTagAutocomplete";
import type { ShotBoundaryConfig } from "@/serverConfig";

interface VersionInfo {
  name: string;
  version: string | null;
  installed: boolean;
  error?: string;
}

export default function ShotBoundaryConfigPage() {
  const dispatch = useAppDispatch();
  const serverConfig = useAppSelector(selectServerConfig);
  const shotBoundaryConfig = useAppSelector(selectShotBoundaryConfig);
  const availableTags = useAppSelector(selectAvailableTags);

  const [formData, setFormData] = useState<ShotBoundaryConfig>(() => shotBoundaryConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{
    ffmpeg: VersionInfo;
    scenedetect: VersionInfo;
  } | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Load current config into form
  useEffect(() => {
    setFormData(shotBoundaryConfig);
  }, [shotBoundaryConfig]);

  // Load tags when server config is available
  useEffect(() => {
    if (serverConfig.url && serverConfig.apiKey && !tagsLoaded) {
      const loadTags = async () => {
        try {
          await dispatch(loadAvailableTags()).unwrap();
        } catch (error) {
          console.error("Failed to automatically load tags:", error);
        }
      };
      loadTags();
      setTagsLoaded(true);
    }
  }, [serverConfig, tagsLoaded, dispatch]);

  // Load version information on component mount
  useEffect(() => {
    const loadVersions = async () => {
      setLoadingVersions(true);
      try {
        const response = await fetch('/api/system/versions');
        if (response.ok) {
          const versions = await response.json();
          setVersionInfo(versions);
        }
      } catch (error) {
        console.error('Failed to load version information:', error);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadVersions();
  }, []);

  const handleInputChange = (field: keyof ShotBoundaryConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Get current full config to preserve other settings
      const configResponse = await fetch('/api/config');
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      // Update the shot boundary configuration
      const updatedConfig = {
        ...existingConfig,
        shotBoundaryConfig: formData,
      };

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedConfig),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      // Update Redux store
      dispatch(setShotBoundaryConfig(formData));

      setMessage("Shot boundary configuration saved successfully!");
    } catch (error) {
      setMessage("Error saving configuration: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };


  const VersionStatus = ({ info, loading }: { info: VersionInfo | undefined; loading: boolean }) => {
    if (loading) {
      return <span className="text-gray-400">Checking...</span>;
    }
    
    if (!info) {
      return <span className="text-gray-400">Unknown</span>;
    }

    if (info.installed && info.version) {
      return (
        <span className="text-green-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          {info.name} {info.version}
        </span>
      );
    } else {
      return (
        <span className="text-red-400 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-400 rounded-full"></span>
          Not found {info.error && `(${info.error})`}
        </span>
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded-md transition-colors font-medium"
        >
          {isSaving ? "Saving..." : "Save Configuration"}
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

      {/* Shot Boundary Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Shot Boundary Detection</h2>
          <p className="text-gray-400 text-sm">
            Configure tags used to orchestrate PySceneDetect workflows. Shot boundaries are now stored in the local
            PostgreSQL database and no longer rely on a dedicated Stashapp tag. Use these fields to manage scene-level
            tags that trigger or record processing status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Source Detection Tag ID
            </label>
            <ConfigTagAutocomplete
              value={formData.sourceShotBoundaryAnalysis}
              onChange={(tagId) =>
                handleInputChange("sourceShotBoundaryAnalysis", tagId)
              }
              availableTags={availableTags}
              placeholder="Search for source detection tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
              onTagCreated={async (_newTag) => {
                // Reload available tags after creating a new tag
                await dispatch(loadAvailableTags());
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Tag indicating markers were created by PySceneDetect analysis
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              AI Tagged ID
            </label>
            <ConfigTagAutocomplete
              value={formData.aiTagged}
              onChange={(tagId) => handleInputChange("aiTagged", tagId)}
              availableTags={availableTags}
              placeholder="Search for AI tagged tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
              onTagCreated={async (_newTag) => {
                // Reload available tags after creating a new tag
                await dispatch(loadAvailableTags());
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Tag used to identify scenes eligible for shot boundary processing
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Processed Tag ID
            </label>
            <ConfigTagAutocomplete
              value={formData.shotBoundaryProcessed}
              onChange={(tagId) =>
                handleInputChange("shotBoundaryProcessed", tagId)
              }
              availableTags={availableTags}
              placeholder="Search for processed tag..."
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
              onTagCreated={async (_newTag) => {
                // Reload available tags after creating a new tag
                await dispatch(loadAvailableTags());
              }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Tag applied to scenes after shot boundary processing is complete
            </p>
          </div>
        </div>

        {/* System Requirements */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h3 className="text-lg font-medium mb-4">System Requirements</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                <strong>FFmpeg:</strong> Required for video processing (v7.1+)
              </span>
              <VersionStatus info={versionInfo?.ffmpeg} loading={loadingVersions} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                <strong>PySceneDetect:</strong> Required for shot boundary detection (v0.5.6+)
              </span>
              <VersionStatus info={versionInfo?.scenedetect} loading={loadingVersions} />
            </div>
          </div>
        </div>

        {/* Processing Information */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h3 className="text-lg font-medium mb-2">Processing Information</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              <strong>Script Location:</strong> Use <code className="bg-gray-800 px-1 rounded">src/scripts/pyscenedetect-process.js</code> 
              to process videos and generate shot boundary markers.
            </p>
            <p>
              <strong>How it works:</strong> The script finds scenes tagged with the &ldquo;AI Tagged&rdquo; tag, 
              downscales the video for faster processing, runs PySceneDetect to identify shot boundaries, 
              and creates markers with the configured tags.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
