// Preview content provider - serves remote file content as read-only virtual documents
// Spec refs: FR-019 (TextDocumentContentProvider with scheme awesome-ca-preview)
// WP04 T04-01

import * as vscode from 'vscode';
import type { GitHubClient } from '../services/githubClient';
import type { SourceConfig } from '../models/types';
import { PreviewFetchFailedError } from '../models/errors';

export const PREVIEW_SCHEME = 'awesome-ca-preview';

/**
 * Resolve the primary file for a directory item.
 * Priority: SKILL.md > README.md > first *.md alphabetically.
 * FR-018: preview skill directories - primary file selection.
 */
export function resolvePrimaryFile(
  directoryPath: string,
  allPaths: string[],
): string | undefined {
  // Normalize: ensure directoryPath does not end with /
  const dir = directoryPath.replace(/\/$/, '');

  // Filter to direct children of this directory that are .md files
  const mdChildren = allPaths
    .filter(p => {
      if (!p.startsWith(dir + '/')) {
        return false;
      }
      // Must be a direct child (no additional /)
      const rest = p.slice(dir.length + 1);
      return !rest.includes('/') && rest.toLowerCase().endsWith('.md');
    })
    .sort();

  if (mdChildren.length === 0) {
    return undefined;
  }

  // Priority: SKILL.md
  const skillMd = mdChildren.find(p => p.split('/').pop()?.toUpperCase() === 'SKILL.MD');
  if (skillMd) {
    return skillMd;
  }

  // Priority: README.md
  const readmeMd = mdChildren.find(p => p.split('/').pop()?.toUpperCase() === 'README.MD');
  if (readmeMd) {
    return readmeMd;
  }

  // Fallback: first .md alphabetically (already sorted)
  return mdChildren[0];
}

/**
 * Build a preview URI from source config, branch, path, and filename.
 */
export function buildPreviewUri(
  source: SourceConfig,
  path: string,
  filename: string,
): vscode.Uri {
  const branch = source.branch || 'main';
  const query = `source=${encodeURIComponent(source.url)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`;
  return vscode.Uri.from({
    scheme: PREVIEW_SCHEME,
    path: filename,
    query,
  });
}

/**
 * Decode source URL, branch, and path from a preview URI's query parameters.
 */
export function decodePreviewUri(uri: vscode.Uri): {
  sourceUrl: string;
  branch: string;
  path: string;
} {
  const params = new URLSearchParams(uri.query);
  return {
    sourceUrl: params.get('source') || '',
    branch: params.get('branch') || 'main',
    path: params.get('path') || '',
  };
}

export class PreviewProvider implements vscode.TextDocumentContentProvider {
  private readonly github: GitHubClient;
  private readonly log: vscode.LogOutputChannel;
  private readonly contentCache = new Map<string, string>();
  private readonly sourceMap: () => Map<string, SourceConfig>;

  constructor(
    github: GitHubClient,
    log: vscode.LogOutputChannel,
    sourceMap: () => Map<string, SourceConfig>,
  ) {
    this.github = github;
    this.log = log;
    this.sourceMap = sourceMap;
  }

  clearCache(): void {
    this.contentCache.clear();
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const cacheKey = uri.toString();
    const cached = this.contentCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const { sourceUrl, branch, path } = decodePreviewUri(uri);

    // Look up the SourceConfig by URL
    const sources = this.sourceMap();
    const source = sources.get(sourceUrl);
    if (!source) {
      const errorContent = `# Error\n\nFailed to load preview: source not found for ${sourceUrl}`;
      this.contentCache.set(cacheKey, errorContent);
      return errorContent;
    }

    // Build a source with the specific branch from the URI
    const sourceWithBranch: SourceConfig = { ...source, branch };

    try {
      const content = await this.github.getFileContent(sourceWithBranch, path);
      this.contentCache.set(cacheKey, content);
      return content;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.log.error(`Preview fetch error for ${path}: ${detail}`);
      const errorContent = `# Error\n\nFailed to load preview: ${detail}`;
      this.contentCache.set(cacheKey, errorContent);
      throw new PreviewFetchFailedError(path, detail);
    }
  }
}
