import * as assert from 'assert';
import * as vscode from 'vscode';
import { CatalogTreeProvider } from '../../src/providers/catalogTree';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { GitHubClient } from '../../src/services/githubClient';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type { SourceConfig, GitHubTreeResponse, GitHubTreeEntry, ValidationResult, CatalogItem } from '../../src/models/types';

// Sample tree response with Copilot and Claude Code files
const SAMPLE_TREE: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
    { path: '.github/agents/reviewer.agent.md', mode: '100644', type: 'blob', sha: 'a2', url: '' },
    { path: '.github/instructions/setup.instructions.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
    { path: '.github/prompts/review.prompt.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
    { path: '.claude/agents/researcher.md', mode: '100644', type: 'blob', sha: 'd1', url: '' },
    { path: '.claude/rules/style.md', mode: '100644', type: 'blob', sha: 'e1', url: '' },
    { path: 'README.md', mode: '100644', type: 'blob', sha: 'f1', url: '' },
    { path: '.github', mode: '040000', type: 'tree', sha: 'g1', url: '' },
    { path: '.github/agents', mode: '040000', type: 'tree', sha: 'g2', url: '' },
  ],
  truncated: false,
};

const TEST_SOURCE: SourceConfig = {
  url: 'https://github.com/test/repo',
  name: 'Test Repo',
  branch: 'main',
};

function createMockGitHubClient(treeResponse?: GitHubTreeResponse): GitHubClient {
  return {
    getRepoTree: async () => treeResponse || SAMPLE_TREE,
    getFileContent: async () => '',
    getLatestCommitSha: async () => 'sha123',
    validateRepo: async () => ({ valid: true } as ValidationResult),
  } as unknown as GitHubClient;
}

function createMockSourceRegistry(sources: SourceConfig[]): SourceRegistry {
  const emitter = new vscode.EventEmitter<void>();
  return {
    getSources: () => sources,
    onDidChange: emitter.event,
    loadMasterIndex: async () => {},
    invalidateCache: () => {},
    dispose: () => { emitter.dispose(); },
  } as unknown as SourceRegistry;
}

function getExtensionUri(): vscode.Uri {
  // Use the workspace folder or a temp path for testing
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }
  return vscode.Uri.file('/tmp/test-extension');
}

