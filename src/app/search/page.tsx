"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scene,
  Tag,
  SceneMarker,
  stashappService,
} from "@/services/StashappService";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getMarkerStatus } from "../../core/marker/markerLogic";
import { MarkerStatus } from "../../core/marker/types";

// Extend the Scene type to include scene_markers
type SceneWithMarkers = Scene & {
  scene_markers?: SceneMarker[];
};

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

type SortField = keyof typeof SORT_OPTIONS;

// Define the type for our search parameters
type SearchParams = {
  query: string;
  tags: Tag[];
  sortField: SortField;
  sortDirection: "ASC" | "DESC";
};

// Constants for localStorage
const STORAGE_KEY = "stash_marker_search_params";

// Add type for marker statistics
type MarkerStats = {
  confirmed: number;
  rejected: number;
  unknown: number;
};

// Function to calculate marker statistics
const calculateMarkerStats = (markers: SceneMarker[]): MarkerStats => {
  // Filter out shot boundary markers first
  const actionMarkers = markers.filter(
    (marker) => marker.primary_tag.id !== stashappService.MARKER_SHOT_BOUNDARY
  );

  return actionMarkers.reduce(
    (stats, marker) => {
      const status = getMarkerStatus(marker);
      switch (status) {
        case MarkerStatus.REJECTED:
          stats.rejected++;
          break;
        case MarkerStatus.CONFIRMED:
        case MarkerStatus.MANUAL:
          stats.confirmed++;
          break;
        default:
          stats.unknown++;
      }
      return stats;
    },
    { confirmed: 0, rejected: 0, unknown: 0 }
  );
};

export default function SearchPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [scenes, setScenes] = useState<SceneWithMarkers[]>([]);
  const [loading, setLoading] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");

  // Load all tags and handle localStorage operations only after tags are loaded
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await stashappService.getAllTags();
        setAllTags(response.findTags.tags);

        // Now that we have tags, try to load saved search params
        const savedParams = localStorage.getItem(STORAGE_KEY);

        if (savedParams) {
          const params: SearchParams = JSON.parse(savedParams);
          setSearchQuery(params.query);
          // Match saved tag IDs with loaded tag data
          const matchedTags = params.tags
            .map((savedTag) => {
              const match = response.findTags.tags.find(
                (tag) => tag.id === savedTag.id
              );
              if (!match) {
                console.log("Could not find matching tag for:", savedTag);
              }
              return match;
            })
            .filter((tag): tag is Tag => tag !== undefined);

          setSelectedTags(matchedTags);
          setSortField(params.sortField);
          setSortDirection(params.sortDirection);
        }
      } catch (error) {
        console.error("Error loading tags or search parameters:", error);
      }
    };
    loadTags();
  }, []);

  // Save search parameters to localStorage only after initial load
  useEffect(() => {
    if (allTags.length === 0) {
      // Don't save until we have tags loaded
      return;
    }

    try {
      const searchParams: SearchParams = {
        query: searchQuery,
        tags: selectedTags,
        sortField,
        sortDirection,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searchParams));
    } catch (error) {
      console.error("Error saving search parameters:", error);
    }
  }, [searchQuery, selectedTags, sortField, sortDirection, allTags]);

  // Filter tag suggestions based on search query
  useEffect(() => {
    if (tagSearchQuery) {
      const suggestions = allTags
        .filter(
          (tag) =>
            tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()) &&
            !selectedTags.some((selected) => selected.id === tag.id)
        )
        .slice(0, 10);
      setTagSuggestions(suggestions);
    } else {
      setTagSuggestions([]);
    }
  }, [tagSearchQuery, allTags, selectedTags]);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await stashappService.searchScenes(
        searchQuery,
        selectedTags.map((tag) => tag.id),
        sortField,
        sortDirection
      );
      setScenes(result.findScenes.scenes);
    } catch (error) {
      console.error("Error searching scenes:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTags, sortField, sortDirection]);

  // Add useEffect to trigger search when tags or search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 500); // Debounce search for 500ms

    return () => clearTimeout(timeoutId);
  }, [selectedTags, searchQuery, handleSearch]);

  const handleTagSelect = (tag: Tag) => {
    setSelectedTags((prev) => [...prev, tag]);
    setTagSearchQuery("");
  };

  const handleTagRemove = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag.id !== tagId));
  };

  const handleSceneClick = (sceneId: string) => {
    router.push(`/marker?sceneId=${sceneId}`);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scenes..."
            className="flex-1 p-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400"
          />
          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="p-2 border rounded bg-gray-800 text-white border-gray-600"
            >
              {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                setSortDirection((prev) => (prev === "ASC" ? "DESC" : "ASC"))
              }
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              {sortDirection === "ASC" ? "↑" : "↓"}
            </button>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            value={tagSearchQuery}
            onChange={(e) => setTagSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full p-2 border rounded bg-gray-800 text-white border-gray-600 placeholder-gray-400"
          />
          {tagSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg">
              {tagSuggestions.map((tag) => (
                <div
                  key={tag.id}
                  onClick={() => handleTagSelect(tag)}
                  className="p-2 text-white hover:bg-gray-700 cursor-pointer"
                >
                  {tag.name}
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
                {tag.name}
                <button
                  onClick={() => handleTagRemove(tag.id)}
                  className="text-gray-300 hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {scenes.map((scene) => {
          console.log("Scene data:", {
            id: scene.id,
            title: scene.title,
            paths: scene.paths,
            markers: scene.scene_markers,
          });

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
                      const stats = calculateMarkerStats(scene.scene_markers);
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
    </div>
  );
}
