// Catalog tree data provider - main tree view for browsing customizations
// Spec refs: FR-007 (tree organization), FR-008 (item display), FR-009 (lazy loading),
//            FR-011 (installed badge), FR-015 (tool badges), US-08 (search and filter)
// WP03 T03-03, T03-05, WP10 T10-01 through T10-04

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
  DetectedTool,
  BundleCategoryItem,
  BundleNodeItem,
  BundleFileItem,
  Bundle,
} from '../models/types';
import { GitHubClient } from '../services/githubClient';
import { SourceRegistry } from '../services/sourceRegistry';
import { classifyItem, detectWorkspaceTools } from '../services/toolDetector';
import { parseBundle } from '../services/bundleParser';
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

// Empty-state item shown when search returns no matches (US-08 Scenario 2)
interface SearchEmptyItem {
  kind: 'searchEmpty';
  query: string;
}

type TreeElement = CatalogItem | ErrorItem | BundleCategoryItem | BundleNodeItem | BundleFileItem | SearchEmptyItem;

/**
 * Check if a catalog file item matches a search query (US-08, T10-02).
 * Matches against name, path, tool, category, and description.
 * Multi-word queries use AND logic: all words must match across any field.
 */
export function matchesSearch(item: CatalogFileItem, query: string): boolean {
  if (!query || query.trim().length === 0) {
    return true;
  }
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return true;
  }

  const searchText = [
    item.name,
    item.path,
    item.tool,
    item.category,
  ].join(' ').toLowerCase();

  return words.every(word => searchText.includes(word));
}

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

  // Cached detected workspace tools for filtering (FR-013, FR-014)
  private detectedTools: Set<string> = new Set();
  private detectedToolsInitialized = false;

  // Cache parsed bundles per source URL
  private bundleCache = new Map<string, Bundle[]>();

  // Active search query for filtering (US-08, T10-01)
  private searchQuery = '';

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
    this.detectedToolsInitialized = false;
    this.bundleCache.clear();
    this.refreshInstalledCache();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Set the active search query and refresh the tree (US-08, T10-01).
   * Empty string clears the filter.
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get the current search query.
   */
  getSearchQuery(): string {
    return this.searchQuery;
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

  /**
   * Refresh the detected workspace tools cache.
   * FR-013: auto-detect which AI tools are in the workspace.
   */
  private async ensureDetectedTools(): Promise<void> {
    if (this.detectedToolsInitialized) {
      return;
    }
    this.detectedToolsInitialized = true;
    this.detectedTools.clear();

    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      try {
        const tools = await detectWorkspaceTools(folder);
        for (const t of tools) {
          this.detectedTools.add(t.tool);
        }
      } catch {
        // If detection fails, we simply don't filter
      }
    }
  }

  /**
   * Check if a tool should be shown based on current filter settings.
   * FR-014: default to detected tools unless showAllTools is true or no tools detected.
   */
  private shouldShowTool(tool: ToolType): boolean {
    const showAll = vscode.workspace.getConfiguration('awesome-coding-assistants').get<boolean>('showAllTools', false);
    if (showAll) {
      return true;
    }
    // If no tools detected, show everything
    if (this.detectedTools.size === 0) {
      return true;
    }
    // Unknown tool items always show (they might be relevant to any tool)
    if (tool === 'unknown') {
      return true;
    }
    return this.detectedTools.has(tool);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    if ('kind' in element && element.kind === 'error') {
      return this.createErrorTreeItem(element);
    }

    if ('kind' in element && element.kind === 'searchEmpty') {
      return this.createSearchEmptyTreeItem(element);
    }

    if ('kind' in element && element.kind === 'bundleCategory') {
      return this.createBundleCategoryTreeItem();
    }

    if ('kind' in element && element.kind === 'bundle') {
      return this.createBundleTreeItem(element);
    }

    if ('kind' in element && element.kind === 'bundleFile') {
      return this.createBundleFileTreeItem(element);
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
      // If search is active, check for empty results across all sources (US-08 Scenario 2)
      if (this.searchQuery) {
        const sources = this.getSourceNodes();
        const anyMatch = await this.hasAnySearchMatch(sources);
        if (!anyMatch) {
          return [{ kind: 'searchEmpty' as const, query: this.searchQuery }];
        }
        return sources;
      }
      return this.getSourceNodes();
    }

    if ('kind' in element && element.kind === 'error') {
      return [];
    }

    if ('kind' in element && element.kind === 'searchEmpty') {
      return [];
    }

    if ('kind' in element && element.kind === 'bundleCategory') {
      return this.getBundleNodes(element);
    }

    if ('kind' in element && element.kind === 'bundle') {
      return this.getBundleFileNodes(element);
    }

    if ('kind' in element && element.kind === 'bundleFile') {
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
      await this.ensureDetectedTools();
      const tree = await this.getOrFetchTree(sourceItem.source);
      const entryMap = this.groupByCategory(tree.tree);

      // Build category nodes, skipping empty categories
      const categories: CategoryItem[] = [];
      for (const [category, entries] of entryMap) {
        if (entries.length > 0) {
          // Determine primary tool for this category from first entry
          const firstClassification = classifyItem(entries[0].path);

          // FR-014: filter categories by detected tools
          // Check if any entry in this category matches detected tools
          const hasVisibleEntries = entries.some(e => this.shouldShowTool(classifyItem(e.path).tool));
          if (!hasVisibleEntries) {
            continue;
          }

          // US-08: if search is active, skip categories with no matching items
          if (this.searchQuery) {
            const hasMatchingItem = entries.some(e => {
              const classification = classifyItem(e.path);
              if (!this.shouldShowTool(classification.tool)) {
                return false;
              }
              const name = this.extractItemName(e.path);
              const fakeItem: CatalogFileItem = {
                kind: 'item',
                source: sourceItem.source,
                path: e.path,
                name,
                tool: classification.tool,
                category: classification.category,
                installed: false,
                updateAvailable: false,
              };
              return matchesSearch(fakeItem, this.searchQuery);
            });
            if (!hasMatchingItem) {
              continue;
            }
          }

          categories.push({
            kind: 'category',
            source: sourceItem.source,
            category: category as CategoryType,
            tool: firstClassification.tool,
          });
        }
      }

      // Check for bundles directory and add Bundles category if present
      const hasBundleFiles = await this.hasBundles(sourceItem.source);
      const result: TreeElement[] = categories;
      if (hasBundleFiles) {
        result.push({
          kind: 'bundleCategory',
          source: sourceItem.source,
        });
      }

      return result;
    } catch (err) {
      this.log.error(`Failed to load source ${sourceItem.source.url}: ${err}`);
      return [{
        kind: 'error',
        message: `Unable to access repository: ${sourceItem.source.url}`,
        source: sourceItem.source,
      }];
    }
  }

  /**
   * Discover and cache bundles from the bundles/ directory in a source repo.
   */
  private async discoverBundles(source: SourceConfig): Promise<Bundle[]> {
    const cached = this.bundleCache.get(source.url);
    if (cached) {
      return cached;
    }

    const tree = await this.getOrFetchTree(source);
    const bundleEntries = tree.tree.filter(
      e => e.type === 'blob' && e.path.startsWith('bundles/') && e.path.endsWith('.json'),
    );

    if (bundleEntries.length === 0) {
      this.bundleCache.set(source.url, []);
      return [];
    }

    const bundles: Bundle[] = [];
    for (const entry of bundleEntries) {
      try {
        const content = await this.github.getFileContent(source, entry.path);
        const bundle = parseBundle(content, entry.path);
        bundles.push(bundle);
      } catch (err) {
        this.log.warn(`Failed to parse bundle ${entry.path}: ${err}`);
      }
    }

    this.bundleCache.set(source.url, bundles);
    return bundles;
  }

  /**
   * Check if a source has any bundles and return a BundleCategory node if so.
   * Called from getCategoryNodes after regular categories.
   */
  async hasBundles(source: SourceConfig): Promise<boolean> {
    try {
      const bundles = await this.discoverBundles(source);
      return bundles.length > 0;
    } catch {
      return false;
    }
  }

  private async getBundleNodes(bundleCat: BundleCategoryItem): Promise<BundleNodeItem[]> {
    try {
      const bundles = await this.discoverBundles(bundleCat.source);
      const tree = await this.getOrFetchTree(bundleCat.source);
      const bundleEntries = tree.tree.filter(
        e => e.type === 'blob' && e.path.startsWith('bundles/') && e.path.endsWith('.json'),
      );

      return bundles.map((bundle, i) => ({
        kind: 'bundle' as const,
        source: bundleCat.source,
        bundle,
        bundlePath: bundleEntries[i]?.path || `bundles/${bundle.name}.json`,
      }));
    } catch (err) {
      this.log.error(`Failed to load bundles for ${bundleCat.source.url}: ${err}`);
      return [];
    }
  }

  private getBundleFileNodes(bundleNode: BundleNodeItem): BundleFileItem[] {
    return bundleNode.bundle.items.map(item => ({
      kind: 'bundleFile' as const,
      source: bundleNode.source,
      bundleItem: item,
      bundleName: bundleNode.bundle.name,
    }));
  }

  private async getFileNodes(categoryItem: CategoryItem): Promise<CatalogFileItem[]> {
    try {
      const tree = await this.getOrFetchTree(categoryItem.source);
      const entryMap = this.groupByCategory(tree.tree);
      const entries = entryMap.get(categoryItem.category) || [];

      return entries
        .map(entry => {
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
        })
        .filter(item => this.shouldShowTool(item.tool))
        .filter(item => matchesSearch(item, this.searchQuery));
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

  private createSearchEmptyTreeItem(item: SearchEmptyItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      `No items match '${item.query}'`,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.iconPath = new vscode.ThemeIcon('search-stop');
    treeItem.tooltip = 'Clear search to show all items';
    treeItem.accessibilityInformation = { label: `No items match '${item.query}'` };
    return treeItem;
  }

  /**
   * Check if any items across all sources match the current search query.
   * Used to decide whether to show the empty-state node (US-08 Scenario 2).
   */
  private async hasAnySearchMatch(sources: SourceItem[]): Promise<boolean> {
    for (const sourceItem of sources) {
      try {
        await this.ensureDetectedTools();
        const tree = await this.getOrFetchTree(sourceItem.source);
        const entryMap = this.groupByCategory(tree.tree);

        for (const [, entries] of entryMap) {
          for (const entry of entries) {
            const classification = classifyItem(entry.path);
            if (!this.shouldShowTool(classification.tool)) {
              continue;
            }
            const name = this.extractItemName(entry.path);
            const fakeItem: CatalogFileItem = {
              kind: 'item',
              source: sourceItem.source,
              path: entry.path,
              name,
              tool: classification.tool,
              category: classification.category,
              installed: false,
              updateAvailable: false,
            };
            if (matchesSearch(fakeItem, this.searchQuery)) {
              return true;
            }
          }
        }
      } catch {
        // Skip failing sources
      }
    }
    return false;
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

  // --- Bundle tree items ---

  private createBundleCategoryTreeItem(): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      'Bundles',
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = 'catalogItem.category';
    treeItem.tooltip = 'Practice bundles - install multiple items at once';
    treeItem.iconPath = new vscode.ThemeIcon('package');
    treeItem.accessibilityInformation = { label: 'Category: Bundles' };
    return treeItem;
  }

  private createBundleTreeItem(item: BundleNodeItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.bundle.name,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = 'bundleItem';
    treeItem.description = `${item.bundle.items.length} items`;
    treeItem.tooltip = item.bundle.description || `Bundle: ${item.bundle.name}`;
    treeItem.iconPath = new vscode.ThemeIcon('package');
    treeItem.accessibilityInformation = {
      label: `Bundle: ${item.bundle.name}, ${item.bundle.items.length} items`,
    };
    return treeItem;
  }

  private createBundleFileTreeItem(item: BundleFileItem): vscode.TreeItem {
    const filename = item.bundleItem.path.split('/').pop() || item.bundleItem.path;
    const treeItem = new vscode.TreeItem(
      filename,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.contextValue = 'bundleFileItem';
    treeItem.description = `${item.bundleItem.tool} / ${item.bundleItem.category}`;
    treeItem.tooltip = `${item.bundleItem.path} (${item.bundleItem.tool})`;
    treeItem.iconPath = this.getToolIcon(item.bundleItem.tool as ToolType);
    const requiredLabel = item.bundleItem.required === false ? ', optional' : '';
    treeItem.accessibilityInformation = {
      label: `${filename}, ${item.bundleItem.tool}, ${item.bundleItem.category}${requiredLabel}`,
    };
    return treeItem;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
