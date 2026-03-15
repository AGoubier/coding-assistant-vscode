// Token management commands: addToken, removeToken
// Spec refs: FR-036, FR-037, Section 8.1

import * as vscode from 'vscode';
import type { AuthManager } from '../services/authManager';

export async function addTokenCommand(auth: AuthManager): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Enter a name for this token',
    placeHolder: 'e.g., my-github-token',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Token name is required';
      }
      if (!/^[a-zA-Z0-9-]+$/.test(value)) {
        return 'Token name must be alphanumeric with hyphens only';
      }
      return undefined;
    },
  });

  if (!name) {
    return; // User cancelled
  }

  const token = await vscode.window.showInputBox({
    prompt: 'Enter your GitHub personal access token',
    password: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Token value is required';
      }
      return undefined;
    },
  });

  if (!token) {
    return; // User cancelled
  }

  await auth.storeToken(name.trim(), token.trim());
  await vscode.window.showInformationMessage(`Token '${name.trim()}' stored successfully`);
}

export async function removeTokenCommand(auth: AuthManager): Promise<void> {
  const names = auth.listTokenNames();

  if (names.length === 0) {
    await vscode.window.showInformationMessage('No tokens stored');
    return;
  }

  const selected = await vscode.window.showQuickPick(names, {
    placeHolder: 'Select token to remove',
  });

  if (!selected) {
    return; // User cancelled
  }

  await auth.deleteToken(selected);
  await vscode.window.showInformationMessage(`Token '${selected}' removed`);
}
