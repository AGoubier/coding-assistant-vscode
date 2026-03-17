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
import { installBundleCommand } from './commands/installBundleCommand';
import { Installer } from './services/installer';
import { ManifestManager } from './services/manifestManager';
import { LifecycleManager } from './services/lifecycle';
import { NewContentDetector } from './services/newContentDetector';
import type { CatalogFileItem, BundleNodeItem, SourceConfig } from './models/types';

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
  context.subscriptions.push(githubClient);

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

  // Register the same tree in the Explorer panel
  const explorerTreeView = vscode.window.createTreeView('awesomeCodingAssistants.explorerCatalog', {
    treeDataProvider: catalogTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(explorerTreeView);

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

  // Initialize new-content detector (WP13)
  const newContentDetector = new NewContentDetector(context.globalState, outputChannel);
  catalogTreeProvider.setNewContentDetector(newContentDetector);

  // Track last update count for badge computation
  let lastUpdateCount = 0;

  // Helper: update TreeView badge with combined new + update counts (Section 4.12)
  const updateTreeBadge = (): void => {
    const newCount = newContentDetector.getTotalNewCount();
    const removedCount = newContentDetector.getTotalRemovedCount();
    const totalNew = newCount + removedCount;
    const total = totalNew + lastUpdateCount;

    const badge = total === 0 ? undefined : {
      value: total,
      tooltip: totalNew > 0 && lastUpdateCount > 0
        ? `${totalNew} new, ${lastUpdateCount} updates`
        : totalNew > 0
          ? `${totalNew} new item${totalNew > 1 ? 's' : ''}`
          : `${lastUpdateCount} update${lastUpdateCount > 1 ? 's' : ''} available`,
    };

    treeView.badge = badge;
    explorerTreeView.badge = badge;
    vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.hasNewContent', totalNew > 0);
  };

  // Wire badge update callback for category expand (FR-023)
  catalogTreeProvider.setOnNewContentChanged(updateTreeBadge);

  // Helper: set hasInstalledItems context based on current manifest state
  const updateHasInstalledContext = async (): Promise<void> => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    let hasInstalled = false;
    for (const folder of folders) {
      const manifest = await manifestManager.readManifest(folder);
      if (manifest.installations.length > 0) {
        hasInstalled = true;
        break;
      }
    }
    await vscode.commands.executeCommand(
      'setContext', 'awesome-coding-assistants.hasInstalledItems', hasInstalled,
    );
  };

  // Set initial context value
  void updateHasInstalledContext();

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
        () => { catalogTreeProvider.refresh(); updateTreeBadge(); void updateHasInstalledContext(); },
        (source) => catalogTreeProvider.getOrFetchTreePublic(source),
      );
    }),
  );

  // Check for Updates command (FR-032, T06-04)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.checkUpdates', () =>
      checkUpdatesCommand(
        lifecycleManager,
        () => { catalogTreeProvider.refresh(); updateTreeBadge(); },
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
        () => { catalogTreeProvider.refresh(); updateTreeBadge(); void updateHasInstalledContext(); },
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
        () => { catalogTreeProvider.refresh(); updateTreeBadge(); void updateHasInstalledContext(); },
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
        lastUpdateCount = updateCount;

        // New content detection (FR-002, FR-029)
        let newContentCount = 0;
        const cfg2 = vscode.workspace.getConfiguration('awesome-coding-assistants');
        if (cfg2.get<boolean>('newContentDetection', true)) {
          const sources = sourceRegistry.getSources();
          for (const source of sources) {
            try {
              const tree = await catalogTreeProvider.getOrFetchTreePublic(source);
              const result = await newContentDetector.checkForNewContent(
                source.url, tree.tree, tree.truncated,
              );
              newContentCount += result.newPaths.length;
            } catch (err) {
              outputChannel.warn(`New content check failed for ${source.url}: ${err}`);
            }
          }
        }

        if (updateCount > 0 || newContentCount > 0) {
          catalogTreeProvider.refresh();
          updateTreeBadge();
          const parts: string[] = [];
          if (newContentCount > 0) {
            parts.push(`${newContentCount} new item${newContentCount > 1 ? 's' : ''}`);
          }
          if (updateCount > 0) {
            parts.push(`${updateCount} update${updateCount > 1 ? 's' : ''} available`);
          }
          vscode.window.showInformationMessage(parts.join(', ') + '.');
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
        lastUpdateCount = updateCount;

        // New content detection (FR-002, FR-029)
        let newContentCount = 0;
        const cfg = vscode.workspace.getConfiguration('awesome-coding-assistants');
        if (cfg.get<boolean>('newContentDetection', true)) {
          const sources = sourceRegistry.getSources();
          for (const source of sources) {
            try {
              const tree = await catalogTreeProvider.getOrFetchTreePublic(source);
              const result = await newContentDetector.checkForNewContent(
                source.url, tree.tree, tree.truncated,
              );
              newContentCount += result.newPaths.length;
            } catch (err) {
              outputChannel.warn(`New content check failed for ${source.url}: ${err}`);
            }
          }
        }

        if (updateCount > 0 || newContentCount > 0) {
          catalogTreeProvider.refresh();
          updateTreeBadge();
          const parts: string[] = [];
          if (newContentCount > 0) {
            parts.push(`${newContentCount} new item${newContentCount > 1 ? 's' : ''}`);
          }
          if (updateCount > 0) {
            parts.push(`${updateCount} update${updateCount > 1 ? 's' : ''} available`);
          }
          vscode.window.showInformationMessage(parts.join(', ') + '.');
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

  // Initialize context key from current config on activation
  const initialShowAll = vscode.workspace.getConfiguration('awesome-coding-assistants').get<boolean>('showAllTools', false);
  vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.showAllTools', initialShowAll);

  // Show All Tools toggle command (FR-014, T08-04)
  // Only flips the config setting; the onDidChangeConfiguration listener
  // handles context key, tree refresh, and user message to avoid double-refresh races.
  const toggleShowAllTools = async () => {
    const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
    const current = config.get<boolean>('showAllTools', false);
    const target = vscode.workspace.workspaceFolders
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await config.update('showAllTools', !current, target);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.showAllTools', toggleShowAllTools),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.showDetectedTools', toggleShowAllTools),
  );

  // Listen to showAllTools setting changes to refresh the tree (single handler)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('awesome-coding-assistants.showAllTools')) {
        const showAll = vscode.workspace.getConfiguration('awesome-coding-assistants').get<boolean>('showAllTools', false);
        vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.showAllTools', showAll);
        catalogTreeProvider.refresh();
        vscode.window.showInformationMessage(
          showAll ? 'Showing all tools' : 'Filtering by detected tools',
        );
      }
    }),
  );

  // Listen to workspace folder changes to refresh tool detection
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      catalogTreeProvider.refresh();
    }),
  );

  // Install Bundle command (US-07, T09-03)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.installBundle', (item?: BundleNodeItem) => {
      if (!item || !('kind' in item) || item.kind !== 'bundle') {
        outputChannel.info('Install Bundle command invoked without a valid bundle item');
        return;
      }
      return installBundleCommand(
        item,
        installer,
        githubClient,
        manifestManager,
        sourceRegistry,
        outputChannel,
        () => { catalogTreeProvider.refresh(); updateTreeBadge(); void updateHasInstalledContext(); },
      );
    }),
  );

  // Search command (US-08, T10-01)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search customizations...',
        placeHolder: 'Search customizations...',
        value: catalogTreeProvider.getSearchQuery(),
      });
      if (query === undefined) {
        // Escape pressed - clear the active search filter (T10-04)
        catalogTreeProvider.setSearchQuery('');
        await vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.searchActive', false);
        return;
      }
      catalogTreeProvider.setSearchQuery(query);
      await vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.searchActive', query.length > 0);
    }),
  );

  // Clear Search command (US-08, T10-04)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.clearSearch', async () => {
      catalogTreeProvider.setSearchQuery('');
      await vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.searchActive', false);
    }),
  );

  // Mark All as Seen command (FR-022, T13-02)
  context.subscriptions.push(
    vscode.commands.registerCommand('awesome-coding-assistants.markAllSeen', async () => {
      await newContentDetector.markAllSeen();
      catalogTreeProvider.refresh();
      updateTreeBadge();
    }),
  );

  outputChannel.info('All commands registered');
}

export function deactivate(): void {
  // No cleanup required
}
