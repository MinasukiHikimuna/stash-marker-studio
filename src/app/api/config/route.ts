import { type AppConfig } from "@/serverConfig";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { validateConfiguration } from "@/utils/configValidation";

const CONFIG_FILE_PATH = path.join(process.cwd(), "app-config.json");

async function loadConfigFromFile(): Promise<AppConfig | null> {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    return JSON.parse(configData) as AppConfig;
  } catch {
    // File doesn't exist or invalid JSON, return null
    return null;
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
