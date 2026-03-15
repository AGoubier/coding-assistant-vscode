// Update command handler - opens diff view and applies update
// Spec refs: FR-031, US-05 Scenario 3, BDD: Apply an update
// WP06 T06-05

import * as vscode from 'vscode';
import type { CatalogFileItem, InstallationEntry, UpdateCheckResult } from '../models/types';
import type { LifecycleManager } from '../services/lifecycle';
import type { ManifestManager } from '../services/manifestManager';
import { buildPreviewUri } from '../providers/previewProvider';

/**
 * Update command: shows diff between installed and upstream, then applies if accepted.
 */
export async function updateCommand(
  item: CatalogFileItem,
  lifecycle: LifecycleManager,
  manifest: ManifestManager,
  refreshTree: () => void,
  log: vscode.LogOutputChannel,
): Promise<void> {
  // Find the workspace folder and installation entry
  const folders = vscode.workspace.workspaceFolders ?? [];
  let entry: InstallationEntry | undefined;
  let folder: vscode.WorkspaceFolder | undefined;

  for (const f of folders) {
    const entryId = `${item.source.url}#${item.path}`;
    const found = await manifest.getInstallation(f, entryId);
    if (found) {
      entry = found;
      folder = f;
      break;
    }
  }

  if (!entry || !folder) {
    vscode.window.showErrorMessage(`${item.name} is not installed.`);
    return;
  }

  // Get the cached update result for the latest SHA
  const updateResult: UpdateCheckResult | undefined = lifecycle.getUpdateResult(entry.id);
  const latestSha = updateResult?.latestSha;

  if (!latestSha || latestSha === entry.commitSha) {
    vscode.window.showInformationMessage(`${item.name} is already up to date.`);
    return;
  }

  // Open diff: installed file vs upstream (via preview scheme)
  const installedUri = vscode.Uri.joinPath(folder.uri, entry.targetPaths[0]);
  const filename = item.path.split('/').pop() || item.name;
  const upstreamUri = buildPreviewUri(item.source, item.path, filename);
  const shortOld = entry.commitSha.substring(0, 7);
  const shortNew = latestSha.substring(0, 7);

  await vscode.commands.executeCommand(
    'vscode.diff',
    installedUri,
    upstreamUri,
    `${filename}: Installed (${shortOld}) vs Upstream (${shortNew})`,
  );

  // Prompt user to accept or reject
  const choice = await vscode.window.showInformationMessage(
    `Apply update for ${item.name}?`,
    'Accept Update',
    'Reject',
  );

  if (choice !== 'Accept Update') {
    log.info(`Update rejected for ${item.name}`);
    return;
  }

  // Apply the update
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Updating ${item.name}...`,
      },
      async () => {
        await lifecycle.applyUpdate(entry!, folder!, latestSha);
      },
    );

    refreshTree();
    vscode.window.showInformationMessage(`Updated ${item.name} to latest version.`);
    log.info(`Updated ${item.name} to SHA ${shortNew}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to update ${item.name}: ${detail}`);
    log.error(`Update failed for ${item.name}: ${detail}`);
  }
}
