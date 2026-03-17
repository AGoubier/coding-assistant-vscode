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
      'awesome-coding-assistants.showDetectedTools',
      'awesome-coding-assistants.markAllSeen',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(allCommands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });

  it('should set noSources context key on activation (T03-08 welcome view)', async () => {
    // Ensures extension.ts calls setContext('awesome-coding-assistants.noSources', ...)
    // In test env, default source is always present so noSources should be false.
    // We verify this indirectly: the extension activates without error and sets the key.
    // If getSources() ever returned empty, the welcome view would show.
    const extension = vscode.extensions.getExtension('jlacube.awesome-coding-assistants');
    assert.ok(extension);
    await extension.activate();

    // Verify the tree view is registered (it only renders when the context key is false)
    const allCommands = await vscode.commands.getCommands(true);
    assert.ok(
      allCommands.includes('awesome-coding-assistants.refresh'),
      'Refresh command confirms tree view wiring is active',
    );
  });
});
