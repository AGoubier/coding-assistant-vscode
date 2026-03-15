// Cache management command: clearCache
// Spec refs: FR-043, Section 8.1

import * as vscode from 'vscode';
import type { CacheManager } from '../services/cacheManager';

export async function clearCacheCommand(cache: CacheManager): Promise<void> {
  await cache.invalidate();
  await vscode.window.showInformationMessage('Cache cleared');
}
