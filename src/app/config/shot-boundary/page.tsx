"use client";

import React, { useState, useEffect } from "react";

interface VersionInfo {
  name: string;
  version: string | null;
  installed: boolean;
  error?: string;
}

export default function ShotBoundaryConfigPage() {
  const [versionInfo, setVersionInfo] = useState<{
    ffmpeg: VersionInfo;
    scenedetect: VersionInfo;
  } | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

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

  const getStatusColor = (installed: boolean) => {
    return installed ? "text-green-400" : "text-red-400";
  };

  const getStatusIcon = (installed: boolean) => {
    return installed ? "✅" : "❌";
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Shot Boundary Tools</h2>

      <div className="space-y-6">
        {/* Information Section */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">About Shot Boundaries</h3>
          <p className="text-gray-300 mb-4">
            Shot boundaries are stored in a local PostgreSQL database and are independent from Stashapp markers.
            They represent video cut points detected by PySceneDetect or manually created in the timeline.
          </p>
          <p className="text-gray-300">
            To import shot boundaries from PySceneDetect CSV files, use the <code className="bg-gray-700 px-2 py-1 rounded">import-csv.js</code> script.
          </p>
        </div>

        {/* System Dependencies Section */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">System Dependencies</h3>
          <p className="text-gray-400 text-sm mb-4">
            The following tools are required for PySceneDetect shot boundary detection:
          </p>

          {loadingVersions ? (
            <div className="text-gray-400">Loading version information...</div>
          ) : versionInfo ? (
            <div className="space-y-4">
              {/* ffmpeg */}
              <div className="flex items-start space-x-4">
                <span className="text-2xl">{getStatusIcon(versionInfo.ffmpeg.installed)}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{versionInfo.ffmpeg.name}</span>
                    {versionInfo.ffmpeg.version && (
                      <span className="text-sm text-gray-400">
                        (v{versionInfo.ffmpeg.version})
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${getStatusColor(versionInfo.ffmpeg.installed)}`}>
                    {versionInfo.ffmpeg.installed ? (
                      "Installed and accessible"
                    ) : (
                      <>
                        Not found in PATH
                        {versionInfo.ffmpeg.error && (
                          <span className="block text-xs text-gray-500 mt-1">
                            {versionInfo.ffmpeg.error}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {!versionInfo.ffmpeg.installed && (
                    <div className="text-sm text-gray-400 mt-2">
                      Install from:{" "}
                      <a
                        href="https://ffmpeg.org/download.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        ffmpeg.org/download.html
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* PySceneDetect */}
              <div className="flex items-start space-x-4">
                <span className="text-2xl">{getStatusIcon(versionInfo.scenedetect.installed)}</span>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{versionInfo.scenedetect.name}</span>
                    {versionInfo.scenedetect.version && (
                      <span className="text-sm text-gray-400">
                        (v{versionInfo.scenedetect.version})
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${getStatusColor(versionInfo.scenedetect.installed)}`}>
                    {versionInfo.scenedetect.installed ? (
                      "Installed and accessible"
                    ) : (
                      <>
                        Not found in PATH
                        {versionInfo.scenedetect.error && (
                          <span className="block text-xs text-gray-500 mt-1">
                            {versionInfo.scenedetect.error}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {!versionInfo.scenedetect.installed && (
                    <div className="text-sm text-gray-400 mt-2">
                      Install from:{" "}
                      <a
                        href="https://scenedetect.com/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        scenedetect.com/download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Failed to load version information</div>
          )}
        </div>

        {/* Usage Instructions */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Importing Shot Boundaries</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-300 mb-2">1. Generate CSV with PySceneDetect</h4>
              <p className="text-sm text-gray-400 mb-2">
                Run PySceneDetect on your video file to detect scene cuts:
              </p>
              <pre className="bg-gray-900 p-3 rounded text-sm text-gray-300 overflow-x-auto">
scenedetect -i video.mp4 detect-adaptive list-scenes
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-gray-300 mb-2">2. Import CSV to Database</h4>
              <p className="text-sm text-gray-400 mb-2">
                Use the import script to load shot boundaries into the local database:
              </p>
              <pre className="bg-gray-900 p-3 rounded text-sm text-gray-300 overflow-x-auto">
node src/scripts/import-csv.js &lt;sceneId&gt; &lt;path/to/csv&gt;
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-gray-300 mb-2">3. View in Timeline</h4>
              <p className="text-sm text-gray-400">
                Shot boundaries will appear in their own row in the timeline header above the markers.
                Use keyboard shortcuts <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">V</kbd> to add/split
                and <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Shift+V</kbd> to remove boundaries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
