import { readFile } from 'node:fs/promises';
import * as core from '@actions/core';
import { XMLParser } from 'fast-xml-parser';

/**
 * Coverage result from parsing Kover XML
 */
export interface CoverageResult {
  /** Number of covered instructions */
  covered: number;
  /** Number of missed instructions */
  missed: number;
  /** Total instructions (covered + missed) */
  total: number;
  /** Coverage percentage (0-100) */
  percentage: number;
}

// XML parser options with security settings
const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  parseAttributeValue: true,
  // Security: disable external entities to prevent XXE attacks
  allowBooleanAttributes: false,
  processEntities: false,
  // Set size limit to prevent XML bomb attacks (10MB)
  maxSize: 10 * 1024 * 1024,
};

/**
 * Parse Kover XML coverage file
 * Extracts INSTRUCTION coverage metrics from JaCoCo-compatible XML format
 * @param filePath Absolute path to Kover XML report
 * @returns Coverage result or null if file not found/invalid
 */
export async function parseCoverageFile(filePath: string): Promise<CoverageResult | null> {
  try {
    // Read XML file
    const xmlContent = await readFile(filePath, 'utf-8');

    if (!xmlContent || xmlContent.trim().length === 0) {
      core.warning(`Coverage file is empty: ${filePath}`);
      return null;
    }

    // Parse XML
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const parsedData = parser.parse(xmlContent);

    // Extract coverage from parsed XML
    const coverage = extractInstructionCounter(parsedData);

    if (coverage) {
      core.debug(
        `Parsed coverage from ${filePath}: ${coverage.percentage}% (${coverage.covered}/${coverage.total})`
      );
    } else {
      core.warning(`Could not extract INSTRUCTION counter from ${filePath}`);
    }

    return coverage;
  } catch (error) {
    // File not found is expected for parent modules
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      core.debug(`Coverage file not found (expected for parent modules): ${filePath}`);
      return null;
    }

    // Invalid XML or parsing errors
    core.warning(
      `Failed to parse coverage file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Extract INSTRUCTION counter from parsed XML data
 * @param xmlData Parsed XML object
 * @returns Coverage result or null if INSTRUCTION counter not found
 */
function extractInstructionCounter(xmlData: any): CoverageResult | null {
  try {
    // Navigate to report.counter (could be single object or array)
    const report = xmlData?.report;
    if (!report) {
      return null;
    }

    let counters = report.counter;
    if (!counters) {
      return null;
    }

    // Ensure counters is an array
    if (!Array.isArray(counters)) {
      counters = [counters];
    }

    // Find INSTRUCTION counter
    const instructionCounter = counters.find(
      (counter: any) => counter?.['@_type'] === 'INSTRUCTION'
    );

    if (!instructionCounter) {
      return null;
    }

    // Extract attributes
    const missed = Number.parseInt(instructionCounter['@_missed'] ?? '0', 10);
    const covered = Number.parseInt(instructionCounter['@_covered'] ?? '0', 10);
    const total = missed + covered;

    // Calculate percentage (handle division by zero)
    const percentage = total === 0 ? 0 : (covered / total) * 100;

    // Round to 1 decimal place
    const roundedPercentage = Math.round(percentage * 10) / 10;

    return {
      covered,
      missed,
      total,
      percentage: roundedPercentage,
    };
  } catch (error) {
    core.debug(
      `Error extracting INSTRUCTION counter: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
