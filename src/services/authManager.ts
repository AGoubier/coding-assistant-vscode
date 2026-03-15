// Authentication manager wrapping VS Code SecretStorage
// Spec refs: FR-035 to FR-039, Section 10.2 Security

import * as vscode from 'vscode';
import type { SourceConfig } from '../models/types';

const TOKEN_NAMES_KEY = 'awesome-ca-token-names';

export class AuthManager {
  private readonly secrets: vscode.SecretStorage;
  private readonly globalState: vscode.Memento;
  private readonly log: vscode.LogOutputChannel;

  constructor(context: vscode.ExtensionContext, log: vscode.LogOutputChannel) {
    this.secrets = context.secrets;
    this.globalState = context.globalState;
    this.log = log;
  }

  async storeToken(name: string, token: string): Promise<void> {
    await this.secrets.store(name, token);
    const names = this.listTokenNames();
    if (!names.includes(name)) {
      names.push(name);
      await this.globalState.update(TOKEN_NAMES_KEY, names);
    }
    this.log.info(`Token stored: ${name}`);
  }

  async getToken(name: string): Promise<string | undefined> {
    return this.secrets.get(name);
  }

  async deleteToken(name: string): Promise<void> {
    await this.secrets.delete(name);
    const names = this.listTokenNames().filter((n) => n !== name);
    await this.globalState.update(TOKEN_NAMES_KEY, names);
    this.log.info(`Token removed: ${name}`);
  }

  listTokenNames(): string[] {
    return this.globalState.get<string[]>(TOKEN_NAMES_KEY, []);
  }

  async getAuthHeader(source: SourceConfig): Promise<Record<string, string> | undefined> {
    // Try configured PAT first
    if (source.authTokenKey) {
      const token = await this.getToken(source.authTokenKey);
      if (token) {
        return { Authorization: `token ${token}` };
      }
    }

    // Fall back to GitHub Auth provider
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], {
        createIfNone: false,
      });
      if (session) {
        return { Authorization: `token ${session.accessToken}` };
      }
    } catch {
      this.log.trace('GitHub Auth provider not available');
    }

    return undefined;
  }
}
