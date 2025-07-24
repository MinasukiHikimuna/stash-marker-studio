/**
 * Shared marker grouping algorithms for consistent sorting between display and navigation
 */

import { SceneMarker } from "../../services/StashappService";
import { TagGroup, MarkerWithTrack } from "./types";
import { getMarkerStatus } from "./markerLogic";
import { MarkerStatus } from "./types";

// Type for marker group info
export type MarkerGroupInfo = {
  fullName: string;
  displayName: string;
} | null;

/**
 * Extract marker group name from tag parents
 */
export function getMarkerGroupName(marker: SceneMarker, markerGroupParentId: string): MarkerGroupInfo {
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
          grandparent.id === markerGroupParentId
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

/**
 * Group markers by tags with proper marker group ordering
 * This is the shared algorithm used by both Timeline display and keyboard navigation
 */
export function groupMarkersByTags(markers: SceneMarker[], markerGroupParentId: string): TagGroup[] {
  console.log("=== SHARED MARKER GROUPING ===");
  console.log("Input markers count:", markers.length);

  // Group all markers by tag name (with AI tag correspondence)
  const tagGroupMap = new Map<string, SceneMarker[]>();

  for (const marker of markers) {
    const groupName = marker.primary_tag.name.endsWith("_AI")
      ? marker.primary_tag.name.replace("_AI", "") // Simple AI tag grouping
      : marker.primary_tag.name;

    console.log(`Processing marker ${marker.id}: tag="${marker.primary_tag.name}" -> group="${groupName}"`);

    if (!tagGroupMap.has(groupName)) {
      tagGroupMap.set(groupName, []);
    }
    tagGroupMap.get(groupName)!.push(marker);
  }

  // Convert to array of tag groups with consistent sorting
  const tagGroups: TagGroup[] = Array.from(tagGroupMap.entries())
    .map(([name, markers]) => {
      // A group is considered rejected only if ALL markers in it are rejected
      const isRejected = markers.every(
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
        markers: markers.sort((a, b) => a.seconds - b.seconds),
        tags: uniqueTags,
        isRejected,
      };
    })
    .sort((a, b) => {
      // Get marker group names for sorting
      const aMarkerGroup = getMarkerGroupName(a.markers[0], markerGroupParentId);
      const bMarkerGroup = getMarkerGroupName(b.markers[0], markerGroupParentId);

      console.log(`Sorting: ${a.name} (group: ${aMarkerGroup?.fullName}) vs ${b.name} (group: ${bMarkerGroup?.fullName})`);

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

  console.log("Created groups:", tagGroups.map(g => `${g.name} (${g.markers.length}) - group: ${getMarkerGroupName(g.markers[0], markerGroupParentId)?.fullName || 'none'}`));
  console.log("=== END SHARED MARKER GROUPING ===");

  return tagGroups;
}

/**
 * Create MarkerWithTrack array from TagGroups for keyboard navigation
 * This assigns swimlane numbers that match the display order
 */
export function createMarkersWithTracks(tagGroups: TagGroup[]): MarkerWithTrack[] {
  const markersWithTracks: MarkerWithTrack[] = [];
  
  tagGroups.forEach((group, swimlaneIndex) => {
    group.markers.forEach((marker, trackIndex) => {
      const markerWithTrack: MarkerWithTrack = {
        ...marker,
        track: trackIndex,
        swimlane: swimlaneIndex,  // This matches the display order
        tagGroup: group.name,
      };
      markersWithTracks.push(markerWithTrack);
    });
  });

  console.log("=== MARKERS WITH TRACKS ===");
  console.log(`Created ${markersWithTracks.length} markers with track data`);
  console.log("Swimlane assignments:", tagGroups.map((group, index) => `${index}: ${group.name} (${group.markers.length} markers)`));
  console.log("=== END MARKERS WITH TRACKS ===");

  return markersWithTracks;
}