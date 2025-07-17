"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  type SceneMarker,
  type SpriteFrame,
  type Scene,
  StashappService,
} from "../services/StashappService";
import { stashappService } from "../services/StashappService";
import SpritePreview from "./SpritePreview";

export type MarkerWithTrack = SceneMarker & {
  track: number;
  swimlane: number;
  tagGroup: string;
};

type TimelineProps = {
  markers: SceneMarker[];
  actionMarkers: SceneMarker[];
  selectedMarker: SceneMarker | null;
  videoDuration: number;
  currentTime: number;
  onMarkerClick: (marker: SceneMarker) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  selectedMarkerIndex: number;
  isCreatingMarker?: boolean;
  newMarkerStartTime?: number | null;
  newMarkerEndTime?: number | null;
  isEditingMarker?: boolean;
  showShotBoundaries?: boolean;
  onSwimlaneDataUpdate?: (
    tagGroups: TagGroup[],
    markersWithTracks: MarkerWithTrack[]
  ) => void;
  filteredSwimlane?: string | null;
  onSwimlaneFilter?: (swimlaneName: string | null) => void;
  scene?: Scene | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
};

export type TagGroup = {
  name: string;
  markers: SceneMarker[];
  isRejected: boolean;
};

// Helper function to extract marker group name from tag parents
function getMarkerGroupName(marker: SceneMarker): string | null {
  const parents = marker.primary_tag.parents;
  if (!parents || parents.length === 0) {
    return null;
  }

  // Look for a parent that starts with "Marker Group: " and has the correct grandparent
  for (const parent of parents) {
    if (
      parent.name.startsWith("Marker Group: ") &&
      parent.parents?.some(
        (grandparent) =>
          grandparent.id === StashappService.MARKER_GROUP_PARENT_ID
      )
    ) {
      // Return the group name without the "Marker Group: " prefix
      return parent.name.replace("Marker Group: ", "");
    }
  }

  return null;
}

// Helper function to group markers by tag groups (simplified version)
async function groupMarkersByTags(markers: SceneMarker[]): Promise<TagGroup[]> {
  console.log("Grouping", markers.length, "markers");

  // Group all markers by tag name (with AI tag correspondence)
  const tagGroupMap = new Map<string, SceneMarker[]>();

  for (const marker of markers) {
    const groupName = marker.primary_tag.name.endsWith("_AI")
      ? marker.primary_tag.name.replace("_AI", "") // Simple AI tag grouping
      : marker.primary_tag.name;

    if (!tagGroupMap.has(groupName)) {
      tagGroupMap.set(groupName, []);
    }
    tagGroupMap.get(groupName)!.push(marker);
  }

  // Create tag groups with all markers (rejected and non-rejected together)
  const tagGroups: TagGroup[] = Array.from(tagGroupMap.entries())
    .map(([name, markers]) => {
      // Sort markers by time within each group
      const sortedMarkers = markers.sort((a, b) => a.seconds - b.seconds);

      // A group is considered rejected only if ALL markers in it are rejected
      const isRejected = sortedMarkers.every(isMarkerRejected);

      return {
        name,
        markers: sortedMarkers,
        isRejected,
      };
    })
    .sort((a, b) => {
      // Get marker group names for sorting
      const aMarkerGroup = getMarkerGroupName(a.markers[0]);
      const bMarkerGroup = getMarkerGroupName(b.markers[0]);

      // If both have marker groups, sort by marker group then by tag name
      if (aMarkerGroup && bMarkerGroup) {
        if (aMarkerGroup !== bMarkerGroup) {
          return aMarkerGroup.localeCompare(bMarkerGroup);
        }
        return a.name.localeCompare(b.name);
      }

      // If only one has a marker group, put the one with marker group first
      if (aMarkerGroup && !bMarkerGroup) {
        return -1;
      }
      if (!aMarkerGroup && bMarkerGroup) {
        return 1;
      }

      // If neither has a marker group, sort alphabetically by tag name
      return a.name.localeCompare(b.name);
    });

  console.log(
    "Created groups:",
    tagGroups.map((g) => {
      const markerGroup = getMarkerGroupName(g.markers[0]) || "No Group";
      return `${g.name} [${markerGroup}] (${g.markers.length} markers, all rejected: ${g.isRejected})`;
    })
  );

  return tagGroups;
}

