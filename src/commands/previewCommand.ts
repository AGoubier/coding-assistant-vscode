// Preview command handler - opens file content in read-only editor
// Spec refs: FR-016, FR-018, Section 8.1 (preview command)
// WP04 T04-04

import * as vscode from 'vscode';
import type { CatalogFileItem, GitHubTreeResponse, SourceConfig } from '../models/types';
import type { GitHubClient } from '../services/githubClient';
import { PreviewFetchFailedError } from '../models/errors';
import { buildPreviewUri, resolvePrimaryFile } from '../providers/previewProvider';

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
      const primaryFile = resolvePrimaryFile(item.path, allPaths);

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
    // Load content via our TextDocumentContentProvider
    const doc = await vscode.workspace.openTextDocument(uri);

    if (filename.toLowerCase().endsWith('.md')) {
      // Show rendered Markdown preview for .md files
      await vscode.commands.executeCommand('markdown.showPreview', uri);
    } else {
      // Show in text editor with syntax highlighting based on file extension
      await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
    }
  } catch (err) {
    if (err instanceof PreviewFetchFailedError) {
      vscode.window.showErrorMessage(err.userMessage);
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to fetch preview: ${detail}`);
    }
  }
}
