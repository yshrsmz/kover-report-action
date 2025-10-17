# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

### Added

#### Core Features
- Multi-module Kover coverage report support
- Flexible module discovery via command-based (Gradle) or glob pattern
- Configurable per-module-type and per-module-name threshold configuration
- Weighted coverage aggregation across multiple modules
- GitHub Actions outputs for coverage data integration

#### Reporting & PR Integration
- Automatic PR comment posting with coverage reports
- Markdown table format with status indicators (✅❌⚠️)
- Comment update functionality (no duplicate comments)
- Customizable report titles
- Console report output for action logs

#### Coverage History & Trends
- Coverage history tracking with GitHub Artifacts storage
- Trend indicators showing coverage changes (↑↓→)
- Baseline branch comparison (e.g., compare PR vs main)
- Configurable history retention (default: 50 entries)
- ASCII graph visualization for coverage trends
- Historical data persists with 90-day artifact retention

#### Security & Validation
- Path traversal attack prevention
- Command injection prevention
- Input validation for all action inputs
- Token masking in logs
- Safe file path handling

#### Developer Experience
- Comprehensive test suite with 188+ tests
- TDD approach with >90% code coverage
- Debug mode with detailed logging
- Clear error messages with actionable suggestions
- TypeScript with strict type checking

### Configuration Options

#### Inputs
- `discovery-command` - Command for module discovery
- `coverage-files` - Glob pattern for coverage files
- `module-path-template` - Path template with {module} placeholder
- `ignore-modules` - Comma-separated list of modules to ignore
- `thresholds` - JSON object for threshold configuration
- `min-coverage` - Global minimum coverage requirement
- `github-token` - Token for PR comments
- `title` - Report title customization
- `enable-pr-comment` - Toggle PR comment posting
- `enable-history` - Enable coverage history tracking
- `baseline-branch` - Branch for trend comparison
- `history-retention` - Number of history entries to keep
- `debug` - Enable debug logging

#### Outputs
- `coverage-percentage` - Overall coverage percentage
- `instructions-covered` - Total instructions covered
- `instructions-total` - Total instructions
- `modules-coverage-json` - Per-module coverage data
- `modules-below-threshold` - List of failing modules

### Documentation
- Comprehensive README with quick start guides
- Example workflows for common use cases
- Troubleshooting guide
- CONTRIBUTING guide for developers
- Detailed threshold configuration documentation

### Performance
- Parallel XML parsing for multiple modules
- Efficient GitHub Artifacts caching
- Bundle size: ~5MB (includes all dependencies)
- Fast execution: <30 seconds for 20+ modules

### Technical Implementation
- Built with TypeScript 5.9+
- Bundled with @vercel/ncc for single-file distribution
- Uses Biome for linting and formatting
- Vitest for testing with comprehensive fixtures
- Node.js 24 runtime

[Unreleased]: https://github.com/yshrsmz/kover-report-action/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yshrsmz/kover-report-action/releases/tag/v1.0.0
