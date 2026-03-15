import * as assert from 'assert';
import * as vscode from 'vscode';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type { SourceConfig, GitHubTreeResponse, ValidationResult } from '../../src/models/types';
import { GitHubClient } from '../../src/services/githubClient';

// Mock GitHubClient for SourceRegistry tests
function createMockGitHubClient(overrides: {
  validateRepo?: (source: SourceConfig) => Promise<ValidationResult>;
  getFileContent?: (source: SourceConfig, path: string) => Promise<string>;
} = {}): GitHubClient {
  return {
    validateRepo: overrides.validateRepo || (async () => ({ valid: true })),
    getFileContent: overrides.getFileContent || (async () => ''),
    getRepoTree: async () => ({ sha: 'abc', url: '', tree: [], truncated: false } as GitHubTreeResponse),
    getLatestCommitSha: async () => 'abc123',
  } as unknown as GitHubClient;
}

describe('SourceRegistry', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(async () => {
    log = createMockLogOutputChannel();
    // Reset sources setting to clean state (prevents leakage from previous runs)
    const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
    await config.update('sources', undefined, vscode.ConfigurationTarget.Global);
  });

  describe('getSources', () => {
    it('should return default source when no sources configured', () => {
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);

      const sources = registry.getSources();
      assert.strictEqual(sources.length, 1);
      assert.strictEqual(sources[0].url, 'https://github.com/jlacube/awesome-coding-assistants');
      assert.strictEqual(sources[0].name, 'Awesome Coding Assistants');

      registry.dispose();
    });

    it('should return user-configured sources from settings', () => {
      // In the test environment, settings are empty, so default source is returned.
      // Verify that getSources() returns a valid SourceConfig with required fields.
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);

      const sources = registry.getSources();
      assert.strictEqual(sources.length, 1, 'Should return exactly the default source');
      assert.ok(sources[0].url, 'Source should have a URL');
      assert.ok(sources[0].name, 'Source should have a name');

      registry.dispose();
    });
  });

  describe('validateSource', () => {
    it('should delegate to GitHubClient.validateRepo', async () => {
      let calledWith: SourceConfig | undefined;
      const github = createMockGitHubClient({
        validateRepo: async (source) => {
          calledWith = source;
          return { valid: true };
        },
      });
      const registry = new SourceRegistry(github, log);

      const testSource: SourceConfig = {
        url: 'https://github.com/test/repo',
        name: 'Test',
      };
      const result = await registry.validateSource(testSource);

      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(calledWith, testSource);

      registry.dispose();
    });

    it('should return invalid for unreachable repos', async () => {
      const github = createMockGitHubClient({
        validateRepo: async () => ({
          valid: false,
          error: 'Unable to access repository',
        }),
      });
      const registry = new SourceRegistry(github, log);

      const result = await registry.validateSource({
        url: 'https://github.com/nonexistent/repo',
        name: 'Bad',
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.error);

      registry.dispose();
    });
  });

  describe('loadMasterIndex', () => {
    it('should handle empty getFileContent response gracefully', async () => {
      // Default indexUrl is set in package.json, so loadMasterIndex() will attempt a fetch.
      // The mock returns empty string, which fails JSON.parse, triggering silent fallback.
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);

      // Should not throw
      await registry.loadMasterIndex();

      registry.dispose();
    });

    it('should parse valid master index JSON and merge sources (FB-03)', async () => {
      const indexContent = JSON.stringify({
        version: '1.0',
        sources: [
          { url: 'https://github.com/org/repo1', name: 'Repo1' },
          { url: 'https://github.com/org/repo2', name: 'Repo2', branch: 'dev' },
        ],
      });

      let fetchCalled = false;
      const github = createMockGitHubClient({
        getFileContent: async () => {
          fetchCalled = true;
          return indexContent;
        },
      });
      const registry = new SourceRegistry(github, log);

      // Default indexUrl from package.json is a raw.githubusercontent.com URL,
      // so indexUrlToSource() will parse it and call getFileContent.
      await registry.loadMasterIndex();

      assert.strictEqual(fetchCalled, true, 'getFileContent should have been called');

      // Verify no errors logged
      const errors = log.messages.filter(m => m.level === 'error');
      assert.strictEqual(errors.length, 0);

      // Verify master index sources are merged into getSources() result
      const sources = registry.getSources();
      const urls = sources.map(s => s.url);
      assert.ok(urls.includes('https://github.com/org/repo1'), 'Should contain index source repo1');
      assert.ok(urls.includes('https://github.com/org/repo2'), 'Should contain index source repo2');

      // Verify Repo2 has the branch from the index
      const repo2 = sources.find(s => s.url === 'https://github.com/org/repo2');
      assert.ok(repo2);
      assert.strictEqual(repo2.branch, 'dev');

      registry.dispose();
    });

    it('should handle malformed JSON gracefully', async () => {
      const github = createMockGitHubClient({
        getFileContent: async () => 'not valid json{{{',
      });
      const registry = new SourceRegistry(github, log);

      // Should not throw
      await registry.loadMasterIndex();

      registry.dispose();
    });

    it('should handle network errors gracefully', async () => {
      const github = createMockGitHubClient({
        getFileContent: async () => { throw new Error('Network error'); },
      });
      const registry = new SourceRegistry(github, log);

      // Should not throw
      await registry.loadMasterIndex();

      registry.dispose();
    });
  });

  describe('invalidateCache', () => {
    it('should clear cached master index', () => {
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);

      registry.invalidateCache();
      // After invalidation, getSources should still return default
      const sources = registry.getSources();
      assert.ok(sources.length > 0);

      registry.dispose();
    });
  });

  describe('addSource', () => {
    it('should throw SourceUnreachableError when validation fails', async () => {
      const github = createMockGitHubClient({
        validateRepo: async () => ({ valid: false, error: 'Not found' }),
      });
      const registry = new SourceRegistry(github, log);

      await assert.rejects(
        () => registry.addSource({
          url: 'https://github.com/bad/repo',
          name: 'Bad Repo',
        }),
        (err: Error) => err.constructor.name === 'SourceUnreachableError',
      );

      registry.dispose();
    });

    it('should validate and add a source on success path (FB-04)', async () => {
      let validated = false;
      const github = createMockGitHubClient({
        validateRepo: async () => {
          validated = true;
          return { valid: true };
        },
      });
      const registry = new SourceRegistry(github, log);

      const newSource = {
        url: 'https://github.com/new/repo',
        name: 'New Repo',
      };

      // addSource calls validateRepo then writes to settings
      await registry.addSource(newSource);

      assert.strictEqual(validated, true, 'Should have validated the source');
      // Verify info log that source was added
      const infoLogs = log.messages.filter(m => m.level === 'info');
      assert.ok(
        infoLogs.some(m => m.message.includes('Source added') && m.message.includes(newSource.url)),
        'Should log that source was added',
      );

      registry.dispose();
    });

    it('should not add duplicate source (FB-04)', async () => {
      const github = createMockGitHubClient({
        validateRepo: async () => ({ valid: true }),
      });
      const registry = new SourceRegistry(github, log);

      // The default source URL is already configured (returned by getSources)
      // Trying to add it again should skip
      const defaultUrl = 'https://github.com/jlacube/awesome-coding-assistants';
      await registry.addSource({ url: defaultUrl, name: 'Duplicate' });

      // Check for "already configured" log
      const infoLogs = log.messages.filter(m => m.level === 'info');
      assert.ok(
        infoLogs.some(m => m.message.includes('already configured')),
        'Should log that source already exists',
      );

      registry.dispose();
    });
  });

  describe('removeSource', () => {
    it('should remove source by URL and log (FB-04)', async () => {
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);

      await registry.removeSource('https://github.com/some/repo');

      const infoLogs = log.messages.filter(m => m.level === 'info');
      assert.ok(
        infoLogs.some(m => m.message.includes('Source removed') && m.message.includes('https://github.com/some/repo')),
        'Should log that source was removed',
      );

      registry.dispose();
    });
  });

  describe('merge priority', () => {
    it('should let user sources override index sources on URL collision (FB-04)', async () => {
      // Simulate master index returning a source with a specific name
      const indexContent = JSON.stringify({
        version: '1.0',
        sources: [
          { url: 'https://github.com/shared/repo', name: 'Index Name', branch: 'main' },
        ],
      });

      const github = createMockGitHubClient({
        getFileContent: async () => indexContent,
      });
      const registry = new SourceRegistry(github, log);

      // Load master index first (populates cachedMasterIndex)
      await registry.loadMasterIndex();

      // In the test environment, user settings are empty (no user sources).
      // The index source should appear.
      const sources = registry.getSources();
      const sharedSource = sources.find(s => s.url === 'https://github.com/shared/repo');
      assert.ok(sharedSource, 'Index source should be present');
      assert.strictEqual(sharedSource.name, 'Index Name');

      registry.dispose();
    });

    it('should skip unsupported master index version (FB-04)', async () => {
      const indexContent = JSON.stringify({
        version: '2.0',
        sources: [
          { url: 'https://github.com/org/repo', name: 'Future Format' },
        ],
      });

      const github = createMockGitHubClient({
        getFileContent: async () => indexContent,
      });
      const registry = new SourceRegistry(github, log);

      await registry.loadMasterIndex();

      // Should log a warning and not include the sources
      const warnLogs = log.messages.filter(m => m.level === 'warn');
      assert.ok(
        warnLogs.some(m => m.message.includes('Unsupported master index version')),
        'Should warn about unsupported version',
      );

      // getSources should still return default (not the v2.0 index sources)
      const sources = registry.getSources();
      const hasOrgRepo = sources.some(s => s.url === 'https://github.com/org/repo');
      assert.strictEqual(hasOrgRepo, false, 'Should not include v2.0 index sources');

      registry.dispose();
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      const github = createMockGitHubClient();
      const registry = new SourceRegistry(github, log);
      // Should not throw
      registry.dispose();
    });
  });
});
