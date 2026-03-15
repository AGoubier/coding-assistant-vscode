import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Write coverage dir path to a marker file the extension host can read
    const coverageDir = path.resolve(extensionDevelopmentPath, '.coverage-tmp');
    const markerFile = path.resolve(extensionDevelopmentPath, '.coverage-marker');
    if (process.env.NODE_V8_COVERAGE) {
      fs.writeFileSync(markerFile, coverageDir, 'utf-8');
    } else {
      // Clean up marker so the extension host doesn't collect coverage
      if (fs.existsSync(markerFile)) {
        fs.unlinkSync(markerFile);
      }
    }

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
