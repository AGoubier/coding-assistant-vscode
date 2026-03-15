import * as path from 'path';
import * as fs from 'fs';
import Mocha from 'mocha';
import { glob } from 'glob';
import { Session } from 'inspector';

// Determine coverage output directory from marker file written by runTest.ts
function getCoverageDir(): string | undefined {
  const markerFile = path.resolve(__dirname, '../../../.coverage-marker');
  if (fs.existsSync(markerFile)) {
    return fs.readFileSync(markerFile, 'utf-8').trim();
  }
  return undefined;
}

// Collect V8 coverage inside the VS Code extension host process
// so that c8 can report accurate numbers despite process isolation.
async function startCoverage(): Promise<Session | undefined> {
  const coverageDir = getCoverageDir();
  if (!coverageDir) {
    return undefined;
  }
  const session = new Session();
  session.connect();
  await new Promise<void>((res, rej) =>
    session.post('Profiler.enable', (err) => (err ? rej(err) : res())),
  );
  await new Promise<void>((res, rej) =>
    session.post(
      'Profiler.startPreciseCoverage',
      { callCount: true, detailed: true },
      (err) => (err ? rej(err) : res()),
    ),
  );
  return session;
}

async function stopCoverage(session: Session | undefined): Promise<void> {
  const coverageDir = getCoverageDir();
  if (!session || !coverageDir) {
    return;
  }
  const coverage = await new Promise<{result: unknown[]}>((res, rej) =>
    session.post('Profiler.takePreciseCoverage', (err, params) =>
      err ? rej(err) : res(params as {result: unknown[]}),
    ),
  );
  await new Promise<void>((res, rej) =>
    session.post('Profiler.stopPreciseCoverage', (err) => (err ? rej(err) : res())),
  );
  await new Promise<void>((res, rej) =>
    session.post('Profiler.disable', (err) => (err ? rej(err) : res())),
  );
  session.disconnect();

  // Write coverage in the format c8 expects
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }
  const filename = `coverage-${process.pid}-${Date.now()}-0.json`;
  fs.writeFileSync(
    path.join(coverageDir, filename),
    JSON.stringify(coverage),
  );
}

export async function run(): Promise<void> {
  const session = await startCoverage();

  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 10000,
  });

  const testsRoot = path.resolve(__dirname, '.');
  const files = await glob('**/*.test.js', { cwd: testsRoot });

  for (const f of files) {
    mocha.addFile(path.resolve(testsRoot, f));
  }

  await mocha.loadFilesAsync();

  return new Promise<void>((resolve, reject) => {
    mocha.run(async (failures) => {
      try {
        await stopCoverage(session);
      } catch (e) {
        console.error('Coverage collection failed:', e);
      }
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
