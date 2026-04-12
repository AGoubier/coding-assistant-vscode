// Install Source command handler - installs all items from a whole source repository
// Downloads every recognized customization file from the repo tree.

import * as vscode from 'vscode';
import type {
  SourceItem,
  GitHubTreeResponse,
  InstallationEntry,
  SourceConfig,
  CategoryType,
} from '../models/types';
import { installationId } from '../models/types';
import type { Installer } from '../services/installer';
import type { GitHubClient } from '../services/githubClient';
import type { ManifestManager } from '../services/manifestManager';
import { classifyItem } from '../services/toolDetector';
import { getTargetPath, getTargetDirectory } from '../utils/pathUtils';

/**
 * Install all recognized items from a source repository.
 */
export async function installSourceCommand(
  sourceItem: SourceItem,
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

  const tree = await getRepoTree(sourceItem.source);
  const items = resolveAllItems(tree);

  if (items.length === 0) {
    vscode.window.showInformationMessage(
      `No installable items found in ${sourceItem.source.name}.`,
    );
    return;
  }

  // Group by category for display
  const byCategory = new Map<string, number>();
  for (const item of items) {
    byCategory.set(item.category, (byCategory.get(item.category) || 0) + 1);
  }
  const summary = Array.from(byCategory.entries())
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  const confirm = await vscode.window.showInformationMessage(
    `Install ${items.length} item(s) from ${sourceItem.source.name}? (${summary})`,
    { modal: true },
    'Install All',
  );
  if (confirm !== 'Install All') {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing all from ${sourceItem.source.name}...`,
      cancellable: true,
    },
    async (progress, token) => {
      let installed = 0;
      let failed = 0;
      const total = items.length;

      for (let i = 0; i < items.length; i++) {
        if (token.isCancellationRequested) {
          log.info(`Source install cancelled at item ${i + 1}/${total}`);
          break;
        }

        const item = items[i];
        progress.report({
          message: `${i + 1}/${total}: ${item.name}`,
          increment: 100 / total,
        });

        try {
          if (item.isDirectory) {
            const targetDir = getTargetDirectory(item.tool, item.category as CategoryType);
            if (!targetDir) {
              failed++;
              continue;
            }
            const dirRelative = `${targetDir}/${item.dirName}`;
            const targetDirUri = vscode.Uri.joinPath(folder.uri, dirRelative);
            await installer.installDirectory(
              sourceItem.source,
              item.sourceDir,
              targetDirUri,
              dirRelative,
              tree.tree,
              token,
              progress,
            );
            const sha = await github.getLatestCommitSha(
              sourceItem.source, item.path,
            ).catch(() => 'unknown');
            const entry: InstallationEntry = {
              id: installationId(sourceItem.source.url, sourceItem.source.branch, item.path),
              sourceUrl: sourceItem.source.url,
              sourceBranch: sourceItem.source.branch || 'main',
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
            const targetPath = getTargetPath(item.tool, item.category as CategoryType, item.filename);
            if (!targetPath) {
              failed++;
              continue;
            }
            const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
            await installer.installFile(
              sourceItem.source, item.path, targetUri, targetPath,
            );
            const sha = await github.getLatestCommitSha(
              sourceItem.source, item.path,
            ).catch(() => 'unknown');
            const entry: InstallationEntry = {
              id: installationId(sourceItem.source.url, sourceItem.source.branch, item.path),
              sourceUrl: sourceItem.source.url,
              sourceBranch: sourceItem.source.branch || 'main',
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
        `Installed ${result.installed} item(s) from ${sourceItem.source.name} (${result.failed} failed).`,
      );
    } else {
      vscode.window.showInformationMessage(
        `Installed ${result.installed} item(s) from ${sourceItem.source.name}.`,
      );
    }
  }
}

interface ResolvedItem {
  path: string;
  name: string;
  filename: string;
  tool: string;
  category: string;
  isDirectory: boolean;
  sourceDir: string;
  dirName: string;
}

function resolveAllItems(tree: GitHubTreeResponse): ResolvedItem[] {
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

    // Deduplicate directory-type items (skills/plugins) by root folder
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
