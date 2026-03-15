// Tests for PreviewProvider, preview command, and directory resolution
// Spec refs: FR-016, FR-017, FR-018, FR-019, US-02, BDD Section 11.2
// WP04 T04-05

import * as assert from 'assert';
import {
  PreviewProvider,
  PREVIEW_SCHEME,
  buildPreviewUri,
  decodePreviewUri,
  resolvePrimaryFile,
} from '../../src/providers/previewProvider';
import { PreviewFetchFailedError } from '../../src/models/errors';
import type { SourceConfig } from '../../src/models/types';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type { GitHubClient } from '../../src/services/githubClient';

// --- Mock GitHubClient ---

function createMockGitHubClient(
  fileContentMap: Record<string, string> = {},
  errorPaths: Set<string> = new Set(),
) {
  return {
    getFileContent: async (_source: SourceConfig, path: string): Promise<string> => {
      if (errorPaths.has(path)) {
        throw new Error(`Network error fetching ${path}`);
      }
      const content = fileContentMap[path];
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
    getRepoTree: async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
    getLatestCommitSha: async () => 'abc123',
    validateRepo: async () => ({ valid: true }),
  } as unknown as GitHubClient;
}

// --- Tests ---

describe('PreviewProvider', () => {
  const testSource: SourceConfig = {
    url: 'https://github.com/test-owner/test-repo',
    name: 'Test Repo',
    branch: 'main',
  };

  function createSourceMap(...sources: SourceConfig[]): () => Map<string, SourceConfig> {
    return () => {
      const map = new Map<string, SourceConfig>();
      for (const s of sources) {
        map.set(s.url, s);
      }
      return map;
    };
  }

  describe('provideTextDocumentContent', () => {
    it('should fetch and return file content (US-02 Scenario 1, BDD: Preview a public file)', async () => {
      const mockContent = '# Code Review Agent\n\nThis agent performs code reviews.';
      const mockClient = createMockGitHubClient({
        'agents/code-review.agent.md': mockContent,
      });
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        createSourceMap(testSource),
      );

      const uri = buildPreviewUri(testSource, 'agents/code-review.agent.md', 'code-review.agent.md');
      const result = await provider.provideTextDocumentContent(uri);

      assert.strictEqual(result, mockContent);
    });

    it('should return cached content on second call (cache test)', async () => {
      let fetchCount = 0;
      const mockClient = {
        getFileContent: async () => {
          fetchCount++;
          return '# Cached Content';
        },
      } as unknown as GitHubClient;
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        createSourceMap(testSource),
      );

      const uri = buildPreviewUri(testSource, 'agents/test.agent.md', 'test.agent.md');

      await provider.provideTextDocumentContent(uri);
      await provider.provideTextDocumentContent(uri);

      assert.strictEqual(fetchCount, 1, 'Should only fetch once due to caching');
    });

    it('should throw PreviewFetchFailedError on fetch failure (US-02 Scenario 3, BDD: Preview fails)', async () => {
      const mockClient = createMockGitHubClient({}, new Set(['agents/broken.agent.md']));
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        createSourceMap(testSource),
      );

      const uri = buildPreviewUri(testSource, 'agents/broken.agent.md', 'broken.agent.md');

      await assert.rejects(
        () => provider.provideTextDocumentContent(uri),
        (err: Error) => {
          assert.ok(err instanceof PreviewFetchFailedError);
          assert.strictEqual(err.code, 'PREVIEW_FETCH_FAILED');
          assert.ok(err.userMessage.startsWith('Failed to fetch preview:'));
          return true;
        },
      );

      // Verify internal log message format
      const errorLogs = log.messages.filter(m => m.level === 'error');
      assert.ok(errorLogs.length > 0, 'Should log error');
      assert.ok(errorLogs[0].message.includes('Preview fetch error for'), 'Log should include path');
    });

    it('should return error content when source is not found', async () => {
      const mockClient = createMockGitHubClient();
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        () => new Map(), // empty source map
      );

      const uri = buildPreviewUri(testSource, 'agents/test.agent.md', 'test.agent.md');
      const result = await provider.provideTextDocumentContent(uri);

      assert.ok(result.includes('# Error'));
      assert.ok(result.includes('source not found'));
    });

    it('should work with private repo source (US-02 Scenario 2)', async () => {
      const privateSource: SourceConfig = {
        url: 'https://github.com/private-org/private-repo',
        name: 'Private Repo',
        branch: 'main',
        authTokenKey: 'private-org-token',
      };
      const mockContent = '# Private Agent\n\nInternal-only agent.';
      const mockClient = createMockGitHubClient({
        'agents/internal.agent.md': mockContent,
      });
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        createSourceMap(privateSource),
      );

      const uri = buildPreviewUri(privateSource, 'agents/internal.agent.md', 'internal.agent.md');
      const result = await provider.provideTextDocumentContent(uri);

      assert.strictEqual(result, mockContent);
    });
  });

  describe('clearCache', () => {
    it('should clear cached content so next call re-fetches', async () => {
      let fetchCount = 0;
      const mockClient = {
        getFileContent: async () => {
          fetchCount++;
          return '# Content';
        },
      } as unknown as GitHubClient;
      const log = createMockLogOutputChannel();
      const provider = new PreviewProvider(
        mockClient,
        log,
        createSourceMap(testSource),
      );

      const uri = buildPreviewUri(testSource, 'agents/test.agent.md', 'test.agent.md');

      await provider.provideTextDocumentContent(uri);
      assert.strictEqual(fetchCount, 1);

      provider.clearCache();

      await provider.provideTextDocumentContent(uri);
      assert.strictEqual(fetchCount, 2, 'Should re-fetch after cache clear');
    });
  });
});

