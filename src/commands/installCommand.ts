// Install command handler - orchestrates the full installation flow
// Spec refs: FR-020, FR-023, FR-024, Section 6.2 Install Flow
// WP05 T05-04, T05-07

import * as vscode from 'vscode';
import type { CatalogFileItem, GitHubTreeResponse, InstallationEntry, SourceConfig } from '../models/types';
import { installationId } from '../models/types';
import type { GitHubClient } from '../services/githubClient';
import type { Installer } from '../services/installer';
import type { ManifestManager } from '../services/manifestManager';
import { InvalidPathError } from '../models/errors';
import { getTargetPath, getTargetDirectory, stripFolderPrefix } from '../utils/pathUtils';
import { buildPreviewUri } from '../providers/previewProvider';
import { detectCrossFolderConflict, resolveFolderConflict } from '../services/conflictResolver';

/**
 * Resolve the target relative path for a CatalogFileItem.
 * FR-021: maps tool/category to correct workspace directory.
 * Handles CLAUDE.md special case (user chooses location).
 */
async function resolveTargetPath(item: CatalogFileItem): Promise<string | undefined> {
  const filename = item.path.split('/').pop() || item.name;

  // Special case: CLAUDE.md for Claude Code rules
  if (item.tool === 'claude-code' && item.category === 'rules' && filename.toUpperCase() === 'CLAUDE.MD') {
    const choice = await vscode.window.showQuickPick(
      [
        { label: 'CLAUDE.md', description: 'Project root', path: 'CLAUDE.md' },
        { label: '.claude/CLAUDE.md', description: 'Inside .claude directory', path: '.claude/CLAUDE.md' },
      ],
      { placeHolder: 'Where should CLAUDE.md be installed?' },
    );
    return choice?.path;
  }

  return getTargetPath(item.tool, item.category, filename);
}

/**
 * Resolve the target directory relative path for directory items (skills).
 */
function resolveTargetDirPath(item: CatalogFileItem): string | undefined {
  // For directory-type items, extract the parent folder name (not the filename)
  const segments = item.path.split('/');
  const dirName = segments.length >= 4 ? segments[segments.length - 2] : (segments.pop() || item.name);
  const baseDir = getTargetDirectory(item.tool, item.category);
  if (!baseDir) {
    return undefined;
  }
  return `${baseDir}/${dirName}`;
}

/**
 * FR-023: Conflict resolution - prompt user when target file exists.
 * Returns 'overwrite', 'keep', 'diff', or undefined (cancelled).
 */
async function resolveConflict(
  filename: string,
  existingUri: vscode.Uri,
  source: SourceConfig,
  sourcePath: string,
): Promise<'overwrite' | 'keep' | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Overwrite', description: 'Replace the existing file', value: 'overwrite' as const },
      { label: 'Keep Existing', description: 'Skip this file', value: 'keep' as const },
      { label: 'Show Diff', description: 'Compare installed vs incoming', value: 'diff' as const },
    ],
    { placeHolder: `${filename} already exists` },
  );

  if (!choice) {
    return undefined; // Cancelled = keep existing
  }

  if (choice.value === 'diff') {
    // Open diff editor: existing vs incoming (via preview scheme)
    const incomingUri = buildPreviewUri(source, sourcePath, filename);
    await vscode.commands.executeCommand(
      'vscode.diff',
      existingUri,
      incomingUri,
      `${filename}: Installed vs Incoming`,
    );
    // After showing diff, re-prompt for overwrite/keep
    const followUp = await vscode.window.showQuickPick(
      [
        { label: 'Overwrite', value: 'overwrite' as const },
        { label: 'Keep Existing', value: 'keep' as const },
      ],
      { placeHolder: `${filename} - overwrite or keep?` },
    );
    return followUp?.value;
  }

  return choice.value;
}

/**
 * Install a single file item with conflict resolution.
 */
async function installSingleFile(
  item: CatalogFileItem,
  folder: vscode.WorkspaceFolder,
  installer: Installer,
  log: vscode.LogOutputChannel,
): Promise<string[] | undefined> {
  const targetRelativePath = await resolveTargetPath(item);
  if (!targetRelativePath) {
    return undefined; // User cancelled or unmapped
  }

  const targetUri = vscode.Uri.joinPath(folder.uri, targetRelativePath);
  const sourcePath = item.path;
  const filename = targetRelativePath.split('/').pop() || item.name;

  // FR-023: Check for existing file
  if (await installer.fileExists(targetUri)) {
    const resolution = await resolveConflict(filename, targetUri, item.source, sourcePath);
    if (!resolution || resolution === 'keep') {
      log.info(`Skipped ${filename}: user chose to keep existing`);
      return [targetRelativePath]; // Report as "written" for manifest consistency
    }
  }

  await installer.installFile(item.source, sourcePath, targetUri, targetRelativePath);
  return [targetRelativePath];
}

