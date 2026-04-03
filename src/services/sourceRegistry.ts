// Source registry service - manages configured source repositories
// Spec refs: FR-001 (master index), FR-002 (add/remove), FR-003 (public/private),
//            FR-004 (validate), FR-005 (default source)
// WP03 T03-01, T03-07

import * as vscode from 'vscode';
import type { MasterIndex, SourceConfig, SourceEntry, ValidationResult } from '../models/types';
import { SourceUnreachableError } from '../models/errors';
import { GitHubClient } from './githubClient';

const SETTING_SECTION = 'awesome-coding-assistants';
const SETTING_SOURCES = 'sources';
const SETTING_INDEX_URL = 'indexUrl';

const DEFAULT_SOURCE: SourceConfig = {
  url: 'https://github.com/jlacube/awesome-coding-assistants',
  name: 'Awesome Coding Assistants',
  branch: 'main',
};

/**
 * Composite key for deduplicating sources: same URL on different branches
 * are treated as distinct sources.
 */
export function sourceKey(source: SourceConfig): string {
  return `${source.url}@${source.branch || 'main'}`;
}

export class SourceRegistry {
  private readonly github: GitHubClient;
  private readonly log: vscode.LogOutputChannel;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  private readonly configListener: vscode.Disposable;
  private cachedMasterIndex: SourceConfig[] | undefined;

  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(github: GitHubClient, log: vscode.LogOutputChannel) {
    this.github = github;
    this.log = log;

    this.configListener = vscode.workspace.onDidChangeConfiguration(e => {
      const sourcesChanged = e.affectsConfiguration(`${SETTING_SECTION}.${SETTING_SOURCES}`);
      const indexChanged = e.affectsConfiguration(`${SETTING_SECTION}.${SETTING_INDEX_URL}`);
      if (sourcesChanged || indexChanged) {
        if (indexChanged) {
          this.cachedMasterIndex = undefined;
        }
        this._onDidChange.fire();
        this.log.info('Source configuration changed');
      }
    });
  }

  /**
   * Get all configured sources, merging user settings with master index.
   * User sources take priority on URL conflicts.
   * FR-002, FR-005
   */
  getSources(): SourceConfig[] {
    const config = vscode.workspace.getConfiguration(SETTING_SECTION);
    const userSources = config.get<SourceConfig[]>(SETTING_SOURCES, []);

    // Merge: default first, then index, then user (last wins on url+branch collision)
    const merged = new Map<string, SourceConfig>();

    // Base: master index if loaded, otherwise default source as baseline
    if (this.cachedMasterIndex && this.cachedMasterIndex.length > 0) {
      for (const source of this.cachedMasterIndex) {
        merged.set(sourceKey(source), source);
      }
    } else {
      merged.set(sourceKey(DEFAULT_SOURCE), DEFAULT_SOURCE);
    }

    // Add user sources (overwrite index/default entries on collision)
    for (const source of userSources) {
      merged.set(sourceKey(source), source);
    }

    return Array.from(merged.values());
  }

  /**
   * Add a source after validation. Throws SourceUnreachableError on invalid.
   * FR-002, FR-004
   */
  async addSource(source: SourceConfig): Promise<void> {
    const validation = await this.validateSource(source);
    if (!validation.valid) {
      throw new SourceUnreachableError(source.url);
    }

    // Prevent duplicates - check all visible sources (including default and index)
    const allSources = this.getSources();
    const exists = allSources.some(s => sourceKey(s) === sourceKey(source));
    if (exists) {
      this.log.info(`Source already configured: ${source.url}`);
      return;
    }

    const config = vscode.workspace.getConfiguration(SETTING_SECTION);
    const current = config.get<SourceConfig[]>(SETTING_SOURCES, []);
    const updated = [...current, source];
    await config.update(SETTING_SOURCES, updated, vscode.ConfigurationTarget.Global);
    this.log.info(`Source added: ${source.url}`);
  }

