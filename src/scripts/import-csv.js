#!/usr/bin/env node

import { readFile } from "fs/promises";

/**
 * Import PySceneDetect CSV file to database
 *
 * Usage:
 *   node src/scripts/import-csv.js <sceneId> <csvPath>
 *
 * Example:
 *   node src/scripts/import-csv.js 123 /path/to/scene-Scenes.csv
 */

async function importCsv(sceneId, csvPath) {
  console.log(`Importing CSV for scene ${sceneId} from ${csvPath}`);

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

    console.log(`📤 Sending ${shotBoundaries.length} shot boundaries to API...`);

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
const [, , sceneId, csvPath] = process.argv;

if (!sceneId || !csvPath) {
  console.error("Usage: node src/scripts/import-csv.js <sceneId> <csvPath>");
  console.error("Example: node src/scripts/import-csv.js 123 /path/to/scene-Scenes.csv");
  process.exit(1);
}

importCsv(sceneId, csvPath);
