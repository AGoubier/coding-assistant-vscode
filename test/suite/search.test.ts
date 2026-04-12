// Tests for search and filter functionality
// Spec refs: US-08 (Search and Filter), FR-019 (Search Across Folders), FR-020 (Folder Hierarchy in Search)
// WP10 T10-05, WP18 T18-01 through T18-05

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

  describe('Folder search (WP18)', () => {
    // Tree with two folders and root-level (Default) entries
    const FOLDER_SEARCH_TREE: GitHubTreeResponse = {
      sha: 'foldersearch',
      url: 'https://api.github.com/repos/test/repo/git/trees/main',
      tree: [
        // Root-level entries (Default folder)
        { path: '.github/agents/root-agent.agent.md', mode: '100644', type: 'blob', sha: 'r1', url: '' },
        { path: '.github/prompts/root-prompt.prompt.md', mode: '100644', type: 'blob', sha: 'r2', url: '' },
        // frontend-team folder entries
        { path: 'frontend-team/.github/agents/fe-agent.agent.md', mode: '100644', type: 'blob', sha: 'f1', url: '' },
        { path: 'frontend-team/.github/instructions/fe-setup.instructions.md', mode: '100644', type: 'blob', sha: 'f2', url: '' },
        // backend folder entries
        { path: 'backend/.github/agents/be-agent.agent.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
        { path: 'backend/.claude/rules/be-rules.md', mode: '100644', type: 'blob', sha: 'b2', url: '' },
        // Tree entries (directories - ignored by classification)
        { path: '.github', mode: '040000', type: 'tree', sha: 'g1', url: '' },
        { path: 'frontend-team', mode: '040000', type: 'tree', sha: 'g2', url: '' },
        { path: 'backend', mode: '040000', type: 'tree', sha: 'g3', url: '' },
      ],
      truncated: false,
    };

    // Tree with folders but no items matching a specific query
    const FOLDER_NO_MATCH_TREE: GitHubTreeResponse = {
      sha: 'foldernomatch',
      url: 'https://api.github.com/repos/test/repo/git/trees/main',
      tree: [
        { path: 'frontend-team/.github/agents/fe-agent.agent.md', mode: '100644', type: 'blob', sha: 'f1', url: '' },
        { path: 'backend/.github/agents/be-agent.agent.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
      ],
      truncated: false,
    };

    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('T18-01: search matches items from ALL folders and the Default folder (FR-019)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "agent" should match items in both folders AND default
      provider.setSearchQuery('agent');

      const roots = await provider.getChildren(undefined);
      assert.ok(roots.length > 0);
      assert.strictEqual((roots[0] as any).kind, 'source');

      // Get source children - should show filtered folders
      const children = await provider.getChildren(roots[0]);
      const folders = children.filter((c: any) => c.kind === 'folder');

      // All three folders should have matching items (Default, Backend, Frontend Team)
      assert.ok(folders.length >= 2, `Expected at least 2 folder nodes with matches, got ${folders.length}`);

      const folderNames = (folders as any[]).map((f: any) => f.displayName);
      assert.ok(folderNames.includes('Backend'), 'Backend folder should be visible (has agent match)');
      assert.ok(folderNames.includes('Frontend Team'), 'Frontend Team folder should be visible (has agent match)');

      provider.dispose();
      registry.dispose();
    });

    it('T18-01: folders with zero matching items are hidden during search (FR-020)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "fe-agent" should only match in frontend-team folder
      provider.setSearchQuery('fe-agent');

      const roots = await provider.getChildren(undefined);
      const children = await provider.getChildren(roots[0]);
      const folders = children.filter((c: any) => c.kind === 'folder');

      const folderNames = (folders as any[]).map((f: any) => f.displayName);
      assert.ok(folderNames.includes('Frontend Team'), 'Frontend Team should be visible (has fe-agent match)');
      assert.ok(!folderNames.includes('Backend'), 'Backend should be hidden (no fe-agent match)');

      provider.dispose();
      registry.dispose();
    });

    it('T18-01: Default folder is hidden if none of its items match (FR-020)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "be-rules" only matches in backend folder, not Default
      provider.setSearchQuery('be-rules');

      const roots = await provider.getChildren(undefined);
      const children = await provider.getChildren(roots[0]);
      const folders = children.filter((c: any) => c.kind === 'folder');

      const folderNames = (folders as any[]).map((f: any) => f.displayName);
      assert.ok(!folderNames.includes('Default'), 'Default folder should be hidden (no match)');
      assert.ok(folderNames.includes('Backend'), 'Backend should be visible (has be-rules match)');

      provider.dispose();
      registry.dispose();
    });

    it('T18-01: SearchEmptyItem when no items match across ALL folders and sources (FR-019)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_NO_MATCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "nonexistent" matches nothing
      provider.setSearchQuery('nonexistent');

      const roots = await provider.getChildren(undefined);
      assert.strictEqual(roots.length, 1);
      assert.strictEqual((roots[0] as any).kind, 'searchEmpty');
      assert.strictEqual((roots[0] as any).query, 'nonexistent');

      provider.dispose();
      registry.dispose();
    });

    it('T18-01: clearing search restores full folder hierarchy', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Search then clear
      provider.setSearchQuery('fe-agent');
      provider.setSearchQuery('');

      const roots = await provider.getChildren(undefined);
      assert.strictEqual((roots[0] as any).kind, 'source');

      const children = await provider.getChildren(roots[0]);
      const folders = children.filter((c: any) => c.kind === 'folder');

      // All folders should be restored
      const folderNames = (folders as any[]).map((f: any) => f.displayName);
      assert.ok(folderNames.includes('Backend'), 'Backend folder should be restored');
      assert.ok(folderNames.includes('Frontend Team'), 'Frontend Team folder should be restored');
      assert.ok(folderNames.includes('Default'), 'Default folder should be restored');

      provider.dispose();
      registry.dispose();
    });

    it('T18-02: categories within a folder with zero matching items are hidden during search (FR-019)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "fe-setup" matches only instructions in frontend-team
      provider.setSearchQuery('fe-setup');

      const roots = await provider.getChildren(undefined);
      const sourceChildren = await provider.getChildren(roots[0]);
      const frontendFolder = sourceChildren.find(
        (c: any) => c.kind === 'folder' && c.displayName === 'Frontend Team',
      );
      assert.ok(frontendFolder, 'Frontend Team folder should be visible');

      const folderCategories = await provider.getChildren(frontendFolder!);
      const categoryNames = (folderCategories as any[])
        .filter(c => (c as any).kind === 'category')
        .map(c => (c as CategoryItem).category);

      assert.ok(categoryNames.includes('instructions'), 'Instructions category should be visible (has match)');
      assert.ok(!categoryNames.includes('agents'), 'Agents category should be hidden (no match)');

      provider.dispose();
      registry.dispose();
    });

    it('T18-02: filteredCount on category nodes within folders is correct during search (FR-020)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "agent" matches agent items in every folder
      provider.setSearchQuery('agent');

      const roots = await provider.getChildren(undefined);
      const sourceChildren = await provider.getChildren(roots[0]);
      const frontendFolder = sourceChildren.find(
        (c: any) => c.kind === 'folder' && c.displayName === 'Frontend Team',
      );
      assert.ok(frontendFolder, 'Frontend Team folder should be visible');

      const folderCategories = await provider.getChildren(frontendFolder!);
      const agentsCat = folderCategories.find(
        (c: any) => c.kind === 'category' && (c as CategoryItem).category === 'agents',
      ) as CategoryItem;
      assert.ok(agentsCat, 'Agents category should be visible');
      assert.strictEqual(agentsCat.filteredCount, 1, 'filteredCount should be 1 for single match');

      provider.dispose();
      registry.dispose();
    });

    it('T18-03: hasAnySearchMatch returns true when match exists in any folder (FR-019)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "be-rules" matches only in backend folder -- should still return source (not searchEmpty)
      provider.setSearchQuery('be-rules');

      const roots = await provider.getChildren(undefined);
      assert.ok(roots.length > 0);
      assert.strictEqual((roots[0] as any).kind, 'source', 'Should return source (not searchEmpty) when match exists in any folder');

      provider.dispose();
      registry.dispose();
    });

    it('T18-03: hasAnySearchMatch returns false when no items match across all folders (FR-019)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_NO_MATCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      provider.setSearchQuery('zzz-no-match-zzz');

      const roots = await provider.getChildren(undefined);
      assert.strictEqual(roots.length, 1);
      assert.strictEqual((roots[0] as any).kind, 'searchEmpty');

      provider.dispose();
      registry.dispose();
    });

    it('T18-04: tree path during search preserves Source > Folder > Category > Item hierarchy (FR-020)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "fe-agent" matches frontend-team agent
      provider.setSearchQuery('fe-agent');

      // Level 1: Source
      const roots = await provider.getChildren(undefined);
      assert.strictEqual((roots[0] as any).kind, 'source');

      // Level 2: Folder
      const sourceChildren = await provider.getChildren(roots[0]);
      const frontendFolder = sourceChildren.find(
        (c: any) => c.kind === 'folder' && c.displayName === 'Frontend Team',
      );
      assert.ok(frontendFolder, 'Frontend Team folder should be at level 2');

      // Level 3: Category
      const categories = await provider.getChildren(frontendFolder!);
      const agentsCat = categories.find(
        (c: any) => c.kind === 'category' && (c as CategoryItem).category === 'agents',
      );
      assert.ok(agentsCat, 'Agents category should be at level 3');

      // Level 4: Item
      const items = await provider.getChildren(agentsCat!) as CatalogFileItem[];
      assert.strictEqual(items.length, 1);
      assert.ok(items[0].name.includes('fe-agent'), 'Matching item should be at level 4');
      assert.ok(items[0].path.includes('frontend-team/'), 'Item path should include folder prefix');

      provider.dispose();
      registry.dispose();
    });

    it('T18-04: no duplicate items appear across folders during search', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "agent" matches in all folders
      provider.setSearchQuery('agent');

      const roots = await provider.getChildren(undefined);
      const sourceChildren = await provider.getChildren(roots[0]);
      const folders = sourceChildren.filter((c: any) => c.kind === 'folder');

      // Collect all item paths across all folders
      const allPaths: string[] = [];
      for (const folder of folders) {
        const categories = await provider.getChildren(folder);
        for (const cat of categories) {
          if ((cat as any).kind === 'category') {
            const items = await provider.getChildren(cat) as CatalogFileItem[];
            for (const item of items) {
              allPaths.push(item.path);
            }
          }
        }
      }

      // Check no duplicates
      const uniquePaths = new Set(allPaths);
      assert.strictEqual(allPaths.length, uniquePaths.size, 'No duplicate item paths should appear across folders');

      provider.dispose();
      registry.dispose();
    });

    it('T18-05: search with all folders matching shows all folders', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "agent" should match in Default, Frontend Team, and Backend
      provider.setSearchQuery('agent');

      const roots = await provider.getChildren(undefined);
      const sourceChildren = await provider.getChildren(roots[0]);
      const folders = sourceChildren.filter((c: any) => c.kind === 'folder');

      assert.ok(folders.length >= 3, `Expected at least 3 folders with matches, got ${folders.length}`);

      provider.dispose();
      registry.dispose();
    });

    it('T18-05: search with only one folder matching hides others', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(FOLDER_SEARCH_TREE);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "be-agent" matches only in backend folder
      provider.setSearchQuery('be-agent');

      const roots = await provider.getChildren(undefined);
      const sourceChildren = await provider.getChildren(roots[0]);
      const folders = sourceChildren.filter((c: any) => c.kind === 'folder');

      assert.strictEqual(folders.length, 1, 'Only one folder should have matches');
      assert.strictEqual((folders[0] as any).displayName, 'Backend');

      provider.dispose();
      registry.dispose();
    });

    it('T18-03: hasAnySearchMatch correctly strips folder prefixes before classifyItem', async () => {
      // Use a tree where items would fail classification without prefix stripping
      const prefixTree: GitHubTreeResponse = {
        sha: 'prefix',
        url: 'https://api.github.com/repos/test/repo/git/trees/main',
        tree: [
          { path: 'teamA/.github/agents/special-agent.agent.md', mode: '100644', type: 'blob', sha: 'p1', url: '' },
        ],
        truncated: false,
      };

      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(prefixTree);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // "special" should match even though the path has a folder prefix
      provider.setSearchQuery('special');

      const roots = await provider.getChildren(undefined);
      // Should NOT be searchEmpty -- the match should be found via prefix stripping
      assert.ok(roots.length > 0);
      assert.strictEqual((roots[0] as any).kind, 'source', 'Match should be found after folder prefix stripping');

      provider.dispose();
      registry.dispose();
    });
  });
});
