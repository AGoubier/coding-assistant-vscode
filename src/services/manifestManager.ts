// Manifest CRUD operations for .vscode/awesome-ca-manifest.json
// Spec refs: FR-026, FR-028, Section 7.4-7.5
// WP05 T05-06

import * as vscode from 'vscode';
import type { InstallationEntry, Manifest } from '../models/types';
import { installationId } from '../models/types';
import { ManifestCorruptError } from '../models/errors';

const MANIFEST_DIR = '.vscode';
const MANIFEST_FILE = 'awesome-ca-manifest.json';
const MANIFEST_PATH = `${MANIFEST_DIR}/${MANIFEST_FILE}`;
const BACKUP_EXT = '.bak';

/** Subset of vscode.FileSystem needed by ManifestManager and LifecycleManager, injectable for testing. */
export interface VscFs {
  readFile(uri: vscode.Uri): Thenable<Uint8Array>;
  writeFile(uri: vscode.Uri, content: Uint8Array): Thenable<void>;
  createDirectory(uri: vscode.Uri): Thenable<void>;
  stat(uri: vscode.Uri): Thenable<vscode.FileStat>;
  rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Thenable<void>;
  delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Thenable<void>;
}

function emptyManifest(): Manifest {
  return { version: '1.0', installations: [] };
}

export class ManifestManager {
  private readonly log: vscode.LogOutputChannel;
  private readonly fs: VscFs;

  constructor(log: vscode.LogOutputChannel, fs?: VscFs) {
    this.log = log;
    this.fs = fs ?? vscode.workspace.fs;
  }

  async readManifest(folder: vscode.WorkspaceFolder): Promise<Manifest> {
    const uri = vscode.Uri.joinPath(folder.uri, MANIFEST_PATH);
    try {
      const bytes = await this.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf-8');
      const parsed = JSON.parse(text) as Manifest;

      // Basic validation
      if (!parsed.version || !Array.isArray(parsed.installations)) {
        throw new Error('Invalid manifest structure');
      }

      // Migrate legacy IDs: url#path -> url@branch#path
      let migrated = false;
      for (const entry of parsed.installations) {
        const expected = installationId(entry.sourceUrl, entry.sourceBranch, entry.itemPath);
        if (entry.id !== expected) {
          this.log.info(`Migrating manifest entry ID: ${entry.id} -> ${expected}`);
          entry.id = expected;
          migrated = true;
        }
      }
      if (migrated) {
        await this.writeManifest(folder, parsed);
      }

      return parsed;
    } catch (err) {
      // File does not exist - return empty manifest
      if (err instanceof vscode.FileSystemError || (err as { code?: string })?.code === 'FileNotFound') {
        return emptyManifest();
      }
      // Check if it was a JSON parse error or structure error
      if (err instanceof SyntaxError || (err instanceof Error && err.message === 'Invalid manifest structure')) {
        await this.handleCorruptManifest(folder, uri);
        return emptyManifest();
      }
      // Unknown error reading file - treat as missing
      return emptyManifest();
    }
  }

  async writeManifest(folder: vscode.WorkspaceFolder, manifest: Manifest): Promise<void> {
    const dirUri = vscode.Uri.joinPath(folder.uri, MANIFEST_DIR);
    await this.fs.createDirectory(dirUri);

    const uri = vscode.Uri.joinPath(folder.uri, MANIFEST_PATH);
    const json = JSON.stringify(manifest, null, 2);
    await this.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
  }

  async addInstallation(folder: vscode.WorkspaceFolder, entry: InstallationEntry): Promise<void> {
    const manifest = await this.readManifest(folder);
    // Remove existing entry with same ID (idempotent)
    manifest.installations = manifest.installations.filter(e => e.id !== entry.id);
    manifest.installations.push(entry);
    await this.writeManifest(folder, manifest);
  }

  async removeInstallation(folder: vscode.WorkspaceFolder, id: string): Promise<void> {
    const manifest = await this.readManifest(folder);
    manifest.installations = manifest.installations.filter(e => e.id !== id);
    await this.writeManifest(folder, manifest);
  }

  async getInstallation(folder: vscode.WorkspaceFolder, id: string): Promise<InstallationEntry | undefined> {
    const manifest = await this.readManifest(folder);
    return manifest.installations.find(e => e.id === id);
  }

  async isInstalled(folder: vscode.WorkspaceFolder, sourceUrl: string, branch: string | undefined, itemPath: string): Promise<boolean> {
    const id = installationId(sourceUrl, branch, itemPath);
    const entry = await this.getInstallation(folder, id);
    return entry !== undefined;
  }

  private async handleCorruptManifest(folder: vscode.WorkspaceFolder, manifestUri: vscode.Uri): Promise<void> {
    const backupUri = vscode.Uri.joinPath(folder.uri, MANIFEST_PATH + BACKUP_EXT);
    try {
      await this.fs.rename(manifestUri, backupUri, { overwrite: true });
    } catch {
      // Backup failed - log and continue
    }
    const error = new ManifestCorruptError('Could not parse manifest JSON');
    this.log.error(error.message);
    vscode.window.showWarningMessage(error.userMessage);
  }
}
