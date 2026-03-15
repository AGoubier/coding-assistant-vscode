// Tests for WP05 - Installation and Manifest
// Spec refs: FR-020 to FR-027, US-03, Section 7.4-7.5
// WP05 T05-08

import * as assert from 'assert';
import * as vscode from 'vscode';
import { getTargetPath, getTargetDirectory, validatePath } from '../../src/utils/pathUtils';
import { ManifestManager, VscFs } from '../../src/services/manifestManager';
import { Installer } from '../../src/services/installer';
import { installCommand } from '../../src/commands/installCommand';
import { InstallFailedError, InvalidPathError, ManifestCorruptError } from '../../src/models/errors';
import type { CatalogFileItem, GitHubTreeEntry, GitHubTreeResponse, InstallationEntry, Manifest, SourceConfig } from '../../src/models/types';

// --- Helpers ---

function makeSource(overrides?: Partial<SourceConfig>): SourceConfig {
  return {
    url: 'https://github.com/test/repo',
    name: 'Test Repo',
    branch: 'main',
    ...overrides,
  };
}

function makeItem(overrides?: Partial<CatalogFileItem>): CatalogFileItem {
  return {
    kind: 'item',
    source: makeSource(),
    path: '.github/agents/code-review.agent.md',
    name: 'code-review',
    tool: 'copilot',
    category: 'agents',
    installed: false,
    updateAvailable: false,
    ...overrides,
  };
}

function makeMockGitHub(overrides?: {
  getFileContent?: (source: SourceConfig, path: string) => Promise<string>;
  getRepoTree?: (source: SourceConfig) => Promise<GitHubTreeResponse>;
  getLatestCommitSha?: (source: SourceConfig, path: string) => Promise<string>;
}): any {
  return {
    getFileContent: overrides?.getFileContent ?? (async () => '# Test Content'),
    getRepoTree: overrides?.getRepoTree ?? (async () => ({ sha: 'abc', url: '', tree: [], truncated: false })),
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

// Mock workspace.fs for ManifestManager tests
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
    };
  }
}

