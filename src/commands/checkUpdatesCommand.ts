// Check for Updates command handler
// Spec refs: FR-032, US-05 Scenario 2, BDD: Detect available updates
// WP06 T06-04

import * as vscode from 'vscode';
import type { LifecycleManager } from '../services/lifecycle';

/**
 * Check all installed items for upstream updates.
 * Shows progress notification and updates tree badges.
 */
export async function checkUpdatesCommand(
  lifecycle: LifecycleManager,
  refreshTree: () => void,
  log: vscode.LogOutputChannel,
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showInformationMessage('No workspace folder open.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Checking for updates...',
      cancellable: true,
    },
    async (_progress, token) => {
      try {
        const results = await lifecycle.checkForUpdates(undefined, token);

        if (results.length === 0) {
          vscode.window.showInformationMessage('No installed items to check.');
          return;
        }

        const updateCount = results.filter(r => r.hasUpdate).length;

        // Refresh tree to show update badges
        refreshTree();

        if (updateCount > 0) {
          vscode.window.showInformationMessage(`Found ${updateCount} update${updateCount > 1 ? 's' : ''}.`);
        } else {
          vscode.window.showInformationMessage('All items are up to date.');
        }

        log.info(`Update check complete: ${updateCount} updates found out of ${results.length} items.`);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        vscode.window.showWarningMessage(`Update check failed: ${detail}`);
        log.error(`Update check failed: ${detail}`);
      }
    },
  );
}
