// GitHub API client for fetching repo trees, file content, and commit info
// Spec refs: Section 8.3, 9.4, 9.5, FR-034

import * as vscode from 'vscode';
import type {
  CacheEntry,
  GitHubCommit,
  GitHubTreeResponse,
  SourceConfig,
  ValidationResult,
} from '../models/types';
import {
  AuthFailedError,
  RateLimitedError,
  SourceUnreachableError,
} from '../models/errors';
import { AuthManager } from './authManager';
import { CacheManager } from './cacheManager';
import { isAllowedDomain, parseGitHubUrl } from '../utils/pathUtils';

const USER_AGENT = 'awesome-coding-assistants-vscode';
const ACCEPT_HEADER = 'application/vnd.github.v3+json';

interface FetchResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export class GitHubClient {
  private readonly auth: AuthManager;
  private readonly cache: CacheManager;
  private readonly log: vscode.LogOutputChannel;
  private readonly abortController: AbortController;

  constructor(auth: AuthManager, cache: CacheManager, log: vscode.LogOutputChannel) {
    this.auth = auth;
    this.cache = cache;
    this.log = log;
    this.abortController = new AbortController();
  }

  /**
   * Abort all in-flight fetch requests (called on dispose/deactivation).
   */
  dispose(): void {
    this.abortController.abort();
  }

  /**
   * Fetch the full recursive tree for a repository.
   */
  async getRepoTree(source: SourceConfig): Promise<GitHubTreeResponse> {
    const parsed = parseGitHubUrl(source.url);
    if (!parsed) {
      throw new SourceUnreachableError(source.url);
    }

    const branch = source.branch || 'main';
    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`;
    const cacheKey = `${source.url}:tree:${branch}`;

    const result = await this.fetchWithCache(url, cacheKey, source, true);
    return JSON.parse(result) as GitHubTreeResponse;
  }

  /**
   * Fetch file content from a repository.
   * Uses raw.githubusercontent.com for public repos, falls back to API for private.
   */
  async getFileContent(source: SourceConfig, path: string): Promise<string> {
    const parsed = parseGitHubUrl(source.url);
    if (!parsed) {
      throw new SourceUnreachableError(source.url);
    }

    const branch = source.branch || 'main';
    const cacheKey = `${source.url}:${path}`;

    // Try raw.githubusercontent.com first (for public repos)
    if (!source.authTokenKey) {
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${path}`;
      try {
        return await this.fetchWithCache(rawUrl, cacheKey, source, false);
      } catch {
        // Fall through to API
      }
    }

    // Use Contents API (for private repos or fallback)
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${path}?ref=${branch}`;
    const result = await this.fetchWithCache(apiUrl, cacheKey, source, true);
    const parsed_content = JSON.parse(result);

    // Contents API returns base64-encoded content
    if (parsed_content.content && parsed_content.encoding === 'base64') {
      return Buffer.from(parsed_content.content, 'base64').toString('utf-8');
    }

    return parsed_content.content || result;
  }

  /**
   * Get the latest commit SHA for a specific file path.
   */
  async getLatestCommitSha(source: SourceConfig, path: string): Promise<string> {
    const parsed = parseGitHubUrl(source.url);
    if (!parsed) {
      throw new SourceUnreachableError(source.url);
    }

    const branch = source.branch || 'main';
    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?path=${encodeURIComponent(path)}&per_page=1&sha=${branch}`;
    const cacheKey = `${source.url}:commits:${path}`;

    const result = await this.fetchWithCache(url, cacheKey, source, true);
    const commits = JSON.parse(result) as GitHubCommit[];

    if (!commits || commits.length === 0) {
      throw new SourceUnreachableError(source.url);
    }

