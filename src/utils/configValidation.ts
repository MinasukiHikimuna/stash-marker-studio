import type { AppConfig } from "@/serverConfig";

export interface ConfigValidationResult {
  isComplete: boolean;
  missingFields: string[];
  hasServerConfig: boolean;
  hasMarkerConfig: boolean;
}

export function validateConfiguration(config: AppConfig | null | undefined): ConfigValidationResult {
  const result: ConfigValidationResult = {
    isComplete: false,
    missingFields: [],
    hasServerConfig: false,
    hasMarkerConfig: false,
  };

  if (!config) {
    result.missingFields = ["Complete configuration"];
    return result;
  }

  // Check server configuration
  if (!config.serverConfig?.url || !config.serverConfig?.apiKey) {
    if (!config.serverConfig?.url) result.missingFields.push("Server URL");
    if (!config.serverConfig?.apiKey) result.missingFields.push("API Key");
  } else {
    result.hasServerConfig = true;
  }

  // Check marker configuration - all four fields are required
  const markerConfig = config.markerConfig;
  if (!markerConfig?.statusConfirmed || !markerConfig?.statusRejected || 
      !markerConfig?.sourceManual || !markerConfig?.aiReviewed) {
    if (!markerConfig?.statusConfirmed) result.missingFields.push("Confirmed Status Tag");
    if (!markerConfig?.statusRejected) result.missingFields.push("Rejected Status Tag");
    if (!markerConfig?.sourceManual) result.missingFields.push("Manual Source Tag");
    if (!markerConfig?.aiReviewed) result.missingFields.push("AI Reviewed Tag");
  } else {
    result.hasMarkerConfig = true;
  }

  result.isComplete = result.hasServerConfig && result.hasMarkerConfig;
  return result;
}