/**
 * Shared marker grouping algorithms for consistent sorting between display and navigation
 */

import { SceneMarker, Tag } from "../../services/StashappService";
import { TagGroup, MarkerWithTrack } from "./types";
import { getMarkerStatus } from "./markerLogic";
import { MarkerStatus } from "./types";

// Type for marker group info
export type MarkerGroupInfo = {
  fullName: string;
  displayName: string;
} | null;

/**
 * Extract corresponding tag name from tag description
 */
function getCorrespondingTagName(tag: Tag): string | null {
  if (!tag.description?.includes("Corresponding Tag: ")) {
    return null;
  }
  
  const correspondingTagName = tag.description
    .split("Corresponding Tag: ")[1]
    .trim();
    
  return correspondingTagName || null;
}

/**
 * Parse sort order from marker group tag description
 * Expected format: "Sort Order: 123, 456, 789"
 */
export function parseSortOrder(description: string | null | undefined): string[] {
  console.log("🔍 [PARSE] Parsing sort order from description:", description);
  
  if (!description?.includes("Sort Order: ")) {
    console.log("🚫 [PARSE] No 'Sort Order:' found in description");
    return [];
  }
  
  const sortOrderPart = description
    .split("Sort Order: ")[1]
    .split("\n")[0] // Take only the first line after "Sort Order: "
    .trim();
    
  console.log("📝 [PARSE] Extracted sort order part:", sortOrderPart);
    
  if (!sortOrderPart) {
    console.log("🚫 [PARSE] Sort order part is empty");
    return [];
  }
  
  const result = sortOrderPart
    .split(",")
    .map(id => id.trim())
    .filter(id => id.length > 0);
    
  console.log("✅ [PARSE] Final parsed sort order:", result);
  return result;
}

/**
 * Create sort order description string from tag IDs
 */
export function createSortOrderDescription(tagIds: string[], existingDescription?: string | null): string {
  const sortOrderLine = `Sort Order: ${tagIds.join(", ")}`;
  
  if (!existingDescription) {
    return sortOrderLine;
  }
  
  // Replace existing sort order or append if none exists
  if (existingDescription.includes("Sort Order: ")) {
    return existingDescription.replace(
      /Sort Order: [^\n]*/,
      sortOrderLine
    );
  } else {
    return existingDescription + "\n" + sortOrderLine;
  }
}

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
 * Group markers by tags with proper marker group ordering and corresponding tag support
 * This is the shared algorithm used by both Timeline display and keyboard navigation
 */
