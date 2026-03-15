import * as assert from 'assert';
import {
  ExtensionError,
  SourceUnreachableError,
  AuthFailedError,
  RateLimitedError,
  PreviewFetchFailedError,
  InstallFailedError,
  InvalidPathError,
  ManifestCorruptError,
  CacheError,
} from '../../src/models/errors';

describe('Error classes', () => {
  describe('ExtensionError', () => {
    it('should set code and userMessage', () => {
      const err = new ExtensionError('User message', 'TEST_CODE');
      assert.strictEqual(err.code, 'TEST_CODE');
      assert.strictEqual(err.userMessage, 'User message');
      assert.ok(err instanceof Error);
    });
  });

  describe('SourceUnreachableError', () => {
    it('should have correct code and user message', () => {
      const err = new SourceUnreachableError('https://github.com/owner/repo');
      assert.strictEqual(err.code, 'SOURCE_UNREACHABLE');
      assert.ok(err.userMessage.includes('https://github.com/owner/repo'));
      assert.ok(err.userMessage.includes('Check the URL'));
    });

    it('should include status code in internal message', () => {
      const err = new SourceUnreachableError('https://github.com/owner/repo', 404);
      assert.ok(err.message.includes('404'));
    });
  });

  describe('AuthFailedError', () => {
    it('should have correct code and user message', () => {
      const err = new AuthFailedError('owner/repo');
      assert.strictEqual(err.code, 'AUTH_FAILED');
      assert.ok(err.userMessage.includes('owner/repo'));
      assert.ok(err.userMessage.includes('Check your token'));
    });

    it('should include status code in internal message', () => {
      const err = new AuthFailedError('owner/repo', 401);
      assert.ok(err.message.includes('401'));
    });
  });

  describe('RateLimitedError', () => {
    it('should have correct code and reset time', () => {
      const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const err = new RateLimitedError(resetTimestamp);
      assert.strictEqual(err.code, 'RATE_LIMITED');
      assert.ok(err.resetAt instanceof Date);
      assert.ok(err.userMessage.includes('rate limit exceeded'));
      assert.ok(err.userMessage.includes('personal access token'));
    });
  });

  describe('PreviewFetchFailedError', () => {
    it('should have correct code', () => {
      const err = new PreviewFetchFailedError('/path/to/file', 'timeout');
      assert.strictEqual(err.code, 'PREVIEW_FETCH_FAILED');
      assert.ok(err.userMessage.includes('timeout'));
    });
  });

  describe('InstallFailedError', () => {
    it('should have correct code', () => {
      const err = new InstallFailedError('my-agent.md', 'disk full');
      assert.strictEqual(err.code, 'INSTALL_FAILED');
      assert.ok(err.userMessage.includes('my-agent.md'));
    });
  });

  describe('InvalidPathError', () => {
    it('should have correct code and security message', () => {
      const err = new InvalidPathError('../../etc/passwd');
      assert.strictEqual(err.code, 'INVALID_PATH');
      assert.ok(err.userMessage.includes('blocked for security'));
      assert.ok(err.message.includes('Path traversal attempt'));
    });
  });

  describe('ManifestCorruptError', () => {
    it('should have correct code', () => {
      const err = new ManifestCorruptError('unexpected token');
      assert.strictEqual(err.code, 'MANIFEST_CORRUPT');
      assert.ok(err.userMessage.includes('corrupted'));
      assert.ok(err.userMessage.includes('reset'));
    });
  });

  describe('CacheError', () => {
    it('should have correct code and empty user message', () => {
      const err = new CacheError('disk full');
      assert.strictEqual(err.code, 'CACHE_ERROR');
      assert.strictEqual(err.userMessage, '');
      assert.ok(err.message.includes('disk full'));
    });
  });
});
