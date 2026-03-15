// Accessibility tests - spec Section 10.4
// Verifies: accessible labels on tree items, command palette registration, tooltips on icon actions
// WP07 T07-09

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CatalogTreeProvider } from '../../src/providers/catalogTree';
import { SourceRegistry } from '../../src/services/sourceRegistry';
import { GitHubClient } from '../../src/services/githubClient';
import { createMockLogOutputChannel } from '../helpers/mocks';
import type {
  SourceConfig,
  GitHubTreeResponse,
  ValidationResult,
  CatalogItem,
  CatalogFileItem,
  CategoryItem,
  SourceItem,
} from '../../src/models/types';

const TEST_SOURCE: SourceConfig = {
  url: 'https://github.com/test/repo',
  name: 'Test Repo',
  branch: 'main',
};

const SAMPLE_TREE: GitHubTreeResponse = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/test/repo/git/trees/main',
  tree: [
    { path: '.github/agents/coder.agent.md', mode: '100644', type: 'blob', sha: 'a1', url: '' },
    { path: '.github/instructions/setup.instructions.md', mode: '100644', type: 'blob', sha: 'b1', url: '' },
    { path: '.claude/rules/style.md', mode: '100644', type: 'blob', sha: 'e1', url: '' },
  ],
  truncated: false,
};

function createMockGitHubClient(): GitHubClient {
  return {
    getRepoTree: async () => SAMPLE_TREE,
    getFileContent: async () => '# Test content',
    getLatestCommitSha: async () => 'sha123',
    validateRepo: async () => ({ valid: true } as ValidationResult),
  } as unknown as GitHubClient;
}

function createMockSourceRegistry(sources: SourceConfig[]): SourceRegistry {
  const emitter = new vscode.EventEmitter<void>();
  return {
    getSources: () => sources,
    onDidChange: emitter.event,
    loadMasterIndex: async () => {},
    invalidateCache: () => {},
    dispose: () => { emitter.dispose(); },
  } as unknown as SourceRegistry;
}

function getExtensionUri(): vscode.Uri {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri;
  }
  return vscode.Uri.file('/tmp/test-extension');
}

