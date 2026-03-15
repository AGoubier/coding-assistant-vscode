// E2E test helpers - shared setup for integration/E2E tests
// WP07 T07-01

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { SourceConfig } from '../../src/models/types.js';

// --- Fixture loading ---

const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');

export function loadFixture(relativePath: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8');
}

export function loadJsonFixture<T>(relativePath: string): T {
  return JSON.parse(loadFixture(relativePath)) as T;
}

// --- Fetch mock for E2E tests ---

export interface MockRoute {
  url: string | RegExp;
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export class FetchMocker {
  private routes: MockRoute[] = [];
  private originalFetch: typeof global.fetch;
  private callLog: { url: string; init?: RequestInit }[] = [];

  constructor() {
    this.originalFetch = global.fetch;
  }

  addRoute(route: MockRoute): this {
    this.routes.push(route);
    return this;
  }

  addJsonRoute(url: string | RegExp, status: number, body: unknown, headers?: Record<string, string>): this {
    return this.addRoute({
      url,
      status,
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers },
    });
  }

  getCalls(): { url: string; init?: RequestInit }[] {
    return [...this.callLog];
  }

  getCallsTo(urlPattern: string | RegExp): { url: string; init?: RequestInit }[] {
    return this.callLog.filter(c => {
      if (typeof urlPattern === 'string') {
        return c.url.includes(urlPattern);
      }
      return urlPattern.test(c.url);
    });
  }

  install(): void {
    this.callLog = [];
    const self = this;

    global.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      self.callLog.push({ url, init });

      for (const route of self.routes) {
        const match = typeof route.url === 'string'
          ? url === route.url || url.includes(route.url)
          : route.url.test(url);

        if (match) {
          const headerMap = new Map<string, string>();
          if (route.headers) {
            for (const [k, v] of Object.entries(route.headers)) {
              headerMap.set(k.toLowerCase(), v);
            }
          }

          return {
            ok: route.status >= 200 && route.status < 300,
            status: route.status,
            headers: {
              get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
              forEach: (cb: (value: string, key: string) => void) => {
                headerMap.forEach((v, k) => cb(v, k));
              },
            },
            text: async () => route.body,
            json: async () => JSON.parse(route.body),
          } as unknown as Response;
        }
      }

      throw new Error(`FetchMocker: no match for ${url}`);
    }) as typeof global.fetch;
  }

  restore(): void {
    global.fetch = this.originalFetch;
    this.callLog = [];
  }
}

// --- Temp workspace helpers ---

export function createTempFolder(): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file('/e2e-workspace'),
    name: 'e2e-test',
    index: 0,
  };
}

export const E2E_SOURCE: SourceConfig = {
  url: 'https://github.com/test/repo',
  name: 'E2E Test Repo',
  branch: 'main',
};
