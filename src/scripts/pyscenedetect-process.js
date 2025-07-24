import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import os from "os";

// Load configuration from app-config.json
async function loadConfig() {
  try {
    const configFile = await fs.readFile("app-config.json", "utf-8");
    return JSON.parse(configFile);
  } catch (error) {
    console.error("Error loading app-config.json:", error.message);
    console.error("Please ensure app-config.json exists and is valid JSON.");
    process.exit(1);
  }
}


async function getSidecarFile(videoPath) {
  const parsedPath = path.parse(videoPath);
  const sidecarPattern = `${parsedPath.base}.Scenes.csv`;
  const sidecarPath = path.join(parsedPath.dir, sidecarPattern);

  try {
    await fs.access(sidecarPath);
    return sidecarPath;
  } catch {
    return null;
  }
}

// Create a function to generate a temporary path with UUID
async function createTempPath(originalPath, suffix = "") {
  const parsedPath = path.parse(originalPath);
  const uuid = randomUUID();
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "stash-marker-studio-")
  );
  return {
    tempPath: path.join(tempDir, `${uuid}${suffix}${parsedPath.ext}`),
    tempDir,
    uuid,
  };
}

// Create a function to clean up temporary files and directory
async function cleanupTemp(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up temp directory: ${error.message}`);
  }
}

async function downscaleVideo(inputPath) {
  const {
    tempPath: outputPath,
    tempDir,
    uuid,
  } = await createTempPath(inputPath, ".540p");

  const ffmpegArgs = [
    "-hwaccel",
    "cuda",
    "-hwaccel_output_format",
    "cuda",
    "-i",
    inputPath,
    "-vf",
    "scale_cuda=960:540",
    "-c:v",
    "h264_nvenc",
    "-preset",
    "p1",
    "-tune",
    "ll",
    "-rc",
    "cbr",
    "-b:v",
    "1M",
    "-an",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["inherit", "pipe", "pipe"],
    });

    ffmpeg.stdout.on("data", (data) => {
      process.stdout.write(data);
    });

    ffmpeg.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ outputPath, tempDir, uuid });
      } else {
        cleanupTemp(tempDir);
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function runSceneDetection(videoPath, tempDir) {
  const scenedetectArgs = [
    "--input",
    videoPath,
    "--output",
    tempDir,
    "detect-content",
    "list-scenes",
  ];

  return new Promise((resolve, reject) => {
    const scenedetect = spawn("scenedetect", scenedetectArgs, {
      stdio: ["inherit", "pipe", "pipe"],
    });

    // Buffer for storing stderr output
    let stderrOutput = "";

    scenedetect.stdout.on("data", (data) => {
      try {
        process.stdout.write(data);
      } catch (error) {
        if (error.code === "EILSEQ" || error instanceof TypeError) {
          console.log("[Scene detection in progress...]");
        }
      }
    });

    scenedetect.stderr.on("data", (data) => {
      try {
        process.stderr.write(data);
      } catch (error) {
        if (error.code === "EILSEQ" || error instanceof TypeError) {
          stderrOutput += data.toString("utf8");
        }
      }
    });

    scenedetect.on("error", reject);
    scenedetect.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        if (
          stderrOutput.includes("UnicodeEncodeError") ||
          stderrOutput.includes("charmap")
        ) {
          console.log(
            "⚠️ Non-critical encoding warning occurred, but scene detection completed successfully"
          );
          resolve();
        } else {
          reject(new Error(`scenedetect exited with code ${code}`));
        }
      }
    });
  });
}

async function renameSceneCSV(videoPath, tempDir, uuid, originalVideoPath) {
  // Find the CSV file in temp directory
  const files = await fs.readdir(tempDir);
  const csvFile = files.find((file) => file.endsWith("-Scenes.csv"));

  if (!csvFile) {
    return null;
  }

  const tempCsvPath = path.join(tempDir, csvFile);
  const parsedOriginalPath = path.parse(originalVideoPath);
  const finalCsvPath = path.join(
    parsedOriginalPath.dir,
    `${parsedOriginalPath.base}.Scenes.csv`
  );

  console.log(`Found CSV file: ${tempCsvPath}`);
  console.log(`Renaming to: ${finalCsvPath}`);

  try {
    await fs.copyFile(tempCsvPath, finalCsvPath);
    return finalCsvPath;
  } catch (error) {
    console.error(`Error copying CSV file: ${error.message}`);
    return null;
  }
}

async function getTagName(tagId, config) {
  const query = `
    query FindTag($id: ID!) {
      findTag(id: $id) {
        id
        name
      }
    }
  `;

  const response = await fetch(`${config.serverConfig.url}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: config.serverConfig.apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { id: tagId },
    }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(`Failed to fetch tag name: ${result.errors[0].message}`);
  }
  return result.data.findTag.name;
}