export function groupMarkersByTags(
  markers: SceneMarker[], 
  markerGroupParentId: string, 
  markerGroups?: Array<{ id: string; name: string; description?: string | null }>,
  tagSorting?: { [markerGroupId: string]: string[] }
): TagGroup[] {
  console.log("🎯 [GROUPING] Starting groupMarkersByTags with:", {
    markersCount: markers.length,
    markerGroupParentId,
    markerGroupsCount: markerGroups?.length || 0,
    hasTagSorting: !!tagSorting,
    tagSortingKeys: Object.keys(tagSorting || {})
  });

  // Group all markers by tag name (with corresponding tag support)
  const tagGroupMap = new Map<string, SceneMarker[]>();

  for (const marker of markers) {
    // Check if this tag has a corresponding tag defined
    const correspondingTag = getCorrespondingTagName(marker.primary_tag);
    const groupName = correspondingTag || marker.primary_tag.name;

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

      // If both have marker groups, sort by the full name using natural sorting
      if (aMarkerGroup && bMarkerGroup) {
        if (aMarkerGroup.fullName !== bMarkerGroup.fullName) {
          return aMarkerGroup.fullName.localeCompare(bMarkerGroup.fullName, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
        }
        
        // Within the same marker group, use sort order from app config if available
        console.log("🔍 [SORT] Within same marker group:", {
          aGroup: aMarkerGroup.fullName,
          bGroup: bMarkerGroup.fullName,
          aName: a.name,
          bName: b.name,
          hasMarkerGroups: !!markerGroups,
          hasTagSorting: !!tagSorting
        });
        
        if (markerGroups && tagSorting) {
          const markerGroupTag = markerGroups.find(mg => mg.name === aMarkerGroup.fullName);
          console.log("🏷️ [SORT] Marker group lookup:", {
            searchingFor: aMarkerGroup.fullName,
            found: !!markerGroupTag,
            markerGroupId: markerGroupTag?.id
          });
          
          if (markerGroupTag) {
            const sortOrder = tagSorting[markerGroupTag.id] || [];
            console.log("📋 [SORT] Sort order from config:", {
              markerGroupId: markerGroupTag.id,
              sortOrder,
              sortOrderLength: sortOrder.length
            });
            
            if (sortOrder.length > 0) {
              const aTagId = a.tags[0]?.id;
              const bTagId = b.tags[0]?.id;
              const aIndex = aTagId ? sortOrder.indexOf(aTagId) : -1;
              const bIndex = bTagId ? sortOrder.indexOf(bTagId) : -1;
              
              console.log("📍 [SORT] Tag position lookup:", {
                aTagId,
                bTagId,
                aIndex,
                bIndex,
                aTagName: a.name,
                bTagName: b.name
              });
              
              // If both tags are in sort order, use that order
              if (aIndex !== -1 && bIndex !== -1) {
                console.log("✅ [SORT] Both in sort order, returning:", aIndex - bIndex);
                return aIndex - bIndex;
              }
              // If only one is in sort order, put it first
              if (aIndex !== -1 && bIndex === -1) {
                console.log("✅ [SORT] Only A in sort order, A first");
                return -1;
              }
              if (aIndex === -1 && bIndex !== -1) {
                console.log("✅ [SORT] Only B in sort order, B first");
                return 1;
              }
            }
          }
        }
        
        // Fallback to alphabetical sorting within same marker group
        console.log("🔤 [SORT] Falling back to alphabetical sort:", {
          aName: a.name,
          bName: b.name,
          result: a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        });
        return a.name.localeCompare(b.name, undefined, { 
          numeric: true, 
          sensitivity: 'base' 
        });
      }

      // If only one has a marker group, put the one with marker group first
      if (aMarkerGroup && !bMarkerGroup) {
        return -1;
      }
      if (!aMarkerGroup && bMarkerGroup) {
        return 1;
      }

      // If neither has a marker group, sort alphabetically by tag name
      return a.name.localeCompare(b.name, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });

  return tagGroups;
}

/**
 * Check if two markers overlap in time
 */
function markersOverlap(marker1: SceneMarker, marker2: SceneMarker): boolean {
  const marker1Start = marker1.seconds;
  const marker1End = marker1.end_seconds || marker1Start + 1;
  const marker2Start = marker2.seconds;
  const marker2End = marker2.end_seconds || marker2Start + 1;

  return (
    (marker1Start >= marker2Start && marker1Start < marker2End) ||
    (marker1End > marker2Start && marker1End <= marker2End) ||
    (marker1Start <= marker2Start && marker1End >= marker2End)
  );
}

/**
 * Assign tracks to markers within a tag group to avoid overlaps
 */
function assignTracksWithinGroup(markers: SceneMarker[]): Array<SceneMarker & { assignedTrack: number }> {
  // Sort markers by start time
  const sortedMarkers = [...markers].sort((a, b) => a.seconds - b.seconds);
  const markerTracks: Array<SceneMarker & { assignedTrack: number }> = [];
  
  for (const marker of sortedMarkers) {
    let assignedTrack = 0;
    
    // Find the first available track
    while (true) {
      const trackOccupied = markerTracks
        .filter(m => m.assignedTrack === assignedTrack)
        .some(existingMarker => markersOverlap(marker, existingMarker));
      
      if (!trackOccupied) {
        break;
      }
      assignedTrack++;
    }
    
    markerTracks.push({ ...marker, assignedTrack });
  }
  
  return markerTracks;
}

/**
 * Create MarkerWithTrack array from TagGroups for keyboard navigation
 * This assigns swimlane numbers that match the display order and handles overlapping markers
 */
export function createMarkersWithTracks(tagGroups: TagGroup[]): MarkerWithTrack[] {
  const markersWithTracks: MarkerWithTrack[] = [];
  
  tagGroups.forEach((group, swimlaneIndex) => {
    // Assign tracks within this group to handle overlaps
    const markersWithAssignedTracks = assignTracksWithinGroup(group.markers);
    
    markersWithAssignedTracks.forEach((marker) => {
      const markerWithTrack: MarkerWithTrack = {
        ...marker,
        track: marker.assignedTrack,
        swimlane: swimlaneIndex,  // This matches the display order
        tagGroup: group.name,
      };
      markersWithTracks.push(markerWithTrack);
    });
  });

  return markersWithTracks;
}

/**
 * Calculate the maximum number of tracks needed for each tag group
 * Returns a map of tag group name to track count
 */
export function getTrackCountsByGroup(tagGroups: TagGroup[]): Record<string, number> {
  const trackCounts: Record<string, number> = {};
  
  tagGroups.forEach((group) => {
    const markersWithTracks = assignTracksWithinGroup(group.markers);
    const maxTrack = markersWithTracks.length > 0 
      ? Math.max(...markersWithTracks.map(m => m.assignedTrack))
      : -1;
    trackCounts[group.name] = maxTrack + 1; // +1 because tracks are 0-indexed
  });
  
  return trackCounts;
}