// Install Bundle command handler - installs all items in a bundle sequentially
// Spec refs: US-07 Scenario 2, Section 8.1 (installBundle command)
// WP09 T09-03

import * as vscode from 'vscode';
import type {
  BundleNodeItem,
  BundleItem,
  SourceConfig,
  InstallationEntry,
} from '../models/types';
import type { Installer } from '../services/installer';
import type { GitHubClient } from '../services/githubClient';
import type { ManifestManager } from '../services/manifestManager';
import type { SourceRegistry } from '../services/sourceRegistry';
import { getTargetPath } from '../utils/pathUtils';
import type { CategoryType } from '../models/types';

/**
 * Resolve the source config for a bundle item.
 * If the item has a cross-source sourceUrl, look it up in the registry.
 * Otherwise, use the parent bundle's source.
 */
function resolveItemSource(
  item: BundleItem,
  parentSource: SourceConfig,
  registry: SourceRegistry,
): SourceConfig | undefined {
  if (!item.sourceUrl) {
    return parentSource;
  }
  // Cross-source: find matching configured source
  const sources = registry.getSources();
  return sources.find(s => s.url === item.sourceUrl);
}

/**
 * Main installBundle command handler.
 * Installs all items in the bundle sequentially with progress feedback.
 */
export async function installBundleCommand(
  bundleNode: BundleNodeItem,
  installer: Installer,
  github: GitHubClient,
  manifest: ManifestManager,
  registry: SourceRegistry,
  log: vscode.LogOutputChannel,
  refreshTree: () => void,
): Promise<void> {
  const bundle = bundleNode.bundle;
  const parentSource = bundleNode.source;

  // Select target folder
  const folder = await installer.selectTargetFolder();
  if (!folder) {
    return;
  }

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing bundle '${bundle.name}'...`,
      cancellable: true,
    },
    async (progress, token) => {
      let installed = 0;
      let failed = 0;
      const total = bundle.items.length;

      for (let i = 0; i < bundle.items.length; i++) {
        if (token.isCancellationRequested) {
          log.info(`Bundle install cancelled at item ${i + 1}/${total}`);
          break;
        }

        const bundleItem = bundle.items[i];
        const isRequired = bundleItem.required !== false;

        progress.report({
          message: `${i + 1}/${total}: ${bundleItem.path.split('/').pop() || bundleItem.path}`,
          increment: 100 / total,
        });

        // Resolve source for this item
        const itemSource = resolveItemSource(bundleItem, parentSource, registry);
        if (!itemSource) {
          const msg = `Cross-source reference not found: ${bundleItem.sourceUrl}`;
          log.warn(msg);
          vscode.window.showWarningMessage(
            `Bundle '${bundle.name}': skipping item ${bundleItem.path} - source not configured (${bundleItem.sourceUrl})`,
          );
          failed++;
          if (isRequired) {
            vscode.window.showErrorMessage(
              `Bundle '${bundle.name}' installation aborted: required item failed (missing source ${bundleItem.sourceUrl})`,
            );
            return { installed, failed, aborted: true };
          }
          continue;
        }

        // Compute target path
        const filename = bundleItem.path.split('/').pop() || bundleItem.path;
        const targetRelativePath = getTargetPath(
          bundleItem.tool,
          bundleItem.category as CategoryType,
          filename,
        );

        if (!targetRelativePath) {
          log.warn(`Cannot compute target path for ${bundleItem.path} (${bundleItem.tool}/${bundleItem.category})`);
          failed++;
          if (isRequired) {
            vscode.window.showErrorMessage(
              `Bundle '${bundle.name}' installation aborted: cannot determine target path for ${bundleItem.path}`,
            );
            return { installed, failed, aborted: true };
          }
          continue;
        }

        const targetUri = vscode.Uri.joinPath(folder.uri, targetRelativePath);

        try {
          await installer.installFile(itemSource, bundleItem.path, targetUri, targetRelativePath);

          // Record in manifest
          const sha = await github.getLatestCommitSha(itemSource, bundleItem.path).catch(() => 'unknown');
          const entry: InstallationEntry = {
            id: `${itemSource.url}#${bundleItem.path}`,
            sourceUrl: itemSource.url,
            sourceBranch: itemSource.branch || 'main',
            itemPath: bundleItem.path,
            targetPaths: [targetRelativePath],
            tool: bundleItem.tool,
            category: bundleItem.category,
            commitSha: sha,
            installedAt: new Date().toISOString(),
          };
          await manifest.addInstallation(folder, entry);

          installed++;
          log.info(`Bundle '${bundle.name}': installed ${bundleItem.path} to ${targetRelativePath}`);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          log.error(`Bundle '${bundle.name}': failed to install ${bundleItem.path}: ${detail}`);
          failed++;

          if (isRequired) {
            vscode.window.showErrorMessage(
              `Bundle '${bundle.name}' installation aborted: required item '${filename}' failed - ${detail}`,
            );
            return { installed, failed, aborted: true };
          }
          // Optional item: warn and continue
          vscode.window.showWarningMessage(
            `Bundle '${bundle.name}': optional item '${filename}' failed - ${detail}`,
          );
        }
      }

      return { installed, failed, aborted: false };
    },
  );

  if (result) {
    const total = bundle.items.length;
    if (result.aborted) {
      vscode.window.showWarningMessage(
        `Bundle '${bundle.name}': installed ${result.installed}/${total} items (aborted due to failure)`,
      );
    } else {
      vscode.window.showInformationMessage(
        `Installed ${result.installed}/${total} items from bundle '${bundle.name}'`,
      );
    }
  }

  refreshTree();
}
