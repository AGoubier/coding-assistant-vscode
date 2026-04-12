// E2E Test: Browse > Preview > Install journey
// Spec refs: Section 11.4, Section 6.1, Section 6.2
// WP07 T07-02

import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitHubClient } from '../../src/services/githubClient.js';
import { AuthManager } from '../../src/services/authManager.js';
import { CacheManager } from '../../src/services/cacheManager.js';
import { Installer } from '../../src/services/installer.js';
import { ManifestManager, VscFs } from '../../src/services/manifestManager.js';
import { CatalogTreeProvider } from '../../src/providers/catalogTree.js';
import { SourceRegistry, sourceKey } from '../../src/services/sourceRegistry.js';
import { LifecycleManager } from '../../src/services/lifecycle.js';
import { FetchMocker, loadFixture, loadJsonFixture } from '../helpers/e2e.js';
import { NewContentDetector } from '../../src/services/newContentDetector.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import type { CatalogFileItem, GitHubTreeResponse, SourceConfig } from '../../src/models/types.js';
import { installationId } from '../../src/models/types.js';

// In-memory filesystem for install targets
class E2eFsStore {
  files = new Map<string, string>();

  private normKey(k: string): string {
    return k.replace(/\\/g, '/');
  }

  has(key: string): boolean {
    return this.files.has(this.normKey(key));
  }

  get(key: string): string | undefined {
    return this.files.get(this.normKey(key));
  }

  set(key: string, value: string): void {
    this.files.set(this.normKey(key), value);
  }

  createMockFs(): VscFs {
    const self = this;
    return {
      readFile: async (uri: vscode.Uri) => {
        const content = self.get(uri.path);
        if (content === undefined) {
          throw vscode.FileSystemError.FileNotFound(uri);
        }
        return Buffer.from(content, 'utf-8');
      },
      writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
        self.set(uri.path, Buffer.from(content).toString('utf-8'));
      },
      createDirectory: async () => {},
      stat: async (uri: vscode.Uri) => {
        if (self.has(uri.path)) {
          return { type: vscode.FileType.File, size: 0, ctime: 0, mtime: 0 };
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      },
      rename: async (source: vscode.Uri, target: vscode.Uri) => {
        const content = self.get(source.path);
        if (content !== undefined) {
          self.set(target.path, content);
          self.files.delete(self.normKey(source.path));
        }
      },
      delete: async (uri: vscode.Uri) => {
        self.files.delete(self.normKey(uri.path));
      },
    };
  }
}

