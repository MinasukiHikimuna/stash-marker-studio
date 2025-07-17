export interface AppConfig {
  STASH_URL: string;
  STASH_API_KEY: string;
  MARKER_STATUS_CONFIRMED: string;
  MARKER_STATUS_REJECTED: string;
  MARKER_GROUP_PARENT_ID: string;
  MARKER_SOURCE_MANUAL: string;
  MARKER_SHOT_BOUNDARY: string;
  MARKER_AI_REVIEWED: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required.`);
  }
  return value;
}

export function getServerConfig(): AppConfig {
  return {
    STASH_URL: getEnv("STASH_URL"),
    STASH_API_KEY: getEnv("STASH_API_KEY"),
    MARKER_STATUS_CONFIRMED: getEnv("MARKER_STATUS_CONFIRMED"),
    MARKER_STATUS_REJECTED: getEnv("MARKER_STATUS_REJECTED"),
    MARKER_GROUP_PARENT_ID: getEnv("MARKER_GROUP_PARENT_ID"),
    MARKER_SOURCE_MANUAL: getEnv("MARKER_SOURCE_MANUAL"),
    MARKER_SHOT_BOUNDARY: getEnv("MARKER_SHOT_BOUNDARY"),
    MARKER_AI_REVIEWED: getEnv("MARKER_AI_REVIEWED"),
  };
}
