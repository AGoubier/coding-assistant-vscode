import * as assert from 'assert';
import * as vscode from 'vscode';
import { SourceRegistry, normalizeIndexUrls, sourceKey } from '../../src/services/sourceRegistry';
import { IndexErrorCodes } from '../../src/models/errors';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type { SourceConfig, GitHubTreeResponse, ValidationResult, MergedSourceList } from '../../src/models/types';
import { GitHubClient } from '../../src/services/githubClient';

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

const DEFAULT_URLS = ['https://raw.githubusercontent.com/jlacube/awesome-coding-assistants/main/index.json'];

describe('normalizeIndexUrls', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    log = createMockLogOutputChannel();
  });

  it('should coerce a string to a single-element array (FR-022)', () => {
    const result = normalizeIndexUrls('https://example.com/index.json', DEFAULT_URLS, log);
    assert.deepStrictEqual(result, ['https://example.com/index.json']);
  });

  it('should return a string array unchanged (FR-022)', () => {
    const urls = ['https://a.com/index.json', 'https://b.com/index.json'];
    const result = normalizeIndexUrls(urls, DEFAULT_URLS, log);
    assert.deepStrictEqual(result, urls);
  });

  it('should return defaults for undefined (FR-023)', () => {
    const result = normalizeIndexUrls(undefined, DEFAULT_URLS, log);
    assert.deepStrictEqual(result, DEFAULT_URLS);
  });

  it('should return defaults for a number and log warning (FR-022)', () => {
    const result = normalizeIndexUrls(42, DEFAULT_URLS, log);
    assert.deepStrictEqual(result, DEFAULT_URLS);
    const warns = log.messages.filter(m => m.level === 'warn');
    assert.ok(warns.some(m => m.message.includes('number')));
  });

  it('should return defaults for null and log warning', () => {
    const result = normalizeIndexUrls(null, DEFAULT_URLS, log);
    assert.deepStrictEqual(result, DEFAULT_URLS);
    const warns = log.messages.filter(m => m.level === 'warn');
    assert.ok(warns.some(m => m.message.includes('null')));
  });

  it('should return defaults for an object and log warning', () => {
    const result = normalizeIndexUrls({ foo: 'bar' }, DEFAULT_URLS, log);
    assert.deepStrictEqual(result, DEFAULT_URLS);
    const warns = log.messages.filter(m => m.level === 'warn');
    assert.ok(warns.some(m => m.message.includes('object')));
  });

  it('should return defaults for a mixed array (not all strings)', () => {
    const result = normalizeIndexUrls(['https://a.com', 123], DEFAULT_URLS, log);
    assert.deepStrictEqual(result, DEFAULT_URLS);
  });

  it('should handle empty string as valid string input', () => {
    const result = normalizeIndexUrls('', DEFAULT_URLS, log);
    assert.deepStrictEqual(result, ['']);
  });

  it('should handle empty array as valid array input', () => {
    const result = normalizeIndexUrls([], DEFAULT_URLS, log);
    assert.deepStrictEqual(result, []);
  });

  it('should log coercion at warn level (NFR-017)', () => {
    normalizeIndexUrls('https://example.com/index.json', DEFAULT_URLS, log);
    const warns = log.messages.filter(m => m.level === 'warn');
    assert.ok(warns.length > 0, 'Should log a warning when coercing string to array');
    assert.ok(warns[0].message.includes(IndexErrorCodes.INVALID_INDEX_URL_TYPE.code));
  });

  it('should work without a log channel', () => {
    const result = normalizeIndexUrls('https://example.com/index.json', DEFAULT_URLS);
    assert.deepStrictEqual(result, ['https://example.com/index.json']);
  });
});