// Helper function to assign tracks within swimlanes to avoid overlaps
function assignTracksWithinSwimlanes(tagGroups: TagGroup[]): MarkerWithTrack[] {
  const markersWithTracks: MarkerWithTrack[] = [];

  tagGroups.forEach((tagGroup, swimlaneIndex) => {
    const swimlaneMarkers = [...tagGroup.markers].sort(
      (a, b) => a.seconds - b.seconds
    );
    const tracks: MarkerWithTrack[] = [];

    swimlaneMarkers.forEach((marker) => {
      let track = 0;
      let placed = false;

      while (!placed) {
        const overlapping = tracks.find(
          (m) =>
            m.track === track &&
            ((marker.seconds >= m.seconds &&
              marker.seconds < (m.end_seconds || m.seconds + 1)) ||
              ((marker.end_seconds || marker.seconds + 1) > m.seconds &&
                (marker.end_seconds || marker.seconds + 1) <=
                  (m.end_seconds || m.seconds + 1)) ||
              (marker.seconds <= m.seconds &&
                (marker.end_seconds || marker.seconds + 1) >=
                  (m.end_seconds || m.seconds + 1)))
        );

        if (!overlapping) {
          const markerWithTrack: MarkerWithTrack = {
            ...marker,
            track,
            swimlane: swimlaneIndex,
            tagGroup: tagGroup.name,
          };
          tracks.push(markerWithTrack);
          markersWithTracks.push(markerWithTrack);
          placed = true;
        } else {
          track++;
        }
      }
    });
  });

  return markersWithTracks;
}

// Helper function to check if marker is a shot boundary
const isShotBoundaryMarker = (marker: SceneMarker) => {
  return marker.primary_tag.id === "8836";
};

// Helper functions to check marker status
const isMarkerConfirmed = (marker: SceneMarker) => {
  return marker.tags.some(
    (tag: { id: string }) => tag.id === stashappService.MARKER_STATUS_CONFIRMED
  );
};

const isMarkerManual = (marker: SceneMarker) => {
  return marker.tags.some(
    (tag: { id: string }) => tag.id === stashappService.MARKER_SOURCE_MANUAL
  );
};

const isMarkerRejected = (marker: SceneMarker) => {
  return marker.tags.some(
    (tag: { id: string }) => tag.id === stashappService.MARKER_STATUS_REJECTED
  );
};

