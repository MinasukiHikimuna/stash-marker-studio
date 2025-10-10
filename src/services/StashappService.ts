import type { AppConfig } from "@/serverConfig";

export type SceneMarker = {
  id: string;
  title: string;
  seconds: number;
  end_seconds?: number;
  stream: string;
  preview: string;
  screenshot: string;
  scene: {
    id: string;
    title: string;
  };
  primary_tag: {
    id: string;
    name: string;
    description?: string | null;
    parents?: Array<{
      id: string;
      name: string;
      parents?: Array<{
        id: string;
        name: string;
      }>;
    }>;
  };
  tags: Array<{
    id: string;
    name: string;
  }>;
  // Optional slots data (loaded from local database)
  slots?: Array<{
    id: string;
    slotDefinitionId: string;
    stashappPerformerId: number | null;
    slotLabel: string | null;
    genderHints: string[];
    order: number;
    performer?: {
      id: string;
      name: string;
      gender?: string;
    };
  }>;
};

type SceneMarkersResponse = {
  findSceneMarkers: {
    count: number;
    scene_markers: SceneMarker[];
  };
};

export type Performer = {
  id: string;
  name: string;
  gender:
    | ""
    | "MALE"
    | "FEMALE"
    | "TRANSGENDER_MALE"
    | "TRANSGENDER_FEMALE"
    | "INTERSEX"
    | "NON_BINARY";
};

export type Scene = {
  id: string;
  title: string;
  paths: {
    preview: string;
    vtt?: string;
    sprite?: string;
    screenshot?: string;
  };
  files?: Array<{
    id: string;
    path: string;
    basename: string;
    frame_rate: number;
  }>;
  tags?: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  performers?: Performer[];
  scene_markers?: SceneMarker[];
};

type ScenesResponse = {
  findScenes: {
    count: number;
    scenes: Scene[];
  };
};

export type Tag = {
  id: string;
  name: string;
  description?: string | null;
  parents?: Array<{
    id: string;
    name: string;
    parents?: Array<{
      id: string;
      name: string;
    }>;
  }>;
  children?: {
    id: string;
    name: string;
    description?: string | null;
  }[];
};

type SearchScenesVariables = {
  filter: {
    q: string;
    page: number;
    per_page: number;
    sort: string;
    direction: string;
  };
  scene_filter?: {
    tags: {
      value: string[];
      excludes: string[];
      modifier: string;
      depth: number;
    };
  };
};

