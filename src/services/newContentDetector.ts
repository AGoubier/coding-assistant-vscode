import * as vscode from 'vscode';
import type { GitHubTreeEntry, NewContentResult } from '../models/types';

export class NewContentDetector {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  async checkForNewContent(
    sourceUrl: string,
    currentTree: GitHubTreeEntry[],
    truncated: boolean,
  ): Promise<NewContentResult> {
    if (truncated) {
      this.log.warn(`Truncated tree for ${sourceUrl}, skipping new-content detection`);
      return { newPaths: [], removedPaths: [], sourceUrl };
    }

    const currentPaths = new Set(
      currentTree.filter(e => e.type === 'blob').map(e => e.path),
    );

    const baselineKey = `newContent:seen:${sourceUrl}`;
    const stored = this.globalState.get<string[]>(baselineKey);

    if (!stored) {
      await this.globalState.update(baselineKey, [...currentPaths]);
      this.log.info(`Baseline established for ${sourceUrl}: ${currentPaths.size} items`);
      return { newPaths: [], removedPaths: [], sourceUrl };
    }

    const baselinePaths = new Set(stored);
    const newPaths = [...currentPaths].filter(p => !baselinePaths.has(p));
    const removedPaths = [...baselinePaths].filter(p => !currentPaths.has(p));

    await this.globalState.update(`newContent:new:${sourceUrl}`, newPaths);
    await this.globalState.update(`newContent:removed:${sourceUrl}`, removedPaths);
    await this.globalState.update(baselineKey, [...currentPaths]);

    if (newPaths.length > 0 || removedPaths.length > 0) {
      this.log.info(
        `New content detected: ${newPaths.length} new items, ${removedPaths.length} removed items in ${sourceUrl}`,
      );
    }

    return { newPaths, removedPaths, sourceUrl };
  }

  getNewItems(sourceUrl: string): string[] {
    return this.globalState.get<string[]>(`newContent:new:${sourceUrl}`) ?? [];
  }

  getRemovedItems(sourceUrl: string): string[] {
    return this.globalState.get<string[]>(`newContent:removed:${sourceUrl}`) ?? [];
  }

  async markCategorySeen(sourceUrl: string, categoryPaths: string[]): Promise<void> {
    const key = `newContent:new:${sourceUrl}`;
    const current = this.globalState.get<string[]>(key) ?? [];
    const toRemove = new Set(categoryPaths);
    const updated = current.filter(p => !toRemove.has(p));
    await this.globalState.update(key, updated);
    this.log.debug(`Mark seen: ${categoryPaths.length} items in ${sourceUrl}`);
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