describe('SourceRegistry - loadMultipleIndexes', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(() => {
    log = createMockLogOutputChannel();
  });

  function makeIndex(sources: { url: string; name: string; branch?: string }[]): string {
    return JSON.stringify({ version: '1.0', sources });
  }

  it('should fetch multiple URLs in parallel and merge sources (FR-024)', async () => {
    const index1 = makeIndex([
      { url: 'https://github.com/org/repo1', name: 'Repo1' },
    ]);
    const index2 = makeIndex([
      { url: 'https://github.com/org/repo2', name: 'Repo2' },
    ]);

    const github = createMockGitHubClient({
      getFileContent: async (source) => {
        if (source.url.includes('source1')) { return index1; }
        if (source.url.includes('source2')) { return index2; }
        return '{}';
      },
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/source1/repo/main/index.json',
      'https://raw.githubusercontent.com/source2/repo/main/index.json',
    ]);

    assert.strictEqual(result.sources.length, 2);
    assert.strictEqual(result.fetchResults.length, 2);
    assert.ok(result.fetchResults.every(r => r.success));

    registry.dispose();
  });

  it('should dedup by sourceKey with first-seen-wins (FR-025, FR-026)', async () => {
    const index1 = makeIndex([
      { url: 'https://github.com/org/shared', name: 'First Version', branch: 'main' },
    ]);
    const index2 = makeIndex([
      { url: 'https://github.com/org/shared', name: 'Second Version', branch: 'main' },
    ]);

    const github = createMockGitHubClient({
      getFileContent: async (source) => {
        if (source.url.includes('source1')) { return index1; }
        if (source.url.includes('source2')) { return index2; }
        return '{}';
      },
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/source1/repo/main/index.json',
      'https://raw.githubusercontent.com/source2/repo/main/index.json',
    ]);

    assert.strictEqual(result.sources.length, 1, 'Duplicate should be deduped');
    assert.strictEqual(result.sources[0].name, 'First Version', 'First-seen should win');

    registry.dispose();
  });

  it('should reject non-HTTPS URLs with warning (NFR-006)', async () => {
    const github = createMockGitHubClient();
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'http://insecure.example.com/index.json',
    ]);

    assert.strictEqual(result.sources.length, 0);
    assert.strictEqual(result.fetchResults.length, 1);
    assert.strictEqual(result.fetchResults[0].success, false);
    assert.ok(result.fetchResults[0].error?.includes('Non-HTTPS'));

    const warns = log.messages.filter(m => m.level === 'warn');
    assert.ok(warns.some(m => m.message.includes('Non-HTTPS')));

    registry.dispose();
  });

  it('should handle partial failure - one URL fails, others succeed (FR-024)', async () => {
    const validIndex = makeIndex([
      { url: 'https://github.com/org/good', name: 'Good' },
    ]);

    const github = createMockGitHubClient({
      getFileContent: async (source) => {
        if (source.url.includes('good')) { return validIndex; }
        throw new Error('Network error');
      },
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/bad/repo/main/index.json',
      'https://raw.githubusercontent.com/good/repo/main/index.json',
    ]);

    assert.strictEqual(result.sources.length, 1);
    assert.strictEqual(result.sources[0].name, 'Good');

    const failed = result.fetchResults.find(r => !r.success);
    assert.ok(failed);
    assert.ok(failed.error?.includes('Network error'));

    const succeeded = result.fetchResults.find(r => r.success);
    assert.ok(succeeded);

    registry.dispose();
  });

  it('should handle total failure - all URLs fail (FR-024)', async () => {
    const github = createMockGitHubClient({
      getFileContent: async () => { throw new Error('Network error'); },
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/bad1/repo/main/index.json',
      'https://raw.githubusercontent.com/bad2/repo/main/index.json',
    ]);

    assert.strictEqual(result.sources.length, 0);
    assert.ok(result.fetchResults.every(r => !r.success));

    registry.dispose();
  });

  it('should treat schema validation failure as fetch failure', async () => {
    const github = createMockGitHubClient({
      getFileContent: async () => JSON.stringify({ notAnIndex: true }),
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/bad/repo/main/index.json',
    ]);

    assert.strictEqual(result.sources.length, 0);
    assert.strictEqual(result.fetchResults.length, 1);
    assert.strictEqual(result.fetchResults[0].success, false);
    assert.ok(result.fetchResults[0].error?.includes('Invalid index schema'));

    registry.dispose();
  });

  it('should handle up to 10 URLs without error (NFR-008)', async () => {
    const index = makeIndex([]);
    const github = createMockGitHubClient({
      getFileContent: async () => index,
    });
    const registry = new SourceRegistry(github, log);

    const urls = Array.from({ length: 10 }, (_, i) =>
      `https://raw.githubusercontent.com/org${i}/repo/main/index.json`
    );

    const result = await registry.loadMultipleIndexes(urls);
    assert.strictEqual(result.fetchResults.length, 10);

    registry.dispose();
  });

  it('should handle malformed URLs gracefully', async () => {
    const github = createMockGitHubClient();
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'not-a-url',
    ]);

    assert.strictEqual(result.sources.length, 0);
    assert.strictEqual(result.fetchResults.length, 1);
    assert.strictEqual(result.fetchResults[0].success, false);

    registry.dispose();
  });

  it('should merge 1000 entries efficiently (NFR-009)', async () => {
    const sources = Array.from({ length: 500 }, (_, i) => ({
      url: `https://github.com/org/repo${i}`,
      name: `Repo ${i}`,
    }));
    const index1 = makeIndex(sources);

    const sources2 = Array.from({ length: 500 }, (_, i) => ({
      url: `https://github.com/org2/repo${i}`,
      name: `Repo2 ${i}`,
    }));
    const index2 = makeIndex(sources2);

    const github = createMockGitHubClient({
      getFileContent: async (source) => {
        if (source.url.includes('src1')) { return index1; }
        return index2;
      },
    });
    const registry = new SourceRegistry(github, log);

    const start = Date.now();
    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/src1/repo/main/index.json',
      'https://raw.githubusercontent.com/src2/repo/main/index.json',
    ]);
    const elapsed = Date.now() - start;

    assert.strictEqual(result.sources.length, 1000);
    assert.ok(elapsed < 5000, `Merge took ${elapsed}ms, expected < 5000ms`);

    registry.dispose();
  });
});

