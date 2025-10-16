import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import type { Logger } from './common/logger';

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
 * @param logger Logger for output
 * @param filePath Absolute path to Kover XML report
 * @returns Coverage result or null if file not found/invalid
 */
export async function parseCoverageFile(
  logger: Logger,
  filePath: string
): Promise<CoverageResult | null> {
  try {
    // Read XML file
    const xmlContent = await readFile(filePath, 'utf-8');

    if (!xmlContent || xmlContent.trim().length === 0) {
      logger.warn(`Coverage file is empty: ${filePath}`);
      return null;
    }

    // Parse XML
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const parsedData = parser.parse(xmlContent);

    // Extract coverage from parsed XML
    const coverage = extractInstructionCounter(logger, parsedData);

    if (coverage) {
      logger.debug(
        `Parsed coverage from ${filePath}: ${coverage.percentage}% (${coverage.covered}/${coverage.total})`
      );
    } else {
      logger.warn(`Could not extract INSTRUCTION counter from ${filePath}`);
    }

    return coverage;
  } catch (error) {
    // File not found is expected for parent modules
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      logger.debug(`Coverage file not found (expected for parent modules): ${filePath}`);
      return null;
    }

    // Invalid XML or parsing errors
    logger.warn(
      `Failed to parse coverage file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Represents a parsed XML counter element
 */
interface XmlCounter {
  '@_type'?: string;
  '@_missed'?: string;
  '@_covered'?: string;
}

/**
 * Represents the parsed XML report structure
 */
interface XmlReport {
  report?: {
    counter?: XmlCounter | XmlCounter[];
  };
}

/**
 * Extract INSTRUCTION counter from parsed XML data
 * @param logger Logger for output
 * @param xmlData Parsed XML object
 * @returns Coverage result or null if INSTRUCTION counter not found
 */
function extractInstructionCounter(logger: Logger, xmlData: unknown): CoverageResult | null {
  try {
    // Type guard to check if xmlData has the expected structure
    if (!xmlData || typeof xmlData !== 'object') {
      return null;
    }

    const data = xmlData as XmlReport;
    const report = data.report;
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
      (counter: XmlCounter) => counter?.['@_type'] === 'INSTRUCTION'
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
    logger.debug(
      `Error extracting INSTRUCTION counter: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
