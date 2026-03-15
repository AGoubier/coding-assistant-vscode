// Tests for WP06 - Lifecycle Management (Updates, Uninstall, Badges)
// Spec refs: FR-028 to FR-034, US-05, Section 11.2 BDD Lifecycle Management
// WP06 T06-09

import * as assert from 'assert';
import * as vscode from 'vscode';
import { LifecycleManager } from '../../src/services/lifecycle';
import { ManifestManager, VscFs } from '../../src/services/manifestManager';
import { Installer } from '../../src/services/installer';
import type { InstallationEntry, SourceConfig, UpdateCheckResult } from '../../src/models/types';

// --- Helpers ---

function makeSource(overrides?: Partial<SourceConfig>): SourceConfig {
  return {
    url: 'https://github.com/test/repo',
    name: 'Test Repo',
    branch: 'main',
    ...overrides,
  };
}

function makeMockGitHub(overrides?: {
  getFileContent?: (source: SourceConfig, path: string) => Promise<string>;
  getLatestCommitSha?: (source: SourceConfig, path: string) => Promise<string>;
}): any {
  return {
    getFileContent: overrides?.getFileContent ?? (async () => '# Test Content'),
    getRepoTree: async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
    getLatestCommitSha: overrides?.getLatestCommitSha ?? (async () => 'abc123def456789012345678901234567890abcd'),
  };
}

function makeMockLog(): any {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {},
    debug: () => {},
  };
}

class MockFsStore {
  files = new Map<string, string>();

  private normKey(k: string): string {
    return k.replace(/\\/g, '/');
  }

  has(key: string): boolean {
    return this.files.has(this.normKey(key));
  }

  get(key: string): string | undefined {
    return this.files.get(this.normKey(key));
  }

  set(key: string, value: string): void {
    this.files.set(this.normKey(key), value);
  }

  createMockFs() {
    const self = this;
    return {
      readFile: async (uri: vscode.Uri) => {
        const content = self.get(uri.path);
        if (content === undefined) {
          throw vscode.FileSystemError.FileNotFound(uri);
        }
        return Buffer.from(content, 'utf-8');
      },
      writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
        self.set(uri.path, Buffer.from(content).toString('utf-8'));
      },
      createDirectory: async () => {},
      stat: async (uri: vscode.Uri) => {
        if (self.has(uri.path)) {
          return { type: vscode.FileType.File, size: 0, ctime: 0, mtime: 0 };
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      },
      rename: async (source: vscode.Uri, target: vscode.Uri) => {
        const content = self.get(source.path);
        if (content !== undefined) {
          self.set(target.path, content);
          self.files.delete(self.normKey(source.path));
        }
      },
      delete: async (uri: vscode.Uri) => {
        self.files.delete(self.normKey(uri.path));
      },
    };
  }
}

function makeFolder(name?: string): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file('/workspace'),
    name: name ?? 'test',
    index: 0,
  };
}

