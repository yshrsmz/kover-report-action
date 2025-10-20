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
 * Uses edge-aware distribution: places remainder gap at the edge where values can expand
 * - If bottom = 0%: blank row at top (rows 1-9), remainder at top
 * - If top = 100%: blank row at bottom (rows 0-8), remainder at bottom
 * - Otherwise: blank row at bottom (rows 0-8), remainder at bottom (room to grow)
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

  // If we have more unique percentages than rows, or exactly equal, sample them
  // Using >= prevents baseGap=0 when trying to fit height labels into height-1 rows
  if (uniquePercentages.length >= height) {
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
    // Edge-aware distribution for labels that fit within height
    if (uniquePercentages.length === 1) {
      // Only one unique percentage - show it on both anchors
      labelMap.set(0, `${topPercentage}%`.padStart(4));
      labelMap.set(height - 1, `${bottomPercentage}%`.padStart(4));
    } else {
      // Determine usable row range and where to place remainder
      let startRow: number;
      let endRow: number;
      let expandableEdge: 'top' | 'bottom';

      if (bottomPercentage === 0) {
        // Nothing exists below 0%, blank at top, expandable at top
        startRow = 1;
        endRow = height - 1;
        expandableEdge = 'top';
      } else if (topPercentage === 100) {
        // Nothing exists above 100%, blank at bottom, expandable at bottom
        startRow = 0;
        endRow = height - 2;
        expandableEdge = 'bottom';
      } else {
        // Default: room to grow at bottom
        startRow = 0;
        endRow = height - 2;
        expandableEdge = 'bottom';
      }

      const numLabels = uniquePercentages.length;
      const numGaps = numLabels - 1;
      const totalRows = endRow - startRow;

      // Calculate base gap and remainder
      const baseGap = Math.floor(totalRows / numGaps);
      const remainder = totalRows % numGaps;

      // Place labels with base gaps, putting remainder at expandable edge
      let currentRow = startRow;
      for (let i = 0; i < numLabels; i++) {
        labelMap.set(currentRow, `${uniquePercentages[i]}%`.padStart(4));

        if (i < numLabels - 1) {
          // Add base gap
          currentRow += baseGap;

          // Add remainder to appropriate edge
          if (expandableEdge === 'bottom' && i === numLabels - 2) {
            // Last gap gets the remainder (expandable at bottom)
            currentRow += remainder;
          } else if (expandableEdge === 'top' && i === 0) {
            // First gap gets the remainder (expandable at top)
            currentRow += remainder;
          }
        }
      }
    }
  }

  return labelMap;
}
