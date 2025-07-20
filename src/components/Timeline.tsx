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
import { MarkerWithTrack, TagGroup } from "../core/marker/types";
import {
  getMarkerStatus,
  isMarkerManual,
  isMarkerConfirmed,
  isMarkerRejected,
} from "../core/marker/markerLogic";
import { MarkerStatus } from "../core/marker/types";

// Add new type for marker group info
type MarkerGroupInfo = {
  fullName: string;
  displayName: string;
} | null;

// Add this new component for the tag label with optional group name
function TagLabel({
  tagName,
  groupName,
  isLastInGroup,
  isRejected,
  counts,
  isFilteredSwimlane,
  isActiveSwimlane,
  onClick,
  isFirstInGroup, // Add this new prop
}: {
  tagName: string;
  groupName?: MarkerGroupInfo;
  isLastInGroup: boolean;
  isRejected: boolean;
  counts: { confirmed: number; rejected: number; pending: number };
  isFilteredSwimlane: boolean;
  isActiveSwimlane: boolean;
  onClick: () => void;
  isFirstInGroup: boolean; // Add this new prop
}) {
  return (
    <>
      <div
        className={`w-full h-full grid grid-cols-[minmax(60px,auto)_16px_1fr_auto] items-center text-xs transition-all duration-200 cursor-pointer hover:brightness-110 ${
          isFilteredSwimlane
            ? "border-l-2 border-yellow-400" +
              (isRejected ? " bg-red-900/60" : " bg-blue-900/60")
            : isActiveSwimlane
            ? "border-l-2 border-white" +
              (isRejected ? " bg-red-900/60" : " bg-blue-900/60")
            : isRejected
            ? " bg-red-900/40"
            : " bg-blue-900/40"
        }`}
        onClick={onClick}
        title={
          isFilteredSwimlane
            ? `Click to show all`
            : `Click to filter by ${tagName}`
        }
      >
        {/* Group name column - always takes space but only visible on first swimlane */}
        <div className="px-2 font-medium whitespace-nowrap">
          <span className={isFirstInGroup ? "text-blue-100" : "opacity-0"}>
            {groupName?.displayName || ""}
          </span>
        </div>

        {/* Separator - always takes space but only visible on first swimlane */}
        <div className="text-center text-gray-500">
          <span className={isFirstInGroup ? "" : "opacity-0"}>
            {groupName ? "/" : ""}
          </span>
        </div>

        {/* Tag name */}
        <div className="truncate text-gray-100 px-1">
          <span>{tagName}</span>
          {isRejected && " (R)"}
          {isFilteredSwimlane && " 🔍"}
        </div>

        {/* Counts */}
        <div className="flex items-center gap-1 pr-2 font-medium whitespace-nowrap">
          {counts.confirmed > 0 && (
            <div className="flex items-center">
              <span className="text-green-400">✓</span>
              <span className="text-green-200 ml-px">{counts.confirmed}</span>
            </div>
          )}
          {counts.rejected > 0 && (
            <div className="flex items-center">
              <span className="text-red-400">✗</span>
              <span className="text-red-200 ml-px">{counts.rejected}</span>
            </div>
          )}
          {counts.pending > 0 && (
            <div className="flex items-center">
              <span className="text-yellow-400">?</span>
              <span className="text-yellow-200 ml-px">{counts.pending}</span>
            </div>
          )}
        </div>
      </div>
      {isLastInGroup && <div className="h-px bg-gray-600 w-full" />}
    </>
  );
}

type TimelineProps = {
  markers: SceneMarker[];
  actionMarkers: SceneMarker[];
  selectedMarker: SceneMarker | null;
  videoDuration: number;
  currentTime: number;
  onMarkerClick: (marker: SceneMarker) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  selectedMarkerId: string | null; // Add this prop
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

// Helper function to extract marker group name from tag parents
function getMarkerGroupName(marker: SceneMarker): MarkerGroupInfo {
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
      // Return an object containing both the full name and display name
      return {
        fullName: parent.name,
        displayName: parent.name
          .replace("Marker Group: ", "")
          .replace(/^\d+\.\s*/, ""),
      };
    }
  }

  return null;
}