    return commits[0].sha;
  }

  /**
   * Validate that a repository exists and is accessible.
   */
  async validateRepo(source: SourceConfig): Promise<ValidationResult> {
    const parsed = parseGitHubUrl(source.url);
    if (!parsed) {
      return { valid: false, error: `Invalid GitHub URL: ${source.url}` };
    }

    const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

    try {
      await this.doFetch(url, source, true);
      return { valid: true };
    } catch (err) {
      if (err instanceof AuthFailedError) {
        return { valid: false, error: err.userMessage };
      }
      if (err instanceof SourceUnreachableError) {
        return { valid: false, error: err.userMessage };
      }
      return { valid: false, error: String(err) };
    }
  }

  private async fetchWithCache(
    url: string,
    cacheKey: string,
    source: SourceConfig,
    isApiRequest: boolean,
  ): Promise<string> {
    // Check cache first
    const cached = await this.cache.getCached(cacheKey);
    if (cached) {
      this.log.trace(`Cache hit for: ${cacheKey}`);
      return cached.body;
    }

    // Build headers with conditional request if we have an ETag
    const etag = this.cache.getETag(cacheKey);

    try {
      const result = await this.doFetch(url, source, isApiRequest, etag);

      // 304 Not Modified - use stale cache
      if (result.status === 304) {
        const stale = await this.cache.getStale(cacheKey);
        if (stale) {
          // Refresh the timestamp
          await this.cache.setCached(cacheKey, { ...stale, timestamp: Date.now() });
          return stale.body;
        }
      }

      // Cache the response
      const entry: CacheEntry = {
        key: cacheKey,
        body: result.body,
        etag: result.headers['etag'],
        timestamp: Date.now(),
      };
      await this.cache.setCached(cacheKey, entry);

      return result.body;
    } catch (err) {
      // On server errors, try stale cache
      if (err instanceof SourceUnreachableError) {
        const stale = await this.cache.getStale(cacheKey);
        if (stale) {
          this.log.warn(`Serving stale cache for ${cacheKey} due to server error`);
          return stale.body;
        }
      }
      throw err;
    }
  }

  private async doFetch(
    url: string,
    source: SourceConfig,
    isApiRequest: boolean,
    etag?: string,
  ): Promise<FetchResult> {
    // SSRF protection
    if (!isAllowedDomain(url)) {
      throw new SourceUnreachableError(url);
    }

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
    };

    if (isApiRequest) {
      headers['Accept'] = ACCEPT_HEADER;
    }

    if (etag) {
      headers['If-None-Match'] = etag;
    }

    // Add auth header if available
    const authHeader = await this.auth.getAuthHeader(source);
    if (authHeader) {
      Object.assign(headers, authHeader);
    }

    this.log.trace(`Fetch: ${url}`);

    try {
      const response = await fetch(url, { headers, signal: this.abortController.signal });

      // Log rate limit info (never log tokens)
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining) {
        this.log.trace(`Rate limit remaining: ${remaining}`);
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      this.log.trace(`Response: ${url} -> ${response.status}`);

      // Handle error status codes
      if (response.status === 304) {
        return { status: 304, body: '', headers: responseHeaders };
      }

      if (response.status === 401 || response.status === 403) {
        throw new AuthFailedError(source.url, response.status);
      }

      if (response.status === 429) {
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const resetTimestamp = resetHeader ? parseInt(resetHeader, 10) : Math.floor(Date.now() / 1000) + 3600;
        throw new RateLimitedError(resetTimestamp);
      }

      if (response.status === 404) {
        throw new SourceUnreachableError(source.url, 404);
      }

      if (response.status >= 500) {
        throw new SourceUnreachableError(source.url, response.status);
      }

      if (!response.ok) {
        throw new SourceUnreachableError(source.url, response.status);
      }

      const body = await response.text();
      return { status: response.status, body, headers: responseHeaders };
    } catch (err) {
      if (err instanceof AuthFailedError || err instanceof RateLimitedError || err instanceof SourceUnreachableError) {
        throw err;
      }
      // Gracefully handle aborted/terminated fetch (extension shutting down)
      if (this.abortController.signal.aborted ||
          (err instanceof TypeError && (err.message === 'terminated' || err.message === 'Failed to fetch'))) {
        this.log.trace(`Fetch aborted for ${url}`);
      }
      throw new SourceUnreachableError(source.url);
    }
  }
}
