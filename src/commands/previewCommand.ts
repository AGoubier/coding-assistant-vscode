// Preview command handler - opens file content in read-only editor
// Spec refs: FR-016, FR-018, Section 8.1 (preview command)
// WP04 T04-04

import * as vscode from 'vscode';
import type { CatalogFileItem, GitHubTreeResponse, SourceConfig } from '../models/types';
import type { GitHubClient } from '../services/githubClient';
import { PreviewFetchFailedError } from '../models/errors';
import { buildPreviewUri, resolvePrimaryFile } from '../providers/previewProvider';

// Map file extensions to VS Code language identifiers
const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.md': 'markdown',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shellscript',
  '.bash': 'shellscript',
  '.ts': 'typescript',
  '.js': 'javascript',
  '.py': 'python',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
};

function getLanguageId(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) {
    return undefined;
  }
  return EXT_LANGUAGE_MAP[lower.slice(dotIdx)];
}

export async function previewCommand(
  item: CatalogFileItem,
  github: GitHubClient,
  log: vscode.LogOutputChannel,
  getRepoTree: (source: SourceConfig) => Promise<GitHubTreeResponse>,
): Promise<void> {
  let previewPath = item.path;
  let filename = item.name;

  // FR-018: For directory-type items (skills), resolve the primary file
  if (item.category === 'skills') {
    try {
      const tree = await getRepoTree(item.source);
      const allPaths = tree.tree.map(e => e.path);

      // item.path is a file path (e.g. .github/skills/my-skill/SKILL.md);
      // extract the parent directory for primary file resolution
      const dirPath = item.path.split('/').slice(0, -1).join('/');
      const primaryFile = resolvePrimaryFile(dirPath, allPaths);

      if (!primaryFile) {
        vscode.window.showInformationMessage(
          'No previewable file found in this directory.',
        );
        return;
      }

      previewPath = primaryFile;
      filename = primaryFile.split('/').pop() || filename;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log.error(`Failed to resolve primary file for ${item.path}: ${detail}`);
      vscode.window.showErrorMessage(`Failed to fetch preview: ${detail}`);
      return;
    }
  }

  const uri = buildPreviewUri(item.source, previewPath, filename);

  try {
    const doc = await vscode.workspace.openTextDocument(uri);

    // Set language mode explicitly since custom URI schemes bypass auto-detection
    const langId = getLanguageId(filename);
    if (langId) {
      await vscode.languages.setTextDocumentLanguage(doc, langId);
    }

    await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
  } catch (err) {
    if (err instanceof PreviewFetchFailedError) {
      vscode.window.showErrorMessage(err.userMessage);
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to fetch preview: ${detail}`);
    }
  }
}