// Helper function to group markers by tags (simplified version)
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

  // Convert to array of tag groups
  const tagGroups: TagGroup[] = Array.from(tagGroupMap.entries())
    .map(([name, markers]) => {
      // Sort markers by time within each group
      const sortedMarkers = markers.sort((a, b) => a.seconds - b.seconds);

      // A group is considered rejected only if ALL markers in it are rejected
      const isRejected = sortedMarkers.every(
        (marker) => getMarkerStatus(marker) === MarkerStatus.REJECTED
      );

      // Get unique tags from markers
      const uniqueTags = Array.from(
        new Set(markers.map((m) => m.primary_tag.id))
      )
        .map((tagId) => {
          const marker = markers.find((m) => m.primary_tag.id === tagId);
          if (!marker) return null;
          return {
            id: marker.primary_tag.id,
            name: marker.primary_tag.name,
            description: marker.primary_tag.description,
            parents: marker.primary_tag.parents,
          };
        })
        .filter((tag): tag is NonNullable<typeof tag> => tag !== null);

      return {
        name,
        markers: sortedMarkers,
        tags: uniqueTags,
        isRejected,
      };
    })
    .sort((a, b) => {
      // Get marker group names for sorting
      const aMarkerGroup = getMarkerGroupName(a.markers[0]);
      const bMarkerGroup = getMarkerGroupName(b.markers[0]);

      // If both have marker groups, sort by the full name to preserve numbering
      if (aMarkerGroup && bMarkerGroup) {
        if (aMarkerGroup.fullName !== bMarkerGroup.fullName) {
          return aMarkerGroup.fullName.localeCompare(bMarkerGroup.fullName);
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

  return tagGroups;
}

// Helper function to assign tracks within swimlanes to avoid overlaps
function assignTracksWithinSwimlanes(tagGroups: TagGroup[]): MarkerWithTrack[] {
  const markersWithTracks: MarkerWithTrack[] = [];

  tagGroups.forEach((tagGroup, swimlaneIndex) => {
    // Sort markers by time within each swimlane
    const swimlaneMarkers = [...tagGroup.markers].sort(
      (a, b) => a.seconds - b.seconds
    );

    // Initialize array to track occupied tracks for this swimlane
    const tracks: MarkerWithTrack[] = [];

    // Process each marker in the swimlane
    swimlaneMarkers.forEach((marker) => {
      // Find the first available track that doesn't overlap with this marker
      let trackIndex = 0;
      let foundTrack = false;

      while (!foundTrack) {
        // Check if this track is available for this marker
        const isTrackAvailable = !tracks
          .filter((t) => t.track === trackIndex)
          .some((t) => {
            // Check for overlap
            const markerStart = marker.seconds;
            const markerEnd = marker.end_seconds || markerStart + 1;
            const trackMarkerStart = t.seconds;
            const trackMarkerEnd = t.end_seconds || trackMarkerStart + 1;

            return (
              (markerStart >= trackMarkerStart &&
                markerStart < trackMarkerEnd) ||
              (markerEnd > trackMarkerStart && markerEnd <= trackMarkerEnd) ||
              (markerStart <= trackMarkerStart && markerEnd >= trackMarkerEnd)
            );
          });

        if (isTrackAvailable) {
          foundTrack = true;
        } else {
          trackIndex++;
        }
      }

      // Create the marker with track information
      const markerWithTrack: MarkerWithTrack = {
        ...marker,
        track: trackIndex,
        swimlane: swimlaneIndex,
        tagGroup: tagGroup.name,
      };

      // Add to tracking arrays
      tracks.push(markerWithTrack);
      markersWithTracks.push(markerWithTrack);
    });
  });

  return markersWithTracks;
}

// Helper function to check if marker is a shot boundary
const isShotBoundaryMarker = (marker: SceneMarker) => {
  return marker.primary_tag.id === "8836";
};

export default function Timeline({
  markers,
  actionMarkers,
  selectedMarker,
  videoDuration,
  currentTime,
  onMarkerClick,
  videoRef,
  selectedMarkerId,
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
      if (!markers) return;

      try {
        // Group markers by tags
        const allGroups = await groupMarkersByTags(markers);

        // Filter groups to only include action markers if needed
        const finalGroups = allGroups.map((group) => ({
          ...group,
          markers: actionMarkers.filter((m) => {
            const groupName = m.primary_tag.name.endsWith("_AI")
              ? m.primary_tag.name.replace("_AI", "")
              : m.primary_tag.name;
            return groupName === group.name;
          }),
        }));

        // Update state
        setTagGroups(finalGroups);

        // Assign tracks to markers
        const newMarkersWithTracks = assignTracksWithinSwimlanes(finalGroups);
        setMarkersWithTracks(newMarkersWithTracks);

        // Notify parent component
        if (onSwimlaneDataUpdate) {
          onSwimlaneDataUpdate(finalGroups, newMarkersWithTracks);
        }
      } catch (err) {
        console.error("Error setting up tag groups:", err);
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
      return tagGroups.filter((tagGroup) => tagGroup.tags.length > 0);
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
  }, [selectedMarker, pixelsPerSecond, isEditingMarker, videoDuration]);

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
      className="relative w-full bg-gray-800 flex"
      style={{
        height: `${totalHeight + 32}px`, // Only add height for the time header
      }}
    >
      {/* Left sidebar with sticky tag names */}
      <div className="flex-shrink-0 w-60 bg-gray-900 border-r border-gray-600 relative z-[100]">
        {/* Time area spacer */}
        <div className="h-8 bg-gray-700 border-b border-gray-600"></div>

        {/* Tag labels container */}
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {displayTagGroups.map((tagGroup, swimlaneIndex) => {
            const groupMarkers = displayMarkersWithTracks.filter(
              (m) => m.swimlane === swimlaneIndex
            );
            if (groupMarkers.length === 0) return null;

            // Get the marker group name from the first marker
            const firstMarker = groupMarkers[0];
            const currentMarkerGroupName = firstMarker
              ? getMarkerGroupName(firstMarker)
              : null;

            // Check if this is the first swimlane of the current marker group
            const previousMarker =
              swimlaneIndex > 0
                ? displayMarkersWithTracks.find(
                    (m) => m.swimlane === swimlaneIndex - 1
                  )
                : null;
            const previousMarkerGroup = previousMarker
              ? getMarkerGroupName(previousMarker)
              : null;
            const isFirstInGroup =
              currentMarkerGroupName?.fullName !==
              previousMarkerGroup?.fullName;

            // Check if this is the last swimlane of the current marker group
            const nextMarker =
              swimlaneIndex < displayTagGroups.length - 1
                ? displayMarkersWithTracks.find(
                    (m) => m.swimlane === swimlaneIndex + 1
                  )
                : null;
            const nextMarkerGroup = nextMarker
              ? getMarkerGroupName(nextMarker)
              : null;
            const isLastInGroup =
              currentMarkerGroupName?.fullName !== nextMarkerGroup?.fullName;

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

            // Calculate height for this group
            const maxTrack = Math.max(...groupMarkers.map((m) => m.track), -1);
            const tracksInGroup = Math.max(1, maxTrack + 1);
            const groupHeight = tracksInGroup * trackHeight;

            // Calculate status counts
            const counts = {
              confirmed: tagGroup.markers.filter(
                (marker) => isMarkerConfirmed(marker) || isMarkerManual(marker)
              ).length,
              rejected: tagGroup.markers.filter(isMarkerRejected).length,
              pending: tagGroup.markers.filter(
                (marker) =>
                  !isMarkerConfirmed(marker) &&
                  !isMarkerManual(marker) &&
                  !isMarkerRejected(marker)
              ).length,
            };

            // Check if this swimlane contains the selected marker
            const isActiveSwimlane =
              selectedMarker &&
              groupMarkers.some((m) => m.id === selectedMarker.id);

            // Check if this swimlane is being filtered
            const isFilteredSwimlane = filteredSwimlane === tagGroup.name;

            // Get the display name for the tag (remove _AI suffix if present)
            const displayName = tagGroup.name.endsWith("_AI")
              ? tagGroup.name.slice(0, -3)
              : tagGroup.name;

            return (
              <div
                key={`label-${swimlaneIndex}`}
                className="absolute w-full"
                style={{
                  top: `${swimlaneTop}px`,
                  height: `${groupHeight}px`,
                }}
              >
                <TagLabel
                  tagName={displayName}
                  groupName={currentMarkerGroupName}
                  isLastInGroup={isLastInGroup}
                  isRejected={false} // TagGroup now contains isRejected flag
                  counts={counts}
                  isFilteredSwimlane={!!isFilteredSwimlane}
                  isActiveSwimlane={!!isActiveSwimlane}
                  onClick={() => {
                    if (onSwimlaneFilter) {
                      const newFilter = isFilteredSwimlane
                        ? null
                        : tagGroup.name;
                      onSwimlaneFilter(newFilter);
                    }
                  }}
                  isFirstInGroup={isFirstInGroup}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline container with horizontal scroll */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-x-auto relative"
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
            className="absolute h-full w-0.5 bg-red-500 z-[30]"
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
              if (groupMarkers.length === 0) return null;

              // Calculate swimlane position
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

              // Calculate total height for this group
              const maxTrack =
                groupMarkers.length > 0
                  ? Math.max(...groupMarkers.map((m) => m.track))
                  : -1;
              const tracksInGroup = Math.max(1, maxTrack + 1);
              const groupHeight = tracksInGroup * trackHeight;

              return (
                <React.Fragment key={`swimlane-${swimlaneIndex}`}>
                  <div
                    className="absolute w-full"
                    style={{
                      top: `${swimlaneTop}px`,
                      height: `${groupHeight}px`,
                    }}
                  >
                    {/* Track backgrounds */}
                    {Array.from({ length: tracksInGroup }).map(
                      (_, trackIndex) => {
                        // Get the marker group name from the first marker in this group
                        const firstMarker = groupMarkers[0];
                        const currentMarkerGroupName = firstMarker
                          ? getMarkerGroupName(firstMarker)
                          : null;

                        return (
                          <div
                            key={`track-${swimlaneIndex}-${trackIndex}`}
                            className={`absolute border ${
                              false // isRejected flag is now part of TagGroup
                                ? "border-red-800/30"
                                : currentMarkerGroupName
                                ? "border-blue-400/20"
                                : "border-gray-600/20"
                            }`}
                            style={{
                              top: `${trackIndex * trackHeight}px`,
                              height: `${trackHeight}px`,
                              width: `${scaledWidth}px`,
                              backgroundColor: getGroupBackgroundColor(
                                currentMarkerGroupName,
                                swimlaneIndex,
                                false // isRejected flag is now part of TagGroup
                              ),
                            }}
                          />
                        );
                      }
                    )}

                    {/* Markers in this swimlane */}
                    {groupMarkers.map((marker) => {
                      const isSelected = marker.id === selectedMarkerId;

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
                            console.log("Timeline marker click:", {
                              markerId: marker.id,
                              markerTag: marker.primary_tag.name,
                              markerStart: marker.seconds,
                              markerEnd: marker.end_seconds,
                            });
                            onMarkerClick(marker);
                          }}
                          onMouseEnter={(e) =>
                            handleMarkerMouseEnter(e, marker)
                          }
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
                </React.Fragment>
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
          className="fixed z-[9000] bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-600 max-w-md"
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
            <div className="text-sm text-gray-400">
              ID: {markerTooltip.marker.id}
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

function getGroupBackgroundColor(
  markerGroupName: MarkerGroupInfo,
  swimlaneIndex: number,
  isRejected: boolean
): string {
  if (isRejected) {
    return swimlaneIndex % 2 === 0
      ? "rgba(127, 29, 29, 0.3)" // Even rejected: darker red
      : "rgba(153, 27, 27, 0.25)"; // Odd rejected: slightly lighter red
  }

  // Define colors for different marker groups
  const groupColors: { [key: string]: { even: string; odd: string } } = {
    Positions: {
      even: "rgba(59, 130, 246, 0.15)", // blue-500 with low opacity
      odd: "rgba(59, 130, 246, 0.1)",
    },
    Actions: {
      even: "rgba(16, 185, 129, 0.15)", // emerald-500 with low opacity
      odd: "rgba(16, 185, 129, 0.1)",
    },
    Objects: {
      even: "rgba(245, 158, 11, 0.15)", // amber-500 with low opacity
      odd: "rgba(245, 158, 11, 0.1)",
    },
    // Add more group colors as needed
  };

  // If we have a specific color for this group, use it
  if (markerGroupName && groupColors[markerGroupName.displayName]) {
    return swimlaneIndex % 2 === 0
      ? groupColors[markerGroupName.displayName].even
      : groupColors[markerGroupName.displayName].odd;
  }

  // Default colors for groups without specific colors
  return swimlaneIndex % 2 === 0
    ? "rgba(65, 75, 90, 0.35)" // Default even: lighter than gray-700
    : "rgba(75, 85, 99, 0.35)"; // Default odd: gray-600 with custom opacity
}
