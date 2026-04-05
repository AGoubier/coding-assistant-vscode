import * as vscode from 'vscode';
import type { GitHubTreeEntry, NewContentResult } from '../models/types';

/**
 * Deduplicate skill paths: multiple files under the same skill root directory
 * (e.g., .github/skills/my-skill/) collapse to a single representative path.
 * Non-skill paths pass through unchanged.
 */
function deduplicateSkillPaths(paths: string[]): string[] {
  const seenSkillDirs = new Set<string>();
  const result: string[] = [];
  for (const p of paths) {
    const segments = p.split('/');
    // Skill pattern: .github/skills/<skill-name>/...
    // Also handle templates/.github/skills/<skill-name>/...
    let offset = 0;
    if (segments[0]?.toLowerCase() === 'templates') {
      offset = 1;
    }
    if (
      segments.length >= offset + 4 &&
      segments[offset]?.toLowerCase() === '.github' &&
      segments[offset + 1]?.toLowerCase() === 'skills'
    ) {
      const dirKey = segments.slice(0, offset + 3).join('/');
      if (seenSkillDirs.has(dirKey)) {
        continue;
      }
      seenSkillDirs.add(dirKey);
    }
    result.push(p);
  }
  return result;
}

export class NewContentDetector {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  /**
   * Check for new/removed content in a source.
   * @param sourceKey Unique key for the source (url@branch) to prevent cross-branch contamination.
   * @param currentTree The current tree entries from the GitHub API.
   * @param truncated Whether the tree response was truncated.
   */
  async checkForNewContent(
    sourceKey: string,
    currentTree: GitHubTreeEntry[],
    truncated: boolean,
  ): Promise<NewContentResult> {
    if (truncated) {
      this.log.warn(`Truncated tree for ${sourceKey}, skipping new-content detection`);
      return { newPaths: [], removedPaths: [], sourceUrl: sourceKey };
    }

    const currentPaths = new Set(
      currentTree.filter(e => e.type === 'blob').map(e => e.path),
    );

    const baselineKeyStr = `newContent:seen:${sourceKey}`;
    const stored = this.globalState.get<string[]>(baselineKeyStr);

    if (!stored) {
      await this.globalState.update(baselineKeyStr, [...currentPaths]);
      this.log.info(`Baseline established for ${sourceKey}: ${currentPaths.size} items`);
      return { newPaths: [], removedPaths: [], sourceUrl: sourceKey };
    }

    const baselinePaths = new Set(stored);
    const rawNewPaths = [...currentPaths].filter(p => !baselinePaths.has(p));
    const rawRemovedPaths = [...baselinePaths].filter(p => !currentPaths.has(p));

    // Deduplicate skill paths so multiple files in the same skill count as 1
    const newPaths = deduplicateSkillPaths(rawNewPaths);
    const removedPaths = deduplicateSkillPaths(rawRemovedPaths);

    await this.globalState.update(`newContent:new:${sourceKey}`, newPaths);
    await this.globalState.update(`newContent:removed:${sourceKey}`, removedPaths);
    await this.globalState.update(baselineKeyStr, [...currentPaths]);

    if (newPaths.length > 0 || removedPaths.length > 0) {
      this.log.info(
        `New content detected: ${newPaths.length} new items, ${removedPaths.length} removed items in ${sourceKey}`,
      );
    }

    return { newPaths, removedPaths, sourceUrl: sourceKey };
  }

  getNewItems(sourceKey: string): string[] {
    return this.globalState.get<string[]>(`newContent:new:${sourceKey}`) ?? [];
  }

  getRemovedItems(sourceKey: string): string[] {
    return this.globalState.get<string[]>(`newContent:removed:${sourceKey}`) ?? [];
  }

  async markCategorySeen(sourceKey: string, categoryPaths: string[]): Promise<void> {
    const key = `newContent:new:${sourceKey}`;
    const current = this.globalState.get<string[]>(key) ?? [];
    const toRemove = new Set(categoryPaths);
    const updated = current.filter(p => !toRemove.has(p));
    await this.globalState.update(key, updated);
    this.log.debug(`Mark seen: ${categoryPaths.length} items in ${sourceKey}`);
  }

  async markAllSeen(): Promise<void> {
    const keys = this.globalState.keys();
    let cleared = 0;
    for (const key of keys) {
      if (key.startsWith('newContent:new:') || key.startsWith('newContent:removed:')) {
        await this.globalState.update(key, undefined);
        cleared++;
      }
    }
    this.log.debug(`Mark all seen: cleared ${cleared} keys`);
  }

  getTotalNewCount(): number {
    return this.globalState.keys()
      .filter(k => k.startsWith('newContent:new:'))
      .reduce((sum, k) => sum + (this.globalState.get<string[]>(k)?.length ?? 0), 0);
  }

  getTotalRemovedCount(): number {
    return this.globalState.keys()
      .filter(k => k.startsWith('newContent:removed:'))
      .reduce((sum, k) => sum + (this.globalState.get<string[]>(k)?.length ?? 0), 0);
  }
}
