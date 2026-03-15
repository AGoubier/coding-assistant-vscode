import * as assert from 'assert';
import { CacheManager } from '../../src/services/cacheManager';
import { createMockExtensionContext, createMockLogOutputChannel } from '../helpers/mocks';
import type { CacheEntry } from '../../src/models/types';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    const context = createMockExtensionContext();
    log = createMockLogOutputChannel();
    cacheManager = new CacheManager(context, log);
  });

  describe('getCached / setCached', () => {
    it('should return undefined for non-existent key', async () => {
      const result = await cacheManager.getCached('nonexistent');
      assert.strictEqual(result, undefined);
    });

    it('should store and retrieve a cache entry', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        body: '{"data": "hello"}',
        etag: '"abc123"',
        timestamp: Date.now(),
      };
      await cacheManager.setCached('test-key', entry);
      const result = await cacheManager.getCached('test-key');
      assert.deepStrictEqual(result, entry);
    });

    it('should return undefined for expired entries', async () => {
      const entry: CacheEntry = {
        key: 'expired-key',
        body: 'data',
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      };
      await cacheManager.setCached('expired-key', entry);
      const result = await cacheManager.getCached('expired-key');
      assert.strictEqual(result, undefined);
    });
  });

  describe('getStale', () => {
    it('should return expired entries', async () => {
      const entry: CacheEntry = {
        key: 'stale-key',
        body: 'stale-data',
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      };
      await cacheManager.setCached('stale-key', entry);
      const result = await cacheManager.getStale('stale-key');
      assert.ok(result);
      assert.strictEqual(result!.body, 'stale-data');
    });
  });

  describe('invalidate', () => {
    it('should invalidate a specific key', async () => {
      const entry: CacheEntry = {
        key: 'to-invalidate',
        body: 'data',
        timestamp: Date.now(),
      };
      await cacheManager.setCached('to-invalidate', entry);
      await cacheManager.invalidate('to-invalidate');
      const result = await cacheManager.getCached('to-invalidate');
      assert.strictEqual(result, undefined);
    });

    it('should clear all cache entries when no key specified', async () => {
      await cacheManager.setCached('key1', {
        key: 'key1', body: 'data1', timestamp: Date.now(),
      });
      await cacheManager.setCached('key2', {
        key: 'key2', body: 'data2', timestamp: Date.now(),
      });
      await cacheManager.invalidate();
      const r1 = await cacheManager.getCached('key1');
      const r2 = await cacheManager.getCached('key2');
      assert.strictEqual(r1, undefined);
      assert.strictEqual(r2, undefined);
    });
  });

  describe('getETag', () => {
    it('should return etag from cached entry', async () => {
      await cacheManager.setCached('etag-test', {
        key: 'etag-test',
        body: 'data',
        etag: '"abc123"',
        timestamp: Date.now(),
      });
      assert.strictEqual(cacheManager.getETag('etag-test'), '"abc123"');
    });

    it('should return undefined for non-existent entry', () => {
      assert.strictEqual(cacheManager.getETag('nonexistent'), undefined);
    });

    it('should return undefined for entry without etag', async () => {
      await cacheManager.setCached('no-etag', {
        key: 'no-etag',
        body: 'data',
        timestamp: Date.now(),
      });
      assert.strictEqual(cacheManager.getETag('no-etag'), undefined);
    });
  });
});
