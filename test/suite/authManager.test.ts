import * as assert from 'assert';
import { AuthManager } from '../../src/services/authManager';
import {
  createMockExtensionContext,
  createMockLogOutputChannel,
} from '../helpers/mocks';

describe('AuthManager', () => {
  let authManager: AuthManager;
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    const context = createMockExtensionContext();
    log = createMockLogOutputChannel();
    authManager = new AuthManager(context, log);
  });

  describe('storeToken', () => {
    it('should store a token and update token names', async () => {
      await authManager.storeToken('test-token', 'ghp_abc123');
      const token = await authManager.getToken('test-token');
      assert.strictEqual(token, 'ghp_abc123');
    });

    it('should add name to token names list', async () => {
      await authManager.storeToken('my-token', 'value');
      const names = authManager.listTokenNames();
      assert.ok(names.includes('my-token'));
    });

    it('should not duplicate token names', async () => {
      await authManager.storeToken('my-token', 'value1');
      await authManager.storeToken('my-token', 'value2');
      const names = authManager.listTokenNames();
      assert.strictEqual(names.filter((n) => n === 'my-token').length, 1);
    });
  });

  describe('getToken', () => {
    it('should return undefined for non-existent token', async () => {
      const token = await authManager.getToken('nonexistent');
      assert.strictEqual(token, undefined);
    });
  });

  describe('deleteToken', () => {
    it('should delete a token and remove from names list', async () => {
      await authManager.storeToken('delete-me', 'value');
      await authManager.deleteToken('delete-me');
      const token = await authManager.getToken('delete-me');
      assert.strictEqual(token, undefined);
      assert.ok(!authManager.listTokenNames().includes('delete-me'));
    });
  });

  describe('listTokenNames', () => {
    it('should return empty array initially', () => {
      assert.deepStrictEqual(authManager.listTokenNames(), []);
    });

    it('should return all stored token names', async () => {
      await authManager.storeToken('a', 'val');
      await authManager.storeToken('b', 'val');
      const names = authManager.listTokenNames();
      assert.deepStrictEqual(names, ['a', 'b']);
    });
  });

  describe('getAuthHeader', () => {
    it('should return undefined for public source', async () => {
      const header = await authManager.getAuthHeader({
        url: 'https://github.com/owner/repo',
        name: 'test',
      });
      // No PAT, no GitHub Auth provider in test env
      assert.strictEqual(header, undefined);
    });

    it('should return auth header for source with token', async () => {
      await authManager.storeToken('my-pat', 'ghp_secrettoken');
      const header = await authManager.getAuthHeader({
        url: 'https://github.com/owner/repo',
        name: 'test',
        authTokenKey: 'my-pat',
      });
      assert.deepStrictEqual(header, { Authorization: 'token ghp_secrettoken' });
    });

    it('should return undefined if token key exists but token is not stored', async () => {
      const header = await authManager.getAuthHeader({
        url: 'https://github.com/owner/repo',
        name: 'test',
        authTokenKey: 'nonexistent-key',
      });
      assert.strictEqual(header, undefined);
    });
  });

  describe('security - no token in logs', () => {
    it('should not log token values', async () => {
      await authManager.storeToken('secret-token', 'ghp_supersecret');
      await authManager.deleteToken('secret-token');
      for (const entry of log.messages) {
        assert.ok(
          !entry.message.includes('ghp_supersecret'),
          `Token value found in log: ${entry.message}`,
        );
      }
    });
  });
});
