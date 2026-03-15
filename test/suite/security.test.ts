// Security tests: path traversal, credential exposure, HTTPS enforcement, domain allowlist
// Spec refs: Section 10.2 Security, Section 11.6 Security Tests
// WP07 T07-07

import * as assert from 'assert';
import { validatePath } from '../../src/utils/pathUtils.js';
import { isAllowedDomain } from '../../src/utils/pathUtils.js';
import { InvalidPathError } from '../../src/models/errors.js';
import { GitHubClient } from '../../src/services/githubClient.js';
import { AuthManager } from '../../src/services/authManager.js';
import { CacheManager } from '../../src/services/cacheManager.js';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks.js';
import { FetchMocker } from '../helpers/e2e.js';
import type { SourceConfig } from '../../src/models/types.js';

describe('WP07 - Security Tests', function () {
  this.timeout(10000);

  describe('Path traversal rejection', () => {
    it('rejects ../../.ssh/authorized_keys', () => {
      assert.strictEqual(validatePath('../../.ssh/authorized_keys'), false);
    });

    it('rejects ../../../etc/passwd', () => {
      assert.strictEqual(validatePath('../../../etc/passwd'), false);
    });

    it('rejects path with null byte file\\x00.md', () => {
      assert.strictEqual(validatePath('file\x00.md'), false);
    });

    it('rejects absolute Unix path /etc/shadow', () => {
      assert.strictEqual(validatePath('/etc/shadow'), false);
    });

    it('rejects absolute Windows path C:\\Windows\\system32', () => {
      assert.strictEqual(validatePath('C:\\Windows\\system32'), false);
    });

    it('accepts valid relative path agents/my-agent.md', () => {
      assert.strictEqual(validatePath('agents/my-agent.md'), true);
    });

    it('rejects URL-encoded traversal %2e%2e/etc/passwd', () => {
      assert.strictEqual(validatePath('%2e%2e/etc/passwd'), false);
    });

    it('InvalidPathError provides security message', () => {
      const err = new InvalidPathError('../../etc/passwd');
      assert.strictEqual(err.code, 'INVALID_PATH');
      assert.ok(err.message.includes('Path traversal attempt'));
      assert.ok(err.userMessage.includes('blocked for security'));
    });
  });

  describe('HTTPS enforcement', () => {
    it('rejects HTTP URLs as not allowed', () => {
      assert.strictEqual(isAllowedDomain('http://api.github.com/repos'), false);
    });

    it('accepts HTTPS URLs for github.com', () => {
      assert.strictEqual(isAllowedDomain('https://github.com/owner/repo'), true);
    });

    it('accepts HTTPS URLs for api.github.com', () => {
      assert.strictEqual(isAllowedDomain('https://api.github.com/repos/owner/repo'), true);
    });

    it('accepts HTTPS URLs for raw.githubusercontent.com', () => {
      assert.strictEqual(isAllowedDomain('https://raw.githubusercontent.com/owner/repo/main/file.md'), true);
    });
  });

  describe('Domain allowlist', () => {
    it('rejects unknown domains', () => {
      assert.strictEqual(isAllowedDomain('https://evil.com/malicious'), false);
    });

    it('rejects subdomain spoofing', () => {
      assert.strictEqual(isAllowedDomain('https://api.github.com.evil.com/repos'), false);
    });

    it('rejects FTP protocol', () => {
      assert.strictEqual(isAllowedDomain('ftp://github.com/owner/repo'), false);
    });

    it('rejects invalid URLs', () => {
      assert.strictEqual(isAllowedDomain('not-a-url'), false);
    });
  });

  describe('No credentials in log output', () => {
    let log: ReturnType<typeof createMockLogOutputChannel>;
    let fetchMocker: FetchMocker;

    beforeEach(() => {
      log = createMockLogOutputChannel();
      fetchMocker = new FetchMocker();
    });

    afterEach(() => {
      fetchMocker.restore();
    });

    it('token value does not appear in any log entry after API calls', async () => {
      const token = 'ghp_TestSecretToken123456789';
      const ctx = createMockExtensionContext(undefined, undefined);
      const auth = new AuthManager(ctx, log);
      const cache = new CacheManager(ctx, log);
      const client = new GitHubClient(auth, cache, log);

      await auth.storeToken('test-token', token);

      const source: SourceConfig = {
        url: 'https://github.com/test/repo',
        name: 'test',
        authTokenKey: 'test-token',
      };

      // Mock a successful API response
      fetchMocker.addRoute({
        url: /api\.github\.com/,
        status: 200,
        body: JSON.stringify({ sha: 'abc', tree: [], truncated: false }),
      });
      fetchMocker.install();

      try {
        await client.getRepoTree(source);
      } catch {
        // Ignore errors - we just want to verify logging
      }

      // Scan all log messages for the token value
      for (const entry of log.messages) {
        assert.ok(
          !entry.message.includes(token),
          `Token value leaked in log: ${entry.message}`,
        );
      }
    });
  });

  describe('SSRF protection in GitHubClient', () => {
    let fetchMocker: FetchMocker;
    let log: ReturnType<typeof createMockLogOutputChannel>;

    beforeEach(() => {
      fetchMocker = new FetchMocker();
      log = createMockLogOutputChannel();
    });

    afterEach(() => {
      fetchMocker.restore();
    });

    it('rejects requests to non-GitHub domains via parseGitHubUrl', async () => {
      const ctx = createMockExtensionContext(undefined, undefined);
      const auth = new AuthManager(ctx, log);
      const cache = new CacheManager(ctx, log);
      const client = new GitHubClient(auth, cache, log);

      const evilSource: SourceConfig = {
        url: 'https://evil.com/malicious/payload',
        name: 'evil',
      };

      fetchMocker.install();

      await assert.rejects(
        () => client.getRepoTree(evilSource),
        (err: Error) => err.message.includes('unreachable') || err.message.includes('evil.com'),
      );

      // Verify no fetch calls were made
      assert.strictEqual(fetchMocker.getCalls().length, 0);
    });
  });
});