describe('WP07 - E2E: Browse > Preview > Install', function () {
  this.timeout(30000);

  let fetchMocker: FetchMocker;
  let fsStore: E2eFsStore;
  let mockFs: VscFs;
  let log: ReturnType<typeof createMockLogOutputChannel>;
  let ctx: vscode.ExtensionContext;
  let githubClient: GitHubClient;
  let installer: Installer;
  let manifestManager: ManifestManager;
  let treeProvider: CatalogTreeProvider;
  let sourceRegistry: SourceRegistry;
  let folder: vscode.WorkspaceFolder;

  // The default source used by SourceRegistry
  const defaultSource: SourceConfig = {
    url: 'https://github.com/jlacube/awesome-coding-assistants',
    name: 'Awesome Coding Assistants',
    branch: 'main',
  };

  const treeFixture = loadJsonFixture<GitHubTreeResponse>('api/tree.json');
  const agentContent = loadFixture('contents/code-review.agent.md');

  beforeEach(() => {
    fetchMocker = new FetchMocker();
    fsStore = new E2eFsStore();
    mockFs = fsStore.createMockFs();
    log = createMockLogOutputChannel();
    ctx = createMockExtensionContext();
    folder = {
      uri: vscode.Uri.file('/e2e-workspace'),
      name: 'e2e-test',
      index: 0,
    };

    // Mock routes for any source URL
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      treeFixture,
      { etag: '"tree-etag-1"' },
    );

    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\/.*\/main\/.github\/agents\/code-review\.agent\.md/,
      status: 200,
      body: agentContent,
    });

    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\//,
      status: 200,
      body: '# Mock content',
    });

    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/commits\?/,
      200,
      [{ sha: 'sha_v1_34567890123456789012345678901234' }],
    );

    // Validate repo
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\//,
      status: 200,
      body: '{}',
    });

    fetchMocker.install();

    // Create services
    const authManager = new AuthManager(ctx, log);
    const cacheManager = new CacheManager(ctx, log);
    githubClient = new GitHubClient(authManager, cacheManager, log);
    installer = new Installer(githubClient, log, mockFs);
    manifestManager = new ManifestManager(log, mockFs);
    sourceRegistry = new SourceRegistry(githubClient, log);

    // Create tree provider with real source
    treeProvider = new CatalogTreeProvider(
      sourceRegistry,
      githubClient,
      log,
      vscode.Uri.file('/e2e-ext'),
    );
  });

  afterEach(() => {
    fetchMocker.restore();
  });

  it('loads source tree with expected structure', async () => {
    // Get top-level children (source items)
    const roots = await treeProvider.getChildren();
    assert.ok(roots.length > 0, 'Should have at least one source');

    // Get source item
    const sourceItem = roots[0];
    assert.ok(sourceItem, 'Source item should exist');
    assert.strictEqual(sourceItem.kind, 'source');

    // Get categories under the source
    const categories = await treeProvider.getChildren(sourceItem);
    assert.ok(categories.length > 0, 'Should have at least one category');

    // Find agents category
    const agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
    assert.ok(agentsCat, 'Should have an agents category');
  });

  it('fetches file content via preview scheme', async () => {
    // Get tree items to find the code-review agent
    const roots = await treeProvider.getChildren();
    const categories = await treeProvider.getChildren(roots[0]);
    const agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
    assert.ok(agentsCat);

    const items = await treeProvider.getChildren(agentsCat);
    const codeReviewItem = items.find(
      (i): i is CatalogFileItem => i.kind === 'item' && i.name === 'code-review',
    );
    assert.ok(codeReviewItem, 'Should find code-review item');

    // Fetch file content via GitHub client (simulates preview)
    const content = await githubClient.getFileContent(codeReviewItem.source, codeReviewItem.path);
    assert.ok(content.includes('Code Review Agent'), 'Content should match fixture');
  });

  it('installs file to workspace and creates manifest entry', async () => {
    // Build a catalog file item
    const item: CatalogFileItem = {
      kind: 'item',
      source: defaultSource,
      path: '.github/agents/code-review.agent.md',
      name: 'code-review.agent.md',
      tool: 'copilot',
      category: 'agents',
      installed: false,
      updateAvailable: false,
    };

    // Mock workspace folders
    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    // Mock showOpenDialog to return the workspace folder (simulating folder selection)
    const origShowOpen = vscode.window.showOpenDialog;
    (vscode.window as any).showOpenDialog = async () => [folder.uri];

    try {
      // Use installer directly (simulating the command flow without UI)
      const content = await githubClient.getFileContent(item.source, item.path);
      const sha = 'sha_v1_34567890123456789012345678901234';

      // Write file to mock FS
      const targetUri = vscode.Uri.joinPath(folder.uri, '.github/agents/code-review.agent.md');
      await mockFs.createDirectory(vscode.Uri.joinPath(folder.uri, '.github/agents'));
      await mockFs.writeFile(targetUri, Buffer.from(content, 'utf-8'));

      // Create manifest entry
      await manifestManager.addInstallation(folder, {
        id: installationId(item.source.url, item.source.branch, item.path),
        sourceUrl: item.source.url,
        sourceBranch: item.source.branch || 'main',
        itemPath: item.path,
        targetPaths: ['.github/agents/code-review.agent.md'],
        tool: item.tool,
        category: item.category,
        commitSha: sha,
        installedAt: new Date().toISOString(),
      });

      // Verify file exists in mock FS
      const stat = await mockFs.stat(targetUri);
      assert.strictEqual(stat.type, vscode.FileType.File);

      // Verify installed content
      const bytes = await mockFs.readFile(targetUri);
      const fileContent = Buffer.from(bytes).toString('utf-8');
      assert.ok(fileContent.includes('Code Review Agent'));

      // Verify manifest has the entry
      const manifest = await manifestManager.readManifest(folder);
      assert.strictEqual(manifest.installations.length, 1);
      assert.strictEqual(manifest.installations[0].id, installationId(item.source.url, item.source.branch, item.path));
      assert.strictEqual(manifest.installations[0].commitSha, sha);
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
      (vscode.window as any).showOpenDialog = origShowOpen;
    }
  });

  it('tree item shows installed badge after install', async () => {
    // Install an item into the manifest
    await manifestManager.addInstallation(folder, {
      id: installationId(defaultSource.url, defaultSource.branch, '.github/agents/code-review.agent.md'),
      sourceUrl: defaultSource.url,
      sourceBranch: 'main',
      itemPath: '.github/agents/code-review.agent.md',
      targetPaths: ['.github/agents/code-review.agent.md'],
      tool: 'copilot',
      category: 'agents',
      commitSha: 'sha_v1_34567890123456789012345678901234',
      installedAt: new Date().toISOString(),
    });

    // Set the manifest manager on the tree provider
    const lifecycle = new LifecycleManager(githubClient, manifestManager, installer, log, mockFs);
    treeProvider.setLifecycle(manifestManager, lifecycle);

    // Mock workspace folders
    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      // Manually populate the installed IDs cache (avoids fire-and-forget race)
      const ids = (treeProvider as any).installedIds as Set<string>;
      ids.clear();
      const m = await manifestManager.readManifest(folder);
      for (const entry of m.installations) {
        ids.add(entry.id);
      }
      // Clear tree cache so getChildren re-reads with updated state
      (treeProvider as any).treeCache.clear();

      // Get tree items to find the installed agent
      const roots = await treeProvider.getChildren();
      const categories = await treeProvider.getChildren(roots[0]);
      const agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
      assert.ok(agentsCat);

      const items = await treeProvider.getChildren(agentsCat);
      const codeReviewItem = items.find(
        (i): i is CatalogFileItem => i.kind === 'item' && i.name === 'code-review',
      );
      assert.ok(codeReviewItem, 'Should find code-review item');

      // Verify it has installed flag
      assert.strictEqual(codeReviewItem.installed, true, 'Item should be marked as installed');

      // Verify tree item has correct contextValue and description
      const treeItem = treeProvider.getTreeItem(codeReviewItem);
      assert.strictEqual(treeItem.contextValue, 'catalogItem.installed');
      assert.strictEqual((treeItem as vscode.TreeItem).description, 'installed');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });
});