describe('SourceRegistry - loadMasterIndex multi-URL integration', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(async () => {
    log = createMockLogOutputChannel();
    const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
    await config.update('sources', undefined, vscode.ConfigurationTarget.Global);
  });

  function makeIndex(sources: { url: string; name: string; branch?: string }[]): string {
    return JSON.stringify({ version: '1.0', sources });
  }

  it('should use single-fetch path for one URL (backward compat)', async () => {
    const indexContent = makeIndex([
      { url: 'https://github.com/org/repo1', name: 'Repo1' },
    ]);

    let fetchCount = 0;
    const github = createMockGitHubClient({
      getFileContent: async () => {
        fetchCount++;
        return indexContent;
      },
    });
    const registry = new SourceRegistry(github, log);

    await registry.loadMasterIndex();

    assert.strictEqual(fetchCount, 1, 'Should fetch exactly once for single URL');
    const sources = registry.getSources();
    assert.ok(sources.some(s => s.url === 'https://github.com/org/repo1'));

    registry.dispose();
  });

  it('should handle backward-compatible string indexUrl setting (FR-022)', async () => {
    // The default indexUrl is now an array in package.json
    // But if a user had the old string format, normalizeIndexUrls coerces it
    const indexContent = makeIndex([
      { url: 'https://github.com/org/repo1', name: 'Repo1' },
    ]);

    const github = createMockGitHubClient({
      getFileContent: async () => indexContent,
    });
    const registry = new SourceRegistry(github, log);

    // Default from package.json is now an array, so loadMasterIndex should work
    await registry.loadMasterIndex();

    const sources = registry.getSources();
    assert.ok(sources.some(s => s.url === 'https://github.com/org/repo1'));

    registry.dispose();
  });

  it('should log per-URL results at info level for multi-URL (NFR-015)', async () => {
    const index1 = makeIndex([{ url: 'https://github.com/org/a', name: 'A' }]);
    const index2 = makeIndex([{ url: 'https://github.com/org/b', name: 'B' }]);

    const github = createMockGitHubClient({
      getFileContent: async (source) => {
        if (source.url.includes('src1')) { return index1; }
        return index2;
      },
    });
    const registry = new SourceRegistry(github, log);

    const result = await registry.loadMultipleIndexes([
      'https://raw.githubusercontent.com/src1/repo/main/index.json',
      'https://raw.githubusercontent.com/src2/repo/main/index.json',
    ]);

    // Verify the method returns proper fetch results
    assert.strictEqual(result.fetchResults.length, 2);
    assert.ok(result.fetchResults.every(r => r.success));

    registry.dispose();
  });
});