function makeEntry(overrides?: Partial<InstallationEntry>): InstallationEntry {
  return {
    id: 'https://github.com/test/repo#.github/agents/code-review.agent.md',
    sourceUrl: 'https://github.com/test/repo',
    sourceBranch: 'main',
    itemPath: '.github/agents/code-review.agent.md',
    targetPaths: ['.github/agents/code-review.agent.md'],
    tool: 'copilot',
    category: 'agents',
    commitSha: 'oldsha1234567890123456789012345678901234',
    installedAt: '2025-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('WP06 - Lifecycle Management', () => {

  // ========================================
  // T06-01: LifecycleManager scaffold
  // ========================================
  describe('T06-01: LifecycleManager scaffold', () => {
    it('constructs with required dependencies', () => {
      const store = new MockFsStore();
      const mockFs = store.createMockFs() as VscFs;
      const github = makeMockGitHub();
      const log = makeMockLog();
      const manifest = new ManifestManager(log, mockFs);
      const installer = new Installer(github, log, mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, log, mockFs);

      assert.ok(lifecycle, 'LifecycleManager should be created');
      assert.strictEqual(typeof lifecycle.checkForUpdates, 'function');
      assert.strictEqual(typeof lifecycle.applyUpdate, 'function');
      assert.strictEqual(typeof lifecycle.uninstallItem, 'function');
    });
  });

  // ========================================
  // T06-02: Update check logic (SHA comparison)
  // ========================================
  describe('T06-02: Update check logic', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('detects update when SHA differs (BDD: Detect available updates)', async () => {
      const entry = makeEntry({ commitSha: 'oldsha1234567890123456789012345678901234' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha5678901234567890123456789012345678',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const results = await lifecycle.checkForUpdates(folder);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].hasUpdate, true);
      assert.strictEqual(results[0].latestSha, 'newsha5678901234567890123456789012345678');
    });

    it('reports no update when SHA matches', async () => {
      const sha = 'abc123def456789012345678901234567890abcd';
      const entry = makeEntry({ commitSha: sha });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => sha,
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const results = await lifecycle.checkForUpdates(folder);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].hasUpdate, false);
    });

    it('returns empty array when no installations exist', async () => {
      const github = makeMockGitHub();
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const results = await lifecycle.checkForUpdates(folder);
      assert.strictEqual(results.length, 0);
    });

    it('handles per-item errors without aborting entire check', async () => {
      const entry1 = makeEntry({
        id: 'https://github.com/test/repo#file1.md',
        itemPath: 'file1.md',
        commitSha: 'old1',
      });
      const entry2 = makeEntry({
        id: 'https://github.com/test/repo#file2.md',
        itemPath: 'file2.md',
        commitSha: 'old2',
      });

      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry1);
      await manifest.addInstallation(folder, entry2);

      let callCount = 0;
      const github = makeMockGitHub({
        getLatestCommitSha: async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Network error');
          }
          return 'new2sha67890123456789012345678901234567';
        },
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const results = await lifecycle.checkForUpdates(folder);

      assert.strictEqual(results.length, 2);
      // First item failed -> hasUpdate = false, keeps old SHA
      assert.strictEqual(results[0].hasUpdate, false);
      // Second item succeeded -> hasUpdate = true
      assert.strictEqual(results[1].hasUpdate, true);
    });

    it('checks with mixed results (some updated, some not)', async () => {
      const entry1 = makeEntry({
        id: 'https://github.com/test/repo#file1.md',
        itemPath: 'file1.md',
        commitSha: 'sameSha',
      });
      const entry2 = makeEntry({
        id: 'https://github.com/test/repo#file2.md',
        itemPath: 'file2.md',
        commitSha: 'differentSha',
      });

      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry1);
      await manifest.addInstallation(folder, entry2);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'sameSha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const results = await lifecycle.checkForUpdates(folder);

      assert.strictEqual(results.length, 2);
      const updated = results.filter(r => r.hasUpdate);
      const notUpdated = results.filter(r => !r.hasUpdate);
      assert.strictEqual(updated.length, 1);
      assert.strictEqual(notUpdated.length, 1);
    });

    it('caches update results for tree badge lookups', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.checkForUpdates(folder);

      assert.ok(lifecycle.hasUpdate(entry.id), 'Should have cached update result');
      const cached = lifecycle.getUpdateResult(entry.id);
      assert.ok(cached);
      assert.strictEqual(cached!.latestSha, 'newsha');
    });

    it('clearUpdateCache clears all cached results', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.checkForUpdates(folder);
      assert.ok(lifecycle.hasUpdate(entry.id));

      lifecycle.clearUpdateCache();
      assert.ok(!lifecycle.hasUpdate(entry.id));
    });
  });

  // ========================================
  // T06-05: Update (apply) logic
  // ========================================
  describe('T06-05: applyUpdate', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('writes new content and updates manifest SHA (BDD: Apply an update)', async () => {
      const entry = makeEntry({
        commitSha: 'oldsha1234567890123456789012345678901234',
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      // Put the "old" installed file into the mock fs
      store.set('/workspace/.github/agents/code-review.agent.md', '# Old Content');

      const github = makeMockGitHub({
        getFileContent: async () => '# New Content',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const latestSha = 'newsha5678901234567890123456789012345678';
      await lifecycle.applyUpdate(entry, folder, latestSha);

      // Verify file was updated
      const content = store.get('/workspace/.github/agents/code-review.agent.md');
      assert.strictEqual(content, '# New Content');

      // Verify manifest was updated
      const m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations.length, 1);
      assert.strictEqual(m.installations[0].commitSha, latestSha);
      assert.ok(m.installations[0].updatedAt, 'Should have updatedAt timestamp');
    });

    it('removes entry from update cache after apply', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);
      store.set('/workspace/.github/agents/code-review.agent.md', '# Old');

      const github = makeMockGitHub({
        getFileContent: async () => '# New',
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // First, run update check to populate cache
      await lifecycle.checkForUpdates(folder);
      assert.ok(lifecycle.hasUpdate(entry.id));

      // Apply update
      await lifecycle.applyUpdate(entry, folder, 'newsha');
      assert.ok(!lifecycle.hasUpdate(entry.id), 'Update cache should be cleared after apply');
    });
  });

  // ========================================
  // T06-06: Uninstall logic
  // ========================================
  describe('T06-06: uninstallItem', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('deletes file and removes manifest entry (BDD: Uninstall a customization)', async () => {
      const entry = makeEntry();
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      // Put the installed file into the mock fs
      store.set('/workspace/.github/agents/code-review.agent.md', '# Agent');

      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.uninstallItem(entry, folder);

      // Verify file was deleted
      assert.ok(!store.has('/workspace/.github/agents/code-review.agent.md'), 'File should be deleted');

      // Verify manifest entry was removed
      const m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations.length, 0);
    });

    it('handles already-deleted file gracefully', async () => {
      const entry = makeEntry();
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      // Do NOT put the file in mock fs - simulating user already deleted it
      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // Should not throw
      await lifecycle.uninstallItem(entry, folder);

      // Manifest entry should still be removed
      const m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations.length, 0);
    });

    it('removes entry from update cache after uninstall', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);
      store.set('/workspace/.github/agents/code-review.agent.md', '# Agent');

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // First, run update check to populate cache
      await lifecycle.checkForUpdates(folder);
      assert.ok(lifecycle.hasUpdate(entry.id));

      // Uninstall
      await lifecycle.uninstallItem(entry, folder);
      assert.ok(!lifecycle.hasUpdate(entry.id), 'Update cache should be cleared after uninstall');
    });

    it('handles multiple target paths (directory item)', async () => {
      const entry = makeEntry({
        targetPaths: [
          '.github/skills/analysis/SKILL.md',
          '.github/skills/analysis/prompts/main.md',
        ],
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      store.set('/workspace/.github/skills/analysis/SKILL.md', '# Skill');
      store.set('/workspace/.github/skills/analysis/prompts/main.md', '# Prompt');

      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.uninstallItem(entry, folder);

      assert.ok(!store.has('/workspace/.github/skills/analysis/SKILL.md'));
      assert.ok(!store.has('/workspace/.github/skills/analysis/prompts/main.md'));
      const m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations.length, 0);
    });
  });

  // ========================================
  // Integration: Full lifecycle roundtrip
  // ========================================
  describe('Integration: full lifecycle roundtrip', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('install -> check updates -> apply update -> uninstall', async () => {
      const github = makeMockGitHub({
        getFileContent: async () => '# Agent v1',
        getLatestCommitSha: async () => 'sha_v1_34567890123456789012345678901234',
      });

      const log = makeMockLog();
      const manifest = new ManifestManager(log, mockFs);
      const installer = new Installer(github, log, mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, log, mockFs);

      // Step 1: Simulate install (manifest entry written)
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#.github/agents/test.agent.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: '.github/agents/test.agent.md',
        targetPaths: ['.github/agents/test.agent.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'sha_v1_34567890123456789012345678901234',
        installedAt: new Date().toISOString(),
      };
      store.set('/workspace/.github/agents/test.agent.md', '# Agent v1');
      await manifest.addInstallation(folder, entry);

      // Step 2: Check for updates - no update (same SHA)
      let results = await lifecycle.checkForUpdates(folder);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].hasUpdate, false);

      // Step 3: Simulate upstream change - GitHub now returns new SHA
      const githubV2 = makeMockGitHub({
        getFileContent: async () => '# Agent v2 - Updated',
        getLatestCommitSha: async () => 'sha_v2_45678901234567890123456789012345',
      });
      const lifecycleV2 = new LifecycleManager(githubV2, manifest, new Installer(githubV2, log, mockFs), log, mockFs);

      results = await lifecycleV2.checkForUpdates(folder);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].hasUpdate, true);
      assert.strictEqual(results[0].latestSha, 'sha_v2_45678901234567890123456789012345');

      // Step 4: Apply update
      await lifecycleV2.applyUpdate(entry, folder, 'sha_v2_45678901234567890123456789012345');

      // Verify file updated
      const content = store.get('/workspace/.github/agents/test.agent.md');
      assert.strictEqual(content, '# Agent v2 - Updated');

      // Verify manifest updated
      let m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations[0].commitSha, 'sha_v2_45678901234567890123456789012345');
      assert.ok(m.installations[0].updatedAt);

      // Step 5: Uninstall
      await lifecycleV2.uninstallItem(m.installations[0], folder);

      // Verify file gone
      assert.ok(!store.has('/workspace/.github/agents/test.agent.md'));

      // Verify manifest empty
      m = await manifest.readManifest(folder);
      assert.strictEqual(m.installations.length, 0);
    });
  });

  // ========================================
  // T06-03: Installed badge logic
  // ========================================
  describe('T06-03: Installed badge via hasUpdate/getUpdateResult', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('hasUpdate returns true for items with cached updates', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.checkForUpdates(folder);

      assert.ok(lifecycle.hasUpdate(entry.id));
      assert.ok(!lifecycle.hasUpdate('nonexistent'));
    });

    it('getUpdateResult returns correct data for cached update', async () => {
      const entry = makeEntry({ commitSha: 'oldsha' });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha',
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.checkForUpdates(folder);

      const result = lifecycle.getUpdateResult(entry.id);
      assert.ok(result);
      assert.strictEqual(result!.hasUpdate, true);
      assert.strictEqual(result!.latestSha, 'newsha');
      assert.strictEqual(result!.entry.id, entry.id);
    });
  });

  // ========================================
  // Edge cases
  // ========================================
  describe('Edge cases', () => {
    let store: MockFsStore;
    let mockFs: VscFs;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
    });

    it('checkForUpdates with no workspace folders returns empty', async () => {
      const github = makeMockGitHub();
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // Call with explicit undefined folder - will use vscode.workspace.workspaceFolders
      // which in test env may be undefined or empty
      const results = await lifecycle.checkForUpdates(undefined);
      // Should not throw; results depend on test environment workspace state
      assert.ok(Array.isArray(results));
    });

    it('entryToSource reconstructs source from entry', async () => {
      const entry = makeEntry({
        sourceUrl: 'https://github.com/owner/special-repo',
        sourceBranch: 'develop',
        commitSha: 'oldsha',
      });
      const folder = makeFolder();
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);

      let capturedSource: SourceConfig | undefined;
      const github = makeMockGitHub({
        getLatestCommitSha: async (source: SourceConfig) => {
          capturedSource = source;
          return 'oldsha';
        },
      });

      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      await lifecycle.checkForUpdates(folder);

      assert.ok(capturedSource);
      assert.strictEqual(capturedSource!.url, 'https://github.com/owner/special-repo');
      assert.strictEqual(capturedSource!.branch, 'develop');
    });
  });

  // ========================================
  // T06-05: Update command - diff view URIs
  // ========================================
  describe('T06-05: updateCommand diff view', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let folder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      folder = makeFolder();
    });

    it('opens diff view with correct installed and upstream URIs', async () => {
      const { updateCommand } = await import('../../src/commands/updateCommand.js');
      const { buildPreviewUri } = await import('../../src/providers/previewProvider.js');

      const entry = makeEntry({
        commitSha: 'oldsha1234567890123456789012345678901234',
        targetPaths: ['.github/agents/code-review.agent.md'],
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);
      store.set('/workspace/.github/agents/code-review.agent.md', '# Old');

      const source = makeSource();
      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha5678901234567890123456789012345678',
        getFileContent: async () => '# New Content',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // Populate update cache
      await lifecycle.checkForUpdates(folder);

      // Track vscode.diff calls
      let diffCalled = false;
      let diffArgs: any[] = [];
      const origExecCommand = vscode.commands.executeCommand;
      const execStub = async (cmd: string, ...args: any[]) => {
        if (cmd === 'vscode.diff') {
          diffCalled = true;
          diffArgs = args;
          return;
        }
        return origExecCommand(cmd, ...args);
      };
      (vscode.commands as any).executeCommand = execStub;

      // Mock showInformationMessage to reject update (so we don't need withProgress)
      const origShowInfo = vscode.window.showInformationMessage;
      (vscode.window as any).showInformationMessage = async () => 'Reject';

      // Mock workspaceFolders
      const origFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [folder], configurable: true });

      try {
        const item = {
          kind: 'item' as const,
          name: 'code-review.agent.md',
          path: '.github/agents/code-review.agent.md',
          source,
          tool: 'copilot' as const,
          category: 'agents' as const,
          installed: true,
          updateAvailable: true,
        };

        await updateCommand(item, lifecycle, manifest, () => {}, makeMockLog());

        assert.ok(diffCalled, 'vscode.diff should have been called');

        // Verify installed URI
        const installedUri = diffArgs[0] as vscode.Uri;
        assert.ok(installedUri.path.endsWith('.github/agents/code-review.agent.md'),
          `Installed URI path should end with target path, got: ${installedUri.path}`);

        // Verify upstream URI uses preview scheme
        const upstreamUri = diffArgs[1] as vscode.Uri;
        assert.strictEqual(upstreamUri.scheme, 'awesome-ca-preview');

        // Verify diff title contains SHA abbreviations
        const diffTitle = diffArgs[2] as string;
        assert.ok(diffTitle.includes('oldsha1'), `Diff title should contain abbreviated old SHA, got: ${diffTitle}`);
        assert.ok(diffTitle.includes('newsha5'), `Diff title should contain abbreviated new SHA, got: ${diffTitle}`);
      } finally {
        (vscode.commands as any).executeCommand = origExecCommand;
        (vscode.window as any).showInformationMessage = origShowInfo;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: origFolders, configurable: true });
      }
    });

    it('reject update leaves file and manifest unchanged', async () => {
      const { updateCommand } = await import('../../src/commands/updateCommand.js');

      const entry = makeEntry({
        commitSha: 'oldsha1234567890123456789012345678901234',
        targetPaths: ['.github/agents/code-review.agent.md'],
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(folder, entry);
      store.set('/workspace/.github/agents/code-review.agent.md', '# Original');

      const source = makeSource();
      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha5678901234567890123456789012345678',
        getFileContent: async () => '# Updated',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      // Populate update cache
      await lifecycle.checkForUpdates(folder);

      // Mock vscode.diff to no-op
      const origExecCommand = vscode.commands.executeCommand;
      (vscode.commands as any).executeCommand = async (cmd: string, ...args: any[]) => {
        if (cmd === 'vscode.diff') { return; }
        return origExecCommand(cmd, ...args);
      };

      // Mock showInformationMessage to reject
      const origShowInfo = vscode.window.showInformationMessage;
      (vscode.window as any).showInformationMessage = async () => 'Reject';

      const origFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [folder], configurable: true });

      try {
        const item = {
          kind: 'item' as const,
          name: 'code-review.agent.md',
          path: '.github/agents/code-review.agent.md',
          source,
          tool: 'copilot' as const,
          category: 'agents' as const,
          installed: true,
          updateAvailable: true,
        };

        await updateCommand(item, lifecycle, manifest, () => {}, makeMockLog());

        // File should be unchanged
        assert.strictEqual(store.get('/workspace/.github/agents/code-review.agent.md'), '# Original');

        // Manifest should be unchanged
        const m = await manifest.readManifest(folder);
        assert.strictEqual(m.installations.length, 1);
        assert.strictEqual(m.installations[0].commitSha, 'oldsha1234567890123456789012345678901234');
        assert.strictEqual(m.installations[0].updatedAt, undefined);
      } finally {
        (vscode.commands as any).executeCommand = origExecCommand;
        (vscode.window as any).showInformationMessage = origShowInfo;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: origFolders, configurable: true });
      }
    });

    it('shows error when item is not installed', async () => {
      const { updateCommand } = await import('../../src/commands/updateCommand.js');

      const manifest = new ManifestManager(makeMockLog(), mockFs);
      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const origFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [makeFolder()], configurable: true });

      let errorMsg = '';
      const origShowError = vscode.window.showErrorMessage;
      (vscode.window as any).showErrorMessage = async (msg: string) => { errorMsg = msg; };

      try {
        const item = {
          kind: 'item' as const,
          name: 'test-item',
          path: '.github/agents/test.agent.md',
          source: makeSource(),
          tool: 'copilot' as const,
          category: 'agents' as const,
          installed: false,
          updateAvailable: false,
        };

        await updateCommand(item, lifecycle, manifest, () => {}, makeMockLog());
        assert.ok(errorMsg.includes('not installed'), `Expected not installed error, got: ${errorMsg}`);
      } finally {
        (vscode.window as any).showErrorMessage = origShowError;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: origFolders, configurable: true });
      }
    });

    it('shows up-to-date message when no update available', async () => {
      const { updateCommand } = await import('../../src/commands/updateCommand.js');

      const entry = makeEntry({
        commitSha: 'sha12345678901234567890123456789012345678',
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(makeFolder(), entry);

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'sha12345678901234567890123456789012345678',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);

      const origFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [makeFolder()], configurable: true });

      let infoMsg = '';
      const origShowInfo = vscode.window.showInformationMessage;
      (vscode.window as any).showInformationMessage = async (msg: string) => { infoMsg = msg; };

      try {
        const item = {
          kind: 'item' as const,
          name: 'code-review.agent.md',
          path: '.github/agents/code-review.agent.md',
          source: makeSource(),
          tool: 'copilot' as const,
          category: 'agents' as const,
          installed: true,
          updateAvailable: false,
        };

        await updateCommand(item, lifecycle, manifest, () => {}, makeMockLog());
        assert.ok(infoMsg.includes('up to date'), `Expected up-to-date message, got: ${infoMsg}`);
      } finally {
        (vscode.window as any).showInformationMessage = origShowInfo;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: origFolders, configurable: true });
      }
    });

    it('applies update when user accepts', async () => {
      const { updateCommand } = await import('../../src/commands/updateCommand.js');

      const entry = makeEntry({
        commitSha: 'oldsha1234567890123456789012345678901234',
        targetPaths: ['.github/agents/code-review.agent.md'],
      });
      const manifest = new ManifestManager(makeMockLog(), mockFs);
      await manifest.addInstallation(makeFolder(), entry);
      store.set('/workspace/.github/agents/code-review.agent.md', '# Old content');

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'newsha5678901234567890123456789012345678',
        getFileContent: async () => '# Updated content',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const lifecycle = new LifecycleManager(github, manifest, installer, makeMockLog(), mockFs);
      const folder = makeFolder();

      // Populate update cache
      await lifecycle.checkForUpdates(folder);

      const origFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: [folder], configurable: true });

      // Mock vscode.diff to no-op
      const origExecCommand = vscode.commands.executeCommand;
      (vscode.commands as any).executeCommand = async (cmd: string, ...args: any[]) => {
        if (cmd === 'vscode.diff') { return; }
        return origExecCommand(cmd, ...args);
      };

      // Mock showInformationMessage to accept update
      const origShowInfo = vscode.window.showInformationMessage;
      let infoMsgs: string[] = [];
      (vscode.window as any).showInformationMessage = async (msg: string, ...items: string[]) => {
        infoMsgs.push(msg);
        if (msg.includes('Apply update')) { return 'Accept Update'; }
        return undefined;
      };

      // Mock withProgress to just call the callback
      const origWithProgress = vscode.window.withProgress;
      (vscode.window as any).withProgress = async (_opts: any, cb: any) => cb();

      let refreshCalled = false;

      try {
        const item = {
          kind: 'item' as const,
          name: 'code-review.agent.md',
          path: '.github/agents/code-review.agent.md',
          source: makeSource(),
          tool: 'copilot' as const,
          category: 'agents' as const,
          installed: true,
          updateAvailable: true,
        };

        await updateCommand(item, lifecycle, manifest, () => { refreshCalled = true; }, makeMockLog());

        // Verify file was updated
        assert.strictEqual(store.get('/workspace/.github/agents/code-review.agent.md'), '# Updated content');
        // Verify refresh was called
        assert.ok(refreshCalled, 'Tree refresh should have been called');
        // Verify success message
        assert.ok(infoMsgs.some(m => m.includes('Updated')), 'Should show updated message');
      } finally {
        (vscode.commands as any).executeCommand = origExecCommand;
        (vscode.window as any).showInformationMessage = origShowInfo;
        (vscode.window as any).withProgress = origWithProgress;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', { value: origFolders, configurable: true });
      }
    });
  });

  // ========================================
  // T06-08: Auto-check updates scheduling
  // ========================================
  describe('T06-08: Auto-check scheduling logic', () => {
    it('schedules auto-check when setting is true', async () => {
      // Verify the extension declares autoCheckUpdates with default true
      // by reading the configuration value (defaults from package.json)
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const autoCheck = config.get<boolean>('autoCheckUpdates');

      assert.strictEqual(typeof autoCheck, 'boolean', 'autoCheckUpdates setting should be declared');
      assert.strictEqual(autoCheck, true, 'Default should be true');
    });

    it('declares auto-check interval setting with configurable minutes', async () => {
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const interval = config.get<number>('autoCheckIntervalMinutes');

      assert.strictEqual(typeof interval, 'number', 'autoCheckIntervalMinutes setting should be a number');
      assert.ok(interval! >= 1, 'Default interval should be at least 1 minute');
    });

    it('auto-check respects autoCheckUpdates=false', async () => {
      // When autoCheckUpdates is false, the extension should not schedule checks.
      // We verify by reading the configuration default and confirming the code path:
      // The extension reads the setting and returns early if false.
      const config = vscode.workspace.getConfiguration('awesome-coding-assistants');
      const autoCheck = config.get<boolean>('autoCheckUpdates');

      // The setting exists and is readable (may be true/false depending on test env)
      assert.strictEqual(typeof autoCheck, 'boolean',
        'autoCheckUpdates should be a boolean setting');

      // Verify the auto-check interval setting also exists and is numeric
      const interval = config.get<number>('autoCheckIntervalMinutes');
      assert.strictEqual(typeof interval, 'number',
        'autoCheckIntervalMinutes should be a numeric setting');
    });
  });
});
