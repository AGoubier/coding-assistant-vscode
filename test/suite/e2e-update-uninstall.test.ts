// E2E Test: Check Updates > Update > Uninstall journey
// Spec refs: Section 11.4, Section 6.3
// WP07 T07-03

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
import type { CatalogFileItem, GitHubTreeResponse, InstallationEntry, SourceConfig } from '../../src/models/types.js';
import { installationId } from '../../src/models/types.js';

// Reuse the in-memory filesystem from e2e-browse-install
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

describe('WP07 - E2E: Check Updates > Update > Uninstall', function () {
  this.timeout(30000);

  let fetchMocker: FetchMocker;
  let fsStore: E2eFsStore;
  let mockFs: VscFs;
  let log: ReturnType<typeof createMockLogOutputChannel>;
  let ctx: vscode.ExtensionContext;
  let githubClient: GitHubClient;
  let installer: Installer;
  let manifestManager: ManifestManager;
  let lifecycle: LifecycleManager;
  let treeProvider: CatalogTreeProvider;
  let sourceRegistry: SourceRegistry;
  let folder: vscode.WorkspaceFolder;

  const defaultSource: SourceConfig = {
    url: 'https://github.com/jlacube/awesome-coding-assistants',
    name: 'Awesome Coding Assistants',
    branch: 'main',
  };

  const treeFixture = loadJsonFixture<GitHubTreeResponse>('api/tree.json');
  const agentContentV1 = loadFixture('contents/code-review.agent.md');
  const agentContentV2 = loadFixture('contents/code-review-v2.agent.md');

  const SHA_V1 = 'sha_v1_34567890123456789012345678901234';
  const SHA_V2 = 'sha_v2_98765432109876543210987654321098';

  const itemPath = '.github/agents/code-review.agent.md';
  const targetPath = '.github/agents/code-review.agent.md';

  function makeInstallEntry(): InstallationEntry {
    return {
      id: installationId(defaultSource.url, defaultSource.branch, itemPath),
      sourceUrl: defaultSource.url,
      sourceBranch: 'main',
      itemPath,
      targetPaths: [targetPath],
      tool: 'copilot',
      category: 'agents',
      commitSha: SHA_V1,
      installedAt: new Date().toISOString(),
    };
  }

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

    // Mock routes - V1 content first
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      treeFixture,
      { etag: '"tree-etag-1"' },
    );

    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\/.*\/main\/.github\/agents\/code-review\.agent\.md/,
      status: 200,
      body: agentContentV1,
    });

    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\//,
      status: 200,
      body: '# Mock content',
    });

    // Default: commits return V1 SHA
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/commits\?/,
      200,
      [{ sha: SHA_V1 }],
    );

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

    lifecycle = new LifecycleManager(githubClient, manifestManager, installer, log, mockFs);

    treeProvider = new CatalogTreeProvider(
      sourceRegistry,
      githubClient,
      log,
      vscode.Uri.file('/e2e-ext'),
    );
    // Note: setLifecycle is called within individual tests, not here,
    // to ensure the async cache refresh triggers at the right time.
  });

  afterEach(() => {
    fetchMocker.restore();
  });

  it('detects no updates when SHA matches (baseline)', async () => {
    // Install item in manifest
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);

    // Write file to mock FS
    const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
    await mockFs.writeFile(targetUri, Buffer.from(agentContentV1, 'utf-8'));

    // Mock workspace folders
    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      const results = await lifecycle.checkForUpdates(folder);
      assert.strictEqual(results.length, 1, 'Should check 1 item');
      assert.strictEqual(results[0].hasUpdate, false, 'SHA matches - no update');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });

  it('detects update when upstream SHA differs', async () => {
    // Install item in manifest
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);

    // Now change commits mock to return V2 SHA
    fetchMocker.restore();
    fetchMocker = new FetchMocker();
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      treeFixture,
      { etag: '"tree-etag-2"' },
    );
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/commits\?/,
      200,
      [{ sha: SHA_V2 }],
    );
    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\/.*\/main\/.github\/agents\/code-review\.agent\.md/,
      status: 200,
      body: agentContentV2,
    });
    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\//,
      status: 200,
      body: '# Mock content',
    });
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\//,
      status: 200,
      body: '{}',
    });
    fetchMocker.install();

    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      const results = await lifecycle.checkForUpdates(folder);
      assert.strictEqual(results.length, 1, 'Should check 1 item');
      assert.strictEqual(results[0].hasUpdate, true, 'SHA differs - update available');
      assert.strictEqual(results[0].latestSha, SHA_V2);
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });

  it('applies update: content changes and manifest SHA updates', async () => {
    // Install V1
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);
    const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
    await mockFs.writeFile(targetUri, Buffer.from(agentContentV1, 'utf-8'));

    // Switch to V2 mock responses
    fetchMocker.restore();
    fetchMocker = new FetchMocker();
    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\/.*\/main\/.github\/agents\/code-review\.agent\.md/,
      status: 200,
      body: agentContentV2,
    });
    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\//,
      status: 200,
      body: '# fallback',
    });
    fetchMocker.install();

    // Apply update
    await lifecycle.applyUpdate(entry, folder, SHA_V2);

    // Verify file content updated
    const bytes = await mockFs.readFile(targetUri);
    const content = Buffer.from(bytes).toString('utf-8');
    assert.ok(content.includes('v2'), 'File content should be V2');

    // Verify manifest SHA updated
    const manifest = await manifestManager.readManifest(folder);
    assert.strictEqual(manifest.installations.length, 1);
    assert.strictEqual(manifest.installations[0].commitSha, SHA_V2);
    assert.ok(manifest.installations[0].updatedAt, 'Should have updatedAt timestamp');
  });

  it('uninstalls item: file deleted and manifest entry removed', async () => {
    // Install V1
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);
    const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
    await mockFs.writeFile(targetUri, Buffer.from(agentContentV1, 'utf-8'));

    // Verify file exists before uninstall
    const stat = await mockFs.stat(targetUri);
    assert.strictEqual(stat.type, vscode.FileType.File);

    // Uninstall
    await lifecycle.uninstallItem(entry, folder);

    // Verify file deleted
    let fileExists = false;
    try {
      await mockFs.stat(targetUri);
      fileExists = true;
    } catch {
      // expected - file should not exist
    }
    assert.strictEqual(fileExists, false, 'File should be deleted after uninstall');

    // Verify manifest entry removed
    const manifest = await manifestManager.readManifest(folder);
    assert.strictEqual(manifest.installations.length, 0, 'Manifest should be empty');
  });

  // Helper: manually populate the tree provider's installedIds cache
  // This avoids the race condition with the fire-and-forget refreshInstalledCache.
  async function syncInstalledCache(): Promise<void> {
    const ids = (treeProvider as any).installedIds as Set<string>;
    ids.clear();
    const folders = [folder];
    for (const f of folders) {
      try {
        const m = await manifestManager.readManifest(f);
        for (const entry of m.installations) {
          ids.add(entry.id);
        }
      } catch {
        // no manifest yet
      }
    }
    // Clear tree cache so getChildren re-fetches with updated installed state
    (treeProvider as any).treeCache.clear();
  }

  it('tree no longer shows installed badge after uninstall', async () => {
    // Install item
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);
    const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
    await mockFs.writeFile(targetUri, Buffer.from(agentContentV1, 'utf-8'));

    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      // Set lifecycle and sync installed IDs cache
      treeProvider.setLifecycle(manifestManager, lifecycle);
      await syncInstalledCache();

      // Verify badge present before uninstall
      let roots = await treeProvider.getChildren();
      let categories = await treeProvider.getChildren(roots[0]);
      let agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
      assert.ok(agentsCat);

      let items = await treeProvider.getChildren(agentsCat);
      let codeReview = items.find(
        (i): i is CatalogFileItem => i.kind === 'item' && i.name === 'code-review',
      );
      assert.ok(codeReview);
      assert.strictEqual(codeReview!.installed, true, 'Should be installed initially');

      // Uninstall
      await lifecycle.uninstallItem(entry, folder);

      // Sync cache after uninstall
      await syncInstalledCache();

      // Verify badge removed
      roots = await treeProvider.getChildren();
      categories = await treeProvider.getChildren(roots[0]);
      agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
      assert.ok(agentsCat);

      items = await treeProvider.getChildren(agentsCat);
      codeReview = items.find(
        (i): i is CatalogFileItem => i.kind === 'item' && i.name === 'code-review',
      );
      assert.ok(codeReview);
      assert.strictEqual(codeReview!.installed, false, 'Should not be installed after uninstall');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });

  it('update badge appears in tree when update is available', async () => {
    // Install item
    const entry = makeInstallEntry();
    await manifestManager.addInstallation(folder, entry);

    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      // Switch to V2 SHA for update check
      fetchMocker.restore();
      fetchMocker = new FetchMocker();
      fetchMocker.addJsonRoute(
        /api\.github\.com\/repos\/.*\/git\/trees/,
        200,
        treeFixture,
        { etag: '"tree-etag-3"' },
      );
      fetchMocker.addJsonRoute(
        /api\.github\.com\/repos\/.*\/commits\?/,
        200,
        [{ sha: SHA_V2 }],
      );
      fetchMocker.addRoute({
        url: /raw\.githubusercontent\.com\//,
        status: 200,
        body: '# content',
      });
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\//,
        status: 200,
        body: '{}',
      });
      fetchMocker.install();

      // Run update check
      const results = await lifecycle.checkForUpdates(folder);
      assert.strictEqual(results[0].hasUpdate, true);

      // Set lifecycle, sync installed cache, and refresh tree
      treeProvider.setLifecycle(manifestManager, lifecycle);
      await syncInstalledCache();

      // Get tree items
      const roots = await treeProvider.getChildren();
      const categories = await treeProvider.getChildren(roots[0]);
      const agentsCat = categories.find(c => c.kind === 'category' && c.category === 'agents');
      assert.ok(agentsCat);

      const items = await treeProvider.getChildren(agentsCat);
      const codeReview = items.find(
        (i): i is CatalogFileItem => i.kind === 'item' && i.name === 'code-review',
      );
      assert.ok(codeReview, 'Should find code-review item');
      assert.strictEqual(codeReview!.installed, true, 'Should be installed');
      assert.strictEqual(codeReview!.updateAvailable, true, 'Should show update available');
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });
});
