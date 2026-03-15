import * as assert from 'assert';
import {
  validatePath,
  getTargetPath,
  getTargetDirectory,
  parseGitHubUrl,
  isAllowedDomain,
  classifyPath,
} from '../../src/utils/pathUtils';

describe('pathUtils', () => {
  describe('validatePath', () => {
    it('should accept a normal relative path', () => {
      assert.strictEqual(validatePath('.github/agents/my-agent.md'), true);
    });

    it('should accept a nested path', () => {
      assert.strictEqual(validatePath('src/services/githubClient.ts'), true);
    });

    it('should reject paths with .. traversal', () => {
      assert.strictEqual(validatePath('../etc/passwd'), false);
    });

    it('should reject paths with mid-path .. traversal', () => {
      assert.strictEqual(validatePath('a/b/../../../etc/passwd'), false);
    });

    it('should reject absolute Unix paths', () => {
      assert.strictEqual(validatePath('/etc/passwd'), false);
    });

    it('should reject absolute Windows paths', () => {
      assert.strictEqual(validatePath('C:\\Users\\test'), false);
    });

    it('should reject paths with null bytes', () => {
      assert.strictEqual(validatePath('file\0.txt'), false);
    });

    it('should reject empty paths', () => {
      assert.strictEqual(validatePath(''), false);
    });

    it('should reject encoded traversal patterns', () => {
      assert.strictEqual(validatePath('%2e%2e/etc/passwd'), false);
    });

    it('should accept a simple filename', () => {
      assert.strictEqual(validatePath('file.txt'), true);
    });
  });

  describe('getTargetDirectory', () => {
    it('should return correct path for copilot agents', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'agents'), '.github/agents');
    });

    it('should return correct path for copilot instructions', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'instructions'), '.github/instructions');
    });

    it('should return correct path for copilot skills', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'skills'), '.github/skills');
    });

    it('should return correct path for copilot prompts', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'prompts'), '.github/prompts');
    });

    it('should return correct path for copilot hooks', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'hooks'), '.github/hooks');
    });

    it('should return correct path for copilot modes (chatmodes)', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'modes'), '.github/chatmodes');
    });

    it('should return correct path for claude-code agents', () => {
      assert.strictEqual(getTargetDirectory('claude-code', 'agents'), '.claude/agents');
    });

    it('should return correct path for claude-code rules', () => {
      assert.strictEqual(getTargetDirectory('claude-code', 'rules'), '.claude/rules');
    });

    it('should return correct path for claude-code commands', () => {
      assert.strictEqual(getTargetDirectory('claude-code', 'commands'), '.claude/commands');
    });

    it('should return undefined for unknown tool', () => {
      assert.strictEqual(getTargetDirectory('unknown-tool', 'agents'), undefined);
    });

    it('should return undefined for unmapped category', () => {
      assert.strictEqual(getTargetDirectory('copilot', 'bundles'), undefined);
    });
  });

  describe('getTargetPath', () => {
    it('should return full path for copilot agent file', () => {
      assert.strictEqual(getTargetPath('copilot', 'agents', 'my-agent.md'), '.github/agents/my-agent.md');
    });

    it('should return full path for claude-code rule', () => {
      assert.strictEqual(getTargetPath('claude-code', 'rules', 'style.md'), '.claude/rules/style.md');
    });

    it('should return undefined for unmapped combination', () => {
      assert.strictEqual(getTargetPath('unknown', 'agents', 'file.md'), undefined);
    });
  });

  describe('parseGitHubUrl', () => {
    it('should parse a standard GitHub URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    it('should parse a GitHub URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      assert.deepStrictEqual(result, { owner: 'owner', repo: 'repo' });
    });

    it('should return undefined for non-GitHub URL', () => {
      assert.strictEqual(parseGitHubUrl('https://gitlab.com/owner/repo'), undefined);
    });

    it('should return undefined for invalid URL', () => {
      assert.strictEqual(parseGitHubUrl('not-a-url'), undefined);
    });

    it('should return undefined for GitHub URL with extra path segments', () => {
      assert.strictEqual(parseGitHubUrl('https://github.com/owner/repo/tree/main'), undefined);
    });

    it('should return undefined for HTTP (non-HTTPS)', () => {
      assert.strictEqual(parseGitHubUrl('http://github.com/owner/repo'), undefined);
    });
  });

  describe('isAllowedDomain', () => {
    it('should allow github.com', () => {
      assert.strictEqual(isAllowedDomain('https://github.com/owner/repo'), true);
    });

    it('should allow api.github.com', () => {
      assert.strictEqual(isAllowedDomain('https://api.github.com/repos/owner/repo'), true);
    });

    it('should allow raw.githubusercontent.com', () => {
      assert.strictEqual(isAllowedDomain('https://raw.githubusercontent.com/owner/repo/main/file.md'), true);
    });

    it('should reject other domains', () => {
      assert.strictEqual(isAllowedDomain('https://evil.com/hack'), false);
    });

    it('should reject HTTP (non-HTTPS)', () => {
      assert.strictEqual(isAllowedDomain('http://github.com/owner/repo'), false);
    });

    it('should reject invalid URLs', () => {
      assert.strictEqual(isAllowedDomain('not-a-url'), false);
    });
  });

  describe('classifyPath', () => {
    it('should classify .github/agents/ as copilot agents', () => {
      const result = classifyPath('.github/agents/my-agent.md');
      assert.deepStrictEqual(result, { tool: 'copilot', category: 'agents' });
    });

    it('should classify .github/instructions/ as copilot instructions', () => {
      const result = classifyPath('.github/instructions/style.md');
      assert.deepStrictEqual(result, { tool: 'copilot', category: 'instructions' });
    });

    it('should classify .github/chatmodes/ as copilot modes', () => {
      const result = classifyPath('.github/chatmodes/analyze.json');
      assert.deepStrictEqual(result, { tool: 'copilot', category: 'modes' });
    });

    it('should classify .claude/agents/ as claude-code agents', () => {
      const result = classifyPath('.claude/agents/my-agent.md');
      assert.deepStrictEqual(result, { tool: 'claude-code', category: 'agents' });
    });

    it('should classify .claude/rules/ as claude-code rules', () => {
      const result = classifyPath('.claude/rules/style.md');
      assert.deepStrictEqual(result, { tool: 'claude-code', category: 'rules' });
    });

    it('should classify CLAUDE.md as claude-code rules', () => {
      const result = classifyPath('CLAUDE.md');
      assert.deepStrictEqual(result, { tool: 'claude-code', category: 'rules' });
    });

    it('should return undefined for unrecognized paths', () => {
      assert.strictEqual(classifyPath('src/main.ts'), undefined);
    });

    it('should handle Windows-style backslashes', () => {
      const result = classifyPath('.github\\agents\\my-agent.md');
      assert.deepStrictEqual(result, { tool: 'copilot', category: 'agents' });
    });
  });
});
