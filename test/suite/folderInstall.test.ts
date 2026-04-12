// Tests for WP17 - Folder-Aware Installation and Conflict Resolution
// Spec refs: FR-010 to FR-015, US-04, US-05
// WP17 T17-07

import * as assert from 'assert';
import * as vscode from 'vscode';
import { detectCrossFolderConflict, resolveFolderConflict } from '../../src/services/conflictResolver';
import { stripFolderPrefix } from '../../src/utils/pathUtils';
import { installationId } from '../../src/models/types';
import type {
  CrossFolderConflict,
  GitHubTreeEntry,
  Manifest,
  SourceConfig,
  InstallationEntry,
} from '../../src/models/types';
import { createMockLogOutputChannel } from '../helpers/mocks';

// --- Helpers ---

function makeSource(overrides?: Partial<SourceConfig>): SourceConfig {
  return {
    url: 'https://github.com/test/repo',
    name: 'Test Repo',
    branch: 'main',
    ...overrides,
  };
}

function makeEntry(path: string, type: 'blob' | 'tree' = 'blob'): GitHubTreeEntry {
  return {
    path,
    mode: '100644',
    type,
    sha: 'abc123',
    url: `https://api.github.com/repos/test/repo/git/blobs/abc123`,
  };
}

function makeManifest(installations: InstallationEntry[] = []): Manifest {
  return { version: '1.0', installations };
}

