import * as vscode from 'vscode';
import { AuthManager } from './services/authManager';
import { CacheManager } from './services/cacheManager';
import { GitHubClient } from './services/githubClient';
import { SourceRegistry } from './services/sourceRegistry';
import { CatalogTreeProvider } from './providers/catalogTree';
import { PreviewProvider, PREVIEW_SCHEME } from './providers/previewProvider';
import { previewCommand } from './commands/previewCommand';
import { installCommand } from './commands/installCommand';
import { checkUpdatesCommand } from './commands/checkUpdatesCommand';
import { updateCommand } from './commands/updateCommand';
import { uninstallCommand } from './commands/uninstallCommand';
import { addTokenCommand, removeTokenCommand } from './commands/tokenCommands';
import { clearCacheCommand } from './commands/cacheCommands';
import { Installer } from './services/installer';
import { ManifestManager } from './services/manifestManager';
import { LifecycleManager } from './services/lifecycle';
import type { CatalogFileItem, SourceConfig } from './models/types';

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
          previewProvider.clearCache();
          await sourceRegistry.loadMasterIndex();
          catalogTreeProvider.refresh();
          updateNoSourcesContext();
        },
      );
    }),
  );

  // Build a source lookup map for PreviewProvider
  const getSourceMap = (): Map<string, SourceConfig> => {
    const sources = sourceRegistry.getSources();
    const map = new Map<string, SourceConfig>();
    for (const s of sources) {
      map.set(s.url, s);
    }
    return map;
  };

  // Register PreviewProvider (FR-019: TextDocumentContentProvider with scheme awesome-ca-preview)
  const previewProvider = new PreviewProvider(githubClient, outputChannel, getSourceMap);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewProvider),
  );

  // Preview command (FR-016, T04-04)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.preview', (item?: CatalogFileItem) => {
      if (!item || item.kind !== 'item') {
        outputChannel.info('Preview command invoked without a valid catalog item');
        return;
      }
      return previewCommand(item, githubClient, outputChannel, (source) =>
        catalogTreeProvider.getOrFetchTreePublic(source),
      );
    }),
  );

  // Initialize installer, manifest manager, and lifecycle manager (WP05, WP06)
  const installer = new Installer(githubClient, outputChannel);
  const manifestManager = new ManifestManager(outputChannel);
  const lifecycleManager = new LifecycleManager(
    githubClient, manifestManager, installer, outputChannel,
  );

  // Inject lifecycle dependencies into tree provider for installed/update badges
  catalogTreeProvider.setLifecycle(manifestManager, lifecycleManager);

  // Install command (FR-020, T05-07)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.install', (item?: CatalogFileItem) => {
      if (!item || item.kind !== 'item') {
        outputChannel.info('Install command invoked without a valid catalog item');
        return;
      }
      return installCommand(
        item,
        installer,
        githubClient,
        manifestManager,
        outputChannel,
        () => catalogTreeProvider.refresh(),
        (source) => catalogTreeProvider.getOrFetchTreePublic(source),
      );
    }),
  );

  // Check for Updates command (FR-032, T06-04)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.checkUpdates', () =>
      checkUpdatesCommand(
        lifecycleManager,
        () => catalogTreeProvider.refresh(),
        outputChannel,
      ),
    ),
  );

  // Update command (FR-031, T06-05)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.update', (item?: CatalogFileItem) => {
      if (!item || item.kind !== 'item') {
        outputChannel.info('Update command invoked without a valid catalog item');
        return;
      }
      return updateCommand(
        item,
        lifecycleManager,
        manifestManager,
        () => catalogTreeProvider.refresh(),
        outputChannel,
      );
    }),
  );

  // Uninstall command (FR-033, T06-06)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.uninstall', (item?: CatalogFileItem) => {
      if (!item || item.kind !== 'item') {
        outputChannel.info('Uninstall command invoked without a valid catalog item');
        return;
      }
      return uninstallCommand(
        item,
        lifecycleManager,
        manifestManager,
        () => catalogTreeProvider.refresh(),
        outputChannel,
      );
    }),
  );

  // Auto-check updates on activation (T06-08)
  const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
  let autoCheckInterval: ReturnType<typeof setInterval> | undefined;

  const scheduleAutoCheck = (): void => {
    if (autoCheckInterval) {
      clearInterval(autoCheckInterval);
      autoCheckInterval = undefined;
    }

    const cfg = vscode.workspace.getConfiguration('awesome-coding-assistants');
    const autoCheck = cfg.get<boolean>('autoCheckUpdates', true);
    if (!autoCheck) {
      return;
    }

    const intervalMin = cfg.get<number>('autoCheckIntervalMinutes', 60);
    const intervalMs = Math.max(5, Math.min(1440, intervalMin)) * 60 * 1000;

    autoCheckInterval = setInterval(async () => {
      try {
        const results = await lifecycleManager.checkForUpdates();
        const updateCount = results.filter(r => r.hasUpdate).length;
        if (updateCount > 0) {
          catalogTreeProvider.refresh();
          vscode.window.showInformationMessage(
            `${updateCount} update${updateCount > 1 ? 's' : ''} available.`,
          );
        }
      } catch (err) {
        outputChannel.warn(`Auto update check failed: ${err}`);
      }
    }, intervalMs);
  };

  // Initial auto-check with 5-second delay to not block startup
  if (config.get<boolean>('autoCheckUpdates', true)) {
    const initialDelay = setTimeout(async () => {
      try {
        const results = await lifecycleManager.checkForUpdates();
        const updateCount = results.filter(r => r.hasUpdate).length;
        if (updateCount > 0) {
          catalogTreeProvider.refresh();
          vscode.window.showInformationMessage(
            `${updateCount} update${updateCount > 1 ? 's' : ''} available.`,
          );
        }
      } catch (err) {
        outputChannel.warn(`Initial update check failed: ${err}`);
      }
    }, 5000);
    context.subscriptions.push({ dispose: () => clearTimeout(initialDelay) });
  }

  scheduleAutoCheck();

  // Re-schedule on config change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('awesome-coding-assistants.autoCheckUpdates') ||
          e.affectsConfiguration('awesome-coding-assistants.autoCheckIntervalMinutes')) {
        scheduleAutoCheck();
      }
    }),
  );

  // Cleanup interval on deactivation
  context.subscriptions.push({ dispose: () => { if (autoCheckInterval) { clearInterval(autoCheckInterval); } } });

  // Stub commands for features not yet implemented
  const stubCommands: string[] = [
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
