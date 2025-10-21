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

  describe('Edge-aware label distribution', () => {
    it.each([
      {
        name: '2 labels, default range (50-51%)',
        min: 50,
        max: 51,
        expectedRows: [0, 8],
        description: 'Use rows 0-8, gap of 8',
      },
      {
        name: '3 labels, default range (50-52%)',
        min: 50,
        max: 52,
        expectedRows: [0, 4, 8],
        description: 'Use rows 0-8, even gaps of 4',
      },
      {
        name: '4 labels, default range (50-53%)',
        min: 50,
        max: 53,
        expectedRows: [0, 2, 4, 8],
        description: 'Use rows 0-8, base gap=2, remainder=2 added to last',
      },
      {
        name: '5 labels, default range (50-54%)',
        min: 50,
        max: 54,
        expectedRows: [0, 2, 4, 6, 8],
        description: 'Use rows 0-8, even gaps of 2',
      },
      {
        name: '6 labels, default range (50-55%)',
        min: 50,
        max: 55,
        expectedRows: [0, 1, 2, 3, 4, 8],
        description: 'Use rows 0-8, base gap=1, remainder=3 added to last',
      },
      {
        name: '7 labels, default range (50-56%)',
        min: 50,
        max: 56,
        expectedRows: [0, 1, 2, 3, 4, 5, 8],
        description: 'Use rows 0-8, base gap=1, remainder=2 added to last',
      },
      {
        name: '8 labels, default range (50-57%)',
        min: 50,
        max: 57,
        expectedRows: [0, 1, 2, 3, 4, 5, 6, 8],
        description: 'Use rows 0-8, base gap=1, remainder=1 added to last',
      },
      {
        name: '9 labels, default range (50-58%)',
        min: 50,
        max: 58,
        expectedRows: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        description: 'Use rows 0-8, consecutive with no remainder',
      },
    ])('should distribute labels with remainder at bottom: $name', ({ min, max, expectedRows }) => {
      const data: TrendData[] = [
        { label: 'start', value: min },
        { label: 'end', value: max },
      ];

      const graph = generateCoverageTrendGraph(data, 'Test');
      const lines = graph.split('\n');

      // Find the offset: title (1 line) + blank (1 line) + top border (1 line) = 3
      const graphStartIndex = lines.findIndex((line) => line.startsWith('┌'));

      // Extract label row positions relative to graph start
      const labelRows: number[] = [];
      for (let i = graphStartIndex + 1; i < lines.length; i++) {
        const match = lines[i].match(/│\s*(\d+%)/);
        if (match) {
          // Convert line index to graph row index (0-9)
          labelRows.push(i - graphStartIndex - 1);
        }
      }

      expect(labelRows).toEqual(expectedRows);
    });

    it.each([
      {
        name: '2 labels, bottom=0% (0-1%)',
        min: 0,
        max: 1,
        expectedRows: [1, 9],
        description: 'Use rows 1-9, gap of 8',
      },
      {
        name: '3 labels, bottom=0% (0-2%)',
        min: 0,
        max: 2,
        expectedRows: [1, 5, 9],
        description: 'Use rows 1-9, even gaps of 4',
      },
      {
        name: '4 labels, bottom=0% (0-3%)',
        min: 0,
        max: 3,
        expectedRows: [1, 5, 7, 9],
        description: 'Use rows 1-9, base gap=2, remainder=2 added to first',
      },
      {
        name: '5 labels, bottom=0% (0-4%)',
        min: 0,
        max: 4,
        expectedRows: [1, 3, 5, 7, 9],
        description: 'Use rows 1-9, even gaps of 2',
      },
      {
        name: '6 labels, bottom=0% (0-5%)',
        min: 0,
        max: 5,
        expectedRows: [1, 5, 6, 7, 8, 9],
        description: 'Use rows 1-9, base gap=1, remainder=3 added to first',
      },
      {
        name: '7 labels, bottom=0% (0-6%)',
        min: 0,
        max: 6,
        expectedRows: [1, 4, 5, 6, 7, 8, 9],
        description: 'Use rows 1-9, base gap=1, remainder=2 added to first',
      },
      {
        name: '8 labels, bottom=0% (0-7%)',
        min: 0,
        max: 7,
        expectedRows: [1, 3, 4, 5, 6, 7, 8, 9],
        description: 'Use rows 1-9, base gap=1, remainder=1 added to first',
      },
      {
        name: '9 labels, bottom=0% (0-8%)',
        min: 0,
        max: 8,
        expectedRows: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        description: 'Use rows 1-9, consecutive with no remainder',
      },
    ])('should distribute labels with remainder at top: $name', ({ min, max, expectedRows }) => {
      const data: TrendData[] = [
        { label: 'start', value: min },
        { label: 'end', value: max },
      ];

      const graph = generateCoverageTrendGraph(data, 'Test');
      const lines = graph.split('\n');

      // Find the offset: title (1 line) + blank (1 line) + top border (1 line) = 3
      const graphStartIndex = lines.findIndex((line) => line.startsWith('┌'));

      // Extract label row positions relative to graph start
      const labelRows: number[] = [];
      for (let i = graphStartIndex + 1; i < lines.length; i++) {
        const match = lines[i].match(/│\s*(\d+%)/);
        if (match) {
          // Convert line index to graph row index (0-9)
          labelRows.push(i - graphStartIndex - 1);
        }
      }

      expect(labelRows).toEqual(expectedRows);
    });

    it.each([
      {
        name: '2 labels, top=100% (99-100%)',
        min: 99,
        max: 100,
        expectedRows: [0, 8],
        description: 'Use rows 0-8, gap of 8',
      },
      {
        name: '3 labels, top=100% (98-100%)',
        min: 98,
        max: 100,
        expectedRows: [0, 4, 8],
        description: 'Use rows 0-8, even gaps of 4',
      },
      {
        name: '4 labels, top=100% (97-100%)',
        min: 97,
        max: 100,
        expectedRows: [0, 2, 4, 8],
        description: 'Use rows 0-8, base gap=2, remainder=2 added to last',
      },
    ])(
      'should distribute labels with remainder at bottom when top=100%: $name',
      ({ min, max, expectedRows }) => {
        const data: TrendData[] = [
          { label: 'start', value: min },
          { label: 'end', value: max },
        ];

        const graph = generateCoverageTrendGraph(data, 'Test');
        const lines = graph.split('\n');

        // Find the offset: title (1 line) + blank (1 line) + top border (1 line) = 3
        const graphStartIndex = lines.findIndex((line) => line.startsWith('┌'));

        // Extract label row positions relative to graph start
        const labelRows: number[] = [];
        for (let i = graphStartIndex + 1; i < lines.length; i++) {
          const match = lines[i].match(/│\s*(\d+%)/);
          if (match) {
            // Convert line index to graph row index (0-9)
            labelRows.push(i - graphStartIndex - 1);
          }
        }

        expect(labelRows).toEqual(expectedRows);
      }
    );

    it('should handle exactly 10 labels using overflow/sampling path', () => {
      // Regression test: exactly height labels should use overflow path
      // to avoid baseGap=0 when fitting 10 labels into 9 usable rows
      const data: TrendData[] = [
        { label: 'start', value: 50 },
        { label: 'end', value: 59 },
      ];

      const graph = generateCoverageTrendGraph(data, 'Ten Labels');
      const lines = graph.split('\n');

      const graphStartIndex = lines.findIndex((line) => line.startsWith('┌'));

      // Extract label row positions
      const labelRows: number[] = [];
      for (let i = graphStartIndex + 1; i < lines.length; i++) {
        const match = lines[i].match(/│\s*(\d+%)/);
        if (match) {
          labelRows.push(i - graphStartIndex - 1);
        }
      }

      // Should show all 10 labels, one per row
      expect(labelRows.length).toBe(10);
      expect(labelRows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Verify both endpoints present
      expect(graph).toContain('50%');
      expect(graph).toContain('59%');
    });
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
