// Tool classification for file paths from repo trees
// Spec refs: FR-012 (path-based detection), FR-015 (tool badges)
// WP03 T03-02: classifyItem wraps classifyPath with 'unknown' fallback

import type { ToolClassification, CategoryType, ToolType } from '../models/types';

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

  // Claude Code patterns first (.claude/ prefix is unambiguous)
  if (segments[0] === '.claude' && segments.length >= 3) {
    const dir = segments[1];
    for (const pattern of CLAUDE_PATTERNS) {
      if (dir === pattern.dir) {
        return { tool: 'claude-code', category: pattern.category };
      }
    }
  }

  // Claude Code CLAUDE.md at root
  if (normalized === 'CLAUDE.md') {
    return { tool: 'claude-code', category: 'rules' };
  }

  // Claude Code .claude/settings.json
  if (normalized === '.claude/settings.json') {
    return { tool: 'claude-code', category: 'rules' };
  }

  // Copilot patterns: .github/{category}/...
  if (segments[0] === '.github' && segments.length >= 3) {
    const dir = segments[1];
    for (const pattern of COPILOT_PATTERNS) {
      if (dir === pattern.dir) {
        // If pattern requires specific extensions, check them
        if (pattern.extensions) {
          const filename = segments[segments.length - 1];
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

  return { tool: 'unknown' as ToolType, category: 'unknown' as CategoryType };
}