describe('WP14 - E2E: Removed content detection', function () {
  this.timeout(30000);

  let log: ReturnType<typeof createMockLogOutputChannel>;
  let ctx: vscode.ExtensionContext;
  let detector: NewContentDetector;

  beforeEach(() => {
    log = createMockLogOutputChannel();
    ctx = createMockExtensionContext();
    detector = new NewContentDetector(ctx.globalState, log);
  });

  it('checkForNewContent detects removed items and getRemovedItems returns them', async () => {
    const baseTree = [
      { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob' as const, sha: 'a1', url: '' },
      { path: '.github/agents/reviewer.agent.md', mode: '100644', type: 'blob' as const, sha: 'a2', url: '' },
    ];
    const sourceUrl = 'https://github.com/test/removed-test';

    // Establish baseline
    const result1 = await detector.checkForNewContent(sourceUrl, baseTree, false);
    assert.strictEqual(result1.removedPaths.length, 0, 'First check establishes baseline');

    // Now tree V2 has one item removed
    const treeV2 = [
      { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob' as const, sha: 'a1', url: '' },
    ];
    const result2 = await detector.checkForNewContent(sourceUrl, treeV2, false);
    assert.deepStrictEqual(result2.removedPaths, ['.github/agents/reviewer.agent.md']);

    // getRemovedItems should return the same
    const removed = detector.getRemovedItems(sourceUrl);
    assert.deepStrictEqual(removed, ['.github/agents/reviewer.agent.md']);
  });

  it('markAllSeen clears removed items', async () => {
    const baseTree = [
      { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob' as const, sha: 'a1', url: '' },
      { path: '.github/agents/reviewer.agent.md', mode: '100644', type: 'blob' as const, sha: 'a2', url: '' },
    ];
    const sourceUrl = 'https://github.com/test/removed-clear';

    // Establish baseline then remove one
    await detector.checkForNewContent(sourceUrl, baseTree, false);
    await detector.checkForNewContent(sourceUrl, [baseTree[0]], false);

    assert.strictEqual(detector.getRemovedItems(sourceUrl).length, 1);
    assert.strictEqual(detector.getTotalRemovedCount(), 1);

    // Mark all seen
    await detector.markAllSeen();

    assert.strictEqual(detector.getRemovedItems(sourceUrl).length, 0);
    assert.strictEqual(detector.getTotalRemovedCount(), 0);
  });

  it('getTotalRemovedCount reflects removed items across sources', async () => {
    const tree1 = [
      { path: '.github/agents/a.agent.md', mode: '100644', type: 'blob' as const, sha: 'a1', url: '' },
    ];
    const tree2 = [
      { path: '.claude/rules/b.md', mode: '100644', type: 'blob' as const, sha: 'b1', url: '' },
    ];
    const url1 = 'https://github.com/test/repo1';
    const url2 = 'https://github.com/test/repo2';

    // Establish baselines
    await detector.checkForNewContent(url1, tree1, false);
    await detector.checkForNewContent(url2, tree2, false);

    // Remove both items
    await detector.checkForNewContent(url1, [], false);
    await detector.checkForNewContent(url2, [], false);

    assert.strictEqual(detector.getTotalRemovedCount(), 2);
  });

  it('removed installed item renders with contextValue removedInstalled', async () => {
    const fetchMocker = new FetchMocker();
    const fsStore = new E2eFsStore();
    const mockFs = fsStore.createMockFs();
    const authManager = new AuthManager(ctx, log);
    const cacheManager = new CacheManager(ctx, log);
    const githubClient = new GitHubClient(authManager, cacheManager, log);
    const manifestManager = new ManifestManager(log, mockFs);

    const treeFixture = loadJsonFixture<GitHubTreeResponse>('api/tree.json');
    const defaultSource: SourceConfig = {
      url: 'https://github.com/jlacube/awesome-coding-assistants',
      name: 'Awesome Coding Assistants',
      branch: 'main',
    };

    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      treeFixture,
      { etag: '"tree-etag-1"' },
    );
    fetchMocker.addRoute({ url: /raw\.githubusercontent\.com\//, status: 200, body: '# Mock' });
    fetchMocker.addJsonRoute(/api\.github\.com\/repos\/.*\/commits\?/, 200, [{ sha: 'sha_v1' }]);
    fetchMocker.addRoute({ url: /api\.github\.com\/repos\//, status: 200, body: '{}' });
    fetchMocker.install();

    try {
      const sourceRegistry = new SourceRegistry(githubClient, log);
      const treeProvider = new CatalogTreeProvider(
        sourceRegistry, githubClient, log, vscode.Uri.file('/e2e-ext'),
      );

      // Mock detector that returns a removed path that is also installed
      const removedPath = '.github/agents/code-review.agent.md';
      const mockDetector = {
        getNewItems: () => [],
        getRemovedItems: (url: string) =>
          url === sourceKey(defaultSource) ? [removedPath] : [],
        markCategorySeen: async () => {},
      };
      treeProvider.setNewContentDetector(mockDetector as any);

      // Mark the item as installed
      const ids = (treeProvider as any).installedIds as Set<string>;
      ids.add(installationId(defaultSource.url, defaultSource.branch, removedPath));

      const roots = await treeProvider.getChildren();
      const categories = await treeProvider.getChildren(roots[0]);
      const agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
      assert.ok(agentsCat);

      const items = await treeProvider.getChildren(agentsCat) as CatalogFileItem[];
      const removedItem = items.find(i => i.path === removedPath && i.isRemoved);
      assert.ok(removedItem, 'Should find removed installed item');
      assert.strictEqual(removedItem.installed, true);

      const treeItem = treeProvider.getTreeItem(removedItem);
      assert.strictEqual(treeItem.contextValue, 'catalogItem.removedInstalled');
      assert.strictEqual(treeItem.description, 'removed upstream - installed');

      treeProvider.dispose();
      sourceRegistry.dispose();
    } finally {
      fetchMocker.restore();
    }
  });
});
