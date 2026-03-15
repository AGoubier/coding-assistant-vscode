import * as vscode from 'vscode';
import { AuthManager } from './services/authManager';
import { CacheManager } from './services/cacheManager';
import { GitHubClient } from './services/githubClient';
import { SourceRegistry } from './services/sourceRegistry';
import { CatalogTreeProvider } from './providers/catalogTree';
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
  const githubClient = new GitHubClient(authManager, cacheManager, outputChannel);
  const sourceRegistry = new SourceRegistry(githubClient, outputChannel);
  context.subscriptions.push(sourceRegistry);

  // Initialize tree view provider
  const catalogTreeProvider = new CatalogTreeProvider(
    sourceRegistry,
    githubClient,
    outputChannel,
    context.extensionUri,
  );
  context.subscriptions.push(catalogTreeProvider);

  // Register tree view using createTreeView for programmatic access
  const treeView = vscode.window.createTreeView('awesomeCodingAssistants.catalog', {
    treeDataProvider: catalogTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Set initial noSources context key for welcome view
  const updateNoSourcesContext = (): void => {
    const sources = sourceRegistry.getSources();
    vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.noSources', sources.length === 0);
  };
  updateNoSourcesContext();

  // Update context key when sources change
  sourceRegistry.onDidChange(() => {
    updateNoSourcesContext();
    catalogTreeProvider.refresh();
  });

  // Load master index on activation
  sourceRegistry.loadMasterIndex().then(() => {
    updateNoSourcesContext();
    catalogTreeProvider.refresh();
  }).catch(err => {
    outputChannel.warn(`Master index load failed: ${err}`);
  });

  // Wire real commands for token and cache management
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.addToken', (arg?: string) =>
      addTokenCommand(authManager, arg),
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

  // Refresh command (T03-06): invalidate caches and reload tree
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.refresh', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Refreshing sources...' },
        async () => {
          await cacheManager.invalidate();
          sourceRegistry.invalidateCache();
          await sourceRegistry.loadMasterIndex();
          catalogTreeProvider.refresh();
          updateNoSourcesContext();
        },
      );
    }),
  );

  // Stub commands for features not yet implemented
  const stubCommands: string[] = [
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
