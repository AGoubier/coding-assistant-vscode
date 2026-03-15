import * as vscode from 'vscode';

let outputChannel: vscode.LogOutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Awesome Coding Assistants', { log: true });
  context.subscriptions.push(outputChannel);

  outputChannel.info('Extension activated');

  const commands: string[] = [
    'awesome-coding-assistants.refresh',
    'awesome-coding-assistants.preview',
    'awesome-coding-assistants.install',
    'awesome-coding-assistants.update',
    'awesome-coding-assistants.uninstall',
    'awesome-coding-assistants.checkUpdates',
    'awesome-coding-assistants.addToken',
    'awesome-coding-assistants.removeToken',
    'awesome-coding-assistants.clearCache',
    'awesome-coding-assistants.showAllTools',
  ];

  for (const commandId of commands) {
    const disposable = vscode.commands.registerCommand(commandId, () => {
      outputChannel.info(`Command ${commandId} not yet implemented`);
    });
    context.subscriptions.push(disposable);
  }

  outputChannel.info('All commands registered');
}

export function deactivate(): void {
  // No cleanup required
}
