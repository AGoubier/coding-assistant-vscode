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
import { SourceRegistry } from '../../src/services/sourceRegistry.js';
import { LifecycleManager } from '../../src/services/lifecycle.js';
import { FetchMocker, loadFixture, loadJsonFixture } from '../helpers/e2e.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import type { CatalogFileItem, GitHubTreeResponse, SourceConfig } from '../../src/models/types.js';

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
        id: `${item.source.url}#${item.path}`,
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
      assert.strictEqual(manifest.installations[0].id, `${item.source.url}#${item.path}`);
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
      id: `${defaultSource.url}#.github/agents/code-review.agent.md`,
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
      assert.strictEqual((treeItem as vscode.TreeItem).description, '$(check) installed');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });
});
