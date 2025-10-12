import { NextRequest, NextResponse } from "next/server";
import { performSync, type EntityType, type SyncSummary } from "@/lib/stashSync";
import { stashappService } from "@/services/StashappService";
import { type AppConfig } from "@/serverConfig";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_FILE_PATH = path.join(process.cwd(), "app-config.json");

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
  return JSON.parse(configData) as AppConfig;
}

type SyncRequestBody = {
  entities?: EntityType[];
};

/**
 * POST /api/sync/stash
 *
 * Manually trigger sync of Stash metadata to local database.
 *
 * Request body:
 * {
 *   entities?: ["performers" | "tags" | "scenes"]  // defaults to all
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   summary: {
 *     performers?: { fetched: number, upserted: number },
 *     tags?: { fetched: number, upserted: number },
 *     scenes?: { fetched: number, upserted: number },
 *     errors?: string[]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: SyncRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine, will use defaults
    }

    const entities = body.entities || ["performers", "tags", "scenes"];

    // Validate entity types
    const validEntities = ["performers", "tags", "scenes"];
    for (const entity of entities) {
      if (!validEntities.includes(entity)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid entity type: ${entity}. Must be one of: ${validEntities.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Load and apply config to StashappService
    const config = await loadConfig();
    stashappService.applyConfig(config);

    // Perform sync
    const summary: SyncSummary = await performSync(entities);

    // Check if there were any errors
    const hasErrors = summary.errors && summary.errors.length > 0;

    return NextResponse.json(
      {
        success: !hasErrors,
        summary,
      },
      { status: hasErrors ? 500 : 200 }
    );
  } catch (error) {
    console.error("Sync API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
