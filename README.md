# kover-report-action

A GitHub Action for generating and reporting Kover coverage reports. This action helps you track code coverage for your Kotlin projects using Kover.

## Features

- 📊 Parse Kover XML coverage reports
- ✅ Set minimum coverage thresholds
- 📈 Output coverage metrics
- 🎯 Fail builds on insufficient coverage
- 🚀 Built with TypeScript and Node.js

## Usage

### Basic Example

```yaml
name: Coverage Report

on:
  pull_request:
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up JDK
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      
      - name: Run tests with Kover
        run: ./gradlew koverXmlReport
      
      - name: Generate coverage report
        uses: yshrsmz/kover-report-action@v1
        with:
          coverage-file: 'build/reports/kover/report.xml'
          min-coverage: '80'
          title: 'Code Coverage Report'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `coverage-file` | Path to the Kover XML coverage report file | Yes | `build/reports/kover/report.xml` |
| `min-coverage` | Minimum coverage percentage required (0-100) | No | `0` |
| `title` | Title for the coverage report comment | No | `Code Coverage Report` |

## Outputs

| Output | Description |
|--------|-------------|
| `coverage-percentage` | Overall coverage percentage |
| `lines-covered` | Number of lines covered |
| `lines-total` | Total number of lines |

### Using Outputs

```yaml
- name: Generate coverage report
  id: coverage
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-file: 'build/reports/kover/report.xml'

- name: Display coverage
  run: |
    echo "Coverage: ${{ steps.coverage.outputs.coverage-percentage }}%"
    echo "Lines covered: ${{ steps.coverage.outputs.lines-covered }}/${{ steps.coverage.outputs.lines-total }}"
```

## Development

### Prerequisites

- Node.js 20.x or higher
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Format code
pnpm run format

# Lint code
pnpm run lint

# Build the action
pnpm run build

# Run all checks
pnpm run all
```

### Project Structure

```
.
├── src/
│   └── index.ts          # Main action code
├── dist/
│   └── index.js          # Compiled action (committed)
├── action.yml            # Action metadata
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.js          # ESLint configuration
├── .prettierrc.json      # Prettier configuration
└── package.json          # Node.js dependencies
```

### Building

The action uses [@vercel/ncc](https://github.com/vercel/ncc) to compile the TypeScript code and all dependencies into a single JavaScript file:

```bash
pnpm run build
```

This creates `dist/index.js` which should be committed to the repository.

## License

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