function makeInstallation(overrides: Partial<InstallationEntry> & { itemPath: string }): InstallationEntry {
  const source = makeSource();
  return {
    id: installationId(source.url, source.branch, overrides.itemPath),
    sourceUrl: source.url,
    sourceBranch: source.branch || 'main',
    targetPaths: [],
    tool: 'copilot',
    category: 'agents',
    commitSha: 'abc123',
    installedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WP17 - Folder-Aware Installation and Conflict Resolution', () => {

  // ========================================
  // T17-01: Folder prefix stripping in install
  // ========================================
  describe('T17-01: Folder prefix stripping for install', () => {
    const folders = new Set(['frontend-team', 'backend-team']);

    it('FR-010: strips folder prefix from item path', () => {
      const result = stripFolderPrefix('frontend-team/.github/agents/helper.agent.md', folders);
      assert.strictEqual(result, '.github/agents/helper.agent.md');
    });

    it('FR-011: root-level paths are unchanged (no folder prefix)', () => {
      const result = stripFolderPrefix('.github/prompts/y.prompt.md', folders);
      assert.strictEqual(result, '.github/prompts/y.prompt.md');
    });

    it('FR-010: only strips when first segment is a known folder', () => {
      const result = stripFolderPrefix('unknown-team/.github/agents/x.md', folders);
      assert.strictEqual(result, 'unknown-team/.github/agents/x.md');
    });

    it('empty folders set means no stripping', () => {
      const result = stripFolderPrefix('frontend-team/.github/agents/x.md', new Set());
      assert.strictEqual(result, 'frontend-team/.github/agents/x.md');
    });

    it('preserves full path structure after stripping', () => {
      const result = stripFolderPrefix('backend-team/.claude/commands/deploy.md', folders);
      assert.strictEqual(result, '.claude/commands/deploy.md');
    });
  });

  // ========================================
  // T17-02: Manifest entry with full source path
  // ========================================
  describe('T17-02: Manifest entry with full source path', () => {
    it('FR-012: installationId includes full folder-prefixed path', () => {
      const id = installationId(
        'https://github.com/test/repo',
        'main',
        'frontend-team/.github/agents/helper.agent.md',
      );
      assert.strictEqual(id, 'https://github.com/test/repo@main#frontend-team/.github/agents/helper.agent.md');
    });

    it('FR-012: installationId for root-level path has no folder prefix', () => {
      const id = installationId(
        'https://github.com/test/repo',
        'main',
        '.github/agents/helper.agent.md',
      );
      assert.strictEqual(id, 'https://github.com/test/repo@main#.github/agents/helper.agent.md');
    });

    it('different folder paths produce different installation IDs', () => {
      const id1 = installationId('https://github.com/test/repo', 'main', 'frontend-team/.github/agents/x.md');
      const id2 = installationId('https://github.com/test/repo', 'main', 'backend-team/.github/agents/x.md');
      assert.notStrictEqual(id1, id2);
    });
  });

  // ========================================
  // T17-04: detectCrossFolderConflict
  // ========================================
  describe('T17-04: detectCrossFolderConflict', () => {
    const source = makeSource();
    const folders = new Set(['frontend', 'backend']);
    const log = createMockLogOutputChannel();

    it('FR-014: detects conflict when two folders have same post-strip path', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents/x.md'),
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.ok(result, 'Should detect a conflict');
      assert.strictEqual(result!.targetPath, '.github/agents/x.md');
      assert.strictEqual(result!.candidates.length, 2);
      assert.ok(result!.candidates.some(c => c.folderName === 'frontend'));
      assert.ok(result!.candidates.some(c => c.folderName === 'backend'));
    });

    it('FR-014: includes manifest entry in conflict when already installed', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents/x.md'),
      ];
      const manifest = makeManifest([
        makeInstallation({
          itemPath: 'backend/.github/agents/x.md',
          targetPaths: ['.github/agents/x.md'],
          sourceUrl: source.url,
        }),
      ]);

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.ok(result, 'Should detect a conflict');
      assert.ok(result!.candidates.some(c => c.folderName === 'backend'));
    });

    it('returns undefined when no conflict exists', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents/y.md'),
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('returns undefined when folders set is empty', () => {
      const entries = [makeEntry('.github/agents/x.md')];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        '.github/agents/x.md', new Set(), entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('returns undefined for root-level items (no folder prefix)', () => {
      const entries = [makeEntry('.github/agents/x.md')];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        '.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('does not flag items from the same folder', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('frontend/.github/agents/y.md'),
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('skips tree entries in allEntries (only checks blobs)', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents', 'tree'), // directory, not a file
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('NFR-005: performance - completes quickly with 100 manifest entries', () => {
      const entries: GitHubTreeEntry[] = [];
      const installations: InstallationEntry[] = [];
      for (let i = 0; i < 100; i++) {
        installations.push(makeInstallation({
          itemPath: `backend/.github/agents/agent-${i}.md`,
          targetPaths: [`.github/agents/agent-${i}.md`],
          sourceUrl: source.url,
        }));
        entries.push(makeEntry(`backend/.github/agents/agent-${i}.md`));
      }
      entries.push(makeEntry('frontend/.github/agents/agent-0.md'));
      const manifest = makeManifest(installations);

      const start = Date.now();
      const result = detectCrossFolderConflict(
        'frontend/.github/agents/agent-0.md', folders, entries, manifest, source, log,
      );
      const elapsed = Date.now() - start;

      assert.ok(result, 'Should detect conflict with agent-0');
      assert.ok(elapsed < 100, `Detection took ${elapsed}ms, should be < 100ms`);
    });

    it('detects conflict from manifest only (no matching tree entries)', () => {
      // Only the current item is in entries, but manifest has another folder's install
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
      ];
      const manifest = makeManifest([
        makeInstallation({
          itemPath: 'backend/.github/agents/x.md',
          targetPaths: ['.github/agents/x.md'],
          sourceUrl: source.url,
        }),
      ]);

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.ok(result, 'Should detect conflict from manifest');
      assert.strictEqual(result!.candidates.length, 2);
    });

    it('ignores manifest entries from different sources', () => {
      const entries = [makeEntry('frontend/.github/agents/x.md')];
      const manifest = makeManifest([
        makeInstallation({
          itemPath: 'backend/.github/agents/x.md',
          targetPaths: ['.github/agents/x.md'],
          sourceUrl: 'https://github.com/other/repo', // different source
        }),
      ]);

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('handles conflict with 3+ candidates from different folders', () => {
      const threeFolders = new Set(['alpha', 'beta', 'gamma']);
      const entries = [
        makeEntry('alpha/.github/agents/shared.md'),
        makeEntry('beta/.github/agents/shared.md'),
        makeEntry('gamma/.github/agents/shared.md'),
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'alpha/.github/agents/shared.md', threeFolders, entries, manifest, source, log,
      );

      assert.ok(result, 'Should detect conflict');
      assert.strictEqual(result!.candidates.length, 3);
    });
  });

  // ========================================
  // T17-05: resolveConflict quick-pick
  // ========================================
  describe('T17-05: Conflict resolution via resolveFolderConflict()', () => {
    const source = makeSource();

    function makeConflict(): CrossFolderConflict {
      return {
        targetPath: '.github/agents/x.md',
        candidates: [
          {
            fullSourcePath: 'frontend/.github/agents/x.md',
            folderName: 'frontend',
            folderDisplayName: 'Frontend',
            source,
          },
          {
            fullSourcePath: 'backend/.github/agents/x.md',
            folderName: 'backend',
            folderDisplayName: 'Backend',
            source,
          },
        ],
      };
    }

    it('returns selected candidate when user picks an option', async () => {
      const log = createMockLogOutputChannel();
      const conflict = makeConflict();

      const origShowQuickPick = vscode.window.showQuickPick;
      (vscode.window as any).showQuickPick = async (items: any[]) => {
        // Simulate user selecting the first item
        return items[0];
      };

      try {
        const result = await resolveFolderConflict(conflict, log);
        assert.ok(result, 'Should return a candidate');
        assert.strictEqual(result!.fullSourcePath, 'frontend/.github/agents/x.md');
        assert.strictEqual(result!.folderName, 'frontend');
      } finally {
        (vscode.window as any).showQuickPick = origShowQuickPick;
      }
    });

    it('returns undefined when user dismisses (Escape)', async () => {
      const log = createMockLogOutputChannel();
      const conflict = makeConflict();

      const origShowQuickPick = vscode.window.showQuickPick;
      (vscode.window as any).showQuickPick = async () => undefined;

      try {
        const result = await resolveFolderConflict(conflict, log);
        assert.strictEqual(result, undefined, 'Should return undefined on dismiss');
      } finally {
        (vscode.window as any).showQuickPick = origShowQuickPick;
      }
    });

    it('NFR-016: logs selection at info level', async () => {
      const log = createMockLogOutputChannel();
      const conflict = makeConflict();

      const origShowQuickPick = vscode.window.showQuickPick;
      (vscode.window as any).showQuickPick = async (items: any[]) => items[0];

      try {
        await resolveFolderConflict(conflict, log);
        const infoMessages = log.messages.filter(m => m.level === 'info');
        assert.ok(
          infoMessages.some(m => m.message.includes('Conflict resolved') && m.message.includes('frontend')),
          'Should log selection with folder name',
        );
      } finally {
        (vscode.window as any).showQuickPick = origShowQuickPick;
      }
    });

    it('NFR-016: logs cancellation at info level', async () => {
      const log = createMockLogOutputChannel();
      const conflict = makeConflict();

      const origShowQuickPick = vscode.window.showQuickPick;
      (vscode.window as any).showQuickPick = async () => undefined;

      try {
        await resolveFolderConflict(conflict, log);
        const infoMessages = log.messages.filter(m => m.level === 'info');
        assert.ok(
          infoMessages.some(m => m.message.includes('Conflict cancelled') && m.message.includes('.github/agents/x.md')),
          'Should log cancellation with target path',
        );
      } finally {
        (vscode.window as any).showQuickPick = origShowQuickPick;
      }
    });
  });

  // ========================================
  // T17-03: Lifecycle operations with folder-aware manifests
  // ========================================
  describe('T17-03: Lifecycle with folder-aware manifest entries', () => {
    it('FR-013: installationId uses full path for folder items', () => {
      const id = installationId(
        'https://github.com/test/repo',
        'main',
        'frontend-team/.github/agents/helper.agent.md',
      );
      // Update and uninstall lookup use this ID
      assert.ok(id.includes('frontend-team/.github/agents/helper.agent.md'));
    });

    it('FR-013: manifest targetPaths contains stripped workspace path', () => {
      const entry = makeInstallation({
        itemPath: 'frontend-team/.github/agents/helper.agent.md',
        targetPaths: ['.github/agents/helper.agent.md'],
      });
      // Uninstall uses targetPaths to find workspace files
      assert.deepStrictEqual(entry.targetPaths, ['.github/agents/helper.agent.md']);
      // itemPath retains full source path for update fetch
      assert.strictEqual(entry.itemPath, 'frontend-team/.github/agents/helper.agent.md');
    });
  });

  // ========================================
  // T17-06: Conflict detection integration
  // ========================================
  describe('T17-06: Conflict detection integration guard', () => {
    const source = makeSource();
    const log = createMockLogOutputChannel();

    it('skips conflict detection when discoveredFolders is empty', () => {
      const entries = [makeEntry('.github/agents/x.md')];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        '.github/agents/x.md', new Set(), entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('skips conflict detection for non-folder items (strippedPath equals itemPath)', () => {
      const folders = new Set(['frontend']);
      const entries = [makeEntry('.github/agents/x.md')];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        '.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });
  });

  // ========================================
  // Edge cases
  // ========================================
  describe('Edge cases', () => {
    const source = makeSource();
    const folders = new Set(['frontend', 'backend']);
    const log = createMockLogOutputChannel();

    it('conflict detection with empty manifest and no conflicting entries', () => {
      const entries = [makeEntry('frontend/.github/agents/unique.md')];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/unique.md', folders, entries, manifest, source, log,
      );

      assert.strictEqual(result, undefined);
    });

    it('conflict detection with empty allEntries but manifest conflict', () => {
      const entries: GitHubTreeEntry[] = [];
      const manifest = makeManifest([
        makeInstallation({
          itemPath: 'backend/.github/agents/shared.md',
          targetPaths: ['.github/agents/shared.md'],
          sourceUrl: source.url,
        }),
      ]);

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/shared.md', folders, entries, manifest, source, log,
      );

      assert.ok(result, 'Should detect conflict from manifest');
    });

    it('no duplicate candidates when same item appears in both entries and manifest', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents/x.md'),
      ];
      const manifest = makeManifest([
        makeInstallation({
          itemPath: 'backend/.github/agents/x.md',
          targetPaths: ['.github/agents/x.md'],
          sourceUrl: source.url,
        }),
      ]);

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.ok(result);
      // backend should appear only once, not duplicated
      const backendCandidates = result!.candidates.filter(c => c.folderName === 'backend');
      assert.strictEqual(backendCandidates.length, 1);
    });

    it('conflict candidates include folderDisplayName (formatted)', () => {
      const entries = [
        makeEntry('frontend/.github/agents/x.md'),
        makeEntry('backend/.github/agents/x.md'),
      ];
      const manifest = makeManifest();

      const result = detectCrossFolderConflict(
        'frontend/.github/agents/x.md', folders, entries, manifest, source, log,
      );

      assert.ok(result);
      const frontendCandidate = result!.candidates.find(c => c.folderName === 'frontend');
      assert.strictEqual(frontendCandidate?.folderDisplayName, 'Frontend');
      const backendCandidate = result!.candidates.find(c => c.folderName === 'backend');
      assert.strictEqual(backendCandidate?.folderDisplayName, 'Backend');
    });

    it('folder prefix stripping for directory items', () => {
      const result = stripFolderPrefix('frontend/.github/skills/my-skill/index.ts', folders);
      assert.strictEqual(result, '.github/skills/my-skill/index.ts');
    });

    it('folder prefix stripping preserves .claude paths', () => {
      const result = stripFolderPrefix('backend/.claude/commands/deploy.md', folders);
      assert.strictEqual(result, '.claude/commands/deploy.md');
    });
  });
});
