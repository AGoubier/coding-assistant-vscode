// Tests for bundle manifest parsing, tree display, and installation
// Spec refs: US-07 (Org Practice Bundles), Section 7.7, 7.8
// WP09 T09-05

import * as assert from 'assert';
import * as vscode from 'vscode';
import { parseBundle } from '../../src/services/bundleParser';
import { CatalogTreeProvider } from '../../src/providers/catalogTree';
import { installBundleCommand } from '../../src/commands/installBundleCommand';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { GitHubClient } from '../../src/services/githubClient';
import { Installer } from '../../src/services/installer';
import { ManifestManager } from '../../src/services/manifestManager';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type {
  SourceConfig,
  GitHubTreeResponse,
  ValidationResult,
  BundleCategoryItem,
  BundleNodeItem,
  BundleFileItem,
  Bundle,
  InstallationEntry,
} from '../../src/models/types';

// --- Fixtures ---

const VALID_BUNDLE_JSON = JSON.stringify({
  name: 'Team Onboarding',
  description: 'Essential customizations for new team members',
  items: [
    { path: '.github/agents/coder.agent.md', tool: 'copilot', category: 'agents' },
    { path: '.github/agents/reviewer.agent.md', tool: 'copilot', category: 'agents' },
    { path: '.github/prompts/review.prompt.md', tool: 'copilot', category: 'prompts' },
    { path: '.claude/agents/researcher.md', tool: 'claude-code', category: 'agents' },
    { path: '.claude/rules/style.md', tool: 'claude-code', category: 'rules' },
  ],
});

const CROSS_SOURCE_BUNDLE_JSON = JSON.stringify({
  name: 'Cross-Source Bundle',
  items: [
    { path: '.github/agents/coder.agent.md', tool: 'copilot', category: 'agents' },
    { path: '.claude/rules/style.md', tool: 'claude-code', category: 'rules', sourceUrl: 'https://github.com/other/repo' },
  ],
});

const OPTIONAL_ITEMS_BUNDLE_JSON = JSON.stringify({
  name: 'With Optionals',
  items: [
    { path: '.github/agents/coder.agent.md', tool: 'copilot', category: 'agents', required: true },
    { path: '.github/prompts/review.prompt.md', tool: 'copilot', category: 'prompts', required: false },
  ],
});

const TEST_SOURCE: SourceConfig = {
  url: 'https://github.com/test/repo',
  name: 'Test Repo',
  branch: 'main',
};

// Tree with bundles/ directory
const TREE_WITH_BUNDLES: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
    { path: 'bundles/team-onboarding.json', mode: '100644', type: 'blob', sha: 'b1', url: '' },
  ],
  truncated: false,
};

// Tree without bundles
const TREE_WITHOUT_BUNDLES: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
  ],
  truncated: false,
};

