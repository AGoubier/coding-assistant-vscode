// Installer service - downloads and writes files to workspace
// Spec refs: FR-020, FR-022, FR-025, FR-027, Section 10.2
// WP05 T05-02, T05-03

import * as vscode from 'vscode';
import type { SourceConfig, GitHubTreeEntry } from '../models/types';
import type { GitHubClient } from '../services/githubClient';
import { InstallFailedError, InvalidPathError } from '../models/errors';
import { validatePath } from '../utils/pathUtils';
import type { VscFs } from './manifestManager';

export class Installer {
  private readonly github: GitHubClient;
  private readonly log: vscode.LogOutputChannel;
  private readonly fs: VscFs;

  constructor(github: GitHubClient, log: vscode.LogOutputChannel, fs?: VscFs) {
    this.github = github;
    this.log = log;
    this.fs = fs ?? vscode.workspace.fs;
  }

  /**
   * Install a single file from a source repo to a target URI.
   * FR-022: creates target directory automatically.
   * FR-027: validates path before any FS operation.
   */
  async installFile(
    source: SourceConfig,
    sourcePath: string,
    targetUri: vscode.Uri,
    targetRelativePath: string,
  ): Promise<void> {
    // FR-027: path traversal check before any FS operation
    if (!validatePath(targetRelativePath)) {
      throw new InvalidPathError(targetRelativePath);
    }

    try {
      const content = await this.github.getFileContent(source, sourcePath);

      // FR-022: create target directory if it does not exist
      const parentUri = vscode.Uri.joinPath(targetUri, '..');
      await this.fs.createDirectory(parentUri);

      // Write file as UTF-8
      await this.fs.writeFile(targetUri, Buffer.from(content, 'utf-8'));

      this.log.info(`Installed ${sourcePath} to ${targetRelativePath}`);
    } catch (err) {
      if (err instanceof InvalidPathError) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : String(err);
      throw new InstallFailedError(targetRelativePath, detail);
    }
  }

  /**
   * Install all files under a directory from a source repo.
   * FR-025: recursive directory download preserving structure.
   */
  async installDirectory(
    source: SourceConfig,
    sourceDir: string,
    targetDirUri: vscode.Uri,
    targetDirRelative: string,
    repoTree: GitHubTreeEntry[],
    token: vscode.CancellationToken,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
  ): Promise<string[]> {
    // Find all blobs under the source directory
    const prefix = sourceDir.endsWith('/') ? sourceDir : sourceDir + '/';
    const filesToInstall = repoTree.filter(
      entry => entry.type === 'blob' && entry.path.startsWith(prefix),
    );

    if (filesToInstall.length === 0) {
      return [];
    }

    const writtenPaths: string[] = [];
    const increment = 100 / filesToInstall.length;

    for (let i = 0; i < filesToInstall.length; i++) {
      if (token.isCancellationRequested) {
        break;
      }

      const entry = filesToInstall[i];
      // Compute relative path within the directory
      const relativePath = entry.path.slice(prefix.length);
      const targetRelativePath = `${targetDirRelative}/${relativePath}`;
      const targetUri = vscode.Uri.joinPath(targetDirUri, relativePath);

      progress.report({
        message: `Installing ${sourceDir.split('/').pop()}: ${i + 1}/${filesToInstall.length} files`,
        increment,
      });

      // FR-027: validate each file path
      if (!validatePath(targetRelativePath)) {
        throw new InvalidPathError(targetRelativePath);
      }

      try {
        const content = await this.github.getFileContent(source, entry.path);
        const parentUri = vscode.Uri.joinPath(targetUri, '..');
        await this.fs.createDirectory(parentUri);
        await this.fs.writeFile(targetUri, Buffer.from(content, 'utf-8'));
        writtenPaths.push(targetRelativePath);
        this.log.info(`Installed ${entry.path} to ${targetRelativePath}`);
      } catch (err) {
        if (err instanceof InvalidPathError) {
          throw err;
        }
        const detail = err instanceof Error ? err.message : String(err);
        throw new InstallFailedError(targetRelativePath, detail);
      }
    }

    return writtenPaths;
  }

  /**
   * Check if a target file already exists.
   */
  async fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await this.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Select the target workspace folder.
   * FR-024: prompt for folder in multi-root workspaces, auto-select in single.
   */
  async selectTargetFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
      return undefined;
    }

    if (folders.length === 1) {
      return folders[0];
    }

    // Multi-root: prompt user to select
    const items = folders.map(f => ({
      label: f.name,
      description: f.uri.fsPath,
      folder: f,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select workspace folder for installation',
    });

    return selected?.folder;
  }
}
