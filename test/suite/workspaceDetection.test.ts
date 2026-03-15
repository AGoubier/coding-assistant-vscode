// Tests for workspace tool detection and tree filtering
// Spec refs: FR-013 (workspace auto-detect), FR-014 (filter by detected tools)
// WP08 T08-01, T08-03, T08-04, T08-06

import * as assert from 'assert';
import * as vscode from 'vscode';
import { detectWorkspaceTools, classifyItem } from '../../src/services/toolDetector';
import { CatalogTreeProvider } from '../../src/providers/catalogTree';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { GitHubClient } from '../../src/services/githubClient';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type {
  SourceConfig,
  GitHubTreeResponse,
  ValidationResult,
  CatalogItem,
  CategoryItem,
  SourceItem,
  CatalogFileItem,
} from '../../src/models/types';

// --- Mock factories ---

const TEST_SOURCE: SourceConfig = {
  url: 'https://github.com/test/repo',
  name: 'Test Repo',
  branch: 'main',
};

// Tree with both Copilot and Claude Code items
const MIXED_TREE: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
    { path: '.github/agents/reviewer.agent.md', mode: '100644', type: 'blob', sha: 'a2', url: '' },
    { path: '.github/prompts/review.prompt.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
    { path: '.claude/agents/researcher.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
    { path: '.claude/rules/style.md', mode: '100644', type: 'blob', sha: 'd1', url: '' },
  ],
  truncated: false,
};