  /**
   * Remove a source by URL.
   * FR-002
   */
  async removeSource(url: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTING_SECTION);
    const current = config.get<SourceConfig[]>(SETTING_SOURCES, []);
    const updated = current.filter(s => s.url !== url);
    await config.update(SETTING_SOURCES, updated, vscode.ConfigurationTarget.Global);
    this.log.info(`Source removed: ${url}`);
  }

  /**
   * Validate a source by delegating to GitHubClient.validateRepo().
   * FR-004
   */
  async validateSource(source: SourceConfig): Promise<ValidationResult> {
    return this.github.validateRepo(source);
  }

  /**
   * Fetch and parse the master index from the configured indexUrl.
   * Silently falls back on errors (FR-001 - no error to user).
   * FR-001, T03-07
   */
  async loadMasterIndex(): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTING_SECTION);
    const indexUrl = config.get<string>(SETTING_INDEX_URL, '');

    if (!indexUrl) {
      this.log.trace('No index URL configured, skipping master index');
      this.cachedMasterIndex = undefined;
      return;
    }

    try {
      // Build a temporary SourceConfig for fetching the index
      const indexSource = this.indexUrlToSource(indexUrl);
      if (!indexSource) {
        this.log.warn(`Cannot parse index URL: ${indexUrl}`);
        this.cachedMasterIndex = undefined;
        return;
      }

      const content = await this.github.getFileContent(indexSource.source, indexSource.path);
      const parsed = JSON.parse(content) as unknown;

      if (!this.isValidMasterIndex(parsed)) {
        this.log.error('Master index JSON is malformed or missing required fields');
        this.cachedMasterIndex = undefined;
        return;
      }

      const index = parsed as MasterIndex;

      // Version check
      if (!index.version.startsWith('1')) {
        this.log.warn(`Unsupported master index version: ${index.version}, skipping`);
        this.cachedMasterIndex = undefined;
        return;
      }

      this.cachedMasterIndex = index.sources.map(entry => this.sourceEntryToConfig(entry));
      this.log.info(`Master index loaded: ${this.cachedMasterIndex.length} sources from ${indexUrl}`);
    } catch (err) {
      // Silently fall back - FR-001 says no error shown to user
      this.log.warn(`Failed to fetch master index from ${indexUrl}: ${err}`);
      this.cachedMasterIndex = undefined;
    }
  }

  /**
   * Invalidate cached master index (used by refresh).
   */
  invalidateCache(): void {
    this.cachedMasterIndex = undefined;
  }

  dispose(): void {
    this.configListener.dispose();
    this._onDidChange.dispose();
  }

  private isValidMasterIndex(data: unknown): data is MasterIndex {
    if (typeof data !== 'object' || data === null) {
      return false;
    }
    const obj = data as Record<string, unknown>;
    return typeof obj.version === 'string' && Array.isArray(obj.sources);
  }

  private sourceEntryToConfig(entry: SourceEntry): SourceConfig {
    return {
      url: entry.url,
      name: entry.name,
      branch: entry.branch,
      // Index sources are assumed public (FR-003)
      authTokenKey: undefined,
    };
  }

  /**
   * Parse a raw.githubusercontent.com URL into a SourceConfig + path for fetching.
   * Also handles github.com repo URLs with /blob/ or direct raw URLs.
   */
  private indexUrlToSource(indexUrl: string): { source: SourceConfig; path: string } | undefined {
    // Handle raw.githubusercontent.com URLs
    const rawMatch = indexUrl.match(
      /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/
    );
    if (rawMatch) {
      return {
        source: {
          url: `https://github.com/${rawMatch[1]}/${rawMatch[2]}`,
          name: 'Index',
          branch: rawMatch[3],
        },
        path: rawMatch[4],
      };
    }

    // Handle github.com URLs with blob path
    const blobMatch = indexUrl.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
    );
    if (blobMatch) {
      return {
        source: {
          url: `https://github.com/${blobMatch[1]}/${blobMatch[2]}`,
          name: 'Index',
          branch: blobMatch[3],
        },
        path: blobMatch[4],
      };
    }

    return undefined;
  }
}
