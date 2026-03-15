// Catalog tree data provider - main tree view for browsing customizations
// Spec refs: FR-007 (tree organization), FR-008 (item display), FR-009 (lazy loading),
//            FR-011 (installed badge), FR-015 (tool badges)
// WP03 T03-03, T03-05

import * as vscode from 'vscode';
import type {
  CatalogItem,
  CategoryItem,
  CatalogFileItem,
  SourceItem,
  SourceConfig,
  GitHubTreeResponse,
  GitHubTreeEntry,
  CategoryType,
  ToolType,
} from '../models/types';
import { GitHubClient } from '../services/githubClient';
import { SourceRegistry } from '../services/sourceRegistry';
import { classifyItem } from '../services/toolDetector';
import type { ManifestManager } from '../services/manifestManager';
import type { LifecycleManager } from '../services/lifecycle';

// Category display labels for tree nodes
const CATEGORY_LABELS: Record<string, string> = {
  agents: 'Agents',
  instructions: 'Instructions',
  skills: 'Skills',
  prompts: 'Prompts',
  hooks: 'Hooks',
  commands: 'Commands',
  rules: 'Rules',
  modes: 'Modes',
  plugins: 'Plugins',
  workflows: 'Workflows',
};

// Error tree item shown when a source fails to load
interface ErrorItem {
  kind: 'error';
  message: string;
  source: SourceConfig;
}

type TreeElement = CatalogItem | ErrorItem;

