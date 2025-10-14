#!/usr/bin/env node

import { readFile } from "fs/promises";
import { basename } from "path";

/**
 * Import PySceneDetect CSV file to database
 *
 * Usage:
 *   node src/scripts/import-csv.js <csvPath> [--dry-run]
 *
 * Example:
 *   node src/scripts/import-csv.js /path/to/video.mp4.Scenes.csv --dry-run
 *   node src/scripts/import-csv.js /path/to/video.mp4.Scenes.csv
 */

/**
 * Load app configuration from the Next.js API
 */
async function loadConfig() {
  const response = await fetch("http://localhost:3000/api/config");
  if (!response.ok) {
    throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
  }
  const config = await response.json();
  return config;
}

/**
 * Query Stashapp GraphQL API to find scene by filename
 */
async function findSceneByFilename(stashUrl, apiKey, filename) {
  const query = `
    query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
      findScenes(filter: $filter, scene_filter: $scene_filter) {
        count
        scenes {
          id
          title
          date
          details
          performers {
            id
          }
          tags {
            id
          }
        }
      }
    }
  `;

  const variables = {
    filter: {
      q: `"${filename}"`,
      page: 1,
      per_page: 40,
      sort: "path",
      direction: "ASC",
    },
    scene_filter: {},
  };

  const headers = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.ApiKey = apiKey;
  }

  const response = await fetch(`${stashUrl}/graphql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.data.findScenes;
}

/**
 * Extract filename from CSV path by removing .Scenes.csv suffix
 */
function extractFilename(csvPath) {
  const base = basename(csvPath);
  // Remove .Scenes.csv suffix (PySceneDetect appends this to the original filename)
  const match = base.match(/^(.+)\.Scenes\.csv$/);
  if (!match) {
    throw new Error(`CSV filename must end with .Scenes.csv: ${base}`);
  }
  return match[1];
}

async function importCsv(sceneId, csvPath, dryRun = false) {
  try {
    // Read CSV file with different encodings
    const encodings = ["utf-8", "utf-8-sig", "utf-16", "cp1252", "iso-8859-1"];
    let csvContent;

    for (const encoding of encodings) {
      try {
        csvContent = await readFile(csvPath, encoding);
        console.log(`✅ Successfully read CSV with encoding: ${encoding}`);
        break;
      } catch (e) {
        console.log(`❌ Failed with ${encoding}: ${e.message}`);
        if (encoding === encodings[encodings.length - 1]) {
          throw new Error("Could not read CSV file with any encoding");
        }
      }
    }

    // Parse CSV content
    const rows = csvContent.split("\n").map((row) => row.split(","));

    // Skip first row (timecode list), use second row as headers
    const dataRows = rows.slice(2);

    console.log(`📊 Found ${dataRows.length} shot boundaries to store`);

    // Extract shot boundaries
    const shotBoundaries = [];
    for (const row of dataRows) {
      if (row.length < 7) continue; // Skip invalid rows

      const startTime = parseFloat(row[3]); // Start Time (seconds)
      const endTime = parseFloat(row[6]); // End Time (seconds)

      if (isNaN(startTime) || isNaN(endTime)) continue;

      shotBoundaries.push({ startTime, endTime });
    }

    console.log(`📤 Preparing ${shotBoundaries.length} shot boundaries...`);

    if (dryRun) {
      console.log(`🔍 Dry run mode - would import ${shotBoundaries.length} shot boundaries for scene ${sceneId}`);
      return;
    }

    // Send to API
    const response = await fetch("http://localhost:3000/api/shot-boundaries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stashappSceneId: parseInt(sceneId),
        shotBoundaries,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`API error: ${result.error}`);
    }

    console.log(`✅ Stored ${result.count} shot boundaries in database`);
  } catch (error) {
    console.error(`❌ Error importing CSV:`, error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node src/scripts/import-csv.js <csvPath> [--dry-run]");
  console.error("");
  console.error("Examples:");
  console.error("  node src/scripts/import-csv.js /path/to/video.mp4.Scenes.csv --dry-run");
  console.error("  node src/scripts/import-csv.js /path/to/video.mp4.Scenes.csv");
  process.exit(1);
}

const csvPath = args[0];
const dryRun = args.includes("--dry-run");

console.log(`🔍 Looking up scene by filename...`);

// Extract filename from CSV path
const filename = extractFilename(csvPath);
console.log(`📝 Extracted filename: ${filename}`);

// Load config to get Stashapp connection info
const config = await loadConfig();
const { url: stashUrl, apiKey } = config.serverConfig;

// Query Stashapp to find the scene
const searchResult = await findSceneByFilename(stashUrl, apiKey, filename);

if (searchResult.count === 0) {
  console.error(`❌ No scene found matching filename: ${filename}`);
  process.exit(1);
}

if (searchResult.count > 1) {
  console.error(`❌ Multiple scenes found matching filename: ${filename}`);
  console.error(`Found ${searchResult.count} scenes:`);
  for (const scene of searchResult.scenes) {
    console.error(`  - ID: ${scene.id}, Title: ${scene.title || "(no title)"}`);
  }
  process.exit(1);
}

// Exactly one scene found
const scene = searchResult.scenes[0];
console.log(`✅ Found scene: ID=${scene.id}, Title=${scene.title || "(no title)"}`);

if (dryRun) {
  console.log(`\n🔍 Dry run mode - would import shot boundaries for scene ${scene.id}`);
  console.log(`To import, run without --dry-run flag`);
  process.exit(0);
}

await importCsv(scene.id, csvPath, false);