describe('CatalogTreeProvider', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    log = createMockLogOutputChannel();
  });

  describe('getChildren (root)', () => {
    it('should return source nodes from registry', async () => {
      const sources = [TEST_SOURCE];
      const registry = createMockSourceRegistry(sources);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const children = await provider.getChildren(undefined);
      assert.strictEqual(children.length, 1);

      const sourceItem = children[0] as { kind: string; source: SourceConfig };
      assert.strictEqual(sourceItem.kind, 'source');
      assert.strictEqual(sourceItem.source.url, TEST_SOURCE.url);

      provider.dispose();
      registry.dispose();
    });

    it('should return empty array when no sources configured', async () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const children = await provider.getChildren(undefined);
      assert.strictEqual(children.length, 0);

      provider.dispose();
      registry.dispose();
    });

    it('should signal noSources condition when registry returns empty (T03-08 FB-02)', async () => {
      // Verifies the precondition for the welcome view: when getSources() returns [],
      // getChildren(undefined) returns [], which means the extension.ts updateNoSourcesContext
      // would set 'awesome-coding-assistants.noSources' to true.
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sources = registry.getSources();
      assert.strictEqual(sources.length, 0, 'Registry should return no sources');

      const children = await provider.getChildren(undefined);
      assert.strictEqual(children.length, 0, 'Tree should show no children');

      // This is the condition that triggers:
      // vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.noSources', true)
      // in extension.ts updateNoSourcesContext()
      assert.strictEqual(
        sources.length === 0,
        true,
        'noSources context key should be set to true when sources are empty',
      );

      provider.dispose();
      registry.dispose();
    });

    it('should not fetch repo tree at root level (lazy loading)', async () => {
      let fetchCalled = false;
      const github = {
        getRepoTree: async () => { fetchCalled = true; return SAMPLE_TREE; },
        getFileContent: async () => '',
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      await provider.getChildren(undefined);
      assert.strictEqual(fetchCalled, false, 'getRepoTree should not be called at root level');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('getChildren (source node)', () => {
    it('should return category nodes grouped from repo tree', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };
      const children = await provider.getChildren(sourceItem);

      // Should have categories: agents, instructions, prompts (from Copilot), agents, rules (from Claude)
      // But agents merges Copilot + Claude into one group
      assert.ok(children.length > 0, 'Should have category children');

      // Check that categories are present
      const categories = children
        .filter((c): c is CatalogItem => 'kind' in c && (c as CatalogItem).kind === 'category')
        .map(c => (c as { category: string }).category);

      assert.ok(categories.includes('agents'), 'Should have agents category');
      assert.ok(categories.includes('instructions'), 'Should have instructions category');
      assert.ok(categories.includes('prompts'), 'Should have prompts category');
      assert.ok(categories.includes('rules'), 'Should have rules category');

      provider.dispose();
      registry.dispose();
    });

    it('should not show empty categories', async () => {
      const emptyTree: GitHubTreeResponse = {
        sha: 'abc', url: '', tree: [
          { path: '.github/agents/test.agent.md', mode: '100644', type: 'blob', sha: 'x', url: '' },
        ], truncated: false,
      };
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(emptyTree);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };
      const children = await provider.getChildren(sourceItem);

      // Only agents should appear
      assert.strictEqual(children.length, 1);
      const cat = children[0] as { kind: string; category: string };
      assert.strictEqual(cat.category, 'agents');

      provider.dispose();
      registry.dispose();
    });

    it('should show error node when source is unreachable', async () => {
      const github = {
        getRepoTree: async () => { throw new Error('Network error'); },
        getFileContent: async () => '',
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };
      const children = await provider.getChildren(sourceItem);

      assert.strictEqual(children.length, 1);
      const errItem = children[0] as { kind: string; message: string };
      assert.strictEqual(errItem.kind, 'error');
      assert.ok(errItem.message.includes(TEST_SOURCE.url));

      provider.dispose();
      registry.dispose();
    });
  });

  describe('getChildren (category node)', () => {
    it('should return file items for a category', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // First expand source to populate cache
      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };
      await provider.getChildren(sourceItem);

      const categoryItem = {
        kind: 'category' as const,
        source: TEST_SOURCE,
        category: 'agents' as const,
        tool: 'copilot' as const,
      };
      const children = await provider.getChildren(categoryItem);

      // Should contain copilot agents + claude agents
      assert.ok(children.length > 0, 'Should have file items');

      // Verify items are CatalogFileItems
      for (const child of children) {
        const item = child as { kind: string; name: string; path: string };
        assert.strictEqual(item.kind, 'item');
        assert.ok(item.name, 'Item should have a name');
        assert.ok(item.path, 'Item should have a path');
      }

      provider.dispose();
      registry.dispose();
    });
  });

  describe('getTreeItem', () => {
    it('should create collapsible source tree item', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };
      const treeItem = provider.getTreeItem(sourceItem);

      assert.strictEqual(treeItem.label, TEST_SOURCE.name);
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
      assert.strictEqual(treeItem.contextValue, 'catalogItem.source');

      provider.dispose();
      registry.dispose();
    });

    it('should create collapsible category tree item', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const catItem = {
        kind: 'category' as const,
        source: TEST_SOURCE,
        category: 'agents' as const,
        tool: 'copilot' as const,
      };
      const treeItem = provider.getTreeItem(catItem);

      assert.strictEqual(treeItem.label, 'Agents');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
      assert.strictEqual(treeItem.contextValue, 'catalogItem.category');

      provider.dispose();
      registry.dispose();
    });

    it('should create leaf file tree item with correct contextValue', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);

      assert.strictEqual(treeItem.label, 'coder');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(treeItem.contextValue, 'catalogItem.item');

      provider.dispose();
      registry.dispose();
    });

    it('should show installed contextValue for installed items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: true,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);

      assert.strictEqual(treeItem.contextValue, 'catalogItem.installed');

      provider.dispose();
      registry.dispose();
    });

    it('should show updateAvailable contextValue when update exists', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: true,
        updateAvailable: true,
      };
      const treeItem = provider.getTreeItem(fileItem);

      assert.strictEqual(treeItem.contextValue, 'catalogItem.updateAvailable');

      provider.dispose();
      registry.dispose();
    });

    it('should create error tree item with error icon', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const errItem = {
        kind: 'error' as const,
        message: 'Unable to access repository: https://github.com/test/repo',
        source: TEST_SOURCE,
      };
      const treeItem = provider.getTreeItem(errItem);

      assert.strictEqual(treeItem.label, errItem.message);
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);

      provider.dispose();
      registry.dispose();
    });
  });

  describe('refresh', () => {
    it('should clear tree cache and fire change event', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      let eventFired = false;
      provider.onDidChangeTreeData(() => { eventFired = true; });

      provider.refresh();
      assert.strictEqual(eventFired, true, 'onDidChangeTreeData should fire');

      provider.dispose();
      registry.dispose();
    });

    it('should re-fetch tree after refresh', async () => {
      let fetchCount = 0;
      const github = {
        getRepoTree: async () => { fetchCount++; return SAMPLE_TREE; },
        getFileContent: async () => '',
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const sourceItem = { kind: 'source' as const, source: TEST_SOURCE };

      // First fetch
      await provider.getChildren(sourceItem);
      assert.strictEqual(fetchCount, 1);

      // Second fetch should hit cache
      await provider.getChildren(sourceItem);
      assert.strictEqual(fetchCount, 1, 'Should use cached tree');

      // After refresh, should re-fetch
      provider.refresh();
      await provider.getChildren(sourceItem);
      assert.strictEqual(fetchCount, 2, 'Should re-fetch after refresh');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('tool badge icons', () => {
    it('should assign copilot icon to copilot items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);

      // Icon should be an object with light/dark paths
      assert.ok(treeItem.iconPath, 'Should have an icon');
      const icon = treeItem.iconPath as { light: vscode.Uri; dark: vscode.Uri };
      assert.ok(icon.light.path.includes('copilot-light'), 'Light icon should be copilot');
      assert.ok(icon.dark.path.includes('copilot-dark'), 'Dark icon should be copilot');

      provider.dispose();
      registry.dispose();
    });

    it('should assign claude icon to claude-code items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.claude/rules/style.md',
        name: 'style',
        tool: 'claude-code' as const,
        category: 'rules' as const,
        installed: false,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);

      const icon = treeItem.iconPath as { light: vscode.Uri; dark: vscode.Uri };
      assert.ok(icon.light.path.includes('claude-light'), 'Light icon should be claude');
      assert.ok(icon.dark.path.includes('claude-dark'), 'Dark icon should be claude');

      provider.dispose();
      registry.dispose();
    });

    it('should assign generic AI icon to unknown tool items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: 'unknown/path.md',
        name: 'unknown',
        tool: 'unknown' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);

      const icon = treeItem.iconPath as { light: vscode.Uri; dark: vscode.Uri };
      assert.ok(icon.light.path.includes('ai-light'), 'Light icon should be ai');
      assert.ok(icon.dark.path.includes('ai-dark'), 'Dark icon should be ai');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('file descriptions (FR-008)', () => {
    it('should set description from cached value on non-installed items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Pre-populate description cache via internals
      const descCache = (provider as unknown as { descriptionCache: Map<string, string> }).descriptionCache;
      descCache.set('https://github.com/test/repo:.github/agents/coder.agent.md', 'A code review agent');

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);
      assert.strictEqual(treeItem.description, 'A code review agent');

      provider.dispose();
      registry.dispose();
    });

    it('should trigger lazy fetch when description is not cached', async () => {
      let fetchedPath: string | undefined;
      const github = {
        getRepoTree: async () => SAMPLE_TREE,
        getFileContent: async (_source: SourceConfig, path: string) => {
          fetchedPath = path;
          return '# Agent\n\nThis agent reviews code for quality.';
        },
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };

      // First call triggers lazy fetch (no description yet)
      provider.getTreeItem(fileItem);

      // Wait for async fetch to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      assert.strictEqual(fetchedPath, '.github/agents/coder.agent.md');

      // Now description should be cached
      const descCache = (provider as unknown as { descriptionCache: Map<string, string> }).descriptionCache;
      assert.strictEqual(
        descCache.get('https://github.com/test/repo:.github/agents/coder.agent.md'),
        'This agent reviews code for quality.',
      );

      provider.dispose();
      registry.dispose();
    });

    it('should extract description skipping frontmatter and headings', async () => {
      const github = {
        getRepoTree: async () => SAMPLE_TREE,
        getFileContent: async () => '---\ntitle: Test\n---\n# My Agent\n\nA helpful assistant for TypeScript.',
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/helper.agent.md',
        name: 'helper',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };

      provider.getTreeItem(fileItem);
      await new Promise(resolve => setTimeout(resolve, 50));

      const descCache = (provider as unknown as { descriptionCache: Map<string, string> }).descriptionCache;
      assert.strictEqual(
        descCache.get('https://github.com/test/repo:.github/agents/helper.agent.md'),
        'A helpful assistant for TypeScript.',
      );

      provider.dispose();
      registry.dispose();
    });

    it('should not set description on installed items', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: true,
        updateAvailable: false,
      };
      const treeItem = provider.getTreeItem(fileItem);
      assert.strictEqual(treeItem.description, 'installed');

      provider.dispose();
      registry.dispose();
    });

    it('should not duplicate fetch for same item', async () => {
      let fetchCount = 0;
      const github = {
        getRepoTree: async () => SAMPLE_TREE,
        getFileContent: async () => {
          fetchCount++;
          return '# Agent\n\nDescription line.';
        },
        getLatestCommitSha: async () => 'sha',
        validateRepo: async () => ({ valid: true }),
      } as unknown as GitHubClient;

      const registry = createMockSourceRegistry([]);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: false,
        updateAvailable: false,
      };

      // Call getTreeItem twice rapidly
      provider.getTreeItem(fileItem);
      provider.getTreeItem(fileItem);

      await new Promise(resolve => setTimeout(resolve, 50));
      assert.strictEqual(fetchCount, 1, 'Should only fetch once for same item');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('Bug fixes (WP11)', () => {
    it('T11-01: update-available description should not contain codicon syntax', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: true,
        updateAvailable: true,
      };
      const treeItem = provider.getTreeItem(fileItem);
      assert.strictEqual(treeItem.description, 'update available');
      assert.ok(!String(treeItem.description).includes('$('), 'description must not contain codicon syntax');

      provider.dispose();
      registry.dispose();
    });

    it('T11-01: update-available icon should be cloud-download ThemeIcon', () => {
      const registry = createMockSourceRegistry([]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const fileItem = {
        kind: 'item' as const,
        source: TEST_SOURCE,
        path: '.github/agents/coder.agent.md',
        name: 'coder',
        tool: 'copilot' as const,
        category: 'agents' as const,
        installed: true,
        updateAvailable: true,
      };
      const treeItem = provider.getTreeItem(fileItem);
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((treeItem.iconPath as vscode.ThemeIcon).id, 'cloud-download');

      provider.dispose();
      registry.dispose();
    });

    it('T11-02: installedIds is never cleared to empty during refresh', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Mock workspace folders so refreshInstalledCache can iterate them
      const origFolders = vscode.workspace.workspaceFolders;
      const mockFolder = { uri: vscode.Uri.file('/tmp/test'), name: 'test', index: 0 };
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [mockFolder], configurable: true,
      });

      // Manually seed the installedIds to simulate a pre-existing cache
      const ids = (provider as unknown as { installedIds: Set<string> }).installedIds;
      ids.add('https://github.com/test/repo#.github/agents/coder.agent.md');
      assert.strictEqual(ids.size, 1, 'precondition: installedIds should have 1 entry');

      // Create a slow mock manifest manager
      const mockManifest = {
        readManifest: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            version: '1.0',
            installations: [
              { id: 'https://github.com/test/repo#.github/agents/coder.agent.md' },
            ],
          };
        },
      };
      const mockLifecycle = { hasUpdate: () => false };
      provider.setLifecycle(
        mockManifest as unknown as import('../../src/services/manifestManager').ManifestManager,
        mockLifecycle as unknown as import('../../src/services/lifecycle').LifecycleManager,
      );

      // Call refresh() which triggers refreshInstalledCache()
      provider.refresh();

      // Immediately after refresh(), installedIds should NOT be empty
      // With atomic swap, the old set is still referenced until the new one is ready
      const idsAfterRefresh = (provider as unknown as { installedIds: Set<string> }).installedIds;
      assert.ok(idsAfterRefresh.size > 0,
        'installedIds should retain stale data during async refresh (atomic swap, not clear())');

      // Wait for async manifest read to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // After swap completes, the new set should be in place
      const idsAfterComplete = (provider as unknown as { installedIds: Set<string> }).installedIds;
      assert.ok(idsAfterComplete.has('https://github.com/test/repo#.github/agents/coder.agent.md'),
        'installedIds should contain expected ID after refresh completes');

      // Restore original workspace folders
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders, configurable: true,
      });
      provider.dispose();
      registry.dispose();
    });

    it('T11-02: _onDidChangeTreeData should fire after atomic swap', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const mockManifest = {
        readManifest: async () => ({
          version: '1.0',
          installations: [
            { id: 'https://github.com/test/repo#.github/agents/coder.agent.md' },
          ],
        }),
      };
      const mockLifecycle = { hasUpdate: () => false };
      provider.setLifecycle(
        mockManifest as unknown as import('../../src/services/manifestManager').ManifestManager,
        mockLifecycle as unknown as import('../../src/services/lifecycle').LifecycleManager,
      );

      // Track fires that happen after initial refresh fire
      let fireCount = 0;
      provider.onDidChangeTreeData(() => { fireCount++; });

      provider.refresh();
      await new Promise(resolve => setTimeout(resolve, 50));

      // refresh() fires once immediately, then once more after async installed cache completes
      assert.ok(fireCount >= 2, `Expected at least 2 fires (immediate + after cache), got ${fireCount}`);

      provider.dispose();
      registry.dispose();
    });
  });
});
