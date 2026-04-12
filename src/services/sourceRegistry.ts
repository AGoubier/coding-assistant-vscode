// Source registry service - manages configured source repositories
// Spec refs: FR-001 (master index), FR-002 (add/remove), FR-003 (public/private),
//            FR-004 (validate), FR-005 (default source)
// WP03 T03-01, T03-07

import * as vscode from 'vscode';
import type { MasterIndex, SourceConfig, SourceEntry, ValidationResult, MergedSourceList, IndexFetchResult } from '../models/types';
import { SourceUnreachableError, IndexErrorCodes } from '../models/errors';
import { GitHubClient } from './githubClient';

const SETTING_SECTION = 'awesome-coding-assistants';
const SETTING_SOURCES = 'sources';
const SETTING_INDEX_URL = 'indexUrl';

const DEFAULT_INDEX_URL = 'https://raw.githubusercontent.com/jlacube/awesome-coding-assistants/main/index.json';

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

/**
 * Coerce the raw indexUrl setting to a validated string[].
 * FR-022, FR-023: backward-compatible runtime coercion.
 */
export function normalizeIndexUrls(raw: unknown, defaultUrls: string[], log?: vscode.LogOutputChannel): string[] {
  if (raw === undefined) {
    return defaultUrls;
  }
  if (typeof raw === 'string') {
    log?.warn(`[${IndexErrorCodes.INVALID_INDEX_URL_TYPE.code}] indexUrl setting is a string, coercing to array. Type: ${typeof raw}`);
    return [raw];
  }
  if (Array.isArray(raw) && raw.every((v: unknown) => typeof v === 'string')) {
    return raw as string[];
  }
  const typeName = raw === null ? 'null' : typeof raw;
  log?.warn(`[${IndexErrorCodes.INVALID_INDEX_URL_TYPE.code}] indexUrl setting has invalid type: ${typeName}. Falling back to defaults.`);
  return defaultUrls;
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
   * Fetch and parse the master index from the configured indexUrl(s).
   * Supports single URL (existing behavior) and multiple URLs (union merge).
   * FR-001, FR-024, FR-027, T03-07
   */
  async loadMasterIndex(): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTING_SECTION);
    const raw = config.get(SETTING_INDEX_URL);

    const urls = normalizeIndexUrls(raw, [DEFAULT_INDEX_URL], this.log);

    if (urls.length === 0) {
      this.log.trace('No index URLs configured, skipping master index');
      this.cachedMasterIndex = undefined;
      return;
    }

    if (urls.length === 1) {
      // Single URL: use existing single-fetch logic
      await this.loadSingleIndex(urls[0]);
    } else {
      // Multiple URLs: parallel fetch + union merge
      const result = await this.loadMultipleIndexes(urls);

      // Log per-URL results (NFR-015)
      for (const fr of result.fetchResults) {
        if (fr.success) {
          this.log.info(`Index fetch succeeded: ${fr.url} (${fr.sourceCount} sources)`);
        } else {
          this.log.warn(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] Index fetch failed: ${fr.url}: ${fr.error}`);
        }
      }

      if (result.sources.length > 0) {
        this.cachedMasterIndex = result.sources;
        this.log.info(`Master index loaded: ${result.sources.length} sources from ${urls.length} URLs`);
      } else {
        // All URLs failed (FR-024)
        this.log.error(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] All index URLs failed. Falling back to user-configured sources.`);
        this.cachedMasterIndex = undefined;
      }
    }
  }

  /**
   * Fetch multiple index JSON files in parallel, union-merge with dedup.
   * FR-024, FR-025, FR-026, NFR-003, NFR-006, NFR-008
   */
  async loadMultipleIndexes(urls: string[]): Promise<MergedSourceList> {
    // Validate HTTPS (NFR-006) and filter
    const validUrls: string[] = [];
    const fetchResults: IndexFetchResult[] = [];

    for (const url of urls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
          this.log.warn(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] Non-HTTPS index URL rejected: ${url}`);
          fetchResults.push({ url, success: false, sourceCount: null, error: 'Non-HTTPS URL rejected' });
          continue;
        }
        validUrls.push(url);
      } catch {
        this.log.warn(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] Malformed index URL: ${url}`);
        fetchResults.push({ url, success: false, sourceCount: null, error: 'Malformed URL' });
      }
    }

    // Parallel fetch using Promise.allSettled (FR-024, NFR-003)
    const fetchPromises = validUrls.map(url => this.fetchSingleIndex(url));
    const results = await Promise.allSettled(fetchPromises);

    // Union merge in array order with dedup by sourceKey (FR-025, FR-026)
    const seenKeys = new Set<string>();
    const mergedSources: SourceConfig[] = [];

    for (let i = 0; i < validUrls.length; i++) {
      const result = results[i];
      const url = validUrls[i];

      if (result.status === 'rejected') {
        fetchResults.push({
          url,
          success: false,
          sourceCount: null,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
        continue;
      }

      const sources = result.value;
      if (sources === null) {
        // Schema validation failure
        fetchResults.push({
          url,
          success: false,
          sourceCount: null,
          error: 'Invalid index schema',
        });
        continue;
      }

      let addedCount = 0;
      for (const source of sources) {
        const key = sourceKey(source);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          mergedSources.push(source);
          addedCount++;
        }
      }

      fetchResults.push({
        url,
        success: true,
        sourceCount: addedCount,
        error: null,
      });
    }

    return { sources: mergedSources, fetchResults };
  }

  /**
   * Fetch and validate a single index URL, returning sources or null.
   */
  private async fetchSingleIndex(url: string): Promise<SourceConfig[] | null> {
    const indexSource = this.indexUrlToSource(url);
    if (!indexSource) {
      this.log.warn(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] Cannot parse index URL: ${url}`);
      throw new Error(`Cannot parse index URL: ${url}`);
    }

    const content = await this.github.getFileContent(indexSource.source, indexSource.path);
    const parsed = JSON.parse(content) as unknown;

    if (!this.isValidMasterIndex(parsed)) {
      this.log.warn(`[${IndexErrorCodes.INDEX_SCHEMA_INVALID.code}] Index at ${url} has an invalid format`);
      return null;
    }

    const index = parsed as MasterIndex;
    if (!index.version.startsWith('1')) {
      this.log.warn(`Unsupported master index version: ${index.version} at ${url}`);
      return null;
    }

    return index.sources.map(entry => this.sourceEntryToConfig(entry));
  }

  /**
   * Single-URL fetch path (refactored from original loadMasterIndex).
   * Preserves existing behavior for backward compatibility.
   */
  private async loadSingleIndex(indexUrl: string): Promise<void> {
    if (!indexUrl) {
      this.log.trace('No index URL configured, skipping master index');
      this.cachedMasterIndex = undefined;
      return;
    }

    try {
      const sources = await this.fetchSingleIndex(indexUrl);
      if (sources === null) {
        this.cachedMasterIndex = undefined;
        return;
      }

      this.cachedMasterIndex = sources;
      this.log.info(`Master index loaded: ${this.cachedMasterIndex.length} sources from ${indexUrl}`);
    } catch (err) {
      this.log.warn(`[${IndexErrorCodes.INDEX_FETCH_FAILED.code}] Failed to fetch master index from ${indexUrl}: ${err}`);
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
