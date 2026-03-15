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

  // Cache repo trees per source URL to avoid re-fetching on expand
  private treeCache = new Map<string, GitHubTreeResponse>();

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

  refresh(): void {
    this.treeCache.clear();
    this._onDidChangeTreeData.fire(undefined);
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
        return {
          kind: 'item' as const,
          source: categoryItem.source,
          path: entry.path,
          name,
          tool: classification.tool,
          category: classification.category,
          installed: false, // Will be populated by WP05 manifest lookup
          updateAvailable: false, // Will be populated by WP06 update check
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
    const treeItem = new vscode.TreeItem(
      item.source.name || item.source.url,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    treeItem.contextValue = 'catalogItem.source';
    treeItem.tooltip = item.source.url;
    treeItem.iconPath = new vscode.ThemeIcon('repo');
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
    } else if (item.installed) {
      treeItem.contextValue = 'catalogItem.installed';
      treeItem.description = '$(check) installed';
    } else {
      treeItem.contextValue = 'catalogItem.item';
    }

    treeItem.tooltip = `${item.name} (${item.tool})`;
    treeItem.iconPath = this.getToolIcon(item.tool);
    return treeItem;
  }

  private createErrorTreeItem(item: ErrorItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.message,
      vscode.TreeItemCollapsibleState.None,
    );
    treeItem.iconPath = new vscode.ThemeIcon('error');
    treeItem.tooltip = 'Click refresh to retry';
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
