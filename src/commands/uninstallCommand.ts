// Uninstall command handler - deletes files and removes manifest entry
// Spec refs: FR-033, US-05 Scenario 4, BDD: Uninstall a customization
// WP06 T06-06

import * as vscode from 'vscode';
import type { CatalogFileItem, InstallationEntry } from '../models/types';
import type { LifecycleManager } from '../services/lifecycle';
import type { ManifestManager } from '../services/manifestManager';

/**
 * Uninstall command: confirms, deletes file(s), removes manifest entry, refreshes tree.
 */
export async function uninstallCommand(
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

  // Confirmation dialog (FR-033)
  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to uninstall ${item.name}? This will delete the file(s) from your workspace.`,
    { modal: true },
    'Uninstall',
  );

  if (confirm !== 'Uninstall') {
    return;
  }

  try {
    await lifecycle.uninstallItem(entry, folder);
    refreshTree();
    vscode.window.showInformationMessage(`Uninstalled ${item.name}.`);
    log.info(`Uninstalled ${item.name}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to uninstall ${item.name}: ${detail}`);
    log.error(`Uninstall failed for ${item.name}: ${detail}`);
  }
}