export class CatalogTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | null>();
  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | null> = this._onDidChangeTreeData.event;

  private readonly registry: SourceRegistry;
  private readonly github: GitHubClient;
  private readonly log: vscode.LogOutputChannel;
  private readonly extensionUri: vscode.Uri;

  // Optional lifecycle dependencies (injected after construction for WP06)
  private manifestMgr?: ManifestManager;
  private lifecycleMgr?: LifecycleManager;

  // Cached set of installed item IDs (sourceUrl#path) for fast tree rendering
  private installedIds = new Set<string>();

  // Cache repo trees per source URL to avoid re-fetching on expand
  private treeCache = new Map<string, GitHubTreeResponse>();

  // Cache file descriptions (first non-heading line) per source:path
  private descriptionCache = new Map<string, string>();

  // Track in-flight description fetches to avoid duplicates
  private pendingDescriptions = new Set<string>();

  constructor(
    registry: SourceRegistry,
    github: GitHubClient,
    log: vscode.LogOutputChannel,
    extensionUri: vscode.Uri,
  ) {
    this.registry = registry;
    this.github = github;
    this.log = log;
    this.extensionUri = extensionUri;
  }

  /**
   * Inject manifest and lifecycle managers for installed/update badge support.
   */
  setLifecycle(manifest: ManifestManager, lifecycle: LifecycleManager): void {
    this.manifestMgr = manifest;
    this.lifecycleMgr = lifecycle;
  }

  refresh(): void {
    this.treeCache.clear();
    this.descriptionCache.clear();
    this.pendingDescriptions.clear();
    this.refreshInstalledCache();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Reload the in-memory cache of installed item IDs from the manifest.
   */
  private refreshInstalledCache(): void {
    if (!this.manifestMgr) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.installedIds.clear();
    // Fire-and-forget async read; if manifest is unavailable we just have no badges
    Promise.all(
      folders.map(async (f) => {
        try {
          const m = await this.manifestMgr!.readManifest(f);
          for (const entry of m.installations) {
            this.installedIds.add(entry.id);
          }
        } catch {
          // ignore
        }
      }),
    ).then(() => {
      // Re-fire to update any tree items that were rendered before cache was ready
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if ('kind' in element && element.kind === 'error') {
      return this.createErrorTreeItem(element);
    }

    const item = element as CatalogItem;
    switch (item.kind) {
      case 'source':
        return this.createSourceTreeItem(item);
      case 'category':
        return this.createCategoryTreeItem(item);
      case 'item':
        return this.createFileTreeItem(item);
    }
  }

  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (!element) {
      // Root level: return source nodes (FR-009: listed immediately from settings)
      return this.getSourceNodes();
    }

    if ('kind' in element && element.kind === 'error') {
      return [];
    }

    const item = element as CatalogItem;
    switch (item.kind) {
      case 'source':
        return this.getCategoryNodes(item);
      case 'category':
        return this.getFileNodes(item);
      case 'item':
        return [];
    }
  }

  private getSourceNodes(): SourceItem[] {
    const sources = this.registry.getSources();
    return sources.map(source => ({
      kind: 'source' as const,
      source,
    }));
  }

  private async getCategoryNodes(sourceItem: SourceItem): Promise<TreeElement[]> {
    try {
      const tree = await this.getOrFetchTree(sourceItem.source);
      const entryMap = this.groupByCategory(tree.tree);

      // Build category nodes, skipping empty categories
      const categories: CategoryItem[] = [];
      for (const [category, entries] of entryMap) {
        if (entries.length > 0) {
          // Determine primary tool for this category from first entry
          const firstClassification = classifyItem(entries[0].path);
          categories.push({
            kind: 'category',
            source: sourceItem.source,
            category: category as CategoryType,
            tool: firstClassification.tool,
          });
        }
      }

      return categories;
    } catch (err) {
      this.log.error(`Failed to load source ${sourceItem.source.url}: ${err}`);
      return [{
        kind: 'error',
        message: `Unable to access repository: ${sourceItem.source.url}`,
        source: sourceItem.source,
      }];
    }
  }

  private async getFileNodes(categoryItem: CategoryItem): Promise<CatalogFileItem[]> {
    try {
      const tree = await this.getOrFetchTree(categoryItem.source);
      const entryMap = this.groupByCategory(tree.tree);
      const entries = entryMap.get(categoryItem.category) || [];

      return entries.map(entry => {
        const classification = classifyItem(entry.path);
        const name = this.extractItemName(entry.path);
        const entryId = `${categoryItem.source.url}#${entry.path}`;
        const isInstalled = this.installedIds.has(entryId);
        const hasUpdate = isInstalled && (this.lifecycleMgr?.hasUpdate(entryId) ?? false);
        return {
          kind: 'item' as const,
          source: categoryItem.source,
          path: entry.path,
          name,
          tool: classification.tool,
          category: classification.category,
          installed: isInstalled,
          updateAvailable: hasUpdate,
        };
      });
    } catch (err) {
      this.log.error(`Failed to load category ${categoryItem.category}: ${err}`);
      return [];
    }
  }

  private async getOrFetchTree(source: SourceConfig): Promise<GitHubTreeResponse> {
    const cached = this.treeCache.get(source.url);
    if (cached) {
      return cached;
    }

    const tree = await this.github.getRepoTree(source);
    this.treeCache.set(source.url, tree);
    return tree;
  }

  /**
   * Public accessor for the tree cache - used by preview command to resolve directory items.
   */
  async getOrFetchTreePublic(source: SourceConfig): Promise<GitHubTreeResponse> {
    return this.getOrFetchTree(source);
  }

  /**
   * Group tree entries by category, filtering to only recognized customization files.
   */
  private groupByCategory(entries: GitHubTreeEntry[]): Map<string, GitHubTreeEntry[]> {
    const map = new Map<string, GitHubTreeEntry[]>();

    for (const entry of entries) {
      // Only process blobs (files), not trees (directories)
      if (entry.type !== 'blob') {
        continue;
      }

      const classification = classifyItem(entry.path);
      if (classification.tool === 'unknown') {
        continue;
      }

      const list = map.get(classification.category) || [];
      list.push(entry);
      map.set(classification.category, list);
    }

    return map;
  }

  private extractItemName(path: string): string {
    const segments = path.split('/');
    const filename = segments[segments.length - 1];
    // Remove tool-specific extensions for cleaner display
    return filename
      .replace(/\.agent\.md$/, '')
      .replace(/\.instructions\.md$/, '')
      .replace(/\.prompt\.md$/, '')
      .replace(/\.md$/, '');
  }

  // --- TreeItem creation ---

  private createSourceTreeItem(item: SourceItem): vscode.TreeItem {
    const label = item.source.name || item.source.url;
    const treeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = 'catalogItem.source';
    treeItem.tooltip = item.source.url;
    treeItem.iconPath = new vscode.ThemeIcon('repo');
    treeItem.accessibilityInformation = { label: `Source repository: ${label}` };
    return treeItem;
  }

  private createCategoryTreeItem(item: CategoryItem): vscode.TreeItem {
    const label = CATEGORY_LABELS[item.category] || item.category;
    const treeItem = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = 'catalogItem.category';
    treeItem.tooltip = `${label} (${item.tool})`;
    treeItem.iconPath = this.getCategoryIcon(item.category);
    treeItem.accessibilityInformation = { label: `Category: ${label}, tool: ${item.tool}` };
    return treeItem;
  }

  private createFileTreeItem(item: CatalogFileItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.name,
      vscode.TreeItemCollapsibleState.None,
    );

    // Set context value for menu contributions
    if (item.updateAvailable) {
      treeItem.contextValue = 'catalogItem.updateAvailable';
      treeItem.description = '$(cloud-download) update available';
      treeItem.iconPath = new vscode.ThemeIcon('cloud-download');
    } else if (item.installed) {
      treeItem.contextValue = 'catalogItem.installed';
      treeItem.description = '$(check) installed';
    } else {
      treeItem.contextValue = 'catalogItem.item';
      // Set cached description if available (FR-008: brief description)
      const descKey = `${item.source.url}:${item.path}`;
      const cachedDesc = this.descriptionCache.get(descKey);
      if (cachedDesc) {
        treeItem.description = cachedDesc;
      } else {
        // Trigger lazy fetch (non-blocking)
        this.fetchDescriptionLazy(item);
      }
    }

    treeItem.tooltip = `${item.name} (${item.tool})`;
    if (!item.updateAvailable) {
      treeItem.iconPath = this.getToolIcon(item.tool);
    }
    const status = item.updateAvailable ? ', update available' : item.installed ? ', installed' : '';
    treeItem.accessibilityInformation = { label: `${item.name}, ${item.tool}${status}` };
    return treeItem;
  }

  /**
   * Lazily fetch the first non-heading line of a file for the tree item description.
   * Does not block tree rendering. Fires onDidChangeTreeData when ready.
   * FR-008: brief description from frontmatter or first non-heading line.
   */
  private fetchDescriptionLazy(item: CatalogFileItem): void {
    const descKey = `${item.source.url}:${item.path}`;
    if (this.pendingDescriptions.has(descKey)) {
      return;
    }
    this.pendingDescriptions.add(descKey);

    this.github.getFileContent(item.source, item.path).then(content => {
      const description = this.extractDescription(content);
      if (description) {
        this.descriptionCache.set(descKey, description);
        // Fire change for this specific item to update its description
        this._onDidChangeTreeData.fire(item);
      }
    }).catch(err => {
      this.log.trace(`Failed to fetch description for ${item.path}: ${err}`);
    }).finally(() => {
      this.pendingDescriptions.delete(descKey);
    });
  }

  /**
   * Extract the first non-heading, non-empty line from file content.
   * Skips YAML frontmatter (--- delimited), markdown headings (#), and blank lines.
   */
  private extractDescription(content: string): string | undefined {
    const lines = content.split('\n');
    let inFrontmatter = false;
    let frontmatterSeen = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Handle YAML frontmatter
      if (trimmed === '---') {
        if (!frontmatterSeen) {
          inFrontmatter = true;
          frontmatterSeen = true;
          continue;
        } else if (inFrontmatter) {
          inFrontmatter = false;
          continue;
        }
      }

      if (inFrontmatter) {
        continue;
      }

      // Skip empty lines and headings
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Return first meaningful line, truncated for display
      const maxLen = 80;
      return trimmed.length > maxLen ? trimmed.substring(0, maxLen) + '...' : trimmed;
    }

    return undefined;
  }

  private createErrorTreeItem(item: ErrorItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.message,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.iconPath = new vscode.ThemeIcon('error');
    treeItem.tooltip = 'Click refresh to retry';
    treeItem.accessibilityInformation = { label: `Error: ${item.message}` };
    return treeItem;
  }

  // --- Icons ---

  private getToolIcon(tool: ToolType): { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon {
    const iconName = this.getToolIconName(tool);
    const lightPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icons', `${iconName}-light.svg`);
    const darkPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icons', `${iconName}-dark.svg`);
    return { light: lightPath, dark: darkPath };
  }

  private getToolIconName(tool: ToolType): string {
    switch (tool) {
      case 'copilot': return 'copilot';
      case 'claude-code': return 'claude';
      default: return 'ai';
    }
  }

  private getCategoryIcon(category: string): vscode.ThemeIcon {
    switch (category) {
      case 'agents': return new vscode.ThemeIcon('person');
      case 'instructions': return new vscode.ThemeIcon('book');
      case 'skills': return new vscode.ThemeIcon('tools');
      case 'prompts': return new vscode.ThemeIcon('comment-discussion');
      case 'hooks': return new vscode.ThemeIcon('git-commit');
      case 'commands': return new vscode.ThemeIcon('terminal');
      case 'rules': return new vscode.ThemeIcon('law');
      case 'modes': return new vscode.ThemeIcon('layout');
      case 'plugins': return new vscode.ThemeIcon('plug');
      case 'workflows': return new vscode.ThemeIcon('workflow');
      default: return new vscode.ThemeIcon('file');
    }
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
