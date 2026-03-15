import * as vscode from 'vscode';
import { AuthManager } from './services/authManager';
import { CacheManager } from './services/cacheManager';
import { GitHubClient } from './services/githubClient';
import { addTokenCommand, removeTokenCommand } from './commands/tokenCommands';
import { clearCacheCommand } from './commands/cacheCommands';

let outputChannel: vscode.LogOutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Awesome Coding Assistants', { log: true });
  context.subscriptions.push(outputChannel);

  outputChannel.info('Extension activated');

  // Initialize services
  const authManager = new AuthManager(context, outputChannel);
  const cacheManager = new CacheManager(context, outputChannel);
  // GitHubClient is created but not used until feature WPs wire it to tree/preview/install
  const _githubClient = new GitHubClient(authManager, cacheManager, outputChannel);

  // Wire real commands for token and cache management
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.addToken', () =>
      addTokenCommand(authManager),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.removeToken', () =>
      removeTokenCommand(authManager),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.clearCache', () =>
      clearCacheCommand(cacheManager),
    ),
  );

  // Stub commands for features not yet implemented
  const stubCommands: string[] = [
    'awesome-coding-assistants.refresh',
    'awesome-coding-assistants.preview',
    'awesome-coding-assistants.install',
    'awesome-coding-assistants.update',
    'awesome-coding-assistants.uninstall',
    'awesome-coding-assistants.checkUpdates',
    'awesome-coding-assistants.showAllTools',
  ];

  for (const commandId of stubCommands) {
    const disposable = vscode.commands.registerCommand(commandId, () => {
      outputChannel.info(`Command ${commandId} not yet implemented`);
    });
    context.subscriptions.push(disposable);
  }

  outputChannel.info('All commands registered');
}

export function deactivate(): void {
  // No cleanup required
}