describe('Accessibility (Section 10.4)', () => {
  let log: ReturnType<typeof createMockLogOutputChannel>;
  let provider: CatalogTreeProvider;
  let registry: SourceRegistry;

  beforeEach(() => {
    log = createMockLogOutputChannel();
    registry = createMockSourceRegistry([TEST_SOURCE]);
    const github = createMockGitHubClient();
    provider = new CatalogTreeProvider(registry, github, log, getExtensionUri());
  });

  afterEach(() => {
    provider.dispose();
    registry.dispose();
  });

  describe('Tree item accessible labels', () => {
    it('source tree items have accessibilityInformation.label', async () => {
      const roots = await provider.getChildren(undefined);
      assert.ok(roots.length > 0, 'Expected at least one source node');

      for (const root of roots) {
        const treeItem = provider.getTreeItem(root);
        assert.ok(
          treeItem.accessibilityInformation,
          'Source tree item must have accessibilityInformation',
        );
        assert.ok(
          treeItem.accessibilityInformation.label,
          'Source tree item must have accessibilityInformation.label',
        );
        assert.ok(
          treeItem.accessibilityInformation.label.includes('Source repository'),
          `Source label should describe the item: ${treeItem.accessibilityInformation.label}`,
        );
      }
    });

    it('category tree items have accessibilityInformation.label', async () => {
      const roots = await provider.getChildren(undefined);
      const sourceItem = roots[0] as SourceItem;
      const categories = await provider.getChildren(sourceItem);
      assert.ok(categories.length > 0, 'Expected at least one category');

      for (const cat of categories) {
        const treeItem = provider.getTreeItem(cat);
        assert.ok(
          treeItem.accessibilityInformation,
          'Category tree item must have accessibilityInformation',
        );
        assert.ok(
          treeItem.accessibilityInformation.label,
          'Category tree item must have accessibilityInformation.label',
        );
        assert.ok(
          treeItem.accessibilityInformation.label.includes('Category'),
          `Category label should describe the item: ${treeItem.accessibilityInformation.label}`,
        );
      }
    });

    it('file tree items have accessibilityInformation.label', async () => {
      const roots = await provider.getChildren(undefined);
      const sourceItem = roots[0] as SourceItem;
      const categories = await provider.getChildren(sourceItem);

      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const file of files) {
          const treeItem = provider.getTreeItem(file);
          assert.ok(
            treeItem.accessibilityInformation,
            `File tree item for ${(file as CatalogFileItem).name} must have accessibilityInformation`,
          );
          assert.ok(
            treeItem.accessibilityInformation.label,
            `File tree item for ${(file as CatalogFileItem).name} must have accessibilityInformation.label`,
          );
          // Label should contain the item name
          const fileItem = file as CatalogFileItem;
          assert.ok(
            treeItem.accessibilityInformation.label.includes(fileItem.name),
            `File label should include item name: ${treeItem.accessibilityInformation.label}`,
          );
        }
      }
    });

    it('error tree items have accessibilityInformation.label', () => {
      const errorElement = {
        kind: 'error' as const,
        message: 'Unable to access repository',
        source: TEST_SOURCE,
      };
      const treeItem = provider.getTreeItem(errorElement);
      assert.ok(
        treeItem.accessibilityInformation,
        'Error tree item must have accessibilityInformation',
      );
      assert.ok(
        treeItem.accessibilityInformation.label.includes('Error'),
        `Error label should start with Error: ${treeItem.accessibilityInformation.label}`,
      );
    });

    it('installed file items include status in accessibility label', async () => {
      // Manually add an installed ID to trigger the installed status
      const entryId = `${TEST_SOURCE.url}#.github/agents/coder.agent.md`;
      (provider as any).installedIds.add(entryId);

      const roots = await provider.getChildren(undefined);
      const sourceItem = roots[0] as SourceItem;
      const categories = await provider.getChildren(sourceItem);

      // Find the agents category
      let agentFiles: any[] = [];
      for (const cat of categories) {
        const catItem = cat as CategoryItem;
        if (catItem.category === 'agents') {
          agentFiles = await provider.getChildren(catItem);
          break;
        }
      }

      assert.ok(agentFiles.length > 0, 'Expected agent files');
      const coderFile = agentFiles.find((f: CatalogFileItem) => f.name === 'coder');
      assert.ok(coderFile, 'Expected coder file');

      const treeItem = provider.getTreeItem(coderFile);
      assert.ok(treeItem.accessibilityInformation, 'Installed item must have accessibilityInformation');
      assert.ok(
        treeItem.accessibilityInformation!.label.includes('installed'),
        `Installed item label should include status: ${treeItem.accessibilityInformation!.label}`,
      );
    });
  });

  describe('Icon-only actions have tooltips', () => {
    it('source tree items have tooltip', async () => {
      const roots = await provider.getChildren(undefined);
      for (const root of roots) {
        const treeItem = provider.getTreeItem(root);
        assert.ok(treeItem.tooltip, 'Source tree item must have a tooltip');
      }
    });

    it('category tree items have tooltip', async () => {
      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);
      for (const cat of categories) {
        const treeItem = provider.getTreeItem(cat);
        assert.ok(treeItem.tooltip, 'Category tree item must have a tooltip');
      }
    });

    it('file tree items have tooltip', async () => {
      const roots = await provider.getChildren(undefined);
      const categories = await provider.getChildren(roots[0]);
      for (const cat of categories) {
        const files = await provider.getChildren(cat as CategoryItem);
        for (const file of files) {
          const treeItem = provider.getTreeItem(file);
          assert.ok(treeItem.tooltip, `File tree item for ${(file as CatalogFileItem).name} must have a tooltip`);
        }
      }
    });

    it('error tree items have tooltip', () => {
      const errorElement = {
        kind: 'error' as const,
        message: 'Unable to access repository',
        source: TEST_SOURCE,
      };
      const treeItem = provider.getTreeItem(errorElement);
      assert.ok(treeItem.tooltip, 'Error tree item must have a tooltip');
    });
  });

  describe('Command palette registration', () => {
    it('all extension commands are registered and accessible via Command Palette', async () => {
      const expectedCommands = [
        'awesome-coding-assistants.refresh',
        'awesome-coding-assistants.preview',
        'awesome-coding-assistants.install',
        'awesome-coding-assistants.update',
        'awesome-coding-assistants.uninstall',
        'awesome-coding-assistants.checkUpdates',
        'awesome-coding-assistants.addToken',
        'awesome-coding-assistants.removeToken',
        'awesome-coding-assistants.clearCache',
        'awesome-coding-assistants.showAllTools',
      ];

      const allCommands = await vscode.commands.getCommands(true);

      for (const cmd of expectedCommands) {
        assert.ok(
          allCommands.includes(cmd),
          `Command "${cmd}" should be registered and accessible via Command Palette`,
        );
      }
    });
  });

  describe('Icons have text-equivalent labels', () => {
    it('all tree items with icons have tooltip as text equivalent', async () => {
      const roots = await provider.getChildren(undefined);
      for (const root of roots) {
        const treeItem = provider.getTreeItem(root);
        if (treeItem.iconPath) {
          assert.ok(
            treeItem.tooltip,
            'Tree item with icon must have tooltip as text equivalent',
          );
        }
      }

      // Check categories and files too
      if (roots.length > 0) {
        const categories = await provider.getChildren(roots[0]);
        for (const cat of categories) {
          const treeItem = provider.getTreeItem(cat);
          if (treeItem.iconPath) {
            assert.ok(treeItem.tooltip, 'Category with icon must have tooltip');
          }

          const files = await provider.getChildren(cat as CategoryItem);
          for (const file of files) {
            const fileTi = provider.getTreeItem(file);
            if (fileTi.iconPath) {
              assert.ok(fileTi.tooltip, 'File item with icon must have tooltip');
            }
          }
        }
      }
    });
  });
});
