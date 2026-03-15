// Performance tests: NFR thresholds for tree load, update check, and preview
// Spec refs: Section 10.1 (NFR-001 to NFR-004), Section 11.5
// WP07 T07-06

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
import { FetchMocker } from '../helpers/e2e.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import type { GitHubTreeEntry, SourceConfig } from '../../src/models/types.js';

// Generate a large mock tree with N items
function generateLargeTree(count: number): { sha: string; url: string; tree: GitHubTreeEntry[]; truncated: boolean } {
  const categories = ['agents', 'prompts', 'instructions', 'skills'];
  const tree: GitHubTreeEntry[] = [];

  // Add directory entries
  tree.push({ path: '.github', mode: '040000', type: 'tree', sha: 'dir0', url: '' });
  for (const cat of categories) {
    tree.push({ path: `.github/${cat}`, mode: '040000', type: 'tree', sha: `dir-${cat}`, url: '' });
  }

  // Add file entries
  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length];
    const ext = cat === 'agents' ? '.agent.md' :
                cat === 'prompts' ? '.prompt.md' :
                cat === 'instructions' ? '.instructions.md' : '.md';
    tree.push({
      path: `.github/${cat}/item-${String(i).padStart(4, '0')}${ext}`,
      mode: '100644',
      type: 'blob',
      sha: `blob-${i}`,
      size: 256,
      url: '',
    });
  }

  return { sha: 'perf-tree', url: '', tree, truncated: false };
}

describe('WP07 - Performance Tests', function () {
  // Performance tests may take longer
  this.timeout(30000);

  let fetchMocker: FetchMocker;
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    fetchMocker = new FetchMocker();
    log = createMockLogOutputChannel();
  });

  afterEach(() => {
    fetchMocker.restore();
  });

  it('NFR-001: loads 500-item tree in under 3 seconds (cached)', async () => {
    const largeTree = generateLargeTree(500);

    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      largeTree,
      { etag: '"perf-etag"' },
    );
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\//,
      status: 200,
      body: '{}',
    });
    fetchMocker.install();

    const ctx = createMockExtensionContext();
    const auth = new AuthManager(ctx, log);
    const cache = new CacheManager(ctx, log);
    const github = new GitHubClient(auth, cache, log);
    const registry = new SourceRegistry(github, log);
    const treeProvider = new CatalogTreeProvider(
      registry,
      github,
      log,
      vscode.Uri.file('/perf-ext'),
    );

    // Warm up: first fetch populates cache
    const roots = await treeProvider.getChildren();
    assert.ok(roots.length > 0, 'Should have sources');

    // Measure: cached tree load
    const start = Date.now();
    const categories = await treeProvider.getChildren(roots[0]);
    let totalItems = 0;
    for (const cat of categories) {
      const items = await treeProvider.getChildren(cat);
      totalItems += items.length;
    }
    const elapsed = Date.now() - start;

    console.log(`[PERF] 500-item tree load (cached): ${elapsed}ms, ${totalItems} items`);
    assert.ok(totalItems >= 500, `Should have at least 500 items, got ${totalItems}`);
    assert.ok(elapsed < 3000, `Should complete in under 3s, took ${elapsed}ms`);
  });

  it('NFR-003: check updates for 50 installed items in under 30 seconds', async () => {
    const ctx = createMockExtensionContext();
    const auth = new AuthManager(ctx, log);
    const cacheManager = new CacheManager(ctx, log);
    const github = new GitHubClient(auth, cacheManager, log);

    // In-memory FS
    const files = new Map<string, string>();
    const mockFs: VscFs = {
      readFile: async (uri: vscode.Uri) => {
        const content = files.get(uri.path.replace(/\\/g, '/'));
        if (content === undefined) { throw vscode.FileSystemError.FileNotFound(uri); }
        return Buffer.from(content, 'utf-8');
      },
      writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
        files.set(uri.path.replace(/\\/g, '/'), Buffer.from(content).toString('utf-8'));
      },
      createDirectory: async () => {},
      stat: async (uri: vscode.Uri) => {
        if (files.has(uri.path.replace(/\\/g, '/'))) {
          return { type: vscode.FileType.File, size: 0, ctime: 0, mtime: 0 };
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      },
      rename: async () => {},
      delete: async (uri: vscode.Uri) => { files.delete(uri.path.replace(/\\/g, '/')); },
    };

    const installer = new Installer(github, log, mockFs);
    const manifestManager = new ManifestManager(log, mockFs);
    const lifecycle = new LifecycleManager(github, manifestManager, installer, log, mockFs);

    const folder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file('/perf-workspace'),
      name: 'perf-test',
      index: 0,
    };

    const source: SourceConfig = {
      url: 'https://github.com/jlacube/awesome-coding-assistants',
      name: 'Test',
      branch: 'main',
    };

    // Install 50 items into manifest
    for (let i = 0; i < 50; i++) {
      await manifestManager.addInstallation(folder, {
        id: `${source.url}#.github/agents/item-${i}.agent.md`,
        sourceUrl: source.url,
        sourceBranch: 'main',
        itemPath: `.github/agents/item-${i}.agent.md`,
        targetPaths: [`.github/agents/item-${i}.agent.md`],
        tool: 'copilot',
        category: 'agents',
        commitSha: `sha_old_${String(i).padStart(4, '0')}`,
        installedAt: new Date().toISOString(),
      });
    }

    // Mock commits endpoint - all return a different SHA (all have updates)
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/commits\?/,
      200,
      [{ sha: 'sha_new_00000000000000000000000000000000' }],
    );
    fetchMocker.install();

    const origFolders = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: [folder],
      configurable: true,
    });

    try {
      const start = Date.now();
      const results = await lifecycle.checkForUpdates(folder);
      const elapsed = Date.now() - start;

      console.log(`[PERF] Update check for ${results.length} items: ${elapsed}ms`);
      assert.strictEqual(results.length, 50, 'Should check 50 items');
      assert.ok(results.every(r => r.hasUpdate), 'All items should have updates');
      assert.ok(elapsed < 30000, `Should complete in under 30s, took ${elapsed}ms`);
    } finally {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: origFolders,
        configurable: true,
      });
    }
  });

  it('NFR-002: preview file content in under 3 seconds', async () => {
    const content = '# Preview Content\n'.repeat(100); // ~2KB file

    fetchMocker.addRoute({
      url: /raw\.githubusercontent\.com\//,
      status: 200,
      body: content,
    });
    fetchMocker.install();

    const ctx = createMockExtensionContext();
    const auth = new AuthManager(ctx, log);
    const cache = new CacheManager(ctx, log);
    const github = new GitHubClient(auth, cache, log);

    const source: SourceConfig = {
      url: 'https://github.com/jlacube/awesome-coding-assistants',
      name: 'Test',
      branch: 'main',
    };

    const start = Date.now();
    const result = await github.getFileContent(source, '.github/agents/test.agent.md');
    const elapsed = Date.now() - start;

    console.log(`[PERF] File preview: ${elapsed}ms`);
    assert.ok(result.length > 0, 'Should return content');
    assert.ok(elapsed < 3000, `Should complete in under 3s, took ${elapsed}ms`);
  });
});