describe('buildPreviewUri / decodePreviewUri', () => {
  it('should round-trip source, branch, and path correctly', () => {
    const source: SourceConfig = {
      url: 'https://github.com/owner/repo',
      name: 'Test',
      branch: 'develop',
    };
    const path = 'agents/code-review.agent.md';
    const filename = 'code-review.agent.md';

    const uri = buildPreviewUri(source, path, filename);

    assert.ok(uri.scheme === PREVIEW_SCHEME);
    assert.ok(uri.path.includes(filename));

    const decoded = decodePreviewUri(uri);
    assert.strictEqual(decoded.sourceUrl, source.url);
    assert.strictEqual(decoded.branch, 'develop');
    assert.strictEqual(decoded.path, path);
  });

  it('should default branch to main for source without branch', () => {
    const source: SourceConfig = { url: 'https://github.com/o/r', name: 'T' };
    const uri = buildPreviewUri(source, 'file.md', 'file.md');
    const decoded = decodePreviewUri(uri);
    assert.strictEqual(decoded.branch, 'main');
  });

  it('should handle special characters in path', () => {
    const source: SourceConfig = {
      url: 'https://github.com/owner/repo',
      name: 'Test',
      branch: 'main',
    };
    const path = '.claude/commands/review & deploy.md';

    const uri = buildPreviewUri(source, path, 'review & deploy.md');
    const decoded = decodePreviewUri(uri);

    assert.strictEqual(decoded.path, path);
    assert.strictEqual(decoded.sourceUrl, source.url);
  });
});

describe('resolvePrimaryFile (FR-018)', () => {
  it('should return SKILL.md for skill directories', () => {
    const allPaths = [
      'skills/code-review/SKILL.md',
      'skills/code-review/README.md',
      'skills/code-review/utils.ts',
    ];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, 'skills/code-review/SKILL.md');
  });

  it('should return README.md if no SKILL.md', () => {
    const allPaths = [
      'skills/code-review/README.md',
      'skills/code-review/helpers.md',
      'skills/code-review/utils.ts',
    ];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, 'skills/code-review/README.md');
  });

  it('should return first .md alphabetically if no SKILL.md or README.md', () => {
    const allPaths = [
      'skills/code-review/zebra.md',
      'skills/code-review/alpha.md',
      'skills/code-review/utils.ts',
    ];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, 'skills/code-review/alpha.md');
  });

  it('should return undefined for empty directories', () => {
    const allPaths = ['skills/code-review/utils.ts'];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, undefined);
  });

  it('should return undefined for directory with no files', () => {
    const result = resolvePrimaryFile('skills/code-review', []);
    assert.strictEqual(result, undefined);
  });

  it('should not match subdirectories', () => {
    const allPaths = [
      'skills/code-review/sub/nested.md',
      'skills/code-review/SKILL.md',
    ];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, 'skills/code-review/SKILL.md');
  });

  it('should handle trailing slash in directory path', () => {
    const allPaths = ['skills/review/SKILL.md'];
    const result = resolvePrimaryFile('skills/review/', allPaths);
    assert.strictEqual(result, 'skills/review/SKILL.md');
  });

  it('should be case-insensitive for SKILL.md and README.md', () => {
    const allPaths = [
      'skills/review/skill.md',
      'skills/review/other.md',
    ];
    const result = resolvePrimaryFile('skills/review', allPaths);
    assert.strictEqual(result, 'skills/review/skill.md');
  });

  it('should show message for directories without .md files (FR-018)', () => {
    const allPaths = [
      'skills/code-review/config.json',
      'skills/code-review/script.ts',
    ];
    const result = resolvePrimaryFile('skills/code-review', allPaths);
    assert.strictEqual(result, undefined);
  });
});

describe('Preview command integration', () => {
  it('should construct correct URI for a catalog file item', () => {
    const source: SourceConfig = {
      url: 'https://github.com/owner/repo',
      name: 'Test',
      branch: 'main',
    };
    const uri = buildPreviewUri(source, 'agents/smart.agent.md', 'smart.agent.md');

    assert.strictEqual(uri.scheme, PREVIEW_SCHEME);
    const decoded = decodePreviewUri(uri);
    assert.strictEqual(decoded.sourceUrl, 'https://github.com/owner/repo');
    assert.strictEqual(decoded.branch, 'main');
    assert.strictEqual(decoded.path, 'agents/smart.agent.md');
  });

  it('should use PREVIEW_SCHEME constant', () => {
    assert.strictEqual(PREVIEW_SCHEME, 'awesome-ca-preview');
  });
});