function createMockGitHubClient(treeResponse?: GitHubTreeResponse, bundleContent?: string): GitHubClient {
  return {
    getRepoTree: async () => treeResponse || TREE_WITH_BUNDLES,
    getFileContent: async (source: SourceConfig, path: string) => {
      if (path.startsWith('bundles/') && path.endsWith('.json')) {
        return bundleContent || VALID_BUNDLE_JSON;
      }
      return '# Test content';
    },
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

describe('Org Practice Bundles (WP09)', () => {

  describe('Bundle manifest parser (T09-01)', () => {
    it('should parse valid bundle JSON with all fields', () => {
      const bundle = parseBundle(VALID_BUNDLE_JSON);
      assert.strictEqual(bundle.name, 'Team Onboarding');
      assert.strictEqual(bundle.description, 'Essential customizations for new team members');
      assert.strictEqual(bundle.items.length, 5);
      assert.strictEqual(bundle.items[0].path, '.github/agents/coder.agent.md');
      assert.strictEqual(bundle.items[0].tool, 'copilot');
      assert.strictEqual(bundle.items[0].category, 'agents');
    });

    it('should parse bundle with optional fields omitted', () => {
      const json = JSON.stringify({
        name: 'Minimal',
        items: [{ path: '.github/agents/a.agent.md', tool: 'copilot', category: 'agents' }],
      });
      const bundle = parseBundle(json);
      assert.strictEqual(bundle.name, 'Minimal');
      assert.strictEqual(bundle.description, undefined);
      assert.strictEqual(bundle.items[0].required, true); // default
      assert.strictEqual(bundle.items[0].sourceUrl, undefined);
    });

    it('should reject bundle with missing name', () => {
      const json = JSON.stringify({
        items: [{ path: 'a.md', tool: 'copilot', category: 'agents' }],
      });
      assert.throws(() => parseBundle(json), /name.*required/i);
    });

    it('should reject bundle with empty items array', () => {
      const json = JSON.stringify({ name: 'Empty', items: [] });
      assert.throws(() => parseBundle(json), /items.*at least one/i);
    });

    it('should reject bundle with missing items', () => {
      const json = JSON.stringify({ name: 'NoItems' });
      assert.throws(() => parseBundle(json), /items.*required/i);
    });

    it('should reject bundle item with invalid tool', () => {
      const json = JSON.stringify({
        name: 'Bad Tool',
        items: [{ path: 'a.md', tool: 'invalid', category: 'agents' }],
      });
      assert.throws(() => parseBundle(json), /tool.*required/i);
    });

    it('should reject bundle item with missing path', () => {
      const json = JSON.stringify({
        name: 'No Path',
        items: [{ tool: 'copilot', category: 'agents' }],
      });
      assert.throws(() => parseBundle(json), /path.*required/i);
    });

    it('should reject bundle item with missing category', () => {
      const json = JSON.stringify({
        name: 'No Cat',
        items: [{ path: 'a.md', tool: 'copilot' }],
      });
      assert.throws(() => parseBundle(json), /category.*required/i);
    });

    it('should reject invalid JSON', () => {
      assert.throws(() => parseBundle('not json'), /unable to parse/i);
    });

    it('should reject name exceeding 100 chars', () => {
      const json = JSON.stringify({
        name: 'x'.repeat(101),
        items: [{ path: 'a.md', tool: 'copilot', category: 'agents' }],
      });
      assert.throws(() => parseBundle(json), /name.*at most 100/i);
    });

    it('should parse cross-source bundle item with sourceUrl', () => {
      const bundle = parseBundle(CROSS_SOURCE_BUNDLE_JSON);
      assert.strictEqual(bundle.items[0].sourceUrl, undefined);
      assert.strictEqual(bundle.items[1].sourceUrl, 'https://github.com/other/repo');
    });

    it('should parse optional items with required=false', () => {
      const bundle = parseBundle(OPTIONAL_ITEMS_BUNDLE_JSON);
      assert.strictEqual(bundle.items[0].required, true);
      assert.strictEqual(bundle.items[1].required, false);
    });
  });

  describe('Bundle discovery in tree (T09-02)', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      log = createMockLogOutputChannel();
    });

    it('should show Bundles category when source has bundles/', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(TREE_WITH_BUNDLES);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      const bundlesCat = categories.find(
        c => 'kind' in c && (c as any).kind === 'bundleCategory',
      );
      assert.ok(bundlesCat, 'Should have a Bundles category');

      const treeItem = provider.getTreeItem(bundlesCat!);
      assert.strictEqual(treeItem.label, 'Bundles');

      provider.dispose();
      registry.dispose();
    });

    it('should not show Bundles category when source has no bundles/', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(TREE_WITHOUT_BUNDLES);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      const bundlesCat = categories.find(
        c => 'kind' in c && (c as any).kind === 'bundleCategory',
      );
      assert.strictEqual(bundlesCat, undefined, 'Should not have a Bundles category');

      provider.dispose();
      registry.dispose();
    });

    it('should show bundle items with count badge under Bundles', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(TREE_WITH_BUNDLES);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);

      const bundlesCat = categories.find(
        c => 'kind' in c && (c as any).kind === 'bundleCategory',
      ) as BundleCategoryItem;
      assert.ok(bundlesCat);

      const bundles = await provider.getChildren(bundlesCat);
      assert.strictEqual(bundles.length, 1, 'Should have one bundle');

      const bundleTreeItem = provider.getTreeItem(bundles[0]);
      assert.strictEqual(bundleTreeItem.label, 'Team Onboarding');
      assert.strictEqual(bundleTreeItem.description, '5 items');
      assert.strictEqual(bundleTreeItem.contextValue, 'bundleItem');

      provider.dispose();
      registry.dispose();
    });

    it('should show bundle child items when expanded', async () => {
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(TREE_WITH_BUNDLES);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);
      const bundlesCat = categories.find(
        c => 'kind' in c && (c as any).kind === 'bundleCategory',
      ) as BundleCategoryItem;
      const bundles = await provider.getChildren(bundlesCat);
      const bundleNode = bundles[0] as BundleNodeItem;

      const children = await provider.getChildren(bundleNode);
      assert.strictEqual(children.length, 5, 'Bundle should have 5 child items');

      // Verify first child
      const firstChild = children[0] as BundleFileItem;
      assert.strictEqual(firstChild.kind, 'bundleFile');
      assert.strictEqual(firstChild.bundleItem.path, '.github/agents/coder.agent.md');

      // Verify tree item rendering
      const childTreeItem = provider.getTreeItem(firstChild);
      assert.ok(typeof childTreeItem.description === 'string' && childTreeItem.description.includes('copilot'));

      provider.dispose();
      registry.dispose();
    });
  });

  describe('Install Bundle command (T09-03)', () => {
    it('installBundle command is registered in package.json', () => {
      const pkgPath = require.resolve('../../../package.json');
      const pkg = require(pkgPath);
      const commandIds = (pkg.contributes?.commands || []).map((c: { command: string }) => c.command);
      assert.ok(commandIds.includes('awesome-coding-assistants.installBundle'), 'installBundle command missing from package.json');
    });
  });

  describe('Bundle menu contributions (T09-04)', () => {
    it('bundle tree items have contextValue=bundleItem', async () => {
      const log = createMockLogOutputChannel();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const github = createMockGitHubClient(TREE_WITH_BUNDLES);
      const provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());

      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);
      const bundlesCat = categories.find(
        c => 'kind' in c && (c as any).kind === 'bundleCategory',
      ) as BundleCategoryItem;
      const bundles = await provider.getChildren(bundlesCat);

      const treeItem = provider.getTreeItem(bundles[0]);
      assert.strictEqual(treeItem.contextValue, 'bundleItem');

      provider.dispose();
      registry.dispose();
    });
  });

  describe('Install Bundle integration (T09-03, T09-05)', () => {
    const OTHER_SOURCE: SourceConfig = {
      url: 'https://github.com/other/repo',
      name: 'Other Repo',
      branch: 'main',
    };

    const FAKE_FOLDER: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file('/tmp/test-workspace'),
      name: 'test-workspace',
      index: 0,
    };

    function createMockInstaller(opts?: {
      failPaths?: string[];
    }): Installer {
      const failPaths = opts?.failPaths || [];
      const installedFiles: string[] = [];
      return {
        selectTargetFolder: async () => FAKE_FOLDER,
        installFile: async (_source: SourceConfig, path: string, _targetUri: vscode.Uri, _relPath: string) => {
          if (failPaths.includes(path)) {
            throw new Error(`Simulated install failure for ${path}`);
          }
          installedFiles.push(path);
        },
        installDirectory: async () => [],
        fileExists: async () => false,
        _installedFiles: installedFiles,
      } as unknown as Installer & { _installedFiles: string[] };
    }

    function createMockManifest(): ManifestManager & { _entries: InstallationEntry[] } {
      const entries: InstallationEntry[] = [];
      return {
        addInstallation: async (_folder: vscode.WorkspaceFolder, entry: InstallationEntry) => {
          entries.push(entry);
        },
        removeInstallation: async () => {},
        readManifest: async () => ({ version: '1.0', installations: [] }),
        writeManifest: async () => {},
        getInstallation: async () => undefined,
        isInstalled: async () => false,
        _entries: entries,
      } as unknown as ManifestManager & { _entries: InstallationEntry[] };
    }

    function createMockGitHubForInstall(): GitHubClient {
      return {
        getRepoTree: async () => TREE_WITH_BUNDLES,
        getFileContent: async () => '# Content',
        getLatestCommitSha: async () => 'sha-latest-123',
        validateRepo: async () => ({ valid: true } as ValidationResult),
      } as unknown as GitHubClient;
    }

    it('should install all items in a bundle (happy path)', async () => {
      const bundle = parseBundle(VALID_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/test.json' };
      const installer = createMockInstaller();
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const log = createMockLogOutputChannel();
      let refreshed = false;

      await installBundleCommand(bundleNode, installer, github, manifest, registry, log, () => { refreshed = true; });

      assert.strictEqual((installer as any)._installedFiles.length, 5, 'All 5 items should be installed');
      assert.strictEqual(manifest._entries.length, 5, 'All 5 items should be in manifest');
      assert.ok(refreshed, 'Tree should be refreshed after install');
    });

    it('should resolve cross-source items from registry', async () => {
      const bundle = parseBundle(CROSS_SOURCE_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/cross.json' };
      const installer = createMockInstaller();
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      const registry = createMockSourceRegistry([TEST_SOURCE, OTHER_SOURCE]);
      const log = createMockLogOutputChannel();

      await installBundleCommand(bundleNode, installer, github, manifest, registry, log, () => {});

      // Both items should install - one from parent source, one from cross-source
      assert.strictEqual((installer as any)._installedFiles.length, 2, 'Both items should install');
      assert.strictEqual(manifest._entries.length, 2, 'Both items in manifest');
      // Cross-source item should reference the other source URL
      const crossEntry = manifest._entries.find(e => e.sourceUrl === 'https://github.com/other/repo');
      assert.ok(crossEntry, 'Cross-source entry should reference other repo URL');
    });

    it('should abort on required item failure', async () => {
      const bundle = parseBundle(VALID_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/test.json' };
      // Fail the second item (which is required by default)
      const installer = createMockInstaller({ failPaths: ['.github/agents/reviewer.agent.md'] });
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const log = createMockLogOutputChannel();

      await installBundleCommand(bundleNode, installer, github, manifest, registry, log, () => {});

      // First item installs, second fails and aborts, remaining items skipped
      assert.strictEqual((installer as any)._installedFiles.length, 1, 'Only first item should install before abort');
      assert.strictEqual(manifest._entries.length, 1, 'Only first manifest entry');
    });

    it('should continue on optional item failure', async () => {
      const bundle = parseBundle(OPTIONAL_ITEMS_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/opt.json' };
      // Fail the optional item
      const installer = createMockInstaller({ failPaths: ['.github/prompts/review.prompt.md'] });
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const log = createMockLogOutputChannel();

      await installBundleCommand(bundleNode, installer, github, manifest, registry, log, () => {});

      // First item (required) installs, second (optional) fails but continues
      assert.strictEqual((installer as any)._installedFiles.length, 1, 'Required item should install');
      assert.strictEqual(manifest._entries.length, 1, 'Only successful item in manifest');
    });

    it('should warn and skip when cross-source is not configured', async () => {
      const bundle = parseBundle(CROSS_SOURCE_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/cross.json' };
      const installer = createMockInstaller();
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      // Only parent source configured, NOT the cross-source
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const log = createMockLogOutputChannel();

      await installBundleCommand(bundleNode, installer, github, manifest, registry, log, () => {});

      // First item installs, second (cross-source) skips since its source is not configured
      // The cross-source item has no "required" field so defaults to true - should abort
      assert.strictEqual((installer as any)._installedFiles.length, 1, 'Only parent-source item should install');
    });

    it('should return gracefully if no workspace folder selected', async () => {
      const bundle = parseBundle(VALID_BUNDLE_JSON);
      const bundleNode: BundleNodeItem = { kind: 'bundle', source: TEST_SOURCE, bundle, bundlePath: 'bundles/test.json' };
      const noFolderInstaller = {
        selectTargetFolder: async () => undefined,
        installFile: async () => {},
        installDirectory: async () => [],
        fileExists: async () => false,
      } as unknown as Installer;
      const manifest = createMockManifest();
      const github = createMockGitHubForInstall();
      const registry = createMockSourceRegistry([TEST_SOURCE]);
      const log = createMockLogOutputChannel();
      let refreshed = false;

      await installBundleCommand(bundleNode, noFolderInstaller, github, manifest, registry, log, () => { refreshed = true; });

      assert.strictEqual(manifest._entries.length, 0, 'No items should be installed');
      assert.strictEqual(refreshed, false, 'Tree should not be refreshed');
    });
  });
});
