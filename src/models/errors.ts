// Custom error classes for Awesome Coding Assistants
// Spec ref: Section 8.4 Error Codes

export class ExtensionError extends Error {
  public readonly code: string;
  public readonly userMessage: string;

  constructor(userMessage: string, code: string) {
    super(userMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.userMessage = userMessage;
  }
}

export class SourceUnreachableError extends ExtensionError {
  constructor(url: string, statusCode?: number) {
    const userMessage = `Unable to access repository: ${url}. Check the URL and authentication.`;
    super(userMessage, 'SOURCE_UNREACHABLE');
    this.message = statusCode
      ? `Source validation failed: ${url}, status: ${statusCode}`
      : `Source validation failed: ${url}`;
  }
}

export class AuthFailedError extends ExtensionError {
  constructor(repo: string, statusCode?: number) {
    const userMessage = `Authentication failed for ${repo}. Check your token.`;
    super(userMessage, 'AUTH_FAILED');
    this.message = statusCode
      ? `Auth failure for ${repo}: ${statusCode}`
      : `Auth failure for ${repo}`;
  }
}

export class RateLimitedError extends ExtensionError {
  public readonly resetAt: Date;

  constructor(resetTimestamp: number) {
    const resetAt = new Date(resetTimestamp * 1000);
    const userMessage = `GitHub API rate limit exceeded. Resets at ${resetAt.toLocaleTimeString()}. Consider adding a personal access token.`;
    super(userMessage, 'RATE_LIMITED');
    this.resetAt = resetAt;
    this.message = `Rate limited: resets at ${resetAt.toISOString()}`;
  }
}

export class PreviewFetchFailedError extends ExtensionError {
  constructor(path: string, detail?: string) {
    const userMessage = `Failed to fetch preview: ${detail || 'unknown error'}`;
    super(userMessage, 'PREVIEW_FETCH_FAILED');
    this.message = `Preview fetch error for ${path}: ${detail || 'unknown error'}`;
  }
}

export class InstallFailedError extends ExtensionError {
  constructor(name: string, detail?: string) {
    const userMessage = `Failed to install ${name}: ${detail || 'unknown error'}`;
    super(userMessage, 'INSTALL_FAILED');
    this.message = `Install error: ${name}, ${detail || 'unknown error'}`;
  }
}

export class InvalidPathError extends ExtensionError {
  constructor(path: string) {
    super('Invalid file path detected. Installation blocked for security.', 'INVALID_PATH');
    this.message = `Path traversal attempt: ${path}`;
  }
}

export class ManifestCorruptError extends ExtensionError {
  constructor(detail?: string) {
    super('Installation manifest was corrupted and has been reset.', 'MANIFEST_CORRUPT');
    this.message = `Manifest parse failed: ${detail || 'unknown error'}`;
  }
}

export class CacheError extends ExtensionError {
  constructor(detail: string) {
    // CacheError is silent to user
    super('', 'CACHE_ERROR');
    this.message = `Cache write failed: ${detail}`;
  }
}
