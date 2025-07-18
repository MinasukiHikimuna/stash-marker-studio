/**
 * Format seconds into a time string (HH:MM:SS or HH:MM:SS.mmm)
 */
export function formatSeconds(
  seconds: number,
  showMilliseconds: boolean = false
): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    showMilliseconds
      ? secs.toFixed(3).padStart(6, "0")
      : Math.floor(secs).toString().padStart(2, "0"),
  ];

  return parts.join(":");
}

/**
 * Format seconds into colon-dot format (HH:MM:SS.mmm)
 */
export function formatTimeColonDot(seconds: number): string {
  return formatSeconds(seconds, true);
}

/**
 * Parse a time string in colon-dot format (HH:MM:SS.mmm) into seconds
 */
export function parseTimeColonDot(str: string): number {
  const parts = str.split(/[:.]/).map(Number);
  if (parts.length < 3) return 0;

  const [hours = 0, minutes = 0, seconds = 0, milliseconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}
