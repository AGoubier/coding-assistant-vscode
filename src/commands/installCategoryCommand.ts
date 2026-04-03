// Install Category command handler - installs all items in a tree category
// Installs all files under a category (e.g., all Agents, all Prompts) from a source repo.

import * as vscode from 'vscode';
import type {
  CategoryItem,
  GitHubTreeResponse,
  InstallationEntry,
  SourceConfig,
  CategoryType,
} from '../models/types';
import type { Installer } from '../services/installer';
import type { GitHubClient } from '../services/githubClient';
import type { ManifestManager } from '../services/manifestManager';
import { classifyItem } from '../services/toolDetector';
import { getTargetPath, getTargetDirectory } from '../utils/pathUtils';

/**
 * Install all items in a category from a source repository.
 */
export async function installCategoryCommand(
  categoryItem: CategoryItem,
  installer: Installer,
  github: GitHubClient,
  manifest: ManifestManager,
  log: vscode.LogOutputChannel,
  refreshTree: () => void,
  getRepoTree: (source: SourceConfig) => Promise<GitHubTreeResponse>,
): Promise<void> {
  const folder = await installer.selectTargetFolder();
  if (!folder) {
    return;
  }

  const tree = await getRepoTree(categoryItem.source);
  const items = resolveItemsForCategory(tree, categoryItem);

  if (items.length === 0) {
    vscode.window.showInformationMessage(
      `No installable items found in ${categoryItem.category}.`,
    );
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Install ${items.length} item(s) from ${categoryItem.category}?`,
    { modal: true },
    'Install',
  );
  if (confirm !== 'Install') {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing ${categoryItem.category}...`,
      cancellable: true,
    },
    async (progress, token) => {
      let installed = 0;
      let failed = 0;
      const total = items.length;

      for (let i = 0; i < items.length; i++) {
        if (token.isCancellationRequested) {
          log.info(`Category install cancelled at item ${i + 1}/${total}`);
          break;
        }

        const item = items[i];
        progress.report({
          message: `${i + 1}/${total}: ${item.name}`,
          increment: 100 / total,
        });

        try {
          if (item.isDirectory) {
            // Install directory item (e.g., a skill folder)
            const targetDir = getTargetDirectory(item.tool, item.category);
            if (!targetDir) {
              failed++;
              continue;
            }
            const dirRelative = `${targetDir}/${item.dirName}`;
            const targetDirUri = vscode.Uri.joinPath(folder.uri, dirRelative);
            await installer.installDirectory(
              categoryItem.source,
              item.sourceDir,
              targetDirUri,
              dirRelative,
              tree.tree,
              token,
              progress,
            );
            // Record directory install in manifest
            const sha = await github.getLatestCommitSha(
              categoryItem.source, item.path,
            ).catch(() => 'unknown');
            const entry: InstallationEntry = {
              id: `${categoryItem.source.url}#${item.path}`,
              sourceUrl: categoryItem.source.url,
              sourceBranch: categoryItem.source.branch || 'main',
              itemPath: item.path,
              targetPaths: [dirRelative],
              tool: item.tool,
              category: item.category,
              commitSha: sha,
              installedAt: new Date().toISOString(),
            };
            await manifest.addInstallation(folder, entry);
            installed++;
          } else {
            // Install single file
            const targetPath = getTargetPath(item.tool, item.category, item.filename);
            if (!targetPath) {
              failed++;
              continue;
            }
            const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
            await installer.installFile(
              categoryItem.source, item.path, targetUri, targetPath,
            );
            const sha = await github.getLatestCommitSha(
              categoryItem.source, item.path,
            ).catch(() => 'unknown');
            const entry: InstallationEntry = {
              id: `${categoryItem.source.url}#${item.path}`,
              sourceUrl: categoryItem.source.url,
              sourceBranch: categoryItem.source.branch || 'main',
              itemPath: item.path,
              targetPaths: [targetPath],
              tool: item.tool,
              category: item.category,
              commitSha: sha,
              installedAt: new Date().toISOString(),
            };
            await manifest.addInstallation(folder, entry);
            installed++;
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error(`Failed to install ${item.path}: ${detail}`);
          failed++;
        }
      }

      return { installed, failed };
    },
  );

  if (result) {
    refreshTree();
    if (result.failed > 0) {
      vscode.window.showWarningMessage(
        `Installed ${result.installed} item(s) from ${categoryItem.category} (${result.failed} failed).`,
      );
    } else {
      vscode.window.showInformationMessage(
        `Installed ${result.installed} item(s) from ${categoryItem.category}.`,
      );
    }
  }
}

interface ResolvedItem {
  path: string;
  name: string;
  filename: string;
  tool: string;
  category: CategoryType;
  isDirectory: boolean;
  sourceDir: string;
  dirName: string;
}

function resolveItemsForCategory(
  tree: GitHubTreeResponse,
  categoryItem: CategoryItem,
): ResolvedItem[] {
  const seenSkillDirs = new Set<string>();
  const items: ResolvedItem[] = [];

  for (const entry of tree.tree) {
    if (entry.type !== 'blob') {
      continue;
    }

    const classification = classifyItem(entry.path);
    if (classification.tool === 'unknown') {
      continue;
    }
    if (classification.category !== categoryItem.category) {
      continue;
    }

    // Deduplicate directory-type items (skills) by root folder
    if (classification.category === 'skills' || classification.category === 'plugins') {
      const segments = entry.path.split('/');
      if (segments.length >= 4) {
        const dirKey = segments.slice(0, 3).join('/');
        if (seenSkillDirs.has(dirKey)) {
          continue;
        }
        seenSkillDirs.add(dirKey);

        items.push({
          path: entry.path,
          name: segments[2],
          filename: segments[segments.length - 1],
          tool: classification.tool,
          category: classification.category,
          isDirectory: true,
          sourceDir: segments.slice(0, 3).join('/'),
          dirName: segments[2],
        });
        continue;
      }
    }

    const segments = entry.path.split('/');
    const filename = segments[segments.length - 1];
    items.push({
      path: entry.path,
      name: filename.replace(/\.agent\.md$/, '').replace(/\.instructions\.md$/, '').replace(/\.prompt\.md$/, '').replace(/\.md$/, ''),
      filename,
      tool: classification.tool,
      category: classification.category,
      isDirectory: false,
      sourceDir: '',
      dirName: '',
    });
  }

  return items;
}
