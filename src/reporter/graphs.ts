/**
 * ASCII graph visualization for coverage trends
 */

/**
 * Maximum width of trend graph in data points
 */
const MAX_GRAPH_WIDTH = 50;

/**
 * Data point for trend visualization
 */
export interface TrendData {
  label: string; // Date, commit, or other label
  value: number; // Coverage percentage (0-100)
}

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
  const width = Math.min(data.length, MAX_GRAPH_WIDTH);

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

    // Calculate unique integer labels and their row positions
    const labelMap = calculateLabelPositions(displayMin, displayMax, height);

    // Draw graph with axis
    lines.push(`┌${'─'.repeat(sampledData.length + 6)}┐`);
    for (let row = 0; row < height; row++) {
      const label = labelMap.get(row) ?? '    ';
      lines.push(`│${label} ${graph[row].join('')} │`);
    }
    lines.push(`└${'─'.repeat(sampledData.length + 6)}┘`);
  } else {
    // Normal case with varying values
    // Plot points
    for (let i = 0; i < sampledData.length; i++) {
      const value = sampledData[i].value;
      const normalizedValue = (value - min) / range;
      const row = height - 1 - Math.round(normalizedValue * (height - 1));
      graph[row][i] = '●';
    }

    // Calculate unique integer labels and their row positions
    const labelMap = calculateLabelPositions(min, max, height);

    // Draw graph with axis
    lines.push(`┌${'─'.repeat(sampledData.length + 6)}┐`);
    for (let row = 0; row < height; row++) {
      const label = labelMap.get(row) ?? '    ';
      lines.push(`│${label} ${graph[row].join('')} │`);
    }
    lines.push(`└${'─'.repeat(sampledData.length + 6)}┘`);
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
 * Sample data points to fit within target width
 * Uses even distribution across the dataset
 * Always includes the last (newest) data point
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

  for (let i = 0; i < targetWidth - 1; i++) {
    const index = Math.floor(i * step);
    sampled.push(data[index]);
  }

  // Always include the last (newest) data point
  sampled.push(data[data.length - 1]);

  return sampled;
}

/**
 * Calculate which row each unique integer percentage should appear on
 * Distributes labels evenly for better visual clarity
 * @param min Minimum percentage value
 * @param max Maximum percentage value
 * @param height Graph height in rows
 * @returns Map of row index to formatted label string
 */
function calculateLabelPositions(min: number, max: number, height: number): Map<number, string> {
  const labelMap = new Map<number, string>();
  const range = max - min;

  // Guard: height must be at least 2 for meaningful distribution
  if (height < 2) {
    labelMap.set(0, `${Math.round(max)}%`.padStart(4));
    return labelMap;
  }

  // Special case: all values are the same
  if (range === 0) {
    const middleRow = Math.floor(height / 2);
    labelMap.set(middleRow, `${Math.round(max)}%`.padStart(4));
    return labelMap;
  }

  const topPercentage = Math.round(max);
  const bottomPercentage = Math.round(min);

  // Get all unique integer percentages in the range
  const uniquePercentages: number[] = [];
  for (let p = topPercentage; p >= bottomPercentage; p--) {
    uniquePercentages.push(p);
  }

  // If we have more unique percentages than rows, we can't show them all
  // In this case, always show top and bottom, and select representative labels for the middle
  if (uniquePercentages.length > height) {
    // Always show top and bottom
    labelMap.set(0, `${topPercentage}%`.padStart(4));
    labelMap.set(height - 1, `${bottomPercentage}%`.padStart(4));

    // For middle rows, select labels at evenly spaced intervals
    const availableRows = height - 2;
    if (availableRows > 0) {
      const labelStep = (uniquePercentages.length - 1) / (height - 1);

      for (let rowIdx = 1; rowIdx < height - 1; rowIdx++) {
        const labelIdx = Math.round(rowIdx * labelStep);
        labelMap.set(rowIdx, `${uniquePercentages[labelIdx]}%`.padStart(4));
      }
    }
  } else {
    // We have enough rows to show all unique percentages
    // Distribute them evenly across the available rows

    if (uniquePercentages.length === 1) {
      // Only one unique percentage - show it on both anchors
      labelMap.set(0, `${topPercentage}%`.padStart(4));
      labelMap.set(height - 1, `${bottomPercentage}%`.padStart(4));
    } else {
      // Distribute evenly from top to bottom
      const rowStep = (height - 1) / (uniquePercentages.length - 1);

      for (let i = 0; i < uniquePercentages.length; i++) {
        const row = Math.round(i * rowStep);
        labelMap.set(row, `${uniquePercentages[i]}%`.padStart(4));
      }
    }
  }

  return labelMap;
}