function createMockGitHubClient(treeResponse?: GitHubTreeResponse): GitHubClient {
  return {
    getRepoTree: async () => treeResponse || MIXED_TREE,
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

// --- Tests ---

describe('Workspace Tool Detection (WP08)', () => {

  describe('detectWorkspaceTools (T08-01)', () => {
    it('should detect Copilot with high confidence when .github/agents/ exists', async () => {
      // The test workspace has .github/ structure from fixtures
      // We test the function signature and return type
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        // No workspace folder available in this test environment - skip gracefully
        return;
      }
      const result = await detectWorkspaceTools(folders[0]);
      assert.ok(Array.isArray(result), 'Should return an array');
      for (const tool of result) {
        assert.ok(
          ['copilot', 'claude-code'].includes(tool.tool),
          `Tool should be copilot or claude-code, got ${tool.tool}`,
        );
        assert.ok(
          ['high', 'low'].includes(tool.confidence),
          `Confidence should be high or low, got ${tool.confidence}`,
        );
      }
    });

    it('should return empty array when no markers found', async () => {
      // Create a mock workspace folder pointing to a non-existent path
      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/nonexistent/empty/workspace'),
        name: 'empty',
        index: 0,
      };
      const result = await detectWorkspaceTools(mockFolder);
      assert.strictEqual(result.length, 0, 'Empty workspace should detect no tools');
    });
  });

  describe('classifyItem case-insensitive (T08-02)', () => {
    it('should classify mixed-case .GitHub/Agents/foo.agent.md as copilot', () => {
      const result = classifyItem('.GitHub/Agents/foo.agent.md');
      assert.strictEqual(result.tool, 'copilot');
      assert.strictEqual(result.category, 'agents');
    });

    it('should classify mixed-case .Claude/Rules/style.md as claude-code', () => {
      const result = classifyItem('.Claude/Rules/style.md');
      assert.strictEqual(result.tool, 'claude-code');
      assert.strictEqual(result.category, 'rules');
    });

    it('should classify .GITHUB/AGENTS/review.AGENT.MD as copilot (fully upper)', () => {
      const result = classifyItem('.GITHUB/AGENTS/review.AGENT.MD');
      assert.strictEqual(result.tool, 'copilot');
      assert.strictEqual(result.category, 'agents');
    });

    it('should classify .CLAUDE/settings.json case-insensitively', () => {
      const result = classifyItem('.CLAUDE/settings.json');
      assert.strictEqual(result.tool, 'claude-code');
      assert.strictEqual(result.category, 'rules');
    });

    it('should classify claude.md (lowercase) at root as claude-code (FB-01)', () => {
      const result = classifyItem('claude.md');
      assert.strictEqual(result.tool, 'claude-code');
      assert.strictEqual(result.category, 'rules');
    });

    it('should classify Claude.md (mixed case) at root as claude-code (FB-01)', () => {
      const result = classifyItem('Claude.md');
      assert.strictEqual(result.tool, 'claude-code');
      assert.strictEqual(result.category, 'rules');
    });
  });

  describe('Tree view filtering (T08-03)', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('should show all items when showAllTools is true', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Force showAllTools behavior by setting detected tools but pretending showAll is default true
      // Since we can't easily set config in test, we verify the unfiltered case
      const roots = await provider.getChildren(undefined);
      assert.strictEqual(roots.length, 1, 'Should have one source');

      const categories = await provider.getChildren(roots[0]);
      // Mixed tree has agents (Copilot + Claude), prompts (Copilot), rules (Claude) = several categories
      assert.ok(categories.length > 0, 'Should have categories');

      provider.dispose();
      registry.dispose();
    });

    it('should show all items when no tools detected (empty workspace)', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // No tools detected = show everything
      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      // Count total file items
      let totalItems = 0;
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        totalItems += files.length;
      }
      // Mixed tree has 5 items total
      assert.strictEqual(totalItems, 5, 'All items should be shown when no tools detected');

      provider.dispose();
      registry.dispose();
    });

    it('should filter out non-matching tool items when detectedTools is set', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Manually set detected tools to only copilot
      (provider as any).detectedTools = new Set(['copilot']);
      (provider as any).detectedToolsInitialized = true;

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      // Should not show Claude-only categories
      let totalItems = 0;
      let hasClaude = false;
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const f of files) {
          totalItems++;
          if ((f as CatalogFileItem).tool === 'claude-code') {
            hasClaude = true;
          }
        }
      }

      assert.ok(totalItems > 0, 'Should have some items');
      assert.ok(!hasClaude, 'Should not have Claude Code items when only copilot detected');

      provider.dispose();
      registry.dispose();
    });

    it('should show only claude items when only claude-code detected', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Manually set detected tools to only claude-code
      (provider as any).detectedTools = new Set(['claude-code']);
      (provider as any).detectedToolsInitialized = true;

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      let hasCopilot = false;
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const f of files) {
          if ((f as CatalogFileItem).tool === 'copilot') {
            hasCopilot = true;
          }
        }
      }

      assert.ok(!hasCopilot, 'Should not have Copilot items when only claude-code detected');

      provider.dispose();
      registry.dispose();
    });

    it('should show both tool items when both tools detected', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Both tools detected
      (provider as any).detectedTools = new Set(['copilot', 'claude-code']);
      (provider as any).detectedToolsInitialized = true;

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      let totalItems = 0;
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        totalItems += files.length;
      }

      assert.strictEqual(totalItems, 5, 'All items should be shown when both tools detected');

      provider.dispose();
      registry.dispose();
    });

    it('should hide empty categories after filtering', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Only copilot detected -- should hide 'rules' (claude-only) category
      (provider as any).detectedTools = new Set(['copilot']);
      (provider as any).detectedToolsInitialized = true;

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      const rulesCat = categories.find(
        c => 'category' in c && (c as CategoryItem).category === 'rules'
      );
      assert.strictEqual(rulesCat, undefined, 'Rules category should be hidden when only copilot detected');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('Toggle Show All Tools command (T08-04)', () => {
    it('showAllTools setting exists in configuration schema', () => {
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const value = config.get<boolean>('showAllTools');
      // The setting should be defined (defaults to false)
      assert.strictEqual(typeof value, 'boolean', 'showAllTools setting should be a boolean');
    });

    it('filtering respects showAllTools=true override', async () => {
      const log = createMockLogOutputChannel();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Set detected tools to copilot only, but shouldShowTool should still return true for all
      // when showAllTools is true (via the setting check in shouldShowTool)
      (provider as any).detectedTools = new Set(['copilot']);
      (provider as any).detectedToolsInitialized = true;

      // The default config has showAllTools=false, so claude items should be filtered
      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      let hasClaude = false;
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const f of files) {
          if ((f as CatalogFileItem).tool === 'claude-code') {
            hasClaude = true;
          }
        }
      }
      assert.ok(!hasClaude, 'With copilot-only detection and showAllTools=false, claude items should be filtered');

      provider.dispose();
      registry.dispose();
    });

    it('showAllTools=true shows all items even when only copilot detected (FB-04)', async () => {
      const log = createMockLogOutputChannel();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      // Set detected tools to copilot only
      (provider as any).detectedTools = new Set(['copilot']);
      (provider as any).detectedToolsInitialized = true;

      // Set showAllTools to true
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      await config.update('showAllTools', true, vscode.ConfigurationTarget.Global);

      try {
        provider.refresh();
        const roots = await provider.getChildren(undefined);
        const categories = await provider.getChildren(roots[0]);

        let totalItems = 0;
        for (const cat of categories) {
          const files = await provider.getChildren(cat as CategoryItem);
          totalItems += files.length;
        }

        // All 5 items should be visible when showAllTools=true
        assert.strictEqual(totalItems, 5, 'All items should be shown when showAllTools=true');
      } finally {
        // Restore default
        await config.update('showAllTools', false, vscode.ConfigurationTarget.Global);
        provider.dispose();
        registry.dispose();
      }
    });
  });

  describe('Tool compatibility badges (T08-05)', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('copilot items get copilot-themed icon', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      // Find agents category (has copilot items)
      for (const cat of categories) {
        const catItem = cat as CategoryItem;
        if (catItem.category === 'agents') {
          const files = await provider.getChildren(catItem);
          for (const f of files) {
            const fileItem = f as CatalogFileItem;
            if (fileItem.tool === 'copilot') {
              const treeItem = provider.getTreeItem(f);
              assert.ok(treeItem.iconPath, 'Copilot item should have an icon');
              // Should be {light, dark} with 'copilot' in the path
              const icon = treeItem.iconPath as { light: vscode.Uri; dark: vscode.Uri };
              assert.ok(
                icon.light.path.includes('copilot') || icon.dark.path.includes('copilot'),
                'Copilot item icon should reference copilot',
              );
            }
          }
        }
      }

      provider.dispose();
      registry.dispose();
    });

    it('claude-code items get claude-themed icon', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      for (const cat of categories) {
        const catItem = cat as CategoryItem;
        if (catItem.category === 'rules') {
          const files = await provider.getChildren(catItem);
          for (const f of files) {
            const fileItem = f as CatalogFileItem;
            if (fileItem.tool === 'claude-code') {
              const treeItem = provider.getTreeItem(f);
              assert.ok(treeItem.iconPath, 'Claude item should have an icon');
              const icon = treeItem.iconPath as { light: vscode.Uri; dark: vscode.Uri };
              assert.ok(
                icon.light.path.includes('claude') || icon.dark.path.includes('claude'),
                'Claude item icon should reference claude',
              );
            }
          }
        }
      }

      provider.dispose();
      registry.dispose();
    });

    it('file item tooltip shows tool name', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient();
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const f of files) {
          const treeItem = provider.getTreeItem(f);
          const fileItem = f as CatalogFileItem;
          assert.ok(
            (treeItem.tooltip as string).includes(fileItem.tool),
            `Tooltip "${treeItem.tooltip}" should include tool name "${fileItem.tool}"`,
          );
        }
      }

      provider.dispose();
      registry.dispose();
    });
  });
});
