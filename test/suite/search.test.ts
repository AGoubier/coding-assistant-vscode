// Tests for search and filter functionality
// Spec refs: US-08 (Search and Filter)
// WP10 T10-05

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CatalogTreeProvider, matchesSearch } from '../../src/providers/catalogTree';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { GitHubClient } from '../../src/services/githubClient';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type {
  SourceConfig,
  GitHubTreeResponse,
  ValidationResult,
  CatalogFileItem,
  CatalogItem,
  CategoryItem,
} from '../../src/models/types';

// --- Fixtures ---

const SEARCH_TREE: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/typescript-best-practices.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
    { path: '.github/agents/code-review.agent.md', mode: '100644', type: 'blob', sha: 'a2', url: '' },
    { path: '.github/prompts/review.prompt.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
    { path: '.claude/agents/researcher.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
    { path: '.claude/rules/style.md', mode: '100644', type: 'blob', sha: 'd1', url: '' },
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
    getRepoTree: async () => treeResponse || SEARCH_TREE,
    getFileContent: async () => '# Test content',
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
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }
  return vscode.Uri.file('/tmp/test-extension');
}

function makeFakeItem(overrides: Partial<CatalogFileItem> = {}): CatalogFileItem {
  return {
    kind: 'item',
    source: TEST_SOURCE,
    path: '.github/agents/test.agent.md',
    name: 'test',
    tool: 'copilot',
    category: 'agents',
    installed: false,
    updateAvailable: false,
    ...overrides,
  };
}

// --- Tests ---