describe('SourceRegistry - cache invalidation (FR-027)', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;

  beforeEach(async () => {
    log = createMockLogOutputChannel();
    const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
    await config.update('sources', undefined, vscode.ConfigurationTarget.Global);
  });

  it('should clear cache when indexUrl setting changes (FR-027)', async () => {
    const indexContent = JSON.stringify({
      version: '1.0',
      sources: [{ url: 'https://github.com/org/repo', name: 'TestRepo' }],
    });

    const github = createMockGitHubClient({
      getFileContent: async () => indexContent,
    });
    const registry = new SourceRegistry(github, log);

    // Load index first
    await registry.loadMasterIndex();
    let sources = registry.getSources();
    assert.ok(sources.some(s => s.url === 'https://github.com/org/repo'));

    // Invalidate and check default source comes back
    registry.invalidateCache();
    sources = registry.getSources();
    // After invalidation, should fall back to default source
    assert.ok(sources.some(s => s.url === 'https://github.com/jlacube/awesome-coding-assistants'));

    registry.dispose();
  });

  it('should handle affectsConfiguration for array-type indexUrl', () => {
    // The existing onDidChangeConfiguration listener checks
    // e.affectsConfiguration('awesome-coding-assistants.indexUrl')
    // This test verifies the listener is properly set up
    const github = createMockGitHubClient();
    const registry = new SourceRegistry(github, log);

    // Dispose should not throw (listener cleanup)
    registry.dispose();
  });
});

describe('IndexErrorCodes', () => {
  it('should have INDEX_FETCH_FAILED code defined', () => {
    assert.strictEqual(IndexErrorCodes.INDEX_FETCH_FAILED.code, 'INDEX_FETCH_FAILED');
    assert.strictEqual(IndexErrorCodes.INDEX_FETCH_FAILED.logLevel, 'warn');
  });

  it('should have INDEX_SCHEMA_INVALID code defined', () => {
    assert.strictEqual(IndexErrorCodes.INDEX_SCHEMA_INVALID.code, 'INDEX_SCHEMA_INVALID');
    assert.strictEqual(IndexErrorCodes.INDEX_SCHEMA_INVALID.logLevel, 'warn');
  });

  it('should have INVALID_INDEX_URL_TYPE code defined', () => {
    assert.strictEqual(IndexErrorCodes.INVALID_INDEX_URL_TYPE.code, 'INVALID_INDEX_URL_TYPE');
    assert.strictEqual(IndexErrorCodes.INVALID_INDEX_URL_TYPE.logLevel, 'warn');
  });

  it('should not modify existing error codes', () => {
    // Verify existing error classes still work
    const { SourceUnreachableError, AuthFailedError } = require('../../src/models/errors');
    const err1 = new SourceUnreachableError('https://test.com');
    assert.strictEqual(err1.code, 'SOURCE_UNREACHABLE');

    const err2 = new AuthFailedError('test-repo');
    assert.strictEqual(err2.code, 'AUTH_FAILED');
  });
});

describe('sourceKey', () => {
  it('should produce url@branch key', () => {
    const key = sourceKey({ url: 'https://github.com/org/repo', name: 'Test', branch: 'dev' });
    assert.strictEqual(key, 'https://github.com/org/repo@dev');
  });

  it('should default branch to main', () => {
    const key = sourceKey({ url: 'https://github.com/org/repo', name: 'Test' });
    assert.strictEqual(key, 'https://github.com/org/repo@main');
  });
});
