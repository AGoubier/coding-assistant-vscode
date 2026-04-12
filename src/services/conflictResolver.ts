// Cross-folder conflict detection and resolution
// Spec refs: FR-014, FR-015, NFR-005, NFR-016, Section 8.4
// WP17 T17-04, T17-05

import * as vscode from 'vscode';
import type {
  CrossFolderConflict,
  ConflictCandidate,
  GitHubTreeEntry,
  Manifest,
  SourceConfig,
} from '../models/types';
import { stripFolderPrefix, formatFolderName } from '../utils/pathUtils';

/**
 * Detect whether installing an item would conflict with items from other folders
 * that resolve to the same post-strip target path.
 * FR-014, FR-015, NFR-005 (< 10ms at p95)
 *
 * Scans allEntries for sibling items from different folders that strip to the same
 * target path, and checks the manifest for existing installed entries at the same
 * target path from a different folder.
 *
 * Returns undefined if no conflict exists.
 */
export function detectCrossFolderConflict(
  itemPath: string,
  folders: Set<string>,
  allEntries: GitHubTreeEntry[],
  manifest: Manifest,
  source: SourceConfig,
  log: vscode.LogOutputChannel,
): CrossFolderConflict | undefined {
  if (folders.size === 0) {
    return undefined;
  }

  const targetPath = stripFolderPrefix(itemPath, folders);

  // If stripping didn't change the path, this item has no folder prefix
  if (targetPath === itemPath) {
    return undefined;
  }

  const itemFolder = itemPath.substring(0, itemPath.indexOf('/'));
  const candidates: ConflictCandidate[] = [];

  // Scan allEntries for other folder entries that strip to the same target path
  for (const entry of allEntries) {
    if (entry.type !== 'blob') {
      continue;
    }
    if (entry.path === itemPath) {
      continue;
    }
    const entryStripped = stripFolderPrefix(entry.path, folders);
    if (entryStripped === targetPath && entryStripped !== entry.path) {
      const entryFolder = entry.path.substring(0, entry.path.indexOf('/'));
      if (entryFolder !== itemFolder) {
        candidates.push({
          fullSourcePath: entry.path,
          folderName: entryFolder,
          folderDisplayName: formatFolderName(entryFolder),
          source,
        });
      }
    }
  }

  // Check manifest for existing installations at the same target path from a different folder
  for (const installed of manifest.installations) {
    if (installed.sourceUrl !== source.url) {
      continue;
    }
    if (installed.targetPaths.includes(targetPath)) {
      const installedFolder = installed.itemPath.substring(0, installed.itemPath.indexOf('/'));
      if (installedFolder !== itemFolder && folders.has(installedFolder)) {
        // Avoid duplicate candidates
        if (!candidates.some(c => c.fullSourcePath === installed.itemPath)) {
          candidates.push({
            fullSourcePath: installed.itemPath,
            folderName: installedFolder,
            folderDisplayName: formatFolderName(installedFolder),
            source,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  // Add the current item as a candidate too
  candidates.unshift({
    fullSourcePath: itemPath,
    folderName: itemFolder,
    folderDisplayName: formatFolderName(itemFolder),
    source,
  });

  return { targetPath, candidates };
}

/**
 * Display a VS Code quick-pick prompt for the user to choose among
 * cross-folder conflicting items. Returns the selected candidate
 * or undefined if the user dismissed without selecting.
 * FR-014, NFR-016
 */
export async function resolveFolderConflict(
  conflict: CrossFolderConflict,
  log: vscode.LogOutputChannel,
): Promise<ConflictCandidate | undefined> {
  const items = conflict.candidates.map(c => ({
    label: `${c.folderDisplayName}/${conflict.targetPath.split('/').pop() || conflict.targetPath}`,
    description: c.fullSourcePath,
    candidate: c,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Multiple folders have "${conflict.targetPath.split('/').pop()}". Which version do you want to install?`,
  });

  if (selected) {
    log.info(`Conflict resolved: user selected ${selected.candidate.fullSourcePath} from folder ${selected.candidate.folderName}`);
    return selected.candidate;
  }

  log.info(`Conflict cancelled by user for target path ${conflict.targetPath}`);
  return undefined;
}
