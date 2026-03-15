import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  it('should be present', () => {
    const extension = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
    assert.ok(extension, 'Extension should be installed');
  });

  it('should export activate and deactivate', async () => {
    const extension = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
    assert.ok(extension, 'Extension should be installed');

    await extension.activate();
    assert.strictEqual(typeof extension.isActive, 'boolean');
    assert.ok(extension.isActive, 'Extension should be active after activation');
  });

  it('should register all commands', async () => {
    const allCommands = await vscode.commands.getCommands(true);
    const expectedCommands = [
      'awesome-coding-assistants.refresh',
      'awesome-coding-assistants.preview',
      'awesome-coding-assistants.install',
      'awesome-coding-assistants.update',
      'awesome-coding-assistants.uninstall',
      'awesome-coding-assistants.checkUpdates',
      'awesome-coding-assistants.addToken',
      'awesome-coding-assistants.removeToken',
      'awesome-coding-assistants.clearCache',
      'awesome-coding-assistants.showAllTools',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(allCommands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });
});
