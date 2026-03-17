import { strict as assert } from 'assert';
import type { GitHubTreeEntry } from '../../src/models/types';
import { NewContentDetector } from '../../src/services/newContentDetector';
import { createMockMemento, createMockLogOutputChannel } from '../helpers/mocks';
import type { MockMemento, MockLogOutputChannel } from '../helpers/mocks';

const TREE_V1: GitHubTreeEntry[] = [
  { path: '.github/agents/a.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
  { path: '.github/agents/b.agent.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
  { path: '.github/agents', mode: '040000', type: 'tree', sha: 'g1', url: '' },
];

const TREE_V2: GitHubTreeEntry[] = [
  ...TREE_V1,
  { path: '.github/agents/c.agent.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
  { path: '.github/prompts/p.prompt.md', mode: '100644', type: 'blob', sha: 'p1', url: '' },
];

const SOURCE_URL = 'https://github.com/test/repo';

describe('WP12 - NewContentDetector', () => {
  let globalState: MockMemento;
  let log: MockLogOutputChannel;
  let detector: NewContentDetector;

  beforeEach(() => {
    globalState = createMockMemento();
    log = createMockLogOutputChannel();
    detector = new NewContentDetector(globalState, log);
  });

  describe('checkForNewContent()', () => {
    it('should establish baseline on first activation and return empty result', async () => {
      const result = await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);

      assert.deepStrictEqual(result.newPaths, []);
      assert.deepStrictEqual(result.removedPaths, []);
      assert.strictEqual(result.sourceUrl, SOURCE_URL);

      // Baseline should be stored (blobs only, not tree entries)
      const stored = globalState.get<string[]>(`newContent:seen:${SOURCE_URL}`);
      assert.ok(stored);
      assert.strictEqual(stored!.length, 2); // 2 blobs, not the tree entry
      assert.ok(stored!.includes('.github/agents/a.agent.md'));
      assert.ok(stored!.includes('.github/agents/b.agent.md'));

      // Should log baseline establishment
      assert.ok(log.messages.some(m => m.level === 'info' && m.message.includes('Baseline established')));
    });

    it('should detect new blob paths on second call', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      const result = await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      assert.deepStrictEqual(result.newPaths.sort(), [
        '.github/agents/c.agent.md',
        '.github/prompts/p.prompt.md',
      ]);
      assert.deepStrictEqual(result.removedPaths, []);
    });

    it('should detect removed paths', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      // V1 is missing c.agent.md and p.prompt.md compared to V2
      const result = await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);

      assert.deepStrictEqual(result.removedPaths.sort(), [
        '.github/agents/c.agent.md',
        '.github/prompts/p.prompt.md',
      ]);
      assert.deepStrictEqual(result.newPaths, []);
    });

    it('should detect mixed new and removed paths', async () => {
      const treeA: GitHubTreeEntry[] = [
        { path: 'a.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
        { path: 'b.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
      ];
      const treeB: GitHubTreeEntry[] = [
        { path: 'b.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
        { path: 'c.md', mode: '100644', type: 'blob', sha: 'c1', url: '' },
      ];

      await detector.checkForNewContent(SOURCE_URL, treeA, false);
      const result = await detector.checkForNewContent(SOURCE_URL, treeB, false);

      assert.deepStrictEqual(result.newPaths, ['c.md']);
      assert.deepStrictEqual(result.removedPaths, ['a.md']);
    });

    it('should ignore tree-type entries (only blobs in baseline)', async () => {
      const treeWithDirs: GitHubTreeEntry[] = [
        { path: 'dir', mode: '040000', type: 'tree', sha: 'd1', url: '' },
        { path: 'dir/file.md', mode: '100644', type: 'blob', sha: 'f1', url: '' },
      ];

      await detector.checkForNewContent(SOURCE_URL, treeWithDirs, false);
      const stored = globalState.get<string[]>(`newContent:seen:${SOURCE_URL}`);
      assert.strictEqual(stored!.length, 1);
      assert.strictEqual(stored![0], 'dir/file.md');
    });

    it('should skip detection when tree is truncated', async () => {
      const result = await detector.checkForNewContent(SOURCE_URL, TREE_V1, true);

      assert.deepStrictEqual(result.newPaths, []);
      assert.deepStrictEqual(result.removedPaths, []);
      assert.strictEqual(result.sourceUrl, SOURCE_URL);

      // No baseline should be stored
      const stored = globalState.get<string[]>(`newContent:seen:${SOURCE_URL}`);
      assert.strictEqual(stored, undefined);

      // Should log warning
      assert.ok(log.messages.some(m => m.level === 'warn' && m.message.includes('Truncated tree')));
    });

    it('should log info when new content is detected', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      assert.ok(log.messages.some(m => m.level === 'info' && m.message.includes('New content detected')));
    });

    it('should update baseline after diff', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      const stored = globalState.get<string[]>(`newContent:seen:${SOURCE_URL}`);
      assert.strictEqual(stored!.length, 4); // All 4 blobs from V2
    });
  });

  describe('getNewItems()', () => {
    it('should return stored new paths for a source', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      const items = detector.getNewItems(SOURCE_URL);
      assert.deepStrictEqual(items.sort(), [
        '.github/agents/c.agent.md',
        '.github/prompts/p.prompt.md',
      ]);
    });

    it('should return empty array for unknown source', () => {
      const items = detector.getNewItems('https://github.com/unknown/repo');
      assert.deepStrictEqual(items, []);
    });
  });

  describe('getRemovedItems()', () => {
    it('should return stored removed paths for a source', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);

      const items = detector.getRemovedItems(SOURCE_URL);
      assert.deepStrictEqual(items.sort(), [
        '.github/agents/c.agent.md',
        '.github/prompts/p.prompt.md',
      ]);
    });
  });

  describe('markCategorySeen()', () => {
    it('should remove specified paths from new list', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      await detector.markCategorySeen(SOURCE_URL, ['.github/agents/c.agent.md']);

      const items = detector.getNewItems(SOURCE_URL);
      assert.deepStrictEqual(items, ['.github/prompts/p.prompt.md']);
    });

    it('should be idempotent (no error if paths already absent)', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      // Mark same path twice - should not throw
      await detector.markCategorySeen(SOURCE_URL, ['.github/agents/c.agent.md']);
      await detector.markCategorySeen(SOURCE_URL, ['.github/agents/c.agent.md']);

      const items = detector.getNewItems(SOURCE_URL);
      assert.deepStrictEqual(items, ['.github/prompts/p.prompt.md']);
    });
  });

  describe('markAllSeen()', () => {
    it('should clear all new and removed keys from all sources', async () => {
      const source2 = 'https://github.com/test/repo2';
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);
      await detector.checkForNewContent(source2, TREE_V1, false);
      await detector.checkForNewContent(source2, TREE_V2, false);

      await detector.markAllSeen();

      assert.deepStrictEqual(detector.getNewItems(SOURCE_URL), []);
      assert.deepStrictEqual(detector.getNewItems(source2), []);
      assert.deepStrictEqual(detector.getRemovedItems(SOURCE_URL), []);
      assert.deepStrictEqual(detector.getRemovedItems(source2), []);
    });

    it('should preserve baseline keys', async () => {
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);

      await detector.markAllSeen();

      // Baseline should still exist
      const stored = globalState.get<string[]>(`newContent:seen:${SOURCE_URL}`);
      assert.ok(stored);
      assert.ok(stored!.length > 0);
    });
  });

  describe('getTotalNewCount()', () => {
    it('should sum across multiple sources', async () => {
      const source2 = 'https://github.com/test/repo2';
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);
      await detector.checkForNewContent(source2, TREE_V1, false);
      await detector.checkForNewContent(source2, TREE_V2, false);

      // Each source has 2 new items (c.agent.md and p.prompt.md)
      assert.strictEqual(detector.getTotalNewCount(), 4);
    });

    it('should return 0 when no new items exist', () => {
      assert.strictEqual(detector.getTotalNewCount(), 0);
    });
  });

  describe('getTotalRemovedCount()', () => {
    it('should sum across multiple sources', async () => {
      const source2 = 'https://github.com/test/repo2';
      // Establish baseline with V2, then check with V1 (2 removed per source)
      await detector.checkForNewContent(SOURCE_URL, TREE_V2, false);
      await detector.checkForNewContent(SOURCE_URL, TREE_V1, false);
      await detector.checkForNewContent(source2, TREE_V2, false);
      await detector.checkForNewContent(source2, TREE_V1, false);

      assert.strictEqual(detector.getTotalRemovedCount(), 4);
    });

    it('should return 0 when no removed items exist', () => {
      assert.strictEqual(detector.getTotalRemovedCount(), 0);
    });
  });

  describe('error resilience', () => {
    it('should return empty arrays when globalState returns undefined', () => {
      assert.deepStrictEqual(detector.getNewItems('nonexistent'), []);
      assert.deepStrictEqual(detector.getRemovedItems('nonexistent'), []);
    });
  });
});