async function createSceneMarkers(sceneId, csvPath, config) {
  console.log(`Creating scene markers for scene ${sceneId} from ${csvPath}`);

  try {
    // Get the shot boundary tag name first
    const tagName = await getTagName(config.shotBoundaryConfig.shotBoundary, config);
    console.log(`Using tag name: ${tagName}`);

    // Read CSV file with different encodings
    const encodings = ["utf-8", "utf-8-sig", "utf-16", "cp1252", "iso-8859-1"];
    let csvContent;

    for (const encoding of encodings) {
      try {
        csvContent = await fs.readFile(csvPath, encoding);
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

    console.log(`📊 Found ${dataRows.length} scenes/cuts to process`);

    // Process each row and create markers
    for (const row of dataRows) {
      if (row.length < 7) continue; // Skip invalid rows

      const startTime = parseFloat(row[3]); // Start Time (seconds)
      const endTime = parseFloat(row[6]); // End Time (seconds)

      if (isNaN(startTime) || isNaN(endTime)) continue;

      const mutation = `
        mutation SceneMarkerCreate($input: SceneMarkerCreateInput!) {
          sceneMarkerCreate(input: $input) {
            id
          }
        }
      `;

      const variables = {
        input: {
          scene_id: sceneId,
          title: tagName,
          seconds: startTime,
          end_seconds: endTime,
          primary_tag_id: config.shotBoundaryConfig.shotBoundary,
          tag_ids: [config.shotBoundaryConfig.sourceShotBoundaryAnalysis],
        },
      };

      try {
        const response = await fetch(`${config.serverConfig.url}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ApiKey: config.serverConfig.apiKey,
          },
          body: JSON.stringify({
            query: mutation,
            variables,
          }),
        });

        const result = await response.json();
        if (result.errors) {
          console.error(
            `❌ Error creating marker at ${startTime}:`,
            result.errors
          );
        }
      } catch (error) {
        console.error(
          `❌ Error creating marker at ${startTime}:`,
          error.message
        );
      }
    }

    // Mark scene as processed by adding the tag
    const mutation = `
      mutation BulkSceneUpdate($input: BulkSceneUpdateInput!) {
        bulkSceneUpdate(input: $input) {
          id
        }
      }
    `;

    const variables = {
      input: {
        ids: [sceneId],
        tag_ids: {
          mode: "ADD",
          ids: [config.shotBoundaryConfig.shotBoundaryProcessed],
        },
      },
    };

    await fetch(`${config.serverConfig.url}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: config.serverConfig.apiKey,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    console.log(`✅ Marked scene ${sceneId} as processed`);
  } catch (error) {
    console.error(`❌ Error processing scene ${sceneId}:`, error.message);
  }
}

async function processVideo(videoPath, sceneId, config) {
  // Check if sidecar file exists
  const sidecarFile = await getSidecarFile(videoPath);
  if (sidecarFile) {
    console.log(`${videoPath}\nSkipped - already processed.\n`);
    return;
  }

  console.log(`${videoPath}`);
  let tempDir = null;

  try {
    // Downscale video
    console.log("Downscaling video...");
    const {
      outputPath,
      tempDir: newTempDir,
      uuid,
    } = await downscaleVideo(videoPath);
    tempDir = newTempDir;

    // Run scene detection
    console.log("Running scene detection...");
    await runSceneDetection(outputPath, tempDir, uuid);

    // Rename CSV file
    const newCsvPath = await renameSceneCSV(
      outputPath,
      tempDir,
      uuid,
      videoPath
    );
    if (newCsvPath) {
      console.log("CSV file created at:", newCsvPath);

      // Create scene markers from the CSV file
      if (sceneId) {
        await createSceneMarkers(sceneId, newCsvPath, config);
      }

      console.log("Done.\n");
    }
  } finally {
    // Clean up temporary directory and all files
    if (tempDir) {
      await cleanupTemp(tempDir);
    }
  }
}

async function findScenes(config) {
  const query = `
    query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
      findScenes(filter: $filter, scene_filter: $scene_filter) {
        scenes {
          id
          title
          files {
            id
            path
          }
        }
      }
    }
  `;

  const variables = {
    filter: {
      q: "",
      page: 1,
      per_page: 200,
      sort: "path",
      direction: "ASC",
    },
    scene_filter: {
      tags: {
        value: [config.shotBoundaryConfig.aiTagged],
        excludes: [config.shotBoundaryConfig.shotBoundaryProcessed],
        modifier: "INCLUDES",
        depth: -1,
      },
    },
  };

  const response = await fetch(`${config.serverConfig.url}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: config.serverConfig.apiKey,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await response.json();
  return data.data.findScenes.scenes;
}

async function main() {
  // Load and initialize configuration
  const config = await loadConfig();

  // Verify configuration values are provided
  if (
    !config.serverConfig.url ||
    !config.serverConfig.apiKey ||
    !config.shotBoundaryConfig.aiTagged ||
    !config.shotBoundaryConfig.shotBoundaryProcessed ||
    !config.shotBoundaryConfig.shotBoundary ||
    !config.shotBoundaryConfig.sourceShotBoundaryAnalysis
  ) {
    console.error(
      "Missing required configuration values. Please check your app-config.json file."
    );
    console.error(
      "Required values: serverConfig.url, serverConfig.apiKey, shotBoundaryConfig.aiTagged, shotBoundaryConfig.shotBoundaryProcessed, shotBoundaryConfig.shotBoundary, shotBoundaryConfig.sourceShotBoundaryAnalysis"
    );
    process.exit(1);
  }

  if (process.argv.length === 3) {
    const videoFile = process.argv[2];
    await processVideo(videoFile, null, config);
  } else {
    const scenes = await findScenes(config);
    for (const scene of scenes) {
      await processVideo(scene.files[0].path, scene.id, config);
    }
  }
}

main().catch(console.error);
