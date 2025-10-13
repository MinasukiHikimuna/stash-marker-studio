import { type AppConfig } from "@/serverConfig";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { validateConfiguration } from "@/utils/configValidation";

const CONFIG_FILE_PATH = path.join(process.cwd(), "app-config.json");

async function loadConfigFromFile(): Promise<AppConfig | null> {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    
    // Check for corrupted file (null bytes, empty content)
    if (!configData.trim()) {
      console.error("❌ Configuration file is empty");
      throw new Error("Configuration file is empty");
    }
    
    if (configData.includes('\0')) {
      console.error("❌ Configuration file is corrupted (contains null bytes)");
      throw new Error("Configuration file is corrupted (contains null bytes)");
    }
    
    const config = JSON.parse(configData) as AppConfig;
    
    // Basic structure validation
    if (!config.serverConfig || !config.markerConfig) {
      console.error("❌ Configuration file is missing required sections");
      throw new Error("Configuration file is missing required sections");
    }
    
    return config;
  } catch (error) {
    // Check for file not found error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.error(`❌ Configuration file not found at ${CONFIG_FILE_PATH}`);
      console.error("Please create app-config.json from app-config.sample.json");
      return null; // Return null for missing file (different from corruption)
    }
    
    // For corruption or parsing errors, re-throw to return 500
    throw error;
  }
}

async function saveConfigToFile(config: AppConfig): Promise<void> {
  const configJson = JSON.stringify(config, null, 2);
  await fs.writeFile(CONFIG_FILE_PATH, configJson, "utf-8");
}

export async function GET() {
  try {
    const fileConfig = await loadConfigFromFile();
    if (fileConfig) {
      return NextResponse.json(fileConfig);
    }

    // No configuration found - return 404 to trigger setup flow
    return NextResponse.json(
      { error: "No configuration found. Please configure the application." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Failed to load configuration:", error);
    return NextResponse.json(
      { error: "Failed to load configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const config: AppConfig = await request.json();
    
    // Validate required fields using the same validation logic
    const validation = validateConfiguration(config);
    if (!validation.hasServerConfig && validation.missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missingFields.join(", ")}` },
        { status: 400 }
      );
    }
    
    // Save to JSON file
    await saveConfigToFile(config);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save configuration:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}