export default function Timeline({
  markers,
  actionMarkers,
  selectedMarker,
  videoDuration,
  currentTime,
  onMarkerClick,
  videoRef,
  selectedMarkerIndex,
  isCreatingMarker = false,
  newMarkerStartTime = null,
  newMarkerEndTime = null,
  isEditingMarker = false,
  showShotBoundaries = true,
  onSwimlaneDataUpdate,
  filteredSwimlane = null,
  onSwimlaneFilter,
  scene = null,
  zoom = 1,
  onZoomChange: _onZoomChange,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [markersWithTracks, setMarkersWithTracks] = useState<MarkerWithTrack[]>(
    []
  );
  const [spriteFrames, setSpriteFrames] = useState<SpriteFrame[]>([]);
  const [previewSprite, setPreviewSprite] = useState<{
    frame: SpriteFrame;
    x: number;
    y: number;
  } | null>(null);

  // Add marker tooltip state
  const [markerTooltip, setMarkerTooltip] = useState<{
    marker: SceneMarker;
    x: number;
    y: number;
  } | null>(null);

  // Separate shot boundaries and action markers for different rendering
  const shotBoundaries = markers.filter(isShotBoundaryMarker);

  // Fetch sprite frames for the scene using direct Stashapp URLs
  useEffect(() => {
    let isCancelled = false;

    const fetchSpriteFrames = async () => {
      if (scene?.paths?.vtt) {
        try {
          console.log("Fetching sprite frames for VTT:", scene.paths.vtt);
          const frames = await stashappService.fetchSpriteFrames(
            scene.paths.vtt
          );
          if (!isCancelled) {
            setSpriteFrames(frames);
            console.log("Loaded", frames.length, "sprite frames");
          }
        } catch (error) {
          if (!isCancelled) {
            console.error("Error loading sprite frames:", error);
            setSpriteFrames([]);
          }
        }
      } else {
        if (!isCancelled) {
          setSpriteFrames([]);
        }
      }
    };

    fetchSpriteFrames();

    return () => {
      isCancelled = true;
    };
  }, [scene?.paths?.vtt]); // More specific dependency

  // Group markers by tags and assign tracks when actionMarkers change
  useEffect(() => {
    console.log(
      "Timeline useEffect triggered - actionMarkers:",
      actionMarkers.length,
      "markers"
    );
    console.log("First few actionMarkers:", actionMarkers.slice(0, 3));

    const setupTagGroups = async () => {
      // Base the swimlanes on all non-shot-boundary markers so that swimlanes remain
      // visible even when filtered to empty, allowing the user to toggle the filter off.
      const allPossibleActionMarkers = markers.filter(
        (m) => !isShotBoundaryMarker(m)
      );

      if (allPossibleActionMarkers.length > 0) {
        try {
          console.log(
            "Generating all possible tag groups from",
            allPossibleActionMarkers.length,
            "markers"
          );
          // Get all possible groups to ensure UI stability during filtering
          const allGroups = await groupMarkersByTags(allPossibleActionMarkers);
          console.log(
            "Created",
            allGroups.length,
            "total tag groups:",
            allGroups.map((g) => g.name)
          );

          // Now, create the groups for final display. The groups themselves are stable,
          // but the markers within them are determined by `actionMarkers` (which is filtered).
          const finalGroups = allGroups.map((group) => ({
            ...group,
            markers: actionMarkers.filter((m) => {
              const groupName = m.primary_tag.name.endsWith("_AI")
                ? m.primary_tag.name.replace("_AI", "")
                : m.primary_tag.name;
              return groupName === group.name;
            }),
          }));

          const markersWithTracksAndSwimlanes =
            assignTracksWithinSwimlanes(finalGroups);
          console.log(
            "Assigned tracks to",
            markersWithTracksAndSwimlanes.length,
            "markers for display"
          );

          setTagGroups(finalGroups);
          setMarkersWithTracks(markersWithTracksAndSwimlanes);
          if (onSwimlaneDataUpdate) {
            onSwimlaneDataUpdate(finalGroups, markersWithTracksAndSwimlanes);
          }
        } catch (error) {
          console.error("Error setting up tag groups:", error);
          // Fallback might be needed here if grouping fails
        }
      } else {
        console.log("No action markers, clearing groups");
        setTagGroups([]);
        setMarkersWithTracks([]);
        if (onSwimlaneDataUpdate) {
          onSwimlaneDataUpdate([], []);
        }
      }
    };

    setupTagGroups();
  }, [markers, actionMarkers, onSwimlaneDataUpdate]);

  // Base width is 300px per minute of video (at zoom 1)
  const basePixelsPerMinute = 300;
  const pixelsPerSecond = useMemo(
    () => (basePixelsPerMinute / 60) * zoom,
    [zoom]
  );
  const scaledWidth = videoDuration * pixelsPerSecond;
  const totalMinutes = Math.floor(videoDuration / 60);

  // Calculate total height needed for all swimlanes
  const trackHeight = 20; // Reduced height of each track in pixels

  // Filter tag groups for display - when filtering is active, only show groups with markers
  // When not filtering, show all groups to maintain UI stability
  const displayTagGroups = useMemo(() => {
    if (filteredSwimlane) {
      // When filtering is active, only show groups that have markers
      return tagGroups.filter((tagGroup) => tagGroup.markers.length > 0);
    } else {
      // When not filtering, show all groups
      return tagGroups;
    }
  }, [tagGroups, filteredSwimlane]);

  // Filter markersWithTracks to match the displayed groups
  const displayMarkersWithTracks = useMemo(() => {
    if (filteredSwimlane) {
      // When filtering, only include markers from groups that are being displayed
      const displayGroupNames = new Set(displayTagGroups.map((g) => g.name));
      return markersWithTracks
        .filter((marker) => displayGroupNames.has(marker.tagGroup))
        .map((marker) => {
          // Remap swimlane indices to be consecutive for the filtered display
          const newSwimlaneIndex = displayTagGroups.findIndex(
            (g) => g.name === marker.tagGroup
          );
          return {
            ...marker,
            swimlane: newSwimlaneIndex,
          };
        });
    } else {
      return markersWithTracks;
    }
  }, [markersWithTracks, displayTagGroups, filteredSwimlane]);

  const totalHeight =
    displayTagGroups.length > 0
      ? displayTagGroups.reduce((totalHeight, tagGroup, index) => {
          const groupMarkers = displayMarkersWithTracks.filter(
            (m) => m.swimlane === index
          );
          const maxTrack =
            groupMarkers.length > 0
              ? Math.max(...groupMarkers.map((m) => m.track))
              : -1;
          const tracksInGroup = Math.max(1, maxTrack + 1); // Ensure at least 1 track
          const groupHeight = tracksInGroup * trackHeight; // Remove extra gaps and label height
          return totalHeight + groupHeight;
        }, 0)
      : 100; // Default height when no groups

  // Sprite preview handlers - only for timeline header
  const handleHeaderMouseMoveForPreview = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || spriteFrames.length === 0) {
        setPreviewSprite(null);
        return;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time =
        (mouseXInDiv + timelineRef.current.scrollLeft) / pixelsPerSecond;

      const frame = spriteFrames.find(
        (f) => time >= f.startTime && time < f.endTime
      );

      if (frame) {
        setPreviewSprite({
          frame: frame,
          x: e.clientX,
          y: rect.top - 10, // show it a bit above the timeline
        });
      } else {
        setPreviewSprite(null);
      }
    },
    [pixelsPerSecond, spriteFrames]
  );

  const handleHeaderMouseLeaveForPreview = useCallback(() => {
    setPreviewSprite(null);
  }, []);

  // Marker tooltip handlers
  const handleMarkerMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, marker: SceneMarker) => {
      setMarkerTooltip({
        marker: marker,
        x: e.clientX,
        y: e.clientY,
      });
    },
    []
  );

  const handleMarkerMouseLeave = useCallback(() => {
    setMarkerTooltip(null);
  }, []);

  const handleMarkerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, marker: SceneMarker) => {
      if (markerTooltip && markerTooltip.marker.id === marker.id) {
        setMarkerTooltip({
          marker: marker,
          x: e.clientX,
          y: e.clientY,
        });
      }
    },
    [markerTooltip]
  );

  // Handle click-to-seek on timeline header
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || !videoRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const mouseXInDiv = e.clientX - rect.left;
      const time =
        (mouseXInDiv + timelineRef.current.scrollLeft) / pixelsPerSecond;

      // Clamp time to video duration bounds
      const seekTime = Math.max(0, Math.min(time, videoDuration));
      videoRef.current.currentTime = seekTime;
    },
    [pixelsPerSecond, videoDuration, videoRef]
  );

  // Note: Playhead auto-scroll disabled for professional NLE behavior
  // Users control the viewport manually, playhead can be off-screen

  // Auto-scroll to keep selected marker in view
  useEffect(() => {
    if (
      timelineRef.current &&
      selectedMarker &&
      !isEditingMarker &&
      videoDuration > 0
    ) {
      const markerStart = selectedMarker.seconds * pixelsPerSecond;
      const markerEnd =
        (selectedMarker.end_seconds || selectedMarker.seconds + 1) *
        pixelsPerSecond;
      const markerWidth = markerEnd - markerStart;

      const containerWidth = timelineRef.current.clientWidth;
      const currentScrollLeft = timelineRef.current.scrollLeft;
      const viewportStart = currentScrollLeft;
      const viewportEnd = currentScrollLeft + containerWidth;

      // Check if marker is completely outside the viewport (not partially visible)
      const isMarkerCompletelyHidden =
        markerEnd <= viewportStart || markerStart >= viewportEnd;

      if (isMarkerCompletelyHidden) {
        let desiredScrollPosition;

        if (markerWidth > containerWidth) {
          // If marker is wider than viewport, show the start of the marker
          desiredScrollPosition = markerStart;
        } else {
          // If marker fits in viewport, center it
          desiredScrollPosition = Math.max(
            0,
            markerStart + markerWidth / 2 - containerWidth / 2
          );
        }

        timelineRef.current.scrollTo({
          left: desiredScrollPosition,
          behavior: "smooth",
        });
      }
    }
  }, [
    selectedMarker,
    selectedMarkerIndex,
    pixelsPerSecond,
    isEditingMarker,
    videoDuration,
  ]);

  const getMarkerColor = (marker: SceneMarker, isCreating: boolean = false) => {
    if (isCreating) {
      return "bg-emerald-300";
    } else if (isShotBoundaryMarker(marker)) {
      return "bg-gray-400 opacity-60"; // Subtle color for shot boundaries
    } else if (isMarkerConfirmed(marker) || isMarkerManual(marker)) {
      return "bg-green-500";
    } else if (isMarkerRejected(marker)) {
      return "bg-red-500";
    } else {
      return "bg-yellow-500";
    }
  };

  // No mouse event handlers needed - sprite previews handled by CSS hover

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Don't render if video duration is not available yet
  if (videoDuration <= 0) {
    return (
      <div className="relative w-full bg-gray-800 rounded-lg overflow-hidden h-24 flex items-center justify-center">
        <span className="text-gray-400">Loading video...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-gray-800 rounded-lg overflow-hidden flex"
      style={{
        height: `${Math.max(300, totalHeight + 48 + 40)}px`, // Increased minimum height
      }}
    >
      {/* Left sidebar with sticky tag names */}
      <div className="flex-shrink-0 w-48 bg-gray-900 border-r border-gray-600 relative z-10 overflow-hidden">
        {/* Time area spacer */}
        <div className="h-8 bg-gray-700 border-b border-gray-600"></div>

        {/* Tag labels container with same height as timeline */}
        <div
          className="relative overflow-hidden"
          style={{ height: `${totalHeight}px` }}
        >
          {displayTagGroups.map((tagGroup, swimlaneIndex) => {
            const groupMarkers = displayMarkersWithTracks.filter(
              (m) => m.swimlane === swimlaneIndex
            );
            const maxTrack =
              groupMarkers.length > 0
                ? Math.max(...groupMarkers.map((m) => m.track))
                : -1;
            const tracksInGroup = Math.max(1, maxTrack + 1);

            // Check if this swimlane contains the selected marker
            const isActiveSwimlane =
              selectedMarker &&
              groupMarkers.some((m) => m.id === selectedMarker.id);

            // Check if this swimlane is being filtered
            const isFilteredSwimlane = filteredSwimlane === tagGroup.name;

            // Calculate vertical position of this swimlane (same calculation as timeline)
            const swimlaneTop = displayTagGroups
              .slice(0, swimlaneIndex)
              .reduce((acc, prevGroup, prevIndex) => {
                const prevGroupMarkers = displayMarkersWithTracks.filter(
                  (m) => m.swimlane === prevIndex
                );
                const prevMaxTrack =
                  prevGroupMarkers.length > 0
                    ? Math.max(...prevGroupMarkers.map((m) => m.track))
                    : -1;
                const prevTracksInGroup = Math.max(1, prevMaxTrack + 1);
                const prevGroupHeight = prevTracksInGroup * trackHeight; // Remove gaps between tracks
                return acc + prevGroupHeight;
              }, 0);

            // Calculate total height for this group (remove extra gaps)
            const groupHeight = tracksInGroup * trackHeight;

            return (
              <div
                key={`label-${swimlaneIndex}`}
                className="absolute w-full"
                style={{
                  top: `${swimlaneTop}px`,
                  height: `${groupHeight}px`,
                }}
              >
                {/* Single tag label that spans entire group height */}
                <div
                  className={`absolute w-full px-2 text-xs flex items-center justify-between transition-all duration-200 cursor-pointer hover:brightness-110 ${
                    isFilteredSwimlane
                      ? "font-bold border-l-4 border-yellow-400 shadow-lg ring-1 ring-yellow-400" +
                        (tagGroup.isRejected
                          ? " bg-red-700 text-red-50"
                          : " bg-blue-400 text-blue-50")
                      : isActiveSwimlane
                      ? "font-bold border-l-2 border-white shadow-md" +
                        (tagGroup.isRejected
                          ? " bg-red-800 text-red-50"
                          : " bg-blue-500 text-blue-50")
                      : "font-medium" +
                        (tagGroup.isRejected
                          ? " bg-red-900 text-red-100"
                          : " bg-blue-600 text-blue-100")
                  }`}
                  style={{
                    height: `${groupHeight}px`,
                  }}
                  onClick={() => {
                    if (onSwimlaneFilter) {
                      // Toggle filter: if already filtered, clear it; otherwise set it
                      const newFilter = isFilteredSwimlane
                        ? null
                        : tagGroup.name;
                      onSwimlaneFilter(newFilter);
                    }
                  }}
                  title={
                    isFilteredSwimlane
                      ? `Filtered by ${tagGroup.name} - Click to show all`
                      : `Click to filter by ${tagGroup.name}`
                  }
                >
                  <div className="truncate" title={tagGroup.name}>
                    {tagGroup.name} {tagGroup.isRejected && "(All R)"}
                    {isFilteredSwimlane && " 🔍"}
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {(() => {
                      // Calculate status counts for this tag group
                      const approved = tagGroup.markers.filter(
                        (marker) =>
                          isMarkerConfirmed(marker) || isMarkerManual(marker)
                      ).length;
                      const rejected =
                        tagGroup.markers.filter(isMarkerRejected).length;
                      const unknown = tagGroup.markers.filter(
                        (marker) =>
                          !isMarkerConfirmed(marker) &&
                          !isMarkerManual(marker) &&
                          !isMarkerRejected(marker)
                      ).length;

                      return (
                        <>
                          {approved > 0 && (
                            <div className="flex items-center">
                              <span className="text-green-300 mr-1">✓</span>
                              <span>{approved}</span>
                            </div>
                          )}
                          {rejected > 0 && (
                            <div className="flex items-center">
                              <span className="text-red-300 mr-1">✗</span>
                              <span>{rejected}</span>
                            </div>
                          )}
                          {unknown > 0 && (
                            <div className="flex items-center">
                              <span className="text-yellow-300 mr-1">?</span>
                              <span>{unknown}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline container with horizontal scroll */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        style={{ height: "100%" }}
        data-timeline-container
      >
        <div style={{ width: `${scaledWidth}px`, height: "100%" }}>
          {/* Time markers with integrated shot boundaries */}
          <div
            className="relative w-full h-8 bg-gray-700 cursor-pointer"
            onClick={handleTimelineClick}
            onMouseMove={handleHeaderMouseMoveForPreview}
            onMouseLeave={handleHeaderMouseLeaveForPreview}
            title="Click to seek to time"
          >
            {/* Minute markers */}
            {Array.from({ length: totalMinutes + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-full border-l border-gray-600"
                style={{ left: `${i * basePixelsPerMinute * zoom}px` }}
              >
                <span className="text-xs text-gray-400 ml-1 leading-8">
                  {formatTime(i * 60)}
                </span>
              </div>
            ))}

            {/* Shot boundaries integrated into time area */}
            {showShotBoundaries &&
              shotBoundaries.map((marker) => (
                <div
                  key={`shot-${marker.id}`}
                  className="absolute top-0 h-full cursor-pointer group"
                  style={{
                    left: `${marker.seconds * pixelsPerSecond}px`,
                    width: "2px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                      videoRef.current.currentTime = marker.seconds;
                    }
                  }}
                  title={`Shot boundary: ${formatTime(marker.seconds)}`}
                >
                  {/* Shot boundary line */}
                  <div className="w-full h-full bg-orange-400 opacity-60 group-hover:opacity-100 transition-opacity" />

                  {/* Small indicator at bottom */}
                  <div className="absolute bottom-0 left-0 w-1 h-1 bg-orange-400 transform translate-x-[-50%] rounded-full opacity-80" />
                </div>
              ))}

            {/* Sub-minute markers (every 10 seconds) when zoomed in */}
            {zoom > 1 &&
              Array.from({ length: Math.floor(videoDuration / 10) }).map(
                (_, i) => {
                  const seconds = (i + 1) * 10;
                  if (seconds % 60 !== 0) {
                    // Don't overlap with minute markers
                    return (
                      <div
                        key={`sub-${i}`}
                        className="absolute h-2 border-l border-gray-500 opacity-50"
                        style={{
                          left: `${seconds * pixelsPerSecond}px`,
                          bottom: "0px",
                          top: "auto",
                        }}
                      >
                        <span
                          className="text-xs text-gray-500 ml-1 leading-2"
                          style={{ fontSize: "10px" }}
                        >
                          {formatTime(seconds)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                }
              )}
          </div>

          {/* Current time indicator */}
          <div
            className="absolute h-full w-0.5 bg-red-500 z-30"
            style={{
              left: `${currentTime * pixelsPerSecond}px`,
              top: "0px",
              transform: "translateX(-50%)",
            }}
          />

          {/* Swimlanes with grouped markers */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: "32px",
              height: `${totalHeight}px`,
            }}
          >
            {displayTagGroups.map((tagGroup, swimlaneIndex) => {
              const groupMarkers = displayMarkersWithTracks.filter(
                (m) => m.swimlane === swimlaneIndex
              );
              const maxTrack =
                groupMarkers.length > 0
                  ? Math.max(...groupMarkers.map((m) => m.track))
                  : -1;
              const tracksInGroup = Math.max(1, maxTrack + 1);
              const groupHeight = tracksInGroup * trackHeight;

              // Calculate vertical position of this swimlane
              const swimlaneTop = displayTagGroups
                .slice(0, swimlaneIndex)
                .reduce((acc, prevGroup, prevIndex) => {
                  const prevGroupMarkers = displayMarkersWithTracks.filter(
                    (m) => m.swimlane === prevIndex
                  );
                  const prevMaxTrack =
                    prevGroupMarkers.length > 0
                      ? Math.max(...prevGroupMarkers.map((m) => m.track))
                      : -1;
                  const prevTracksInGroup = Math.max(1, prevMaxTrack + 1);
                  const prevGroupHeight = prevTracksInGroup * trackHeight;
                  return acc + prevGroupHeight;
                }, 0);

              return (
                <div
                  key={`swimlane-${swimlaneIndex}`}
                  className="absolute w-full"
                  style={{
                    top: `${swimlaneTop}px`,
                    height: `${groupHeight}px`,
                  }}
                >
                  {/* Track backgrounds */}
                  {Array.from({ length: tracksInGroup }).map(
                    (_, trackIndex) => (
                      <div
                        key={`track-${swimlaneIndex}-${trackIndex}`}
                        className={`absolute border ${
                          tagGroup.isRejected
                            ? "border-red-800"
                            : "border-gray-600"
                        }`}
                        style={{
                          top: `${trackIndex * trackHeight}px`,
                          height: `${trackHeight}px`,
                          width: `${scaledWidth}px`,
                          backgroundColor: tagGroup.isRejected
                            ? swimlaneIndex % 2 === 0
                              ? "rgba(127, 29, 29, 0.3)" // Even rejected: darker red
                              : "rgba(153, 27, 27, 0.25)" // Odd rejected: slightly lighter red
                            : swimlaneIndex % 2 === 0
                            ? "rgba(65, 75, 90, 0.35)" // Even normal: lighter than gray-700
                            : "rgba(75, 85, 99, 0.35)", // Odd normal: gray-600 with custom opacity
                        }}
                      />
                    )
                  )}

                  {/* Markers in this swimlane */}
                  {groupMarkers.map((marker) => {
                    const isSelected =
                      selectedMarker && marker.id === selectedMarker.id;

                    return (
                      <div
                        key={marker.id}
                        className={`absolute rounded cursor-pointer ${getMarkerColor(
                          marker
                        )} select-none transition-all duration-200
                          ${
                            isSelected
                              ? "ring-2 ring-white ring-opacity-100 shadow-lg brightness-110"
                              : "opacity-80"
                          }`}
                        style={{
                          left: `${marker.seconds * pixelsPerSecond}px`,
                          width: `${
                            ((marker.end_seconds || marker.seconds + 1) -
                              marker.seconds) *
                            pixelsPerSecond
                          }px`,
                          top: `${marker.track * trackHeight}px`,
                          height: `${trackHeight}px`,
                          minWidth: "4px",
                          zIndex: isSelected ? 20 : 10,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkerClick(marker);
                        }}
                        onMouseEnter={(e) => handleMarkerMouseEnter(e, marker)}
                        onMouseLeave={handleMarkerMouseLeave}
                        onMouseMove={(e) => handleMarkerMouseMove(e, marker)}
                      >
                        {/* Visual indicator for AI vs normal tags */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {marker.primary_tag.name.endsWith("_AI") ? (
                            <div
                              className="w-2 h-2 bg-purple-400 rounded-full opacity-80"
                              title={`AI: ${marker.primary_tag.name}`}
                            />
                          ) : (
                            <div
                              className="w-2 h-2 bg-white rounded-full opacity-60"
                              title={`Manual: ${marker.primary_tag.name}`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* New marker being created */}
            {isCreatingMarker && newMarkerStartTime !== null && (
              <div
                className="absolute rounded-sm bg-emerald-300 select-none transition-all duration-200"
                style={{
                  left: `${newMarkerStartTime * pixelsPerSecond}px`,
                  width: `${
                    ((newMarkerEndTime || newMarkerStartTime + 1) -
                      newMarkerStartTime) *
                    pixelsPerSecond
                  }px`,
                  top: "32px",
                  height: `${trackHeight}px`,
                  minWidth: "4px",
                  zIndex: 40,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-2 h-2 bg-green-400 rounded-full opacity-80"
                    title="New Marker"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewSprite && (
        <SpritePreview
          visible={true}
          x={previewSprite.x}
          y={previewSprite.y}
          currentFrame={previewSprite.frame}
          getSpriteUrlWithApiKey={stashappService.getSpriteUrlWithApiKey}
          spriteFrames={[]}
          currentTime={0}
        />
      )}

      {/* Marker tooltip */}
      {markerTooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-600 max-w-md"
          style={{
            left: `${markerTooltip.x}px`,
            top: `${markerTooltip.y}px`,
            transform: "translate(-100%, -100%)",
            pointerEvents: "none",
          }}
        >
          <div className="space-y-2">
            <div className="font-bold text-lg">
              {markerTooltip.marker.primary_tag.name}
            </div>

            {markerTooltip.marker.primary_tag.description && (
              <div className="text-sm text-gray-300 border-t border-gray-600 pt-2">
                <div className="font-semibold mb-1">Description:</div>
                <div>{markerTooltip.marker.primary_tag.description}</div>
              </div>
            )}

            <div className="text-sm text-gray-400">
              <div className="font-semibold mb-1">Time:</div>
              <div>
                {markerTooltip.marker.end_seconds
                  ? `${formatTime(markerTooltip.marker.seconds)} - ${formatTime(
                      markerTooltip.marker.end_seconds
                    )}`
                  : formatTime(markerTooltip.marker.seconds)}
              </div>
            </div>

            {markerTooltip.marker.tags.length > 0 && (
              <div className="text-sm text-gray-400">
                <div className="font-semibold mb-1">Other Tags:</div>
                <div className="flex flex-wrap gap-1">
                  {markerTooltip.marker.tags
                    .filter(
                      (tag) =>
                        tag.id !== stashappService.MARKER_STATUS_CONFIRMED &&
                        tag.id !== stashappService.MARKER_STATUS_REJECTED &&
                        tag.id !== stashappService.MARKER_SOURCE_MANUAL
                    )
                    .map((tag) => (
                      <span
                        key={tag.id}
                        className="bg-gray-700 px-2 py-1 rounded text-xs"
                      >
                        {tag.name}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
