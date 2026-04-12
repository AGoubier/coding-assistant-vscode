// LifecycleManager - update detection, update application, and uninstall orchestration
// Spec refs: FR-028 through FR-034, Section 9.1
// WP06 T06-01, T06-02

import * as vscode from 'vscode';
import type { InstallationEntry, SourceConfig, UpdateCheckResult } from '../models/types';
import type { GitHubClient } from './githubClient';
import type { ManifestManager } from './manifestManager';
import type { Installer } from './installer';
import type { VscFs } from './manifestManager';

/** Concurrency limiter: runs up to `limit` promises at once from a list of factories. */
async function pAll<T>(
  factories: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < factories.length) {
      const i = index++;
      results[i] = await factories[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, factories.length) }, () => next());
  await Promise.all(workers);
  return results;
}

export class LifecycleManager {
  private readonly github: GitHubClient;
  private readonly manifest: ManifestManager;
  private readonly installer: Installer;
  private readonly log: vscode.LogOutputChannel;
  private readonly fs: VscFs;

  // Cached update results for tree badge lookups
  private updateResults = new Map<string, UpdateCheckResult>();

  constructor(
    github: GitHubClient,
    manifest: ManifestManager,
    installer: Installer,
    log: vscode.LogOutputChannel,
    fs?: VscFs,
  ) {
    this.github = github;
    this.manifest = manifest;
    this.installer = installer;
    this.log = log;
    this.fs = fs ?? vscode.workspace.fs;
  }

  /**
   * Check for updates across one or all workspace folders.
   * FR-029: SHA comparison. FR-034: ETag caching. NFR-003: concurrency limit of 10.
   */
  async checkForUpdates(
    folder?: vscode.WorkspaceFolder,
    token?: vscode.CancellationToken,
  ): Promise<UpdateCheckResult[]> {
    const folders = folder
      ? [folder]
      : (vscode.workspace.workspaceFolders ?? []);

    if (folders.length === 0) {
      return [];
    }

    const allEntries: { entry: InstallationEntry; folder: vscode.WorkspaceFolder }[] = [];
    for (const f of folders) {
      const m = await this.manifest.readManifest(f);
      for (const entry of m.installations) {
        allEntries.push({ entry, folder: f });
      }
    }

    if (allEntries.length === 0) {
      return [];
    }

    // Build check tasks with concurrency limit of 10
    const factories = allEntries.map(({ entry, folder: f }) => async (): Promise<UpdateCheckResult> => {
      if (token?.isCancellationRequested) {
        return { entry, hasUpdate: false, latestSha: entry.commitSha, folder: f };
      }

      try {
        const source = this.entryToSource(entry);
        const latestSha = await this.github.getLatestCommitSha(source, entry.itemPath);
        const hasUpdate = latestSha !== entry.commitSha;
        return { entry, hasUpdate, latestSha, folder: f };
      } catch (err) {
        this.log.warn(`Update check failed for ${entry.itemPath}: ${err}`);
        return { entry, hasUpdate: false, latestSha: entry.commitSha, folder: f };
      }
    });

    const results = await pAll(factories, 10);

    // Cache results for tree badge lookups
    this.updateResults.clear();
    for (const r of results) {
      if (r.hasUpdate) {
        this.updateResults.set(r.entry.id, r);
      }
    }

    return results;
  }

  /**
   * Returns true if the given installation entry has a cached update available.
   */
  hasUpdate(entryId: string): boolean {
    return this.updateResults.has(entryId);
  }

  /**
   * Get the cached update result for a given entry.
   */
  getUpdateResult(entryId: string): UpdateCheckResult | undefined {
    return this.updateResults.get(entryId);
  }

  /**
   * Clear cached update results (e.g., on refresh).
   */
  clearUpdateCache(): void {
    this.updateResults.clear();
  }

  /**
   * Returns the number of cached updates still pending.
   */
  getUpdateCount(): number {
    return this.updateResults.size;
  }

  /**
   * Apply an upstream update: re-download the file(s) and update the manifest entry.
   * FR-031: Update action. FR-013: Uses full itemPath from manifest for fetch.
   */
  async applyUpdate(
    entry: InstallationEntry,
    folder: vscode.WorkspaceFolder,
    latestSha: string,
  ): Promise<void> {
    const source = this.entryToSource(entry);

    // FR-013: Re-install all target paths using full itemPath for source fetch
    for (const targetPath of entry.targetPaths) {
      const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
      try {
        await this.installer.installFile(source, entry.itemPath, targetUri, targetPath);
      } catch (err) {
        // FR-013: If source path no longer exists, report to user
        const detail = err instanceof Error ? err.message : String(err);
        if (detail.includes('404') || detail.includes('Not Found') || detail.includes('not found')) {
          throw new Error(`Item not found in source: ${entry.itemPath}. It may have been moved or deleted from the repository.`);
        }
        throw err;
      }
    }

    // Update manifest entry with new SHA and timestamp
    const updatedEntry: InstallationEntry = {
      ...entry,
      commitSha: latestSha,
      updatedAt: new Date().toISOString(),
    };
    await this.manifest.addInstallation(folder, updatedEntry);

    // Remove from update cache
    this.updateResults.delete(entry.id);

    this.log.info(`Updated ${entry.itemPath} to SHA ${latestSha.substring(0, 7)}`);
  }

  /**
   * Uninstall an item: delete file(s) from workspace and remove manifest entry.
   * FR-033: Uninstall action.
   */
  async uninstallItem(
    entry: InstallationEntry,
    folder: vscode.WorkspaceFolder,
  ): Promise<void> {
    // Delete each target file/directory
    for (const targetPath of entry.targetPaths) {
      const targetUri = vscode.Uri.joinPath(folder.uri, targetPath);
      try {
        await this.fs.delete(targetUri, { recursive: true });
      } catch {
        // File already deleted - that is fine
      }
    }

    // Remove from manifest
    await this.manifest.removeInstallation(folder, entry.id);

    // Remove from update cache
    this.updateResults.delete(entry.id);

    this.log.info(`Uninstalled ${entry.itemPath}`);
  }

  /**
   * Convert an InstallationEntry back to a SourceConfig for API calls.
   */
  private entryToSource(entry: InstallationEntry): SourceConfig {
    return {
      url: entry.sourceUrl,
      name: entry.sourceUrl,
      branch: entry.sourceBranch,
    };
  }
}