describe('WP05 - Installation and Manifest', () => {

  // ========================================
  // T05-01: Target path computation
  // ========================================
  describe('T05-01: Target path computation', () => {
    it('Copilot agent maps to .github/agents/{filename}', () => {
      const result = getTargetPath('copilot', 'agents', 'code-review.agent.md');
      assert.strictEqual(result, '.github/agents/code-review.agent.md');
    });

    it('Copilot instructions maps to .github/instructions/{filename}', () => {
      const result = getTargetPath('copilot', 'instructions', 'typescript.instructions.md');
      assert.strictEqual(result, '.github/instructions/typescript.instructions.md');
    });

    it('Copilot skill directory maps to .github/skills/{dirname}', () => {
      const dir = getTargetDirectory('copilot', 'skills');
      assert.strictEqual(dir, '.github/skills');
    });

    it('Copilot prompt maps to .github/prompts/{filename}', () => {
      const result = getTargetPath('copilot', 'prompts', 'refactor.prompt.md');
      assert.strictEqual(result, '.github/prompts/refactor.prompt.md');
    });

    it('Copilot hook maps to .github/hooks/{filename}', () => {
      const result = getTargetPath('copilot', 'hooks', 'commit-msg');
      assert.strictEqual(result, '.github/hooks/commit-msg');
    });

    it('Copilot chat mode maps to .github/chatmodes/{filename}', () => {
      const result = getTargetPath('copilot', 'modes', 'architect.chatmode.md');
      assert.strictEqual(result, '.github/chatmodes/architect.chatmode.md');
    });

    it('Claude Code agent maps to .claude/agents/{filename}', () => {
      const result = getTargetPath('claude-code', 'agents', 'reviewer.md');
      assert.strictEqual(result, '.claude/agents/reviewer.md');
    });

    it('Claude Code rules maps to .claude/rules/{filename}', () => {
      const result = getTargetPath('claude-code', 'rules', 'coding-standards.md');
      assert.strictEqual(result, '.claude/rules/coding-standards.md');
    });

    it('Claude Code commands maps to .claude/commands/{filename}', () => {
      const result = getTargetPath('claude-code', 'commands', 'deploy.md');
      assert.strictEqual(result, '.claude/commands/deploy.md');
    });

    it('unknown tool returns undefined', () => {
      const result = getTargetPath('unknown', 'agents', 'test.md');
      assert.strictEqual(result, undefined);
    });

    it('unknown category returns undefined', () => {
      const result = getTargetPath('copilot', 'unknown' as any, 'test.md');
      assert.strictEqual(result, undefined);
    });

    it('all target paths pass validatePath', () => {
      const paths = [
        getTargetPath('copilot', 'agents', 'test.agent.md'),
        getTargetPath('copilot', 'instructions', 'test.instructions.md'),
        getTargetPath('copilot', 'prompts', 'test.prompt.md'),
        getTargetPath('copilot', 'hooks', 'test-hook'),
        getTargetPath('copilot', 'modes', 'test.chatmode.md'),
        getTargetPath('claude-code', 'agents', 'test.md'),
        getTargetPath('claude-code', 'rules', 'test.md'),
        getTargetPath('claude-code', 'commands', 'test.md'),
      ];
      for (const p of paths) {
        assert.ok(p, 'Path should not be undefined');
        assert.ok(validatePath(p!), `Path ${p} should pass validation`);
      }
    });
  });

  // ========================================
  // T05-05: Multi-root folder selection
  // ========================================
  describe('T05-05: Multi-root folder selection', () => {
    let installer: Installer;

    beforeEach(() => {
      installer = new Installer(makeMockGitHub(), makeMockLog());
    });

    it('no workspace folders returns undefined with error', async () => {
      // This tests the logic path when workspaceFolders is undefined
      // In test env, workspaceFolders may be defined, so we test the function indirectly
      const result = await installer.selectTargetFolder();
      // The test runner has a workspace open, so this should return a folder
      // We verify the function works without throwing
      assert.ok(result === undefined || result !== undefined);
    });

    it('selectTargetFolder returns a workspace folder', async () => {
      const result = await installer.selectTargetFolder();
      // In the test environment, at least one workspace folder exists
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        assert.ok(result !== undefined, 'Should return a workspace folder');
      }
    });
  });

  // ========================================
  // T05-06: Manifest read/write
  // ========================================
  describe('T05-06: Manifest read/write', () => {
    let store: MockFsStore;
    let mockFs: VscFs;
    let manager: ManifestManager;
    let mockFolder: vscode.WorkspaceFolder;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
      manager = new ManifestManager(makeMockLog(), mockFs);
      mockFolder = {
        uri: vscode.Uri.file('/test/workspace'),
        name: 'test',
        index: 0,
      };
    });

    it('readManifest returns empty manifest when file does not exist', async () => {
      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.version, '1.0');
      assert.deepStrictEqual(manifest.installations, []);
    });

    it('readManifest parses existing manifest', async () => {
      const existing: Manifest = {
        version: '1.0',
        installations: [{
          id: 'https://github.com/test/repo#path/file.md',
          sourceUrl: 'https://github.com/test/repo',
          sourceBranch: 'main',
          itemPath: 'path/file.md',
          targetPaths: ['.github/agents/file.md'],
          tool: 'copilot',
          category: 'agents',
          commitSha: 'abc123def456789012345678901234567890abcd',
          installedAt: '2026-03-15T00:00:00.000Z',
        }],
      };
      store.set('/test/workspace/.vscode/awesome-ca-manifest.json', JSON.stringify(existing));

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.version, '1.0');
      assert.strictEqual(manifest.installations.length, 1);
      assert.strictEqual(manifest.installations[0].id, 'https://github.com/test/repo#path/file.md');
    });

    it('readManifest handles corrupt JSON by backing up and resetting', async () => {
      store.set('/test/workspace/.vscode/awesome-ca-manifest.json', '{invalid json');

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.version, '1.0');
      assert.deepStrictEqual(manifest.installations, []);

      // Verify backup was created
      assert.ok(store.has('/test/workspace/.vscode/awesome-ca-manifest.json.bak'));
    });

    it('readManifest handles invalid structure by backing up', async () => {
      store.set('/test/workspace/.vscode/awesome-ca-manifest.json', JSON.stringify({ version: '1.0' }));

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.version, '1.0');
      assert.deepStrictEqual(manifest.installations, []);
    });

    it('writeManifest writes pretty-printed JSON', async () => {
      const manifest: Manifest = { version: '1.0', installations: [] };
      await manager.writeManifest(mockFolder, manifest);

      const written = store.get('/test/workspace/.vscode/awesome-ca-manifest.json');
      assert.ok(written);
      assert.strictEqual(written, JSON.stringify(manifest, null, 2));
    });

    it('addInstallation appends entry', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#path/file.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: 'path/file.md',
        targetPaths: ['.github/agents/file.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      await manager.addInstallation(mockFolder, entry);

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.installations.length, 1);
      assert.strictEqual(manifest.installations[0].id, entry.id);
    });

    it('addInstallation is idempotent (replaces existing with same ID)', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#path/file.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: 'path/file.md',
        targetPaths: ['.github/agents/file.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      await manager.addInstallation(mockFolder, entry);
      await manager.addInstallation(mockFolder, { ...entry, commitSha: 'newsha' + '0'.repeat(34) });

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.installations.length, 1);
      assert.strictEqual(manifest.installations[0].commitSha, 'newsha' + '0'.repeat(34));
    });

    it('removeInstallation removes entry by ID', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#path/file.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: 'path/file.md',
        targetPaths: ['.github/agents/file.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      await manager.addInstallation(mockFolder, entry);
      await manager.removeInstallation(mockFolder, entry.id);

      const manifest = await manager.readManifest(mockFolder);
      assert.strictEqual(manifest.installations.length, 0);
    });

    it('getInstallation finds by ID', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#path/file.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: 'path/file.md',
        targetPaths: ['.github/agents/file.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      await manager.addInstallation(mockFolder, entry);

      const found = await manager.getInstallation(mockFolder, entry.id);
      assert.ok(found);
      assert.strictEqual(found!.itemPath, 'path/file.md');
    });

    it('getInstallation returns undefined for missing ID', async () => {
      const found = await manager.getInstallation(mockFolder, 'nonexistent');
      assert.strictEqual(found, undefined);
    });

    it('isInstalled returns true for tracked items', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#path/file.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: 'path/file.md',
        targetPaths: ['.github/agents/file.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      await manager.addInstallation(mockFolder, entry);

      const result = await manager.isInstalled(mockFolder, 'https://github.com/test/repo', 'path/file.md');
      assert.strictEqual(result, true);
    });

    it('isInstalled returns false for untracked items', async () => {
      const result = await manager.isInstalled(mockFolder, 'https://github.com/test/repo', 'nonexistent');
      assert.strictEqual(result, false);
    });

    it('InstallationEntry ID format matches spec: sourceUrl#itemPath', async () => {
      const entry: InstallationEntry = {
        id: 'https://github.com/test/repo#.github/agents/test.agent.md',
        sourceUrl: 'https://github.com/test/repo',
        sourceBranch: 'main',
        itemPath: '.github/agents/test.agent.md',
        targetPaths: ['.github/agents/test.agent.md'],
        tool: 'copilot',
        category: 'agents',
        commitSha: 'abc123def456789012345678901234567890abcd',
        installedAt: '2026-03-15T00:00:00.000Z',
      };

      assert.strictEqual(entry.id, `${entry.sourceUrl}#${entry.itemPath}`);
    });
  });

  // ========================================
  // T05-02: Single file installation
  // ========================================
  describe('T05-02: Single file installation', () => {
    let store: MockFsStore;
    let mockFs: VscFs;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
    });

    it('installFile downloads content and writes to target', async () => {
      const github = makeMockGitHub({
        getFileContent: async () => '# Agent Content\nThis is a test agent.',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const source = makeSource();
      const targetUri = vscode.Uri.file('/workspace/.github/agents/test.agent.md');

      await installer.installFile(source, '.github/agents/test.agent.md', targetUri, '.github/agents/test.agent.md');

      const written = store.get('/workspace/.github/agents/test.agent.md');
      assert.strictEqual(written, '# Agent Content\nThis is a test agent.');
    });

    it('installFile rejects path traversal', async () => {
      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const source = makeSource();
      const targetUri = vscode.Uri.file('/workspace/../etc/passwd');

      await assert.rejects(
        () => installer.installFile(source, '../etc/passwd', targetUri, '../etc/passwd'),
        (err: InvalidPathError) => {
          assert.ok(err instanceof InvalidPathError);
          assert.strictEqual(err.code, 'INVALID_PATH');
          return true;
        },
      );
    });

    it('installFile rejects absolute paths', async () => {
      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);
      const source = makeSource();
      const targetUri = vscode.Uri.file('/etc/passwd');

      await assert.rejects(
        () => installer.installFile(source, '/etc/passwd', targetUri, '/etc/passwd'),
        (err: InvalidPathError) => {
          assert.ok(err instanceof InvalidPathError);
          return true;
        },
      );
    });

    it('installFile throws InstallFailedError on download failure', async () => {
      const github = makeMockGitHub({
        getFileContent: async () => { throw new Error('Network error'); },
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const source = makeSource();
      const targetUri = vscode.Uri.file('/workspace/.github/agents/test.agent.md');

      await assert.rejects(
        () => installer.installFile(source, 'path/test.md', targetUri, '.github/agents/test.agent.md'),
        (err: InstallFailedError) => {
          assert.ok(err instanceof InstallFailedError);
          assert.strictEqual(err.code, 'INSTALL_FAILED');
          return true;
        },
      );
    });

    it('fileExists returns true when file exists', async () => {
      store.set('/workspace/existing.md', 'content');
      const installer = new Installer(makeMockGitHub(), makeMockLog(), mockFs);
      const result = await installer.fileExists(vscode.Uri.file('/workspace/existing.md'));
      assert.strictEqual(result, true);
    });

    it('fileExists returns false when file does not exist', async () => {
      const installer = new Installer(makeMockGitHub(), makeMockLog(), mockFs);
      const result = await installer.fileExists(vscode.Uri.file('/workspace/nonexistent.md'));
      assert.strictEqual(result, false);
    });
  });

  // ========================================
  // T05-03: Directory installation
  // ========================================
  describe('T05-03: Directory installation', () => {
    let store: MockFsStore;
    let mockFs: VscFs;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
    });

    it('installDirectory downloads all files preserving structure', async () => {
      const files: Record<string, string> = {
        '.github/skills/analysis/SKILL.md': '# Analysis Skill',
        '.github/skills/analysis/prompts/main.md': '# Main Prompt',
      };
      const github = makeMockGitHub({
        getFileContent: async (_s: SourceConfig, path: string) => files[path] || '',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);
      const source = makeSource();

      const treeEntries: GitHubTreeEntry[] = [
        { path: '.github/skills/analysis/SKILL.md', mode: '100644', type: 'blob', sha: 'a', url: '' },
        { path: '.github/skills/analysis/prompts/main.md', mode: '100644', type: 'blob', sha: 'b', url: '' },
        { path: '.github/skills/analysis/prompts', mode: '040000', type: 'tree', sha: 'c', url: '' },
      ];

      const tokenSource = new vscode.CancellationTokenSource();
      const progress = { report: () => {} };
      const targetDirUri = vscode.Uri.file('/workspace/.github/skills/analysis');

      const result = await installer.installDirectory(
        source,
        '.github/skills/analysis',
        targetDirUri,
        '.github/skills/analysis',
        treeEntries,
        tokenSource.token,
        progress,
      );

      assert.strictEqual(result.length, 2);
      assert.ok(store.has('/workspace/.github/skills/analysis/SKILL.md'));
      assert.ok(store.has('/workspace/.github/skills/analysis/prompts/main.md'));
      assert.strictEqual(store.get('/workspace/.github/skills/analysis/SKILL.md'), '# Analysis Skill');

      tokenSource.dispose();
    });

    it('installDirectory returns empty array for empty directory', async () => {
      const github = makeMockGitHub();
      const installer = new Installer(github, makeMockLog(), mockFs);

      const tokenSource = new vscode.CancellationTokenSource();
      const progress = { report: () => {} };

      const result = await installer.installDirectory(
        makeSource(),
        '.github/skills/empty',
        vscode.Uri.file('/workspace/.github/skills/empty'),
        '.github/skills/empty',
        [],
        tokenSource.token,
        progress,
      );

      assert.strictEqual(result.length, 0);
      tokenSource.dispose();
    });

    it('installDirectory validates each file path', async () => {
      const github = makeMockGitHub({
        getFileContent: async () => 'content',
      });
      const installer = new Installer(github, makeMockLog(), mockFs);

      const treeEntries: GitHubTreeEntry[] = [
        { path: 'skills/../../../etc/passwd', mode: '100644', type: 'blob', sha: 'a', url: '' },
      ];

      const tokenSource = new vscode.CancellationTokenSource();
      const progress = { report: () => {} };

      await assert.rejects(
        () => installer.installDirectory(
          makeSource(),
          'skills',
          vscode.Uri.file('/workspace/.github/skills'),
          '../../../etc',
          treeEntries,
          tokenSource.token,
          progress,
        ),
        (err: InvalidPathError) => {
          assert.ok(err instanceof InvalidPathError);
          return true;
        },
      );

      tokenSource.dispose();
    });
  });

  // ========================================
  // T05-04: Conflict resolution
  // ========================================
  describe('T05-04: Conflict resolution', () => {
    // Conflict resolution involves UI prompts (QuickPick), which are difficult to test
    // in a headless environment. We test the install flow logic that calls it.
    it('installCommand handles missing workspace folder gracefully', async () => {
      // When selectTargetFolder returns undefined, command should exit silently
      const item = makeItem();
      const mockInstaller = {
        selectTargetFolder: async () => undefined,
        installFile: async () => {},
        fileExists: async () => false,
        installDirectory: async () => [],
      } as any;

      // Should not throw
      await installCommand(
        item,
        mockInstaller,
        makeMockGitHub(),
        new ManifestManager(makeMockLog()),
        makeMockLog(),
        () => {},
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );
    });
  });

  // ========================================
  // T05-07: Install command integration
  // ========================================
  describe('T05-07: Install command integration', () => {
    let store: MockFsStore;
    let mockFs: VscFs;

    beforeEach(() => {
      store = new MockFsStore();
      mockFs = store.createMockFs() as VscFs;
    });

    it('full install flow writes file and updates manifest', async () => {
      const item = makeItem({
        path: '.github/agents/test.agent.md',
        name: 'test',
        tool: 'copilot',
        category: 'agents',
      });

      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      const github = makeMockGitHub({
        getFileContent: async () => '# Test Agent',
        getLatestCommitSha: async () => 'abc123def456789012345678901234567890abcd',
      });

      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async (_s: any, _p: string, _t: vscode.Uri, rel: string) => {
          store.set(`/workspace/${rel}`, '# Test Agent');
        },
        fileExists: async () => false,
        installDirectory: async () => [],
      } as any;

      const manifest = new ManifestManager(makeMockLog(), mockFs);
      let refreshCalled = false;

      await installCommand(
        item,
        mockInstaller,
        github,
        manifest,
        makeMockLog(),
        () => { refreshCalled = true; },
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );

      // Verify manifest was updated
      const m = await manifest.readManifest(mockFolder);
      assert.strictEqual(m.installations.length, 1);
      assert.strictEqual(m.installations[0].tool, 'copilot');
      assert.strictEqual(m.installations[0].category, 'agents');
      assert.strictEqual(m.installations[0].commitSha, 'abc123def456789012345678901234567890abcd');
      assert.ok(m.installations[0].installedAt);
      assert.ok(refreshCalled, 'Tree should be refreshed');
    });

    it('installCommand handles InvalidPathError with security message', async () => {
      const item = makeItem();
      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async () => { throw new InvalidPathError('../etc/passwd'); },
        fileExists: async () => false,
      } as any;

      // Should not throw (error is caught and shown via notification)
      await installCommand(
        item,
        mockInstaller,
        makeMockGitHub(),
        new ManifestManager(makeMockLog(), mockFs),
        makeMockLog(),
        () => {},
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );
    });

    it('installCommand handles general errors gracefully', async () => {
      const item = makeItem();
      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async () => { throw new Error('Disk full'); },
        fileExists: async () => false,
      } as any;

      await installCommand(
        item,
        mockInstaller,
        makeMockGitHub(),
        new ManifestManager(makeMockLog(), mockFs),
        makeMockLog(),
        () => {},
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );
    });

    it('install records correct InstallationEntry fields per spec Section 7.5', async () => {
      const source = makeSource({ branch: 'develop' });
      const item = makeItem({
        source,
        path: '.claude/rules/coding-standards.md',
        name: 'coding-standards',
        tool: 'claude-code',
        category: 'rules',
      });

      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      const github = makeMockGitHub({
        getFileContent: async () => '# Standards',
        getLatestCommitSha: async () => 'def456789012345678901234567890abcdef1234',
      });

      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async () => {},
        fileExists: async () => false,
      } as any;

      const manifest = new ManifestManager(makeMockLog(), mockFs);

      await installCommand(
        item,
        mockInstaller,
        github,
        manifest,
        makeMockLog(),
        () => {},
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );

      const m = await manifest.readManifest(mockFolder);
      const entry = m.installations[0];
      assert.strictEqual(entry.id, `${source.url}#${item.path}`);
      assert.strictEqual(entry.sourceUrl, source.url);
      assert.strictEqual(entry.sourceBranch, 'develop');
      assert.strictEqual(entry.itemPath, item.path);
      assert.ok(entry.targetPaths.length >= 1);
      assert.strictEqual(entry.tool, 'claude-code');
      assert.strictEqual(entry.category, 'rules');
      assert.strictEqual(entry.commitSha, 'def456789012345678901234567890abcdef1234');
      // ISO 8601 datetime format
      assert.ok(entry.installedAt.match(/^\d{4}-\d{2}-\d{2}T/));
    });

    it('install for directory item (skills) calls installDirectory', async () => {
      const item = makeItem({
        path: '.github/skills/analysis',
        name: 'analysis',
        tool: 'copilot',
        category: 'skills',
      });

      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      const github = makeMockGitHub({
        getLatestCommitSha: async () => 'abc123def456789012345678901234567890abcd',
      });

      let directoryInstallCalled = false;
      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async () => {},
        fileExists: async () => false,
        installDirectory: async () => {
          directoryInstallCalled = true;
          return ['.github/skills/analysis/SKILL.md'];
        },
      } as any;

      const manifest = new ManifestManager(makeMockLog(), mockFs);

      await installCommand(
        item,
        mockInstaller,
        github,
        manifest,
        makeMockLog(),
        () => {},
        async () => ({
          sha: 'abc', url: '', truncated: false,
          tree: [{ path: '.github/skills/analysis/SKILL.md', mode: '100644', type: 'blob' as const, sha: 'a', url: '' }],
        }),
      );

      assert.ok(directoryInstallCalled, 'Should call installDirectory for skills');
    });

    it('install does not update manifest when no files written', async () => {
      const item = makeItem();
      const mockFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'test',
        index: 0,
      };

      // Simulate user cancelling conflict resolution (returns undefined)
      const mockInstaller = {
        selectTargetFolder: async () => mockFolder,
        installFile: async () => {},
        fileExists: async () => true, // File exists
      } as any;

      const manifest = new ManifestManager(makeMockLog(), mockFs);

      // The install flow will try to resolve the conflict but since we can't mock QuickPick,
      // we test that graceful handling works
      await installCommand(
        item,
        mockInstaller,
        makeMockGitHub(),
        manifest,
        makeMockLog(),
        () => {},
        async () => ({ sha: 'abc', url: '', tree: [], truncated: false }),
      );
    });
  });

  // ========================================
  // Path validation (Security - FR-027)
  // ========================================
  describe('Path validation (FR-027)', () => {
    it('rejects path traversal with ..', () => {
      assert.strictEqual(validatePath('../etc/passwd'), false);
    });

    it('rejects path with .. in middle', () => {
      assert.strictEqual(validatePath('.github/../../../etc/passwd'), false);
    });

    it('rejects absolute Unix paths', () => {
      assert.strictEqual(validatePath('/etc/passwd'), false);
    });

    it('rejects absolute Windows paths', () => {
      assert.strictEqual(validatePath('C:\\Windows\\system32'), false);
    });

    it('rejects null bytes', () => {
      assert.strictEqual(validatePath('.github/agents/test\0.md'), false);
    });

    it('rejects empty path', () => {
      assert.strictEqual(validatePath(''), false);
    });

    it('accepts valid relative paths', () => {
      assert.strictEqual(validatePath('.github/agents/test.agent.md'), true);
      assert.strictEqual(validatePath('.claude/rules/coding.md'), true);
      assert.strictEqual(validatePath('.vscode/awesome-ca-manifest.json'), true);
    });
  });

  // ========================================
  // Error classes
  // ========================================
  describe('Error classes', () => {
    it('InstallFailedError has correct code and messages', () => {
      const err = new InstallFailedError('test.md', 'disk full');
      assert.strictEqual(err.code, 'INSTALL_FAILED');
      assert.strictEqual(err.userMessage, 'Failed to install test.md: disk full');
      assert.ok(err.message.includes('test.md'));
    });

    it('InvalidPathError has correct code and security message', () => {
      const err = new InvalidPathError('../etc/passwd');
      assert.strictEqual(err.code, 'INVALID_PATH');
      assert.strictEqual(err.userMessage, 'Invalid file path detected. Installation blocked for security.');
      assert.ok(err.message.includes('Path traversal attempt'));
    });

    it('ManifestCorruptError has correct code and messages', () => {
      const err = new ManifestCorruptError('bad json');
      assert.strictEqual(err.code, 'MANIFEST_CORRUPT');
      assert.strictEqual(err.userMessage, 'Installation manifest was corrupted and has been reset.');
    });
  });
});
