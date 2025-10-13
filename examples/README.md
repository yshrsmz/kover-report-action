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
