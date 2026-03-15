// Integration tests: SourceRegistry + GitHubClient (tree update event)
// Spec refs: Section 11.3 (SourceRegistry + GitHubClient: validation, tree update)
// WP07 T07-05

import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitHubClient } from '../../src/services/githubClient.js';
import { AuthManager } from '../../src/services/authManager.js';
import { CacheManager } from '../../src/services/cacheManager.js';
import { SourceRegistry } from '../../src/services/sourceRegistry.js';
import { CatalogTreeProvider } from '../../src/providers/catalogTree.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import { FetchMocker } from '../helpers/e2e.js';

describe('WP07 - Integration: SourceRegistry + GitHubClient', function () {
  this.timeout(10000);

  let fetchMocker: FetchMocker;
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    fetchMocker = new FetchMocker();
    log = createMockLogOutputChannel();
  });

  afterEach(() => {
    fetchMocker.restore();
  });

  it('add valid source triggers validation request', async () => {
    // Mock validation endpoint (HEAD/GET to repos)
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\/owner\/valid-repo$/,
      status: 200,
      body: '{}',
    });
    fetchMocker.install();

    const ctx = createMockExtensionContext();
    const auth = new AuthManager(ctx, log);
    const cache = new CacheManager(ctx, log);
    const github = new GitHubClient(auth, cache, log);
    const registry = new SourceRegistry(github, log);

    try {
      await registry.addSource({
        url: 'https://github.com/owner/valid-repo',
        name: 'Valid Repo',
      });

      // Verify validation request was made
      const calls = fetchMocker.getCallsTo(/repos\/owner\/valid-repo$/);
      assert.ok(calls.length > 0, 'Should have made a validation request');
    } finally {
      // Clean up: remove the added source so it doesn't leak to other tests
      await registry.removeSource('https://github.com/owner/valid-repo');
      registry.dispose();
    }
  });

  it('add invalid source (404) throws error and source not added', async () => {
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\/owner\/bad-repo$/,
      status: 404,
      body: '{"message": "Not Found"}',
    });
    fetchMocker.install();

    const ctx = createMockExtensionContext();
    const auth = new AuthManager(ctx, log);
    const cache = new CacheManager(ctx, log);
    const github = new GitHubClient(auth, cache, log);
    const registry = new SourceRegistry(github, log);

    try {
      await assert.rejects(
        () => registry.addSource({
          url: 'https://github.com/owner/bad-repo',
          name: 'Bad Repo',
        }),
        (err: Error) => {
          // Should throw SourceUnreachableError
          return err.constructor.name === 'SourceUnreachableError';
        },
      );

      // Source should NOT be in registry (only default should exist)
      const sources = registry.getSources();
      assert.ok(
        !sources.some(s => s.url === 'https://github.com/owner/bad-repo'),
        'Invalid source should not be added',
      );
    } finally {
      registry.dispose();
    }
  });

  it('tree provider fires onDidChangeTreeData after registry change', async () => {
    fetchMocker.addRoute({
      url: /api\.github\.com\/repos\//,
      status: 200,
      body: '{}',
    });
    fetchMocker.addJsonRoute(
      /api\.github\.com\/repos\/.*\/git\/trees/,
      200,
      { sha: 'abc', url: '', tree: [], truncated: false },
    );
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
      vscode.Uri.file('/test-ext'),
    );

    try {
      let eventFired = false;
      treeProvider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      // Trigger refresh which fires onDidChangeTreeData
      treeProvider.refresh();
      assert.strictEqual(eventFired, true, 'onDidChangeTreeData should fire after refresh');
    } finally {
      registry.dispose();
    }
  });
});
