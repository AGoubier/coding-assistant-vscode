// Shared TypeScript interfaces and type aliases
// Spec refs: Section 7 (Data Models), Section 4.2, 4.5, 4.6

import type { WorkspaceFolder } from 'vscode';

// --- Category and Tool types ---

export type CategoryType =
  | 'agents'
  | 'instructions'
  | 'skills'
  | 'prompts'
  | 'hooks'
  | 'commands'
  | 'rules'
  | 'modes'
  | 'plugins'
  | 'workflows'
  | 'bundles'
  | 'unknown';

export type ToolType = 'copilot' | 'claude-code' | 'kiro' | 'kilocode' | 'opencode' | 'unknown';

// --- Source configuration (from VS Code settings) - Section 7.3 ---

export interface SourceConfig {
  url: string;
  name: string;
  branch?: string;
  authTokenKey?: string;
}

// --- Master Index - Section 7.1, 7.2 ---

export interface SourceEntry {
  url: string;
  name: string;
  description?: string;
  branch?: string;
  categories?: string[];
  tools?: string[];
  private?: boolean;
}

export interface MasterIndex {
  $schema?: string;
  version: string;
  sources: SourceEntry[];
}

// --- Installation Manifest - Section 7.4, 7.5 ---

/**
 * Build a unique installation entry ID that includes the branch.
 * Format: `url@branch#path`
 * This prevents collisions when the same repo is configured on multiple branches.
 */
export function installationId(sourceUrl: string, branch: string | undefined, itemPath: string): string {
  return `${sourceUrl}@${branch || 'main'}#${itemPath}`;
}

export interface InstallationEntry {
  id: string;
  sourceUrl: string;
  sourceBranch: string;
  itemPath: string;
  targetPaths: string[];
  tool: string;
  category: string;
  commitSha: string;
  installedAt: string;
  updatedAt?: string;
}

export interface Manifest {
  version: string;
  installations: InstallationEntry[];
}

// --- Cache - Section 7.6 ---

export interface CacheEntry {
  key: string;
  body: string;
  etag?: string;
  timestamp: number;
}

// --- Catalog tree items (discriminated union) ---

export interface SourceItem {
  kind: 'source';
  source: SourceConfig;
}

export interface CategoryItem {
  kind: 'category';
  source: SourceConfig;
  category: CategoryType;
  tool: ToolType;
  filteredCount?: number;
}

export interface CatalogFileItem {
  kind: 'item';
  source: SourceConfig;
  path: string;
  name: string;
  tool: ToolType;
  category: CategoryType;
  installed: boolean;
  updateAvailable: boolean;
  description?: string;
  isNew?: boolean;
  isRemoved?: boolean;
}

export interface FolderItem {
  kind: 'folder';
  source: SourceConfig;
  folderName: string;
  displayName: string;
  isDefault: boolean;
}

export type CatalogItem = SourceItem | CategoryItem | CatalogFileItem | FolderItem;

export interface FolderDetectionResult {
  folderName: string;
  isDefault: boolean;
  entries: GitHubTreeEntry[];
}

// --- Tool detection ---

export interface DetectedTool {
  tool: 'copilot' | 'claude-code';
  confidence: 'high' | 'low';
}

export interface ToolClassification {
  tool: ToolType;
  category: CategoryType;
}

// --- Operation results ---

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface InstallResult {
  success: boolean;
  filesWritten: string[];
  error?: string;
}

export interface UpdateCheckResult {
  entry: InstallationEntry;
  hasUpdate: boolean;
  latestSha: string;
  folder: WorkspaceFolder;
}

export interface NewContentResult {
  newPaths: string[];
  removedPaths: string[];
  sourceUrl: string;
}

// --- GitHub API response types ---

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface GitHubCommit {
  sha: string;
  url: string;
}

// --- Bundle types - Section 7.7, 7.8 (P2) ---

export interface BundleItem {
  path: string;
  sourceUrl?: string;
  tool: 'copilot' | 'claude-code';
  category: string;
  required?: boolean;
}

export interface Bundle {
  name: string;
  description?: string;
  items: BundleItem[];
}

// --- Bundle tree items ---

export interface BundleCategoryItem {
  kind: 'bundleCategory';
  source: SourceConfig;
}

export interface BundleNodeItem {
  kind: 'bundle';
  source: SourceConfig;
  bundle: Bundle;
  bundlePath: string;
}

export interface BundleFileItem {
  kind: 'bundleFile';
  source: SourceConfig;
  bundleItem: BundleItem;
  bundleName: string;
}
