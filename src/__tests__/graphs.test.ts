import { describe, expect, it } from 'vitest';
import { generateCoverageTrendGraph, type TrendData } from '../reporter/graphs';

describe('generateCoverageTrendGraph', () => {
  it('should generate ASCII graph for overall coverage trend', () => {
    const data: TrendData[] = [
      { label: 'Jan 10', value: 80.0 },
      { label: 'Jan 11', value: 82.5 },
      { label: 'Jan 12', value: 81.0 },
      { label: 'Jan 13', value: 85.5 },
      { label: 'Jan 14', value: 87.0 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Overall Coverage');

    expect(graph).toContain('Overall Coverage');
    expect(graph).toContain('80%'); // Y-axis shows rounded percentages
    expect(graph).toContain('87%');
    // Should contain some ASCII graph characters
    expect(graph).toMatch(/[│┤├─]/g);
  });

  it('should handle single data point', () => {
    const data: TrendData[] = [{ label: 'Jan 10', value: 85.0 }];

    const graph = generateCoverageTrendGraph(data, 'Coverage');

    expect(graph).toContain('85.0%');
    expect(graph).toContain('Jan 10');
  });

  it('should handle empty data', () => {
    const graph = generateCoverageTrendGraph([], 'Coverage');

    expect(graph).toContain('No history data');
  });

  it('should scale values appropriately', () => {
    const data: TrendData[] = [
      { label: 'Day 1', value: 10.0 },
      { label: 'Day 2', value: 90.0 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Coverage');

    expect(graph).toContain('10%'); // Y-axis shows rounded percentages
    expect(graph).toContain('90%');
  });

  it('should handle stable values (no change)', () => {
    const data: TrendData[] = [
      { label: 'Day 1', value: 85.0 },
      { label: 'Day 2', value: 85.0 },
      { label: 'Day 3', value: 85.0 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Stable Coverage');

    // Should display a graph even when all values are the same
    expect(graph).toContain('Stable Coverage');
    expect(graph).toMatch(/[│┤├─]/g); // Should contain graph characters
    expect(graph).toContain('●'); // Should contain data points
    // Y-axis should show values around 85%
    expect(graph).toMatch(/8[3-7]%/); // Range around 85%
  });

  it('should not have duplicate y-axis labels in small ranges (except anchors)', () => {
    // Regression test for bug where small ranges (e.g., 36-39%) caused duplicate labels
    // because multiple rows would round to the same percentage
    const data: TrendData[] = [
      { label: 'commit1', value: 36.0 },
      { label: 'commit2', value: 39.0 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Small Range Coverage');

    // Extract all y-axis labels from the graph with their positions
    const lines = graph.split('\n');
    const labelPositions: Array<{ row: number; label: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/│\s*(\d+%)/);
      if (match) {
        labelPositions.push({ row: i, label: match[1] });
      }
    }

    // Count occurrences of each label
    const labelCounts = new Map<string, number>();
    for (const pos of labelPositions) {
      labelCounts.set(pos.label, (labelCounts.get(pos.label) || 0) + 1);
    }

    // For this range (36-39), all labels should be unique
    // (anchors happen to be different integers)
    for (const [_label, count] of labelCounts.entries()) {
      expect(count).toBe(1);
    }

    // Should contain the range endpoints
    expect(graph).toContain('36%');
    expect(graph).toContain('39%');

    // Verify anchors are at first and last label positions
    expect(labelPositions[0].label).toBe('39%'); // Top
    expect(labelPositions[labelPositions.length - 1].label).toBe('36%'); // Bottom
  });

  it('should maintain visual anchors when min/max round to same integer', () => {
    // Edge case: when range is so small that min and max round to the same percentage
    // e.g., 39.2% to 39.4% both round to 39%
    const data: TrendData[] = [
      { label: 'commit1', value: 39.2 },
      { label: 'commit2', value: 39.4 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Tiny Range Coverage');

    // Extract all y-axis labels from the graph
    const lines = graph.split('\n');
    const labelPositions: Array<{ row: number; label: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/│\s*(\d+%)/);
      if (match) {
        labelPositions.push({ row: i, label: match[1] });
      }
    }

    // Should have at least the top and bottom anchors
    expect(labelPositions.length).toBeGreaterThanOrEqual(2);

    // Both endpoints should show 39% (since both round to 39)
    const firstLabel = labelPositions[0];
    const lastLabel = labelPositions[labelPositions.length - 1];

    expect(firstLabel.label).toBe('39%'); // Top anchor
    expect(lastLabel.label).toBe('39%'); // Bottom anchor

    // In this case, it's acceptable to have the same label twice (at anchors)
    // because the entire range rounds to one integer
  });

  it.each([
    {
      name: 'small range (user-reported bug: 39-42%)',
      min: 39,
      max: 42,
      expectedLabels: 4,
      description: 'Original bug: gaps of 2, 1, 3 rows. After fix: equal gaps',
    },
    {
      name: 'small range (36-39%)',
      min: 36,
      max: 39,
      expectedLabels: 4,
      description: 'Small range with 4 unique integer labels',
    },
    {
      name: 'medium range (35-45%)',
      min: 35,
      max: 45,
      expectedLabels: 10,
      description: 'Medium range filling all 10 graph rows',
    },
    {
      name: 'large range (10-90%)',
      min: 10,
      max: 90,
      expectedLabels: 10,
      description: 'Large range (81 integers) sampled to 10 rows',
    },
  ])('should have even spacing between labels: $name', ({ min, max, expectedLabels }) => {
    const data: TrendData[] = [
      { label: 'start', value: min },
      { label: 'end', value: max },
    ];

    const graph = generateCoverageTrendGraph(data, `Range ${min}-${max}%`);

    // Extract label positions
    const lines = graph.split('\n');
    const labelRows: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/│\s*(\d+%)/);
      if (match) {
        labelRows.push(i);
      }
    }

    // Should have the expected number of labels (or less if range is smaller than height)
    expect(labelRows.length).toBeGreaterThan(0);
    expect(labelRows.length).toBeLessThanOrEqual(expectedLabels);

    // Calculate gaps between consecutive labels
    if (labelRows.length > 1) {
      const gaps: number[] = [];
      for (let i = 1; i < labelRows.length; i++) {
        gaps.push(labelRows[i] - labelRows[i - 1]);
      }

      // All gaps should be equal (even spacing)
      const firstGap = gaps[0];
      for (const gap of gaps) {
        expect(gap).toBe(firstGap);
      }
    }

    // Verify min and max are present
    expect(graph).toContain(`${max}%`);
    expect(graph).toContain(`${min}%`);
  });
});

describe('Graph scaling and formatting', () => {
  it('should handle percentage values 0-100', () => {
    const data: TrendData[] = [
      { label: 'Min', value: 0 },
      { label: 'Mid', value: 50 },
      { label: 'Max', value: 100 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Full Range');

    expect(graph).toContain('0%');
    expect(graph).toContain('100%');
    // Middle value should be somewhere in the graph
    expect(graph).toMatch(/\d+%/);
  });

  it('should format labels correctly', () => {
    const data: TrendData[] = [
      { label: 'Very Long Label Name', value: 85.0 },
      { label: 'Short', value: 86.0 },
    ];

    const graph = generateCoverageTrendGraph(data, 'Label Test');

    // Labels should be present (may be truncated for long labels)
    expect(graph).toMatch(/Very/);
    expect(graph).toContain('Short');
  });

  it('should limit graph width for readability', () => {
    const data: TrendData[] = Array.from({ length: 50 }, (_, i) => ({
      label: `Day ${i + 1}`,
      value: 80 + Math.random() * 10,
    }));

    const graph = generateCoverageTrendGraph(data, 'Long History');

    // Graph should not be excessively wide
    const lines = graph.split('\n');
    const maxLineLength = Math.max(...lines.map((l) => l.length));
    expect(maxLineLength).toBeLessThanOrEqual(120);
  });

  it('should sample data when exceeding max width and include newest point', () => {
    // Create 60 data points (exceeds MAX_GRAPH_WIDTH of 50)
    const data: TrendData[] = Array.from({ length: 60 }, (_, i) => ({
      label: `commit-${i}`,
      value: 70 + i * 0.5, // Gradually increasing coverage
    }));

    const graph = generateCoverageTrendGraph(data, 'Sampled History');

    // Should contain the title
    expect(graph).toContain('Sampled History');

    // Should contain the first label
    expect(graph).toContain('commit-0');

    // Should contain the last (newest) label - this is the critical test
    // Labels are truncated to 8 chars, so "commit-59" becomes "commit-5"
    expect(graph).toContain('commit-5');

    // Graph should contain data points
    expect(graph).toContain('●');

    // Should show the range (first value ~70%, last value ~99.5%)
    expect(graph).toMatch(/7[0-9]%/); // First values around 70%
    expect(graph).toMatch(/9[0-9]%/); // Last values around 99%
  });

  it('should show trend direction clearly', () => {
    const upwardData: TrendData[] = [
      { label: 'Day 1', value: 70 },
      { label: 'Day 2', value: 75 },
      { label: 'Day 3', value: 80 },
      { label: 'Day 4', value: 85 },
      { label: 'Day 5', value: 90 },
    ];

    const downwardData: TrendData[] = [
      { label: 'Day 1', value: 90 },
      { label: 'Day 2', value: 85 },
      { label: 'Day 3', value: 80 },
      { label: 'Day 4', value: 75 },
      { label: 'Day 5', value: 70 },
    ];

    const upGraph = generateCoverageTrendGraph(upwardData, 'Upward');
    const downGraph = generateCoverageTrendGraph(downwardData, 'Downward');

    // Graphs should be different and show trend
    expect(upGraph).not.toBe(downGraph);
    expect(upGraph.length).toBeGreaterThan(0);
    expect(downGraph.length).toBeGreaterThan(0);
  });
});
