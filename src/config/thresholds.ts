/**
 * Threshold configuration object
 * Keys can be:
 * - Module type (e.g., "core", "data", "feature")
 * - Full module name (e.g., ":core:testing")
 * - "default" for fallback
 */
export interface ThresholdConfig {
  [key: string]: number;
}

/**
 * Validate thresholds configuration
 * Ensures all values are numbers within 0-100 range
 * @param thresholds Threshold configuration object
 * @throws Error if validation fails
 */
export function validateThresholds(thresholds: ThresholdConfig): void {
  for (const [key, value] of Object.entries(thresholds)) {
    // Validate key format
    if (key !== 'default') {
      // Key must be either:
      // 1. Module type (no leading colon): e.g., "core", "data", "feature"
      // 2. Full module name (with leading colon): e.g., ":core:testing"

      if (key.startsWith(':')) {
        // Full module name - must not contain empty segments
        if (key.includes('::')) {
          throw new Error(
            `Threshold key '${key}' is invalid: module names cannot contain empty segments (::)`
          );
        }
        // Must have at least one segment after the colon
        if (key.length === 1 || key.endsWith(':')) {
          throw new Error(`Threshold key '${key}' is invalid: incomplete module name`);
        }
      } else {
        // Module type - must not contain colons
        if (key.includes(':')) {
          throw new Error(
            `Threshold key '${key}' is invalid: module types cannot contain colons (use leading colon for full module names)`
          );
        }
        // Must not be empty
        if (key.trim().length === 0) {
          throw new Error('Threshold key cannot be empty');
        }
      }
    }

    // Check if value is a number
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Threshold value for '${key}' must be a number, got: ${typeof value}`);
    }

    // Check if value is within range
    if (value < 0 || value > 100) {
      throw new Error(`Threshold value for '${key}' must be between 0 and 100, got: ${value}`);
    }
  }
}

/**
 * Parse threshold configuration from JSON string
 * @param jsonString JSON string containing thresholds
 * @returns Parsed and validated threshold configuration
 * @throws Error if JSON is invalid or validation fails
 */
export function parseThresholdsFromJSON(jsonString: string): ThresholdConfig {
  if (!jsonString || jsonString.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Thresholds must be a JSON object');
    }

    // Validate the parsed thresholds
    validateThresholds(parsed);

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid threshold JSON: ${error.message}`);
    }
    throw error;
  }
}
