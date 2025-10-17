import { describe, expect, it } from 'vitest';
import {
  generateCompactTrendGraph,
  generateCoverageTrendGraph,
  generateModuleTrendGraph,
  type TrendData,
} from '../reporter/graphs';

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

    expect(graph).toContain('85.0%');
    expect(graph).toContain('All values');
  });
});

describe('generateModuleTrendGraph', () => {
  it('should generate graph for specific module', () => {
    const data: TrendData[] = [
      { label: 'Jan 10', value: 75.0 },
      { label: 'Jan 11', value: 78.0 },
      { label: 'Jan 12', value: 80.0 },
    ];

    const graph = generateModuleTrendGraph(data, ':core:common');

    expect(graph).toContain(':core:common');
    expect(graph).toContain('75%'); // Y-axis shows rounded percentages
    expect(graph).toContain('80%');
  });

  it('should handle module with no data', () => {
    const graph = generateModuleTrendGraph([], ':new:module');

    expect(graph).toContain(':new:module');
    expect(graph).toContain('No history');
  });
});

describe('generateCompactTrendGraph', () => {
  it('should generate compact sparkline-style graph', () => {
    const data: TrendData[] = [
      { label: '', value: 80.0 },
      { label: '', value: 82.0 },
      { label: '', value: 85.0 },
      { label: '', value: 83.0 },
      { label: '', value: 87.0 },
    ];

    const graph = generateCompactTrendGraph(data);

    // Should be compact (single line or few lines)
    const lines = graph.split('\n');
    expect(lines.length).toBeLessThanOrEqual(3);

    // Should contain trend indicators
    expect(graph.length).toBeGreaterThan(0);
  });

  it('should use sparkline characters for compact display', () => {
    const data: TrendData[] = [
      { label: '', value: 70 },
      { label: '', value: 75 },
      { label: '', value: 80 },
      { label: '', value: 85 },
      { label: '', value: 90 },
    ];

    const graph = generateCompactTrendGraph(data);

    // Should contain block characters or similar for sparkline
    expect(graph).toMatch(/[▁▂▃▄▅▆▇█]/g);
  });

  it('should handle empty data', () => {
    const graph = generateCompactTrendGraph([]);
    expect(graph).toBe('');
  });

  it('should handle single point', () => {
    const data: TrendData[] = [{ label: '', value: 85.0 }];

    const graph = generateCompactTrendGraph(data);

    expect(graph).toMatch(/[▁▂▃▄▅▆▇█]/);
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
