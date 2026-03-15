// Integration tests: GitHubClient + CacheManager + AuthManager
// Spec refs: Section 11.3 (integration test scenarios)
// WP07 T07-04

import * as assert from 'assert';
import { GitHubClient } from '../../src/services/githubClient.js';
import { AuthManager } from '../../src/services/authManager.js';
import { CacheManager } from '../../src/services/cacheManager.js';
import {
  AuthFailedError,
  RateLimitedError,
  SourceUnreachableError,
} from '../../src/models/errors.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import { FetchMocker } from '../helpers/e2e.js';
import type { SourceConfig } from '../../src/models/types.js';

describe('WP07 - Integration: GitHubClient + CacheManager + AuthManager', function () {
  this.timeout(10000);

  let fetchMocker: FetchMocker;
  let client: GitHubClient;
  let auth: AuthManager;
  let cache: CacheManager;
  let log: ReturnType<typeof createMockLogOutputChannel>;

  const publicSource: SourceConfig = {
    url: 'https://github.com/owner/repo',
    name: 'Test Repo',
    branch: 'main',
  };

  const privateSource: SourceConfig = {
    url: 'https://github.com/owner/private-repo',
    name: 'Private Repo',
    branch: 'main',
    authTokenKey: 'my-pat',
  };

  beforeEach(() => {
    fetchMocker = new FetchMocker();
    const ctx = createMockExtensionContext();
    log = createMockLogOutputChannel();
    auth = new AuthManager(ctx, log);
    cache = new CacheManager(ctx, log);
    client = new GitHubClient(auth, cache, log);
  });

  afterEach(() => {
    fetchMocker.restore();
  });

  describe('ETag caching cycle', () => {
    it('first request stores response; second uses cached data', async () => {
      const treeBody = '{"sha":"abc","url":"","tree":[],"truncated":false}';
      let callCount = 0;

      // Custom fetch to track calls
      const origFetch = global.fetch;
      global.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        callCount++;
        const url = typeof input === 'string' ? input : input.toString();
        const headers = new Map<string, string>();
        headers.set('etag', '"tree-etag-v1"');

        return {
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => headers.get(name.toLowerCase()) ?? null,
            forEach: (cb: (value: string, key: string) => void) => {
              headers.forEach((v, k) => cb(v, k));
            },
          },
          text: async () => treeBody,
        } as unknown as Response;
      }) as typeof global.fetch;

      try {
        // First call - goes to network
        const result1 = await client.getRepoTree(publicSource);
        assert.strictEqual(result1.sha, 'abc');
        assert.strictEqual(callCount, 1, 'First request hits network');

        // Second call - should use cache
        const result2 = await client.getRepoTree(publicSource);
        assert.strictEqual(result2.sha, 'abc');
        assert.strictEqual(callCount, 1, 'Second request uses cache');
      } finally {
        global.fetch = origFetch;
      }
    });
  });

  describe('Error code mapping', () => {
    it('401 maps to AuthFailedError', async () => {
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\/owner\/repo\/git\/trees/,
        status: 401,
        body: '{"message": "Bad credentials"}',
      });
      fetchMocker.install();

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        AuthFailedError,
      );
    });

    it('403 maps to AuthFailedError', async () => {
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\/owner\/repo\/git\/trees/,
        status: 403,
        body: '{"message": "Forbidden"}',
      });
      fetchMocker.install();

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        AuthFailedError,
      );
    });

    it('429 maps to RateLimitedError with reset time from headers', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600;
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\/owner\/repo\/git\/trees/,
        status: 429,
        body: '{"message": "rate limit exceeded"}',
        headers: { 'x-ratelimit-reset': String(resetTime) },
      });
      fetchMocker.install();

      try {
        await client.getRepoTree(publicSource);
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof RateLimitedError);
        assert.ok(err.resetAt instanceof Date, 'Should have resetAt Date');
      }
    });

    it('5xx falls back to stale cache with warning', async () => {
      const treeBody = '{"sha":"cached","url":"","tree":[],"truncated":false}';

      // First: successful request to seed cache
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\/owner\/repo\/git\/trees/,
        status: 200,
        body: treeBody,
        headers: { etag: '"v1"' },
      });
      fetchMocker.install();

      const result1 = await client.getRepoTree(publicSource);
      assert.strictEqual(result1.sha, 'cached');

      // Make the cache entry expired by updating timestamp to distant past
      // but keep the stale data accessible via getStale
      const cacheKey = `${publicSource.url}:tree:main`;
      await cache.setCached(cacheKey, {
        key: cacheKey,
        body: treeBody,
        etag: '"v1"',
        timestamp: 0, // very old - will be expired
      });

      // Second: 500 error - should fall back to stale
      fetchMocker.restore();
      fetchMocker = new FetchMocker();
      fetchMocker.addRoute({
        url: /api\.github\.com\/repos\/owner\/repo\/git\/trees/,
        status: 500,
        body: '{"message": "Internal Server Error"}',
      });
      fetchMocker.install();

      const result2 = await client.getRepoTree(publicSource);
      assert.strictEqual(result2.sha, 'cached', 'Should fall back to stale cache');

      // Verify warning logged
      const warnLogs = log.messages.filter(m => m.level === 'warn');
      assert.ok(
        warnLogs.some(m => m.message.includes('stale cache')),
        'Should log stale cache warning',
      );
    });
  });

  describe('Authentication headers', () => {
    it('private repo sends Authorization header', async () => {
      // Store token
      await auth.storeToken('my-pat', 'ghp_test123456789');

      let capturedHeaders: Record<string, string> = {};

      const origFetch = global.fetch;
      global.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (init?.headers) {
          const h = init.headers as Record<string, string>;
          for (const [k, v] of Object.entries(h)) {
            capturedHeaders[k] = v;
          }
        }
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => null,
            forEach: () => {},
          },
          text: async () => '{"sha":"abc","url":"","tree":[],"truncated":false}',
        } as unknown as Response;
      }) as typeof global.fetch;

      try {
        await client.getRepoTree(privateSource);
        assert.ok(
          capturedHeaders['Authorization'],
          'Should include Authorization header for private repo',
        );
        assert.ok(
          capturedHeaders['Authorization'].includes('token'),
          'Authorization should use token scheme',
        );
      } finally {
        global.fetch = origFetch;
      }
    });

    it('public repo has no Authorization header', async () => {
      let capturedHeaders: Record<string, string> = {};

      const origFetch = global.fetch;
      global.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        capturedHeaders = {};
        if (init?.headers) {
          const h = init.headers as Record<string, string>;
          for (const [k, v] of Object.entries(h)) {
            capturedHeaders[k] = v;
          }
        }
        return {
          ok: true,
          status: 200,
          headers: {
            get: () => null,
            forEach: () => {},
          },
          text: async () => '{"sha":"abc","url":"","tree":[],"truncated":false}',
        } as unknown as Response;
      }) as typeof global.fetch;

      try {
        await client.getRepoTree(publicSource);
        assert.strictEqual(
          capturedHeaders['Authorization'],
          undefined,
          'Public repo should not have Authorization header',
        );
      } finally {
        global.fetch = origFetch;
      }
    });
  });
});