export type SpriteFrame = {
  startTime: number;
  endTime: number;
  spriteUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TagsResponse = {
  findTags: {
    count: number;
    tags: Tag[];
  };
};

export class StashappService {
  private apiKey: string | null = null;
  private stashUrl: string = "";

  // Config values that will be set by applyConfig
  private MARKER_STATUS_CONFIRMED = "";
  private MARKER_STATUS_REJECTED = "";
  private MARKER_GROUP_PARENT_ID = "";
  private MARKER_SOURCE_MANUAL = "";
  private MARKER_SOURCE_DERIVED = "";
  private MARKER_AI_REVIEWED = "";

  // Add these getter methods to make the properties accessible
  get markerStatusConfirmed() {
    return this.MARKER_STATUS_CONFIRMED;
  }

  get markerStatusRejected() {
    return this.MARKER_STATUS_REJECTED;
  }

  get markerSourceManual() {
    return this.MARKER_SOURCE_MANUAL;
  }

  get markerSourceDerived() {
    return this.MARKER_SOURCE_DERIVED;
  }

  get markerAiReviewed() {
    return this.MARKER_AI_REVIEWED;
  }

  constructor() {}

  applyConfig(config: AppConfig) {
    this.stashUrl = config.serverConfig.url;
    this.apiKey = config.serverConfig.apiKey;
    this.MARKER_STATUS_CONFIRMED = config.markerConfig.statusConfirmed;
    this.MARKER_STATUS_REJECTED = config.markerConfig.statusRejected;
    this.MARKER_SOURCE_MANUAL = config.markerConfig.sourceManual;
    this.MARKER_SOURCE_DERIVED = config.markerConfig.sourceDerived || "";
    this.MARKER_AI_REVIEWED = config.markerConfig.aiReviewed;
    this.MARKER_GROUP_PARENT_ID = config.markerGroupingConfig.markerGroupParent;
  }

  // Update the fetchGraphQL method to use only the API key
  private async fetchGraphQL<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Only add ApiKey header if we have an API key
    if (this.apiKey) {
      headers.ApiKey = this.apiKey;
    }

    const response = await fetch(`${this.stashUrl}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private transformUrls(data: SceneMarkersResponse): SceneMarkersResponse {
    if (data?.findSceneMarkers?.scene_markers) {
      data.findSceneMarkers.scene_markers =
        data.findSceneMarkers.scene_markers.map((marker) => ({
          ...marker,
          screenshot: marker.screenshot.replace(this.stashUrl, ""),
          preview: marker.preview.replace(this.stashUrl, ""),
          stream: marker.stream.replace(this.stashUrl, ""),
        }));
    }
    return data;
  }

  async getSceneMarkers(sceneId: string): Promise<SceneMarkersResponse> {
    const query = `
      query FindSceneMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
        findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
          count
          scene_markers {
            id
            title
            seconds
            end_seconds
            stream
            preview
            screenshot
            scene {
              id
              title
            }
            primary_tag {
              id
              name
              description
              parents {
                id
                name
                parents {
                  id
                  name
                }
              }
            }
            tags {
              id
              name
            }
          }
        }
      }
    `;

    const allMarkers: SceneMarker[] = [];
    let page = 1;
    const perPage = 250;
    let totalCount = 0;

    do {
      const variables = {
        filter: {
          q: "",
          page,
          per_page: perPage,
          sort: "created_at",
          direction: "ASC",
        },
        scene_marker_filter: {
          scenes: {
            value: [sceneId],
            modifier: "INCLUDES",
          },
        },
      };

      const result = await this.fetchGraphQL<{ data: SceneMarkersResponse }>(
        query,
        variables
      );

      if (page === 1) {
        totalCount = result.data.findSceneMarkers.count;
      }

      allMarkers.push(...result.data.findSceneMarkers.scene_markers);
      page++;
    } while (allMarkers.length < totalCount);

    const response: SceneMarkersResponse = {
      findSceneMarkers: {
        count: totalCount,
        scene_markers: allMarkers,
      },
    };

    return this.transformUrls(response);
  }

  async confirmMarker(markerId: string, sceneId: string): Promise<SceneMarker> {
    return this.updateMarkerStatus(
      markerId,
      this.MARKER_STATUS_CONFIRMED,
      sceneId
    );
  }

  async rejectMarker(markerId: string, sceneId: string): Promise<SceneMarker> {
    return this.updateMarkerStatus(
      markerId,
      this.MARKER_STATUS_REJECTED,
      sceneId
    );
  }

  async resetMarker(markerId: string, sceneId: string): Promise<SceneMarker> {
    // First, fetch the current marker data
    const currentMarker = await this.getSceneMarkerFromScene(markerId, sceneId);

    if (!currentMarker) {
      throw new Error(`Marker with ID ${markerId} not found`);
    }

    // Filter out both status tags
    const newTagIds = currentMarker.tags
      .map((tag) => tag.id)
      .filter(
        (id) =>
          id !== this.MARKER_STATUS_CONFIRMED &&
          id !== this.MARKER_STATUS_REJECTED
      );

    // Update the marker
    const mutation = `
      mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
        sceneMarkerUpdate(input: $input) {
          id
          title
          seconds
          created_at
          updated_at
          stream
          preview
          screenshot
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        id: markerId,
        tag_ids: newTagIds,
      },
    };

    const result = await this.fetchGraphQL<{
      data: { sceneMarkerUpdate: SceneMarker };
    }>(mutation, variables);
    return result.data.sceneMarkerUpdate;
  }

  private async updateMarkerStatus(
    markerId: string,
    statusTagId: string,
    sceneId: string
  ): Promise<SceneMarker> {
    // First, fetch the current marker data
    const currentMarker = await this.getSceneMarkerFromScene(markerId, sceneId);

    if (!currentMarker) {
      throw new Error(`Marker with ID ${markerId} not found`);
    }

    // Prepare the new tag list
    let newTagIds = currentMarker.tags.map((tag) => tag.id);

    // Remove the opposite status tag if it exists
    const oppositeStatusTagId =
      statusTagId === this.MARKER_STATUS_CONFIRMED
        ? this.MARKER_STATUS_REJECTED
        : this.MARKER_STATUS_CONFIRMED;
    newTagIds = newTagIds.filter((id) => id !== oppositeStatusTagId);

    // Check if the status tag is already present
    const statusAlreadyPresent = newTagIds.includes(statusTagId);

    // Add the new status tag if it's not already present
    if (!statusAlreadyPresent) {
      newTagIds.push(statusTagId);
    }
    // We're removing the else block that was toggling the status off

    // Only update if there's a change in tags
    if (!statusAlreadyPresent || newTagIds.includes(oppositeStatusTagId)) {
      // Update the marker
      const mutation = `
        mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
          sceneMarkerUpdate(input: $input) {
            id
            title
            seconds
            created_at
            updated_at
            stream
            preview
            screenshot
            tags {
              id
              name
            }
          }
        }
      `;

      const variables = {
        input: {
          id: markerId,
          tag_ids: newTagIds,
        },
      };

      const result = await this.fetchGraphQL<{
        data: { sceneMarkerUpdate: SceneMarker };
      }>(mutation, variables);
      return result.data.sceneMarkerUpdate;
    } else {
      // If there's no change, return the current marker
      return currentMarker;
    }
  }

  private async getSceneMarkerFromScene(
    markerId: string,
    sceneId: string
  ): Promise<SceneMarker | null> {
    const query = `
      query FindSceneMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
        findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
          scene_markers {
            id
            title
            seconds
            end_seconds
            primary_tag {
              id
              name
              description
              parents {
                id
                name
                parents {
                  id
                  name
                }
              }
            }
            tags {
              id
              name
            }
            scene {
              id
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        per_page: -1,
      },
      scene_marker_filter: {
        scenes: {
          value: [sceneId],
          modifier: "INCLUDES",
        },
      },
    };

    const result = await this.fetchGraphQL<{
      data: { findSceneMarkers: { scene_markers: SceneMarker[] } };
    }>(query, variables);
    const markers = result.data.findSceneMarkers.scene_markers;
    return (
      markers.find((marker: SceneMarker) => marker.id === markerId) || null
    );
  }

  async searchScenes(
    searchQuery: string,
    tagIds: string[] = [],
    sortField: string = "title",
    sortDirection: "ASC" | "DESC" = "ASC",
    excludeTagIds: string[] = []
  ): Promise<ScenesResponse> {
    const query = `
      query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
        findScenes(filter: $filter, scene_filter: $scene_filter) {
          count
          scenes {
            id
            title
            paths {
              screenshot
            }
            scene_markers {
              id
              title
              seconds
              end_seconds
              primary_tag {
                id
                name
              }
              tags {
                id
                name
              }
            }
          }
        }
      }
    `;

    const variables: SearchScenesVariables = {
      filter: {
        q: searchQuery,
        page: 1,
        per_page: 200,
        sort: sortField,
        direction: sortDirection,
      },
    };

    if (tagIds.length > 0 || excludeTagIds.length > 0) {
      variables.scene_filter = {
        tags: {
          value: tagIds,
          excludes: excludeTagIds,
          modifier: "INCLUDES_ALL",
          depth: -1,
        },
      };
    }

    const result = await this.fetchGraphQL<{ data: ScenesResponse }>(
      query,
      variables
    );
    return result.data;
  }

  addApiKeysToMediaUrls(scenes: Scene[]): Scene[] {
    if (!this.apiKey) {
      throw new Error("Not authenticated");
    }
    return scenes.map((scene) => ({
      ...scene,
      paths: {
        ...scene.paths,
        preview: scene.paths.preview.includes("?")
          ? `${scene.paths.preview}&apikey=${this.apiKey}`
          : `${scene.paths.preview}?apikey=${this.apiKey}`,
      },
    }));
  }

  async isAuthenticated(): Promise<boolean> {
    return !!this.apiKey;
  }

  async getAllTags(): Promise<TagsResponse> {
    const query = `
      query FindTags($filter: FindFilterType) {
        findTags(filter: $filter) {
          count
          tags {
            id
            name
            description
            parents {
              id
              name
              parents {
                id
                name
              }
            }
            children {
              id
              name
              description
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        q: "",
        page: 1,
        per_page: 5000,
        sort: "created_at",
        direction: "DESC",
      },
    };

    const result = await this.fetchGraphQL<{ data: TagsResponse }>(
      query,
      variables
    );
    return result.data;
  }

  async getScene(sceneId: string): Promise<Scene> {
    const query = `
      query GetScene($id: ID!) {
        findScene(id: $id) {
          id
          title
          paths {
            preview
            vtt
            sprite
          }
          files {
            id
            path
            basename
            frame_rate
          }
          tags {
            id
            name
            description
          }
          performers {
            id
            name
            gender
          }
        }
      }
    `;

    const variables = {
      id: sceneId,
    };

    const result = await this.fetchGraphQL<{
      data: { findScene: Scene };
    }>(query, variables);
    return result.data.findScene;
  }

  async getSceneTags(sceneId: string): Promise<Tag[]> {
    const query = `
      query GetSceneTags($id: ID!) {
        findScene(id: $id) {
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      id: sceneId,
    };

    const result = await this.fetchGraphQL<{
      data: { findScene: { tags: Tag[] } };
    }>(query, variables);
    return result.data.findScene.tags;
  }

  async updateScene(
    scene: Scene,
    tagsToAdd: Tag[],
    tagsToRemove: Tag[]
  ): Promise<void> {
    // First, get the latest scene tags
    const currentTags = await this.getSceneTags(scene.id);

    // Apply the changes
    const updatedTags = currentTags
      .filter(
        (tag) => !tagsToRemove.some((removeTag) => removeTag.id === tag.id)
      )
      .concat(
        tagsToAdd.filter(
          (addTag) => !currentTags.some((tag) => tag.id === addTag.id)
        )
      );

    const mutation = `
      mutation SceneUpdate($input: SceneUpdateInput!) {
        sceneUpdate(input: $input) {
          id
          title
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        id: scene.id,
        tag_ids: updatedTags.map((tag) => tag.id),
      },
    };

    await this.fetchGraphQL(mutation, variables);
  }

  async createSceneMarker(
    sceneId: string,
    primaryTagId: string,
    seconds: number,
    endSeconds: number | null,
    tagIds: string[]
  ): Promise<SceneMarker> {
    // Get the primary tag name to use as title
    const query = `
      query FindTag($id: ID!) {
        findTag(id: $id) {
          name
        }
      }
    `;

    const result = await this.fetchGraphQL<{
      data: { findTag: { name: string } };
    }>(query, { id: primaryTagId });
    const title = result.data.findTag.name;

    // Create marker with millisecond precision
    const mutation = `
      mutation SceneMarkerCreate($input: SceneMarkerCreateInput!) {
        sceneMarkerCreate(input: $input) {
          id
          title
          seconds
          end_seconds
          stream
          preview
          screenshot
          scene {
            id
            title
          }
          primary_tag {
            id
            name
            description
            parents {
              id
              name
              parents {
                id
                name
              }
            }
          }
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        scene_id: sceneId,
        title,
        seconds: Math.round(seconds * 1000) / 1000, // Round to 3 decimal places
        end_seconds: endSeconds ? Math.round(endSeconds * 1000) / 1000 : null,
        primary_tag_id: primaryTagId,
        tag_ids: tagIds,
      },
    };

    const createResult = await this.fetchGraphQL<{
      data: { sceneMarkerCreate: SceneMarker };
    }>(mutation, variables);
    return createResult.data.sceneMarkerCreate;
  }

  async deleteMarker(markerId: string): Promise<void> {
    const mutation = `
      mutation SceneMarkerDestroy($id: ID!) {
        sceneMarkerDestroy(id: $id)
      }
    `;

    const variables = {
      id: markerId,
    };

    await this.fetchGraphQL(mutation, variables);
  }

  async deleteMarkers(markerIds: string[]): Promise<void> {
    const mutation = `
      mutation SceneMarkersDestroy($ids: [ID!]!) {
        sceneMarkersDestroy(ids: $ids)
      }
    `;

    const variables = {
      ids: markerIds,
    };

    await this.fetchGraphQL(mutation, variables);
  }

  async updateMarkerTimes(
    markerId: string,
    seconds: number,
    endSeconds: number | null
  ): Promise<SceneMarker> {
    const mutation = `
      mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
        sceneMarkerUpdate(input: $input) {
          id
          title
          seconds
          end_seconds
          stream
          preview
          screenshot
          primary_tag {
            id
            name
            description
          }
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        id: markerId,
        seconds: Math.round(seconds * 1000) / 1000,
        end_seconds: endSeconds ? Math.round(endSeconds * 1000) / 1000 : null,
      },
    };

    const result = await this.fetchGraphQL<{
      data: { sceneMarkerUpdate: SceneMarker };
    }>(mutation, variables);
    return result.data.sceneMarkerUpdate;
  }

  async updateMarkerTagAndTitle(
    markerId: string,
    primaryTagId: string
  ): Promise<SceneMarker> {
    // Get the primary tag name to use as title
    const query = `
      query FindTag($id: ID!) {
        findTag(id: $id) {
          name
        }
      }
    `;

    const tagResult = await this.fetchGraphQL<{
      data: { findTag: { name: string } };
    }>(query, { id: primaryTagId });
    const tagName = tagResult.data.findTag.name;

    const mutation = `
      mutation SceneMarkerUpdate($input: SceneMarkerUpdateInput!) {
        sceneMarkerUpdate(input: $input) {
          id
          title
          seconds
          end_seconds
          stream
          preview
          screenshot
          primary_tag {
            id
            name
            description
            parents {
              id
              name
              parents {
                id
                name
              }
            }
          }
          tags {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        id: markerId,
        primary_tag_id: primaryTagId,
        title: tagName, // Always use the primary tag name as the title
      },
    };

    const updateResult = await this.fetchGraphQL<{
      data: { sceneMarkerUpdate: SceneMarker };
    }>(mutation, variables);
    return updateResult.data.sceneMarkerUpdate;
  }

  async generateMarkers(sceneId: string): Promise<string> {
    const mutation = `
      mutation MetadataGenerate($input: GenerateMetadataInput!) {
        metadataGenerate(input: $input)
      }
    `;

    const variables = {
      input: {
        sceneIDs: [sceneId],
        markers: true,
        markerImagePreviews: true,
        markerScreenshots: true,
        overwrite: false,
      },
    };

    const result = await this.fetchGraphQL<{
      data: { metadataGenerate: string };
    }>(mutation, variables);
    return result.data.metadataGenerate;
  }

  async buildCorrespondingTagLookupTable(): Promise<
    Map<string, { id: string; name: string; correspondingTag: Tag | null }>
  > {
    const allTags = await this.getAllTags();
    const lookupTable = new Map<
      string,
      { id: string; name: string; correspondingTag: Tag | null }
    >();

    // Fetch corresponding tag mappings from database
    const response = await fetch('/api/corresponding-tag-mappings');
    if (!response.ok) {
      console.error('Failed to fetch corresponding tag mappings');
      return lookupTable;
    }

    const mappings = await response.json() as Array<{ sourceTagId: number; correspondingTagId: number }>;

    // Build lookup table from database mappings
    for (const mapping of mappings) {
      const sourceTag = allTags.findTags.tags.find(t => parseInt(t.id) === mapping.sourceTagId);
      const correspondingTag = allTags.findTags.tags.find(t => parseInt(t.id) === mapping.correspondingTagId);

      if (sourceTag) {
        lookupTable.set(sourceTag.id, {
          id: sourceTag.id,
          name: sourceTag.name,
          correspondingTag: correspondingTag || null,
        });
      }
    }

    return lookupTable;
  }

  // VTT parsing function
  parseVTT(vttContent: string): SpriteFrame[] {
    const frames: SpriteFrame[] = [];
    const lines = vttContent.split("\n");

    let i = 0;
    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes("-->")) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();

      if (line.includes("-->")) {
        // Parse time range: "00:00:00.000 --> 00:00:42.618"
        const [startTimeStr, endTimeStr] = line.split(" --> ");
        const startTime = this.parseVTTTime(startTimeStr);
        const endTime = this.parseVTTTime(endTimeStr);

        // Next line should contain sprite info
        i++;
        if (i < lines.length) {
          const spriteLine = lines[i].trim();
          const spriteInfo = this.parseSpriteLine(spriteLine);

          if (spriteInfo) {
            frames.push({
              startTime,
              endTime,
              spriteUrl: spriteInfo.spriteUrl,
              x: spriteInfo.x,
              y: spriteInfo.y,
              width: spriteInfo.width,
              height: spriteInfo.height,
            });
          }
        }
      }
      i++;
    }

    return frames;
  }

  // Parse VTT time format: "00:00:42.618" -> seconds
  private parseVTTTime(timeStr: string): number {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Parse sprite line: "807e47eacea352ef_sprite.jpg#xywh=0,0,160,90"
  private parseSpriteLine(spriteLine: string): {
    spriteUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    const match = spriteLine.match(/(.+)#xywh=(\d+),(\d+),(\d+),(\d+)/);
    if (!match) return null;

    const spriteFilename = match[1];
    // Construct full Stash URL path for sprite - sprite files are in the /scene/ path
    const spriteUrl = spriteFilename.startsWith("/")
      ? spriteFilename
      : `/scene/${spriteFilename}`;

    return {
      spriteUrl,
      x: parseInt(match[2], 10),
      y: parseInt(match[3], 10),
      width: parseInt(match[4], 10),
      height: parseInt(match[5], 10),
    };
  }

  // Cache for VTT files to prevent multiple fetches
  private vttCache = new Map<string, Promise<SpriteFrame[]>>();

  // Fetch and parse VTT file
  async fetchSpriteFrames(vttPath: string): Promise<SpriteFrame[]> {
    // Check cache first
    if (this.vttCache.has(vttPath)) {
      return this.vttCache.get(vttPath)!;
    }

    // Create the fetch promise and cache it immediately
    const fetchPromise = this.doFetchSpriteFrames(vttPath);
    this.vttCache.set(vttPath, fetchPromise);

    return fetchPromise;
  }

  private async doFetchSpriteFrames(vttPath: string): Promise<SpriteFrame[]> {
    try {
      // Use direct Stashapp URL with API key
      const vttUrl = this.addApiKeyToUrl(vttPath);
      console.log("Fetching VTT from Stashapp URL:", vttUrl);
      const response = await fetch(vttUrl);
      if (!response.ok) {
        if (response.status === 404) {
          console.log("VTT file not found, returning empty frames array");
          return [];
        }
        throw new Error(
          `Failed to fetch VTT: ${response.status} ${response.statusText}`
        );
      }
      const vttContent = await response.text();
      const frames = this.parseVTT(vttContent);
      console.log("Successfully parsed VTT, got", frames.length, "frames");
      return frames;
    } catch (error) {
      console.error("Error fetching sprite frames:", error);
      // Remove from cache on error so we can retry
      this.vttCache.delete(vttPath);
      return [];
    }
  }

  // Get sprite URL with API key
  getSpriteUrlWithApiKey = (spritePath: string): string => {
    return this.addApiKeyToUrl(spritePath);
  };

  // Helper method to add API key to any URL (only if API key is available)
  addApiKeyToUrl(url: string): string {
    // If URL is relative (starts with /), prepend STASH_URL
    const fullUrl = url.startsWith("/") ? `${this.stashUrl}${url}` : url;

    // Only add API key if we have one
    if (!this.apiKey) {
      return fullUrl;
    }

    return fullUrl.includes("?")
      ? `${fullUrl}&apikey=${this.apiKey}`
      : `${fullUrl}?apikey=${this.apiKey}`;
  }

  async convertConfirmedMarkersWithCorrespondingTags(
    markers: SceneMarker[]
  ): Promise<{ sourceMarker: SceneMarker; correspondingTag: Tag }[]> {
    console.log("Converting confirmed markers with corresponding tags...");
    console.log("Total markers to check:", markers.length);

    const correspondingTagLookup =
      await this.buildCorrespondingTagLookupTable();
    const confirmedMarkersToConvert: {
      sourceMarker: SceneMarker;
      correspondingTag: Tag;
    }[] = [];

    for (const marker of markers) {
      const isConfirmed = marker.tags.some(
        (tag) => tag.id === this.MARKER_STATUS_CONFIRMED
      );

      console.log("Checking marker:", marker.primary_tag.name);
      console.log("Is confirmed:", isConfirmed);
      console.log(
        "Tags:",
        marker.tags.map((t) => t.name)
      );

      const correspondingTagInfo = correspondingTagLookup.get(
        marker.primary_tag.id
      );
      console.log("Corresponding tag info found:", !!correspondingTagInfo);
      if (correspondingTagInfo) {
        console.log("Corresponding tag details:", {
          name: correspondingTagInfo.name,
          correspondingTag: correspondingTagInfo.correspondingTag?.name,
        });
      }

      if (isConfirmed && correspondingTagInfo?.correspondingTag) {
        console.log("Adding confirmed marker for conversion:", {
          sourceTag: marker.primary_tag.name,
          correspondingTag: correspondingTagInfo.correspondingTag.name,
        });

        confirmedMarkersToConvert.push({
          sourceMarker: marker,
          correspondingTag: correspondingTagInfo.correspondingTag,
        });
      }
    }

    console.log(
      "Total markers ready for conversion:",
      confirmedMarkersToConvert.length
    );
    return confirmedMarkersToConvert;
  }

  async updateTagParents(tagId: string, newParentIds: string[]): Promise<Tag> {
    const mutation = `
      mutation TagUpdate($input: TagUpdateInput!) {
        tagUpdate(input: $input) {
          id
          name
          description
          parents {
            id
            name
            parents {
              id
              name
            }
          }
          children {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        id: tagId,
        parent_ids: newParentIds,
      },
    };

    const result = await this.fetchGraphQL<{
      data: { tagUpdate: Tag };
    }>(mutation, variables);
    return result.data.tagUpdate;
  }

  async createTag(
    name: string,
    description?: string,
    parentIds: string[] = []
  ): Promise<Tag> {
    const mutation = `
      mutation TagCreate($input: TagCreateInput!) {
        tagCreate(input: $input) {
          id
          name
          description
          parents {
            id
            name
            parents {
              id
              name
            }
          }
          children {
            id
            name
          }
        }
      }
    `;

    const variables = {
      input: {
        name,
        description,
        parent_ids: parentIds,
      },
    };

    const result = await this.fetchGraphQL<{
      data: { tagCreate: Tag };
    }>(mutation, variables);
    return result.data.tagCreate;
  }

  async updateTag(
    tagId: string,
    name?: string,
    description?: string,
    parentIds?: string[]
  ): Promise<Tag> {
    const mutation = `
      mutation TagUpdate($input: TagUpdateInput!) {
        tagUpdate(input: $input) {
          id
          name
          description
          parents {
            id
            name
            parents {
              id
              name
            }
          }
          children {
            id
            name
          }
        }
      }
    `;

    const input: {
      id: string;
      name?: string;
      description?: string;
      parent_ids?: string[];
    } = { id: tagId };
    if (name !== undefined) input.name = name;
    if (description !== undefined) input.description = description;
    if (parentIds !== undefined) input.parent_ids = parentIds;

    const variables = { input };

    const result = await this.fetchGraphQL<{
      data: { tagUpdate: Tag };
    }>(mutation, variables);
    return result.data.tagUpdate;
  }

  async deleteTag(tagId: string): Promise<void> {
    const mutation = `
      mutation TagDestroy($input: TagDestroyInput!) {
        tagDestroy(input: $input)
      }
    `;

    const variables = { input: { id: tagId } };

    await this.fetchGraphQL<{
      data: { tagDestroy: boolean };
    }>(mutation, variables);
  }

  async getPerformer(performerId: string): Promise<Performer | null> {
    const query = `
      query FindPerformer($id: ID!) {
        findPerformer(id: $id) {
          id
          name
          gender
        }
      }
    `;

    const result = await this.fetchGraphQL<{
      data: { findPerformer: Performer | null };
    }>(query, { id: performerId });
    return result.data.findPerformer;
  }

  async getAllPerformers(): Promise<{
    findPerformers: { count: number; performers: Performer[] };
  }> {
    const query = `
      query FindPerformers($filter: FindFilterType) {
        findPerformers(filter: $filter) {
          count
          performers {
            id
            name
            gender
          }
        }
      }
    `;

    // Fetch all performers with pagination
    const allPerformers: Performer[] = [];
    const perPage = 1000;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetchGraphQL<{
        data: {
          findPerformers: {
            count: number;
            performers: Performer[];
          };
        };
      }>(query, {
        filter: {
          page,
          per_page: perPage,
          sort: "name",
          direction: "ASC",
        },
      });

      allPerformers.push(...result.data.findPerformers.performers);
      hasMore = result.data.findPerformers.performers.length === perPage;
      page++;
    }

    return {
      findPerformers: {
        count: allPerformers.length,
        performers: allPerformers,
      },
    };
  }
}

export const stashappService = new StashappService();
