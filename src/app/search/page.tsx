"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  initializeSearch,
  searchScenes,
  setQuery,
  setSortField,
  toggleSortDirection,
  setMarkerFilter,
  addSelectedTag,
  removeSelectedTag,
  setTagSearchQuery,
  updateTagSuggestions,
  selectSearchState,
  selectInitialized,
  selectInitializing,
  selectInitializationError,
  selectHasSearched,
  SortField,
  MarkerFilter,
} from "@/store/slices/searchSlice";
import { stashappService, Tag } from "@/services/StashappService";
import { calculateMarkerSummary } from "../../core/marker/markerLogic";
import TagIcon from "@/components/TagIcon";
import PlusMinusIcon from "@/components/PlusMinusIcon";
import { navigationPersistence } from "@/utils/navigationPersistence";

const SORT_OPTIONS = {
  bitrate: "Bit Rate",
  created_at: "Created At",
  code: "Studio Code",
  date: "Date",
  file_count: "File Count",
  filesize: "File Size",
  duration: "Duration",
  file_mod_time: "File Modification Time",
  framerate: "Frame Rate",
  group_scene_number: "Scene Number",
  id: "Scene ID",
  interactive: "Interactive",
  interactive_speed: "Interactive Speed",
  last_o_at: "Last O At",
  last_played_at: "Last Played At",
  movie_scene_number: "Scene Number",
  o_counter: "O-Counter",
  organized: "Organised",
  performer_count: "Performer Count",
  play_count: "Play Count",
  play_duration: "Play Duration",
  resume_time: "Resume Time",
  path: "Path",
  perceptual_similarity: "Perceptual Similarity (pHash)",
  random: "Random",
  rating: "Rating",
  tag_count: "Tag Count",
  title: "Title",
  updated_at: "Updated At",
} as const;

