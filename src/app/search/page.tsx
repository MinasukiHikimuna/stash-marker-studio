"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  initializeSearch,
  searchScenes,
  setQuery,
  setSortField,
  toggleSortDirection,
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
} from "@/store/slices/searchSlice";
import { stashappService, Tag } from "@/services/StashappService";
import { calculateMarkerSummary } from "../../core/marker/markerLogic";
import TagIcon from "@/components/TagIcon";
import PlusMinusIcon from "@/components/PlusMinusIcon";

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
        })
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, selectedTags, sortField, sortDirection, initialized, dispatch]);

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
      })
    );
  }, [dispatch, query, selectedTags, sortField, sortDirection]);

  const handleSceneClick = useCallback(
    (sceneId: string) => {
      router.push(`/marker?sceneId=${sceneId}`);
    },
    [router]
  );

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
      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search scenes..."
            className="flex-1 p-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400"
          />
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
