// Shared test mock helpers

import * as vscode from 'vscode';

export interface MockMemento extends vscode.Memento {
  _data: Record<string, unknown>;
}

export function createMockMemento(): MockMemento {
  const data: Record<string, unknown> = {};
  return {
    _data: data,
    keys: () => Object.keys(data),
    get<T>(key: string, defaultValue?: T): T {
      return (data[key] as T) ?? (defaultValue as T);
    },
    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) {
        delete data[key];
      } else {
        data[key] = value;
      }
    },
  };
}

export interface MockSecretStorage extends vscode.SecretStorage {
  _data: Record<string, string>;
}

export function createMockSecretStorage(): MockSecretStorage {
  const data: Record<string, string> = {};
  const emitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  return {
    _data: data,
    onDidChange: emitter.event,
    get: async (key: string): Promise<string | undefined> => {
      return data[key];
    },
    store: async (key: string, value: string): Promise<void> => {
      data[key] = value;
    },
    delete: async (key: string): Promise<void> => {
      delete data[key];
    },
    keys: async (): Promise<string[]> => {
      return Object.keys(data);
    },
  };
}

export interface MockLogOutputChannel extends vscode.LogOutputChannel {
  messages: { level: string; message: string }[];
}

export function createMockLogOutputChannel(): MockLogOutputChannel {
  const messages: { level: string; message: string }[] = [];
  return {
    messages,
    name: 'Test',
    logLevel: vscode.LogLevel.Trace,
    onDidChangeLogLevel: new vscode.EventEmitter<vscode.LogLevel>().event,
    trace: (message: string) => { messages.push({ level: 'trace', message }); },
    debug: (message: string) => { messages.push({ level: 'debug', message }); },
    info: (message: string) => { messages.push({ level: 'info', message }); },
    warn: (message: string) => { messages.push({ level: 'warn', message }); },
    error: (message: string | Error) => { messages.push({ level: 'error', message: String(message) }); },
    append: () => { /* no-op */ },
    appendLine: () => { /* no-op */ },
    clear: () => { /* no-op */ },
    show: () => { /* no-op */ },
    hide: () => { /* no-op */ },
    replace: () => { /* no-op */ },
    dispose: () => { /* no-op */ },
  } as MockLogOutputChannel;
}

export function createMockExtensionContext(
  globalState?: MockMemento,
  secrets?: MockSecretStorage,
): vscode.ExtensionContext {
  return {
    globalState: globalState || createMockMemento(),
    secrets: secrets || createMockSecretStorage(),
    subscriptions: [],
  } as unknown as vscode.ExtensionContext;
}
