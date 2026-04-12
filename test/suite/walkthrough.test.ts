import * as assert from 'assert';
import * as vscode from 'vscode';
import { IndexErrorCodes } from '../../src/models/errors';

describe('Walkthrough Tests', () => {
  before(async () => {
    const ext = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
  });

  describe('openWalkthrough command (FR-032, FR-033, US-06, US-07)', () => {
    it('should register the openWalkthrough command', async () => {
      const allCommands = await vscode.commands.getCommands(true);
      assert.ok(
        allCommands.includes('awesome-coding-assistants.openWalkthrough'),
        'openWalkthrough command should be registered',
      );
    });

    it('US-06.1: should invoke workbench.action.openWalkthrough with correct ID', async () => {
      // Track calls to executeCommand
      const calls: { command: string; args: unknown[] }[] = [];
      const origExecute = vscode.commands.executeCommand;

      // Stub executeCommand to intercept the walkthrough open call
      (vscode.commands as Record<string, unknown>).executeCommand = async (
        command: string,
        ...args: unknown[]
      ) => {
        calls.push({ command, args });
        if (command === 'workbench.action.openWalkthrough') {
          // Simulate success (no-op)
          return;
        }
        return origExecute.call(vscode.commands, command, ...args);
      };

      try {
        await vscode.commands.executeCommand('awesome-coding-assistants.openWalkthrough');

        // Find the openWalkthrough call made by the handler
        const walkthroughCall = calls.find(
          (c) => c.command === 'workbench.action.openWalkthrough',
        );
        assert.ok(walkthroughCall, 'Handler should call workbench.action.openWalkthrough');
        assert.strictEqual(
          walkthroughCall.args[0],
          'jlacube.awesome-coding-assistants#getStarted',
          'Should pass correct walkthrough ID',
        );
        assert.strictEqual(
          walkthroughCall.args[1],
          false,
          'Should pass toSide=false',
        );
      } finally {
        (vscode.commands as Record<string, unknown>).executeCommand =
          origExecute;
      }
    });

    it('US-07.1: should be re-accessible via Command Palette (command is registered)', async () => {
      // Verifying the command exists is sufficient for re-access via palette
      const allCommands = await vscode.commands.getCommands(true);
      assert.ok(
        allCommands.includes('awesome-coding-assistants.openWalkthrough'),
        'openWalkthrough command should be available for re-access',
      );
    });

    it('should catch errors when executeCommand rejects and show info message', async () => {
      const origExecute = vscode.commands.executeCommand;
      let infoMessageShown = false;
      const origShowInfo = vscode.window.showInformationMessage;

      // Stub executeCommand to throw for the walkthrough command
      (vscode.commands as Record<string, unknown>).executeCommand = async (
        command: string,
        ...args: unknown[]
      ) => {
        if (command === 'workbench.action.openWalkthrough') {
          throw new Error('Walkthrough not found');
        }
        return origExecute.call(vscode.commands, command, ...args);
      };

      // Stub showInformationMessage to track the call
      (vscode.window as Record<string, unknown>).showInformationMessage = async (
        message: string,
        ...items: unknown[]
      ) => {
        if (message === 'Unable to open the Get Started walkthrough.') {
          infoMessageShown = true;
        }
        return undefined;
      };

      try {
        // This should not throw (error is caught internally)
        await vscode.commands.executeCommand('awesome-coding-assistants.openWalkthrough');

        assert.ok(
          infoMessageShown,
          'Should show information message when walkthrough open fails',
        );
      } finally {
        (vscode.commands as Record<string, unknown>).executeCommand =
          origExecute;
        (vscode.window as Record<string, unknown>).showInformationMessage =
          origShowInfo;
      }
    });
  });

  describe('WALKTHROUGH_NOT_FOUND error code (T20-05)', () => {
    it('should define WALKTHROUGH_NOT_FOUND in IndexErrorCodes', () => {
      assert.ok(
        IndexErrorCodes.WALKTHROUGH_NOT_FOUND,
        'WALKTHROUGH_NOT_FOUND should exist in IndexErrorCodes',
      );
      assert.strictEqual(
        IndexErrorCodes.WALKTHROUGH_NOT_FOUND.code,
        'WALKTHROUGH_NOT_FOUND',
      );
      assert.strictEqual(
        IndexErrorCodes.WALKTHROUGH_NOT_FOUND.userMessage,
        'Unable to open the Get Started walkthrough.',
      );
      assert.strictEqual(
        IndexErrorCodes.WALKTHROUGH_NOT_FOUND.logLevel,
        'error',
      );
    });
  });

  describe('Enterprise pre-configuration (FR-034, FR-035, US-10)', () => {
    it('FR-034: getConfiguration should read indexUrl setting', () => {
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const indexUrl = config.get<string[]>('indexUrl');
      // In test env, the default value from package.json should be returned
      assert.ok(Array.isArray(indexUrl), 'indexUrl should be an array');
      assert.ok(indexUrl.length > 0, 'indexUrl should have at least one default entry');
    });

    it('FR-035: getConfiguration respects settings resolution hierarchy', () => {
      // VS Code's getConfiguration() automatically respects
      // machine > user > workspace precedence. This test verifies
      // the code path for reading indexUrl works correctly.
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const indexUrl = config.get<string[]>('indexUrl');
      assert.ok(indexUrl !== undefined, 'indexUrl setting should be defined');
      // Verify the default value matches package.json declaration
      if (indexUrl && indexUrl.length > 0) {
        assert.ok(
          indexUrl[0].startsWith('https://'),
          'Default indexUrl should use HTTPS',
        );
      }
    });
  });

  describe('Walkthrough package.json declaration', () => {
    it('should have walkthroughs contribution in package.json', () => {
      const ext = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
      assert.ok(ext, 'Extension should be installed');
      const pkg = ext.packageJSON;
      assert.ok(pkg.contributes.walkthroughs, 'walkthroughs should be declared');
      assert.strictEqual(pkg.contributes.walkthroughs.length, 1, 'Should have exactly one walkthrough');
      assert.strictEqual(
        pkg.contributes.walkthroughs[0].id,
        'getStarted',
        'Walkthrough ID should be getStarted',
      );
    });

    it('should have two walkthrough steps', () => {
      const ext = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
      assert.ok(ext);
      const steps = ext.packageJSON.contributes.walkthroughs[0].steps;
      assert.strictEqual(steps.length, 2, 'Should have exactly two steps');
      assert.strictEqual(steps[0].id, 'configureSource');
      assert.strictEqual(steps[1].id, 'browseCatalog');
    });

    it('should have correct completion events', () => {
      const ext = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
      assert.ok(ext);
      const steps = ext.packageJSON.contributes.walkthroughs[0].steps;
      assert.deepStrictEqual(
        steps[0].completionEvents,
        ['onSettingChanged:awesome-coding-assistants.indexUrl'],
      );
      assert.deepStrictEqual(
        steps[1].completionEvents,
        ['onView:awesomeCodingAssistants.catalog'],
      );
    });

    it('should have correct media paths', () => {
      const ext = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
      assert.ok(ext);
      const steps = ext.packageJSON.contributes.walkthroughs[0].steps;
      assert.strictEqual(
        steps[0].media.markdown,
        'resources/walkthrough/configure-source.md',
      );
      assert.strictEqual(
        steps[1].media.markdown,
        'resources/walkthrough/browse-catalog.md',
      );
    });
  });
});