/**
 * Install a directory item (skills) with per-file conflict resolution.
 */
async function installDirectoryItem(
  item: CatalogFileItem,
  folder: vscode.WorkspaceFolder,
  installer: Installer,
  github: GitHubClient,
  log: vscode.LogOutputChannel,
  getRepoTree: (source: SourceConfig) => Promise<GitHubTreeResponse>,
  token: vscode.CancellationToken,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<string[] | undefined> {
  const targetDirRelative = resolveTargetDirPath(item);
  if (!targetDirRelative) {
    return undefined;
  }

  const tree = await getRepoTree(item.source);
  const targetDirUri = vscode.Uri.joinPath(folder.uri, targetDirRelative);

  // Derive the source directory path from the file path (strip filename)
  const pathSegments = item.path.split('/');
  const sourceDir = pathSegments.length >= 4
    ? pathSegments.slice(0, -1).join('/')
    : item.path;

  return installer.installDirectory(
    item.source,
    sourceDir,
    targetDirUri,
    targetDirRelative,
    tree.tree,
    token,
    progress,
  );
}

/**
 * Main install command handler.
 * Orchestrates: folder selection -> path -> conflict -> download -> manifest -> refresh.
 */
export async function installCommand(
  item: CatalogFileItem,
  installer: Installer,
  github: GitHubClient,
  manifest: ManifestManager,
  log: vscode.LogOutputChannel,
  refreshTree: () => void,
  getRepoTree: (source: SourceConfig) => Promise<GitHubTreeResponse>,
  discoveredFolders: Set<string> = new Set(),
): Promise<void> {
  // Step 1: Select target folder (FR-024)
  const folder = await installer.selectTargetFolder();
  if (!folder) {
    return; // User cancelled or no workspace
  }

  try {
    const filesWritten = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Installing ${item.name}...`,
        cancellable: true,
      },
      async (progress, token) => {
        // FR-010: Compute stripped path for folder-enabled sources
        const strippedPath = stripFolderPrefix(item.path, discoveredFolders);
        let effectiveItem = item;

        // FR-014, FR-015: Cross-folder conflict detection (folder-enabled sources only)
        if (discoveredFolders.size > 0 && strippedPath !== item.path) {
          const tree = await getRepoTree(item.source);
          const currentManifest = await manifest.readManifest(folder);
          const conflict = detectCrossFolderConflict(
            item.path, discoveredFolders, tree.tree, currentManifest, item.source, log,
          );
          if (conflict) {
            const selected = await resolveFolderConflict(conflict, log);
            if (!selected) {
              return undefined; // User cancelled -- no install
            }
            // Use the selected candidate's path if different from original
            if (selected.fullSourcePath !== item.path) {
              effectiveItem = { ...item, path: selected.fullSourcePath };
            }
          }
        }

        let result: string[] | undefined;

        // Step 2-6: Install based on item type
        if (effectiveItem.category === 'skills' || effectiveItem.category === 'plugins') {
          result = await installDirectoryItem(
            effectiveItem, folder, installer, github, log, getRepoTree, token, progress,
          );
        } else {
          result = await installSingleFile(effectiveItem, folder, installer, log);
        }

        if (!result || result.length === 0) {
          return undefined;
        }

        // Step 7: Get commit SHA and record in manifest (FR-026)
        progress.report({ message: 'Updating manifest...' });
        let commitSha: string;
        try {
          commitSha = await github.getLatestCommitSha(effectiveItem.source, effectiveItem.path);
        } catch {
          commitSha = 'unknown';
          log.warn(`Could not fetch commit SHA for ${effectiveItem.path}, using 'unknown'`);
        }

        // FR-012: Manifest stores the FULL source path (including folder prefix)
        const entry: InstallationEntry = {
          id: installationId(effectiveItem.source.url, effectiveItem.source.branch, effectiveItem.path),
          sourceUrl: effectiveItem.source.url,
          sourceBranch: effectiveItem.source.branch || 'main',
          itemPath: effectiveItem.path,
          targetPaths: result,
          tool: effectiveItem.tool,
          category: effectiveItem.category,
          commitSha,
          installedAt: new Date().toISOString(),
        };

        await manifest.addInstallation(folder, entry);
        return result;
      },
    );

    if (filesWritten && filesWritten.length > 0) {
      // Step 8-9: Refresh tree and notify
      refreshTree();
      vscode.window.showInformationMessage(
        `Installed ${item.name} to ${filesWritten[0]}`,
      );
    }
  } catch (err) {
    if (err instanceof InvalidPathError) {
      vscode.window.showErrorMessage(err.userMessage);
      log.error(err.message);
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to install ${item.name}: ${detail}`);
      log.error(`Install failed for ${item.name}: ${detail}`);
    }
  }
}
