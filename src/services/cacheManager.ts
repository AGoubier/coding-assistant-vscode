// Cache manager using globalState for API responses and ETags
// Spec refs: FR-040 to FR-044, Section 7.6

import * as vscode from 'vscode';
import type { CacheEntry } from '../models/types';
import { CacheError } from '../models/errors';

const CACHE_KEY_PREFIX = 'cache:';

export class CacheManager {
  private readonly globalState: vscode.Memento;
  private readonly log: vscode.LogOutputChannel;

  constructor(context: vscode.ExtensionContext, log: vscode.LogOutputChannel) {
    this.globalState = context.globalState;
    this.log = log;
  }

  async getCached(key: string): Promise<CacheEntry | undefined> {
    try {
      const entry = this.globalState.get<CacheEntry>(CACHE_KEY_PREFIX + key);
      if (!entry) {
        return undefined;
      }

      if (this.isExpired(entry)) {
        this.log.trace(`Cache expired for key: ${key}`);
        return undefined;
      }

      return entry;
    } catch (err) {
      this.log.error(`Cache read failed: ${err}`);
      return undefined;
    }
  }

  /**
   * Get a cached entry even if expired. Used for stale-while-revalidate on server errors.
   */
  async getStale(key: string): Promise<CacheEntry | undefined> {
    try {
      return this.globalState.get<CacheEntry>(CACHE_KEY_PREFIX + key);
    } catch (err) {
      this.log.error(`Cache stale read failed: ${err}`);
      return undefined;
    }
  }

  async setCached(key: string, entry: CacheEntry): Promise<void> {
    try {
      await this.globalState.update(CACHE_KEY_PREFIX + key, entry);
    } catch (err) {
      const error = new CacheError(String(err));
      this.log.error(error.message);
    }
  }

  async invalidate(key?: string): Promise<void> {
    try {
      if (key) {
        await this.globalState.update(CACHE_KEY_PREFIX + key, undefined);
        this.log.trace(`Cache invalidated for key: ${key}`);
      } else {
        // Clear all cache entries
        const keys = this.globalState.keys().filter((k) => k.startsWith(CACHE_KEY_PREFIX));
        for (const k of keys) {
          await this.globalState.update(k, undefined);
        }
        this.log.info(`Cache cleared: ${keys.length} entries removed`);
      }
    } catch (err) {
      const error = new CacheError(String(err));
      this.log.error(error.message);
    }
  }

  getETag(key: string): string | undefined {
    try {
      const entry = this.globalState.get<CacheEntry>(CACHE_KEY_PREFIX + key);
      return entry?.etag;
    } catch {
      return undefined;
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    const expirationMinutes = vscode.workspace
      .getConfiguration('awesome-coding-assistants')
      .get<number>('cacheExpirationMinutes', 1440);
    const expirationMs = expirationMinutes * 60 * 1000;
    return entry.timestamp + expirationMs < Date.now();
  }
}
