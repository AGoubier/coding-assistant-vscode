import * as assert from 'assert';
import { GitHubClient } from '../../src/services/githubClient';
import { AuthManager } from '../../src/services/authManager';
import { CacheManager } from '../../src/services/cacheManager';
import {
  AuthFailedError,
  RateLimitedError,
  SourceUnreachableError,
} from '../../src/models/errors';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks';
import type { SourceConfig } from '../../src/models/types';

// Helper to mock global fetch
function createMockFetch(responses: Map<string, { status: number; body: string; headers?: Record<string, string> }>): typeof fetch {
  return async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const mock = responses.get(url);

    if (!mock) {
      throw new Error(`No mock response for URL: ${url}`);
    }

    const headerMap = new Map<string, string>();
    if (mock.headers) {
      for (const [k, v] of Object.entries(mock.headers)) {
        headerMap.set(k.toLowerCase(), v);
      }
    }

    return {
      ok: mock.status >= 200 && mock.status < 300,
      status: mock.status,
      headers: {
        get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
        forEach: (cb: (value: string, key: string) => void) => {
          headerMap.forEach((value, key) => cb(value, key));
        },
      },
      text: async () => mock.body,
    } as unknown as Response;
  };
}

describe('GitHubClient', () => {
  let client: GitHubClient;
  let log: ReturnType<typeof createMockLogOutputChannel>;
  let originalFetch: typeof global.fetch;

  const publicSource: SourceConfig = {
    url: 'https://github.com/owner/repo',
    name: 'Test Repo',
    branch: 'main',
  };

  const privateSource: SourceConfig = {
    url: 'https://github.com/owner/private-repo',
    name: 'Private Repo',
    branch: 'main',
    authTokenKey: 'my-token',
  };

  beforeEach(() => {
    const context = createMockExtensionContext();
    log = createMockLogOutputChannel();
    const auth = new AuthManager(context, log);
    const cache = new CacheManager(context, log);
    client = new GitHubClient(auth, cache, log);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getRepoTree', () => {
    it('should fetch and parse a repo tree', async () => {
      const treeResponse = {
        sha: 'abc123',
        url: 'https://api.github.com/repos/owner/repo/git/trees/abc123',
        tree: [
          { path: '.github/agents/test.md', mode: '100644', type: 'blob', sha: 'def456', url: '' },
        ],
        truncated: false,
      };

      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/git/trees/main?recursive=1', {
          status: 200,
          body: JSON.stringify(treeResponse),
          headers: { 'etag': '"tree-etag"' },
        }],
      ]));

      const result = await client.getRepoTree(publicSource);
      assert.strictEqual(result.sha, 'abc123');
      assert.strictEqual(result.tree.length, 1);
      assert.strictEqual(result.tree[0].path, '.github/agents/test.md');
    });

    it('should throw SourceUnreachableError for invalid URL', async () => {
      await assert.rejects(
        () => client.getRepoTree({ url: 'not-a-url', name: 'bad' }),
        SourceUnreachableError,
      );
    });
  });

  describe('getFileContent', () => {
    it('should fetch file content from raw.githubusercontent.com for public repos', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://raw.githubusercontent.com/owner/repo/main/test.md', {
          status: 200,
          body: '# Test Content',
          headers: { 'etag': '"file-etag"' },
        }],
      ]));

      const result = await client.getFileContent(publicSource, 'test.md');
      assert.strictEqual(result, '# Test Content');
    });
  });

  describe('getLatestCommitSha', () => {
    it('should return the latest commit SHA', async () => {
      const commitResponse = [{ sha: 'commit123', url: '' }];

      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/commits?path=test.md&per_page=1&sha=main', {
          status: 200,
          body: JSON.stringify(commitResponse),
          headers: {},
        }],
      ]));

      const result = await client.getLatestCommitSha(publicSource, 'test.md');
      assert.strictEqual(result, 'commit123');
    });
  });

  describe('validateRepo', () => {
    it('should return valid for accessible repo', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo', {
          status: 200,
          body: '{}',
          headers: {},
        }],
      ]));

      const result = await client.validateRepo(publicSource);
      assert.strictEqual(result.valid, true);
    });

    it('should return invalid for 404', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo', {
          status: 404,
          body: '{}',
          headers: {},
        }],
      ]));

      const result = await client.validateRepo(publicSource);
      assert.strictEqual(result.valid, false);
    });

    it('should return invalid for invalid GitHub URL', async () => {
      const result = await client.validateRepo({ url: 'not-valid', name: 'bad' });
      assert.strictEqual(result.valid, false);
    });
  });

  describe('error handling', () => {
    it('should throw AuthFailedError on 401', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/git/trees/main?recursive=1', {
          status: 401,
          body: '{"message": "Bad credentials"}',
          headers: {},
        }],
      ]));

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        AuthFailedError,
      );
    });

    it('should throw AuthFailedError on 403', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/git/trees/main?recursive=1', {
          status: 403,
          body: '{"message": "Forbidden"}',
          headers: {},
        }],
      ]));

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        AuthFailedError,
      );
    });

    it('should throw RateLimitedError on 429', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 3600;
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/git/trees/main?recursive=1', {
          status: 429,
          body: '{"message": "rate limit exceeded"}',
          headers: { 'x-ratelimit-reset': String(resetTime) },
        }],
      ]));

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        RateLimitedError,
      );
    });

    it('should throw SourceUnreachableError on 404', async () => {
      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/repo/git/trees/main?recursive=1', {
          status: 404,
          body: '{"message": "Not Found"}',
          headers: {},
        }],
      ]));

      await assert.rejects(
        () => client.getRepoTree(publicSource),
        SourceUnreachableError,
      );
    });
  });

  describe('SSRF protection', () => {
    it('should reject requests to disallowed domains', async () => {
      global.fetch = createMockFetch(new Map());

      // Testing with a bad source URL that won't parse as a GitHub URL
      await assert.rejects(
        () => client.getRepoTree({ url: 'https://evil.com/owner/repo', name: 'evil' }),
        SourceUnreachableError,
      );
    });
  });

  describe('headers', () => {
    it('should include User-Agent and Accept headers', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      global.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
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
            forEach: () => { /* no-op */ },
          },
          text: async () => '{"sha":"abc","url":"","tree":[],"truncated":false}',
        } as unknown as Response;
      };

      await client.getRepoTree(publicSource);

      assert.ok(capturedHeaders);
      assert.strictEqual(capturedHeaders!['User-Agent'], 'awesome-coding-assistants-vscode');
      assert.strictEqual(capturedHeaders!['Accept'], 'application/vnd.github.v3+json');
    });
  });

  describe('security - no tokens in logs', () => {
    it('should not log token values', async () => {
      const context = createMockExtensionContext();
      const auth = new AuthManager(context, log);
      await auth.storeToken('my-token', 'ghp_supersecret123');
      const cache = new CacheManager(context, log);
      const secureClient = new GitHubClient(auth, cache, log);

      global.fetch = createMockFetch(new Map([
        ['https://api.github.com/repos/owner/private-repo/git/trees/main?recursive=1', {
          status: 200,
          body: '{"sha":"abc","url":"","tree":[],"truncated":false}',
          headers: {},
        }],
      ]));

      await secureClient.getRepoTree(privateSource);

      for (const entry of log.messages) {
        assert.ok(
          !entry.message.includes('ghp_supersecret123'),
          `Token found in log: ${entry.message}`,
        );
      }
    });
  });
});