describe('Search and Filter (WP10)', () => {

  describe('matchesSearch (T10-02)', () => {
    it('should match item by name (case-insensitive)', () => {
      const item = makeFakeItem({ name: 'TypeScript Best Practices' });
      assert.strictEqual(matchesSearch(item, 'typescript'), true);
      assert.strictEqual(matchesSearch(item, 'TYPESCRIPT'), true);
      assert.strictEqual(matchesSearch(item, 'TypeScript'), true);
    });

    it('should match item by path', () => {
      const item = makeFakeItem({ path: '.github/agents/typescript-review.agent.md' });
      assert.strictEqual(matchesSearch(item, 'typescript'), true);
    });

    it('should match item by tool type', () => {
      const item = makeFakeItem({ tool: 'copilot' });
      assert.strictEqual(matchesSearch(item, 'copilot'), true);
    });

    it('should match item by category', () => {
      const item = makeFakeItem({ category: 'agents' });
      assert.strictEqual(matchesSearch(item, 'agents'), true);
    });

    it('should match item by description', () => {
      const item = makeFakeItem({ description: 'Helps with TypeScript refactoring' });
      assert.strictEqual(matchesSearch(item, 'refactoring'), true);
      assert.strictEqual(matchesSearch(item, 'REFACTORING'), true);
    });

    it('should not match description when absent', () => {
      const item = makeFakeItem();
      assert.strictEqual(matchesSearch(item, 'refactoring'), false);
    });

    it('should use AND logic for multi-word queries', () => {
      const item = makeFakeItem({ name: 'Review', tool: 'copilot', category: 'agents' });
      assert.strictEqual(matchesSearch(item, 'copilot agents'), true);
      assert.strictEqual(matchesSearch(item, 'copilot rules'), false);
    });

    it('should return true for empty query', () => {
      const item = makeFakeItem();
      assert.strictEqual(matchesSearch(item, ''), true);
      assert.strictEqual(matchesSearch(item, '   '), true);
    });

    it('should return false for non-matching query', () => {
      const item = makeFakeItem({ name: 'Review', tool: 'copilot', category: 'agents' });
      assert.strictEqual(matchesSearch(item, 'nonexistent'), false);
    });

    it('should match "copilot agents" against Copilot agent items', () => {
      const item = makeFakeItem({ name: 'Code Review', tool: 'copilot', category: 'agents' });
      assert.strictEqual(matchesSearch(item, 'copilot agents'), true);
    });

    it('should not match "nonexistent" against any item', () => {
      const item = makeFakeItem({ name: 'Code Review', tool: 'copilot', category: 'agents' });
      assert.strictEqual(matchesSearch(item, 'nonexistent'), false);
    });
  });

  describe('Filtered tree rendering (T10-03)', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('should filter items by search query', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Set search query
      provider.setSearchQuery('typescript');

      // Get source -> categories -> items
      const roots = await provider.getChildren(undefined);
      // Should have source (or empty message) - let's check
      assert.ok(roots.length > 0);

      // If source is returned, get categories
      if ('kind' in roots[0] && roots[0].kind === 'source') {
        const categories = await provider.getChildren(roots[0]);

        // Only categories with matching items should be shown
        // "typescript" should match the typescript-best-practices agent
        const agentsCat = categories.find(
          c => 'category' in c && (c as CategoryItem).category === 'agents',
        ) as CategoryItem;
        assert.ok(agentsCat, 'Agents category should be visible (has typescript match)');

        const items = await provider.getChildren(agentsCat) as CatalogFileItem[];
        // Only typescript-best-practices should match
        assert.strictEqual(items.length, 1);
        assert.ok(items[0].name.includes('typescript'));
      }

      provider.dispose();
      registry.dispose();
    });

    it('should hide empty categories when search is active', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      provider.setSearchQuery('style');

      const roots = await provider.getChildren(undefined);
      if ('kind' in roots[0] && roots[0].kind === 'source') {
        const categories = await provider.getChildren(roots[0]);
        // "style" only matches .claude/rules/style.md -> rules category
        const categoryNames = categories
          .filter(c => 'category' in c)
          .map(c => (c as CategoryItem).category);

        assert.ok(categoryNames.includes('rules'), 'Rules category should be visible');
        assert.ok(!categoryNames.includes('agents'), 'Agents category should be hidden (no match)');
        assert.ok(!categoryNames.includes('prompts'), 'Prompts category should be hidden (no match)');
      }

      provider.dispose();
      registry.dispose();
    });

    it('should show filtered count badge on category tree items', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      provider.setSearchQuery('agent');

      const roots = await provider.getChildren(undefined);
      if ('kind' in roots[0] && roots[0].kind === 'source') {
        const categories = await provider.getChildren(roots[0]);
        const agentsCat = categories.find(
          c => 'category' in c && (c as CategoryItem).category === 'agents',
        ) as CategoryItem;
        assert.ok(agentsCat, 'Agents category should be visible');
        assert.ok(agentsCat.filteredCount !== undefined, 'filteredCount should be set');
        assert.ok(agentsCat.filteredCount! > 0, 'filteredCount should be > 0');

        const treeItem = provider.getTreeItem(agentsCat);
        assert.ok(treeItem.description, 'Category tree item should have a count badge description');
        assert.ok((treeItem.description as string).includes('match'), 'Description should include match count');
      }

      provider.dispose();
      registry.dispose();
    });

    it('should show empty state when no items match', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      provider.setSearchQuery('nonexistent');

      const roots = await provider.getChildren(undefined);
      assert.strictEqual(roots.length, 1);
      assert.strictEqual((roots[0] as any).kind, 'searchEmpty');
      assert.strictEqual((roots[0] as any).query, 'nonexistent');

      const treeItem = provider.getTreeItem(roots[0]);
      assert.strictEqual(treeItem.label, "No items match 'nonexistent'");

      provider.dispose();
      registry.dispose();
    });

    it('should show all items when search is cleared', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Set then clear search
      provider.setSearchQuery('typescript');
      provider.setSearchQuery('');

      const roots = await provider.getChildren(undefined);
      // Should show source nodes (no filtering)
      assert.ok(roots.length > 0);
      assert.strictEqual((roots[0] as any).kind, 'source');

      // All categories should be visible
      const categories = await provider.getChildren(roots[0]);
      const categoryCount = categories.filter(c => 'category' in c).length;
      assert.ok(categoryCount >= 3, 'All categories should be restored after clearing search');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('Search state management (T10-01, T10-04)', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('should store and retrieve search query', () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      assert.strictEqual(provider.getSearchQuery(), '');
      provider.setSearchQuery('test query');
      assert.strictEqual(provider.getSearchQuery(), 'test query');
      provider.setSearchQuery('');
      assert.strictEqual(provider.getSearchQuery(), '');

      provider.dispose();
      registry.dispose();
    });

    it('search and clearSearch commands are registered in package.json', () => {
      // Read package.json and verify command IDs exist
      const pkgPath = require.resolve('../../../package.json');
      const pkg = require(pkgPath);
      const commandIds = (pkg.contributes?.commands || []).map((c: { command: string }) => c.command);
      assert.ok(commandIds.includes('awesome-coding-assistants.search'), 'search command missing');
      assert.ok(commandIds.includes('awesome-coding-assistants.clearSearch'), 'clearSearch command missing');
    });
  });
});
