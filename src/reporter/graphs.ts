/**
 * ASCII graph visualization for coverage trends
 * Generates sparklines and text-based charts for PR comments
 */

/**
 * Data point for trend visualization
 */
export interface TrendData {
  label: string; // Date, commit, or other label
  value: number; // Coverage percentage (0-100)
}

/**
 * Sparkline block characters (8 levels from low to high)
 */
const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Generate a coverage trend graph with ASCII art
 * Shows historical coverage data as a text-based line chart
 * @param data Array of coverage data points
 * @param title Graph title
 * @returns Multi-line ASCII graph
 */
export function generateCoverageTrendGraph(data: TrendData[], title: string): string {
  if (data.length === 0) {
    return `**${title}**\n\nNo history data available.`;
  }

  const lines: string[] = [];

  // Title
  lines.push(`**${title}**`);
  lines.push('');

  // If only one data point, show it simply
  if (data.length === 1) {
    lines.push(`${data[0].label}: ${data[0].value.toFixed(1)}%`);
    return lines.join('\n');
  }

  // Find min/max for scaling
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Graph dimensions
  const height = 10;
  const width = Math.min(data.length, 50);

  // Sample data if too many points
  const sampledData = data.length > width ? sampleData(data, width) : data;

  // Create graph
  const graph: string[][] = Array.from({ length: height }, () =>
    Array(sampledData.length).fill(' ')
  );

  // If all values are the same, create a small artificial range for display
  // and place all dots in the middle row
  if (range === 0) {
    const middleRow = Math.floor(height / 2);
    for (let i = 0; i < sampledData.length; i++) {
      graph[middleRow][i] = '●';
    }

    // Create a small range around the value for Y-axis labels
    const displayMin = Math.max(0, max - 2);
    const displayMax = Math.min(100, max + 2);
    const displayRange = displayMax - displayMin;

    // Draw graph with axis
    lines.push(`┌${'─'.repeat(sampledData.length + 2)}┐`);
    for (let row = 0; row < height; row++) {
      const percentage = displayMax - (row / (height - 1)) * displayRange;
      const label = `${percentage.toFixed(0)}%`.padStart(4);
      lines.push(`│${label} ${graph[row].join('')} │`);
    }
    lines.push(`└${'─'.repeat(sampledData.length + 2)}┘`);
  } else {
    // Normal case with varying values
    // Plot points
    for (let i = 0; i < sampledData.length; i++) {
      const value = sampledData[i].value;
      const normalizedValue = (value - min) / range;
      const row = height - 1 - Math.round(normalizedValue * (height - 1));
      graph[row][i] = '●';
    }

    // Draw graph with axis
    lines.push(`┌${'─'.repeat(sampledData.length + 2)}┐`);
    for (let row = 0; row < height; row++) {
      const percentage = max - (row / (height - 1)) * range;
      const label = `${percentage.toFixed(0)}%`.padStart(4);
      lines.push(`│${label} ${graph[row].join('')} │`);
    }
    lines.push(`└${'─'.repeat(sampledData.length + 2)}┘`);
  }

  // X-axis labels
  if (sampledData.length > 1) {
    const firstLabel = sampledData[0].label.substring(0, 8);
    const lastLabel = sampledData[sampledData.length - 1].label.substring(0, 8);
    const padding = ' '.repeat(
      Math.max(0, sampledData.length - firstLabel.length - lastLabel.length)
    );
    lines.push(`       ${firstLabel}${padding}${lastLabel}`);
  }

  return lines.join('\n');
}

/**
 * Generate a trend graph for a specific module
 * @param data Coverage history for the module
 * @param moduleName Name of the module
 * @returns ASCII graph for module trend
 */
export function generateModuleTrendGraph(data: TrendData[], moduleName: string): string {
  if (data.length === 0) {
    return `**${moduleName}**\n\nNo history data available for this module.`;
  }

  return generateCoverageTrendGraph(data, moduleName);
}

/**
 * Generate a compact sparkline graph (single line)
 * Perfect for inline display in tables or compact reports
 * @param data Coverage data points
 * @returns Single-line sparkline string
 */
export function generateCompactTrendGraph(data: TrendData[]): string {
  if (data.length === 0) {
    return '';
  }

  if (data.length === 1) {
    // Single point - use middle block
    return SPARKLINE_CHARS[4];
  }

  // Find min/max for scaling
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // If all values are the same, use middle block
  if (range === 0) {
    return SPARKLINE_CHARS[4].repeat(data.length);
  }

  // Map each value to a sparkline character
  const sparkline = values
    .map((value) => {
      const normalized = (value - min) / range;
      const index = Math.min(7, Math.floor(normalized * 8));
      return SPARKLINE_CHARS[index];
    })
    .join('');

  return sparkline;
}

/**
 * Sample data points to fit within target width
 * Uses even distribution across the dataset
 * @param data Full dataset
 * @param targetWidth Desired number of points
 * @returns Sampled data
 */
function sampleData(data: TrendData[], targetWidth: number): TrendData[] {
  if (data.length <= targetWidth) {
    return data;
  }

  const step = data.length / targetWidth;
  const sampled: TrendData[] = [];

  for (let i = 0; i < targetWidth; i++) {
    const index = Math.floor(i * step);
    sampled.push(data[index]);
  }

  return sampled;
}

/**
 * Generate a summary of recent coverage changes
 * Shows the last N data points with their changes
 * @param data Coverage history
 * @param count Number of recent points to show (default 5)
 * @returns Formatted summary string
 */
export function generateRecentChangesSummary(data: TrendData[], count = 5): string {
  if (data.length === 0) {
    return 'No recent data';
  }

  const recent = data.slice(-count);
  const lines: string[] = [];

  lines.push('**Recent Changes:**');
  lines.push('');

  for (let i = 0; i < recent.length; i++) {
    const point = recent[i];
    let change = '';

    if (i > 0) {
      const delta = point.value - recent[i - 1].value;
      if (delta > 0.1) {
        change = ` (↑ +${delta.toFixed(1)}%)`;
      } else if (delta < -0.1) {
        change = ` (↓ ${delta.toFixed(1)}%)`;
      } else {
        change = ' (→)';
      }
    }

    lines.push(`- ${point.label}: ${point.value.toFixed(1)}%${change}`);
  }

  return lines.join('\n');
}
