// Tool classification for file paths from repo trees and workspace detection
// Spec refs: FR-012 (path-based detection), FR-013 (workspace auto-detect), FR-015 (tool badges)
// WP03 T03-02: classifyItem wraps classifyPath with 'unknown' fallback
// WP08 T08-01: detectWorkspaceTools scans workspace for tool markers

import * as vscode from 'vscode';
import type { ToolClassification, CategoryType, DetectedTool } from '../models/types';

// Copilot file patterns within .github/ directories
const COPILOT_PATTERNS: { dir: string; category: CategoryType; extensions?: string[] }[] = [
  { dir: 'agents', category: 'agents', extensions: ['.agent.md'] },
  { dir: 'instructions', category: 'instructions', extensions: ['.instructions.md'] },
  { dir: 'skills', category: 'skills' },
  { dir: 'prompts', category: 'prompts', extensions: ['.prompt.md'] },
  { dir: 'hooks', category: 'hooks' },
  { dir: 'chatmodes', category: 'modes' },
  { dir: 'plugins', category: 'plugins' },
  { dir: 'workflows', category: 'workflows' },
];

// Claude Code file patterns
const CLAUDE_PATTERNS: { dir: string; category: CategoryType }[] = [
  { dir: 'agents', category: 'agents' },
  { dir: 'rules', category: 'rules' },
  { dir: 'commands', category: 'commands' },
];

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Classify a file path into tool type and category.
 * Returns { tool: 'unknown', category: 'unknown' } for unrecognized patterns.
 * Spec ref: FR-012 (path detection), FR-015 (tool badge)
 */
export function classifyItem(path: string): ToolClassification {
  const normalized = normalizePath(path);
  const segments = normalized.split('/');
  const segLower = segments.map(s => s.toLowerCase());

  // Claude Code patterns first (.claude/ prefix is unambiguous)
  if (segLower[0] === '.claude' && segments.length >= 3) {
    const dir = segLower[1];
    for (const pattern of CLAUDE_PATTERNS) {
      if (dir === pattern.dir) {
        return { tool: 'claude-code', category: pattern.category };
      }
    }
  }

  // Claude Code CLAUDE.md at root (case-insensitive per T08-02 AC)
  if (normalized.toLowerCase() === 'claude.md') {
    return { tool: 'claude-code', category: 'rules' };
  }

  // Claude Code .claude/settings.json
  if (normalized.toLowerCase() === '.claude/settings.json') {
    return { tool: 'claude-code', category: 'rules' };
  }

  // Copilot patterns: .github/{category}/...
  if (segLower[0] === '.github' && segments.length >= 3) {
    const dir = segLower[1];
    for (const pattern of COPILOT_PATTERNS) {
      if (dir === pattern.dir) {
        // If pattern requires specific extensions, check them
        if (pattern.extensions) {
          const filename = segments[segments.length - 1].toLowerCase();
          const matchesExtension = pattern.extensions.some(ext => filename.endsWith(ext));
          // For skills, SKILL.md is the marker file
          if (!matchesExtension && pattern.category !== 'skills') {
            // File does not match required extension (e.g., agents/README.md)
            continue;
          }
        }
        return { tool: 'copilot', category: pattern.category };
      }
    }
  }

  return { tool: 'unknown', category: 'unknown' };
}

/**
 * Check if a path exists in the filesystem.
 */
async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which AI coding tools are configured in the given workspace folder.
 * Checks for known marker files/directories. Does not scan deeply.
 * Spec ref: FR-013 (auto-detect workspace tools)
 */
export async function detectWorkspaceTools(folder: vscode.WorkspaceFolder): Promise<DetectedTool[]> {
  const results: DetectedTool[] = [];
  const root = folder.uri;

  // Copilot high confidence: .github/agents/ directory or .github/copilot-instructions.md
  const hasGithubAgents = await pathExists(vscode.Uri.joinPath(root, '.github', 'agents'));
  const hasCopilotInstructions = await pathExists(vscode.Uri.joinPath(root, '.github', 'copilot-instructions.md'));

  if (hasGithubAgents || hasCopilotInstructions) {
    results.push({ tool: 'copilot', confidence: 'high' });
  } else {
    // Copilot low confidence: any recognized file in .github/
    const lowConfidencePaths = [
      '.github/instructions',
      '.github/prompts',
      '.github/hooks',
      '.github/skills',
    ];
    for (const p of lowConfidencePaths) {
      if (await pathExists(vscode.Uri.joinPath(root, p))) {
        results.push({ tool: 'copilot', confidence: 'low' });
        break;
      }
    }
  }

  // Claude Code high confidence: .claude/ directory or CLAUDE.md at root
  const hasClaudeDir = await pathExists(vscode.Uri.joinPath(root, '.claude'));
  const hasClaudeMd = await pathExists(vscode.Uri.joinPath(root, 'CLAUDE.md'));

  if (hasClaudeDir || hasClaudeMd) {
    results.push({ tool: 'claude-code', confidence: 'high' });
  } else {
    // Claude Code low confidence: .claude/settings.json without the directory.
    // Note: On real filesystems .claude/settings.json implies .claude/ exists (triggering high
    // confidence above). This branch is defensive/spec-aligned for edge cases (e.g., virtual FS).
    const hasClaudeSettings = await pathExists(vscode.Uri.joinPath(root, '.claude', 'settings.json'));
    if (hasClaudeSettings) {
      results.push({ tool: 'claude-code', confidence: 'low' });
    }
  }

  return results;
}
