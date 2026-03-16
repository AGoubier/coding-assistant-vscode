// Path utilities with traversal validation and target path computation
// Spec refs: FR-021, FR-027, Section 10.2 Security

import type { CategoryType, ToolType } from '../models/types';

/**
 * Normalize a path to use forward slashes only.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Validate a path is safe (no traversal, no absolute paths, no null bytes).
 * Returns true if the path is safe, false otherwise.
 */
export function validatePath(filePath: string): boolean {
  if (!filePath || filePath.length === 0) {
    return false;
  }

  // Reject null bytes
  if (filePath.includes('\0')) {
    return false;
  }

  const normalized = normalizePath(filePath);

  // Reject absolute paths (Unix or Windows drive letter)
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }

  // Reject path traversal segments
  const segments = normalized.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      return false;
    }
    // Check for encoded traversal patterns
    if (decodeURIComponent(segment) === '..') {
      return false;
    }
  }

  return true;
}

// Target directory mapping per FR-021
const TARGET_PATH_MAP: Record<string, Record<string, string>> = {
  'copilot': {
    'agents': '.github/agents',
    'instructions': '.github/instructions',
    'skills': '.github/skills',
    'prompts': '.github/prompts',
    'hooks': '.github/hooks',
    'modes': '.github/chatmodes',
  },
  'claude-code': {
    'agents': '.claude/agents',
    'rules': '.claude/rules',
    'commands': '.claude/commands',
    'hooks': '.claude/hooks',
  },
};

/**
 * Get the target workspace-relative directory for a tool/category combination.
 * Returns undefined if the combination is not mapped.
 */
export function getTargetDirectory(tool: string, category: CategoryType): string | undefined {
  const toolMap = TARGET_PATH_MAP[tool];
  if (!toolMap) {
    return undefined;
  }
  return toolMap[category];
}

/**
 * Get the full target path for installing an item.
 * Returns the workspace-relative path including the filename.
 */
export function getTargetPath(tool: string, category: CategoryType, filename: string): string | undefined {
  const dir = getTargetDirectory(tool, category);
  if (!dir) {
    return undefined;
  }
  return `${dir}/${filename}`;
}

/**
 * Parse a GitHub URL to extract owner and repo.
 * Accepts formats like https://github.com/owner/repo or https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | undefined {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!match) {
    return undefined;
  }
  return { owner: match[1], repo: match[2] };
}

const ALLOWED_DOMAINS = new Set([
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
]);

/**
 * Check if a URL's domain is in the allowed list (SSRF protection).
 */
export function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return ALLOWED_DOMAINS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Classify a file path from a repo tree into tool and category.
 * Returns undefined if the path does not match any known pattern.
 */
export function classifyPath(filePath: string): { tool: ToolType; category: CategoryType } | undefined {
  const normalized = normalizePath(filePath);
  const segments = normalized.split('/');

  // Copilot patterns: .github/{category}/...
  if (segments[0] === '.github' && segments.length >= 3) {
    const dir = segments[1];
    const copilotMap: Record<string, CategoryType> = {
      'agents': 'agents',
      'instructions': 'instructions',
      'skills': 'skills',
      'prompts': 'prompts',
      'hooks': 'hooks',
      'chatmodes': 'modes',
    };
    const category = copilotMap[dir];
    if (category) {
      return { tool: 'copilot', category };
    }
  }

  // Claude Code patterns: .claude/{category}/...
  if (segments[0] === '.claude' && segments.length >= 3) {
    const dir = segments[1];
    const claudeMap: Record<string, CategoryType> = {
      'agents': 'agents',
      'rules': 'rules',
      'commands': 'commands',
      'hooks': 'hooks',
    };
    const category = claudeMap[dir];
    if (category) {
      return { tool: 'claude-code', category };
    }
  }

  // Claude Code CLAUDE.md at root
  if (normalized === 'CLAUDE.md' || normalized === '.claude/CLAUDE.md') {
    return { tool: 'claude-code', category: 'rules' };
  }

  return undefined;
}
