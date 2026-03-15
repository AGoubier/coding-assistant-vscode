// Custom coverage report script for VS Code extension tests
// c8 can't process Inspector-collected V8 coverage from the extension host
// so we use v8-to-istanbul and istanbul-lib-* directly

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function main() {
  const V8ToIstanbul = require('v8-to-istanbul');
  const libCoverage = require('istanbul-lib-coverage');
  const libReport = require('istanbul-lib-report');
  const reports = require('istanbul-reports');

  const coverageDir = path.resolve(__dirname, '..', '.coverage-tmp');
  const reportsDir = path.resolve(__dirname, '..', 'coverage');

  // Read all coverage JSON files from the temp directory
  const files = fs.readdirSync(coverageDir).filter(f => f.endsWith('.json'));
  const map = libCoverage.createCoverageMap({});

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(coverageDir, file), 'utf8'));
    if (!data.result) continue;

    // Only process entries for our source files
    const srcEntries = data.result.filter(
      e => e.url && e.url.startsWith('file:') && e.url.includes('out/src'),
    );

    for (const entry of srcEntries) {
      try {
        const converter = new V8ToIstanbul(entry.url);
        await converter.load();
        converter.applyCoverage(entry.functions);
        map.merge(converter.toIstanbul());
      } catch {
        // Skip entries that can't be processed (e.g., missing source maps)
      }
    }
  }

  // Generate reports
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const context = libReport.createContext({
    dir: reportsDir,
    coverageMap: map,
    defaultSummarizer: 'nested',
  });

  // Text report to stdout
  reports.create('text').execute(context);
  // LCOV report for CI
  reports.create('lcov').execute(context);

  // Check thresholds
  const summary = map.getCoverageSummary();
  const thresholds = { lines: 80, branches: 80, functions: 80, statements: 80 };
  let failed = false;

  for (const [metric, min] of Object.entries(thresholds)) {
    const pct = summary[metric].pct;
    if (pct < min) {
      console.error(`ERROR: Coverage for ${metric} (${pct}%) does not meet threshold (${min}%)`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('Coverage thresholds met.');
}

main().catch(err => {
  console.error('Coverage report failed:', err);
  process.exit(1);
});