export default function SearchPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const {
    query,
    selectedTags,
    sortField,
    sortDirection,
    markerFilter,
    tagSearchQuery,
    tagSuggestions,
    scenes,
    loading,
    error,
  } = useAppSelector(selectSearchState);

  const initialized = useAppSelector(selectInitialized);
  const initializing = useAppSelector(selectInitializing);
  const initializationError = useAppSelector(selectInitializationError);
  const hasSearched = useAppSelector(selectHasSearched);

  // State for Stash sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Single initialization effect - much cleaner!
  useEffect(() => {
    if (!initialized && !initializing) {
      dispatch(initializeSearch());
    }
  }, [dispatch, initialized, initializing]);

  // Update tag suggestions when needed
  useEffect(() => {
    if (initialized) {
      dispatch(updateTagSuggestions());
    }
  }, [tagSearchQuery, selectedTags, initialized, dispatch]);

  // Debounced search effect - only after initialization
  useEffect(() => {
    if (!initialized) return;

    const timeoutId = setTimeout(() => {
      dispatch(
        searchScenes({
          query,
          selectedTags,
          sortField,
          sortDirection,
          markerFilter,
        })
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, selectedTags, sortField, sortDirection, markerFilter, initialized, dispatch]);

  const handleQueryChange = useCallback(
    (value: string) => {
      dispatch(setQuery(value));
    },
    [dispatch]
  );

  const handleSortFieldChange = useCallback(
    (value: SortField) => {
      dispatch(setSortField(value));
    },
    [dispatch]
  );

  const handleSortDirectionToggle = useCallback(() => {
    dispatch(toggleSortDirection());
  }, [dispatch]);

  const handleMarkerFilterChange = useCallback(
    (value: MarkerFilter) => {
      dispatch(setMarkerFilter(value));
    },
    [dispatch]
  );

  const handleTagSelect = useCallback(
    (tag: Tag) => {
      dispatch(addSelectedTag(tag));
      dispatch(setTagSearchQuery(""));
    },
    [dispatch]
  );

  const handleTagInclude = useCallback(
    (tag: Tag) => {
      dispatch(addSelectedTag({ ...tag, type: 'included' }));
      dispatch(setTagSearchQuery(""));
    },
    [dispatch]
  );

  const handleTagExclude = useCallback(
    (tag: Tag) => {
      dispatch(addSelectedTag({ ...tag, type: 'excluded' }));
      dispatch(setTagSearchQuery(""));
    },
    [dispatch]
  );

  const handleTagRemove = useCallback(
    (tagId: string) => {
      dispatch(removeSelectedTag(tagId));
    },
    [dispatch]
  );

  const handleTagSearchChange = useCallback(
    (value: string) => {
      dispatch(setTagSearchQuery(value));
    },
    [dispatch]
  );

  const handleManualSearch = useCallback(() => {
    dispatch(
      searchScenes({
        query,
        selectedTags,
        sortField,
        sortDirection,
        markerFilter,
      })
    );
  }, [dispatch, query, selectedTags, sortField, sortDirection, markerFilter]);

  const handleSceneClick = useCallback(
    (sceneId: string) => {
      router.push(`/marker/${sceneId}`);
    },
    [router]
  );

  const handleSettingsClick = useCallback(() => {
    // Store current page before navigating to settings
    const currentPath = window.location.pathname + window.location.search;
    navigationPersistence.storePreviousPage(currentPath, 'Scene Search');
  }, []);

  const handleSyncStash = useCallback(async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing...");

    try {
      const response = await fetch("/api/sync/stash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities: ["performers", "tags", "scenes"] }),
      });

      const result = await response.json();

      if (result.success) {
        const summary = result.summary;
        const lines = [];
        if (summary.performers) {
          lines.push(`Performers: ${summary.performers.upserted} synced`);
        }
        if (summary.tags) {
          lines.push(`Tags: ${summary.tags.upserted} synced`);
        }
        if (summary.scenes) {
          lines.push(`Scenes: ${summary.scenes.upserted} synced`);
        }
        setSyncStatus(`✓ Sync complete!\n${lines.join("\n")}`);
      } else {
        setSyncStatus(`✗ Sync failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      setSyncStatus(`✗ Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSyncing(false);
      // Clear status after 5 seconds
      setTimeout(() => setSyncStatus(null), 5000);
    }
  }, []);

  // Show loading state during initialization
  if (initializing) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-white">Initializing search...</div>
      </div>
    );
  }

  // Show initialization error if it occurred
  if (initializationError) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-red-400">
          Failed to initialize search: {initializationError}
        </div>
      </div>
    );
  }

  // Don't render the main UI until initialized
  if (!initialized) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header with sync button and settings icon */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Scene Search</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncStash}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            title="Sync Stash Metadata"
          >
            {isSyncing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Syncing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Sync Stash
              </>
            )}
          </button>
          <Link
            href="/config"
            onClick={handleSettingsClick}
            className="flex items-center justify-center w-10 h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Configuration"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Sync status message */}
      {syncStatus && (
        <div className={`mb-4 p-3 rounded ${syncStatus.startsWith("✓") ? "bg-green-800 text-green-200" : syncStatus.startsWith("✗") ? "bg-red-800 text-red-200" : "bg-blue-800 text-blue-200"}`}>
          <pre className="whitespace-pre-wrap font-mono text-sm">{syncStatus}</pre>
        </div>
      )}
      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search scenes..."
            className="flex-1 p-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400"
          />
          <select
            value={markerFilter}
            onChange={(e) =>
              handleMarkerFilterChange(e.target.value as MarkerFilter)
            }
            className="p-2 border rounded bg-gray-800 text-white border-gray-600"
            title="Filter by marker status"
          >
            <option value="all">All Scenes</option>
            <option value="none">No Markers</option>
            <option value="has_unconfirmed">Has Unconfirmed</option>
          </select>
          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) =>
                handleSortFieldChange(e.target.value as SortField)
              }
              className="p-2 border rounded bg-gray-800 text-white border-gray-600"
            >
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSortDirectionToggle}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              {sortDirection === "ASC" ? "↑" : "↓"}
            </button>
          </div>
          <button
            onClick={handleManualSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            value={tagSearchQuery}
            onChange={(e) => handleTagSearchChange(e.target.value)}
            placeholder="Search tags..."
            className="w-full p-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400"
          />
          {tagSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg">
              {tagSuggestions.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-2 text-white hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <PlusMinusIcon
                      type="plus"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagInclude(tag);
                      }}
                    />
                    <span
                      onClick={() => handleTagSelect(tag)}
                      className="cursor-pointer flex-1"
                    >
                      {tag.name}
                    </span>
                  </div>
                  <PlusMinusIcon
                    type="minus"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagExclude(tag);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-white rounded"
              >
                <TagIcon
                  type={tag.type}
                  onClick={() => handleTagRemove(tag.id)}
                />
                {tag.name}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-800 text-red-200 rounded">
            Error: {error}
          </div>
        )}
      </div>

      {/* Results section with loading indicator */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Searching for scenes...</p>
        </div>
      ) : scenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl text-gray-600 mb-4">🔍</div>
          <p className="text-gray-400 text-center">
            {hasSearched 
              ? "No scenes found matching your search criteria"
              : "Enter a search term or select tags to find scenes"
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {scenes.map((scene) => {
            if (!scene.paths?.screenshot) {
              console.log("Missing screenshot path for scene:", scene.id);
              return null;
            }

            return (
              <div
                key={scene.id}
                onClick={() => handleSceneClick(scene.id)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="aspect-video relative mb-2">
                  <Image
                    src={stashappService.addApiKeyToUrl(scene.paths.screenshot)}
                    alt={scene.title}
                    fill
                    className="absolute inset-0 w-full h-full object-cover rounded"
                  />
                  {scene.scene_markers && scene.scene_markers.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex justify-around text-xs">
                      {(() => {
                        const stats = calculateMarkerSummary(scene.scene_markers);
                        return (
                          <>
                            <span className="text-green-400">
                              ✓ {stats.confirmed}
                            </span>
                            <span className="text-red-400">
                              ✗ {stats.rejected}
                            </span>
                            <span className="text-yellow-400">
                              ? {stats.unknown}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <h3 className="text-sm truncate text-white">{scene.title}</h3>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
