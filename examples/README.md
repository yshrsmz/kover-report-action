# Example Usage

This directory contains example workflows demonstrating how to use the Kover Report Action.

## Basic Usage

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

## With Coverage Threshold

```yaml
- name: Check coverage threshold
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-file: 'build/reports/kover/report.xml'
    min-coverage: '90'  # Fail if below 90%
```

## Using Outputs

```yaml
- name: Generate coverage report
  id: coverage
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-file: 'build/reports/kover/report.xml'

- name: Comment on PR
  uses: actions/github-script@v7
  with:
    script: |
      const coverage = '${{ steps.coverage.outputs.coverage-percentage }}';
      const covered = '${{ steps.coverage.outputs.lines-covered }}';
      const total = '${{ steps.coverage.outputs.lines-total }}';
      
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `## Coverage Report\n\n📊 Coverage: ${coverage}%\n📈 Lines: ${covered}/${total}`
      });
```

## Multi-Module Project

```yaml
- name: Coverage for module A
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-file: 'moduleA/build/reports/kover/report.xml'
    title: 'Module A Coverage'
    min-coverage: '75'

- name: Coverage for module B
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-file: 'moduleB/build/reports/kover/report.xml'
    title: 'Module B Coverage'
    min-coverage: '80'
```

## With Coverage History & Trends

```yaml
- name: Generate coverage report with history
  uses: yshrsmz/kover-report-action@v1
  with:
    coverage-files: '**/build/reports/kover/report.xml'
    min-coverage: '70'
    github-token: ${{ secrets.GITHUB_TOKEN }}

    # Enable history tracking
    enable-history: 'true'
    baseline-branch: 'main'      # Compare against main branch
    history-retention: '50'       # Keep last 50 entries
```

This will:
- Track coverage history across workflow runs
- Show trend indicators (↑↓→) in PR comments
- Compare current coverage against baseline branch
- Store history in GitHub Artifacts (90-day retention)

**Note:** Requires `actions: write` permission:

```yaml
permissions:
  contents: read
  pull-requests: write
  actions: write  # Required for artifacts
```

## Example Files

This directory contains complete workflow examples:

- [`single-module.yml`](single-module.yml) - Simple single-module project
- [`multi-module-glob.yml`](multi-module-glob.yml) - Multi-module with glob pattern discovery
- [`multi-module-gradle.yml`](multi-module-gradle.yml) - Multi-module with Gradle discovery
- [`advanced-with-outputs.yml`](advanced-with-outputs.yml) - Using action outputs in subsequent steps
- [`with-history.yml`](with-history.yml) - Coverage history and trend tracking
