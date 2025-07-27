"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectVideoPlaybackConfig,
  setFullConfig,
} from "@/store/slices/configSlice";
import type { AppConfig, VideoPlaybackConfig } from "@/serverConfig";

export default function VideoPlaybackConfigPage() {
  const dispatch = useAppDispatch();
  const videoPlaybackConfig = useAppSelector(selectVideoPlaybackConfig);

  const [formData, setFormData] = useState<VideoPlaybackConfig>({
    smallSeekTime: 5,
    mediumSeekTime: 10,
    longSeekTime: 30,
    smallFrameStep: 1,
    mediumFrameStep: 10,
    longFrameStep: 30,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load current config into form
  useEffect(() => {
    setFormData({
      smallSeekTime: videoPlaybackConfig?.smallSeekTime ?? 5,
      mediumSeekTime: videoPlaybackConfig?.mediumSeekTime ?? 10,
      longSeekTime: videoPlaybackConfig?.longSeekTime ?? 30,
      smallFrameStep: videoPlaybackConfig?.smallFrameStep ?? 1,
      mediumFrameStep: videoPlaybackConfig?.mediumFrameStep ?? 10,
      longFrameStep: videoPlaybackConfig?.longFrameStep ?? 30,
    });
  }, [videoPlaybackConfig]);

  const handleInputChange = (field: keyof VideoPlaybackConfig, value: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      // Get current config to preserve other settings
      const configResponse = await fetch("/api/config");
      let existingConfig = {};
      if (configResponse.ok) {
        existingConfig = await configResponse.json();
      }

      // Create updated config with video playback settings
      const appConfig: AppConfig = {
        ...(existingConfig as AppConfig),
        videoPlaybackConfig: formData,
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

      setMessage("Video playback configuration saved successfully!");
    } catch (error) {
      setMessage("Error saving configuration: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      smallSeekTime: 5,
      mediumSeekTime: 10,
      longSeekTime: 30,
      smallFrameStep: 1,
      mediumFrameStep: 10,
      longFrameStep: 30,
    });
  };

  return (
    <div className="space-y-8">
      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleReset}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors font-medium"
        >
          Reset to Defaults
        </button>
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

      {/* Time-Based Seeking Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Time-Based Seeking</h2>
        <p className="text-gray-300 mb-6">
          Configure the time intervals (in seconds) for small, medium, and long seeks.
          These settings affect how far the video jumps when using seek shortcuts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Small Seek Time (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={formData.smallSeekTime}
              onChange={(e) =>
                handleInputChange("smallSeekTime", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 5 seconds
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Medium Seek Time (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={formData.mediumSeekTime}
              onChange={(e) =>
                handleInputChange("mediumSeekTime", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 10 seconds
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Long Seek Time (seconds)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={formData.longSeekTime}
              onChange={(e) =>
                handleInputChange("longSeekTime", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 30 seconds
            </p>
          </div>
        </div>
      </div>

      {/* Frame-Based Stepping Configuration */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Frame-Based Stepping</h2>
        <p className="text-gray-300 mb-6">
          Configure the frame counts for small, medium, and long frame steps.
          These settings affect how many frames the video advances when using frame step shortcuts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Small Frame Step (frames)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={formData.smallFrameStep}
              onChange={(e) =>
                handleInputChange("smallFrameStep", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 1 frame
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Medium Frame Step (frames)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={formData.mediumFrameStep}
              onChange={(e) =>
                handleInputChange("mediumFrameStep", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 10 frames
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Long Frame Step (frames)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={formData.longFrameStep}
              onChange={(e) =>
                handleInputChange("longFrameStep", parseInt(e.target.value) || 1)
              }
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 30 frames
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}