import * as assert from 'assert';
import { classifyItem } from '../../src/services/toolDetector';
import { stripFolderPrefix } from '../../src/utils/pathUtils';

describe('toolDetector', () => {
  describe('classifyItem', () => {
    // --- Copilot patterns ---

    describe('Copilot agents', () => {
      it('should classify .github/agents/foo.agent.md as copilot agent', () => {
        const result = classifyItem('.github/agents/foo.agent.md');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'agents');
      });

      it('should not classify .github/agents/README.md as copilot agent (wrong extension)', () => {
        const result = classifyItem('.github/agents/README.md');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    describe('Copilot instructions', () => {
      it('should classify .github/instructions/setup.instructions.md', () => {
        const result = classifyItem('.github/instructions/setup.instructions.md');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'instructions');
      });

      it('should not classify .github/instructions/README.md', () => {
        const result = classifyItem('.github/instructions/README.md');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    describe('Copilot skills', () => {
      it('should classify .github/skills/myskill/SKILL.md', () => {
        const result = classifyItem('.github/skills/myskill/SKILL.md');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'skills');
      });

      it('should classify .github/skills/myskill/helper.ts', () => {
        const result = classifyItem('.github/skills/myskill/helper.ts');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'skills');
      });
    });

    describe('Copilot prompts', () => {
      it('should classify .github/prompts/review.prompt.md', () => {
        const result = classifyItem('.github/prompts/review.prompt.md');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'prompts');
      });

      it('should not classify .github/prompts/notes.txt', () => {
        const result = classifyItem('.github/prompts/notes.txt');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    describe('Copilot hooks', () => {
      it('should classify .github/hooks/on-save.json', () => {
        const result = classifyItem('.github/hooks/on-save.json');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'hooks');
      });

      it('should not classify .github/hooks/pre-commit.sh (wrong extension)', () => {
        const result = classifyItem('.github/hooks/pre-commit.sh');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    describe('Copilot chatmodes/modes', () => {
      it('should classify .github/chatmodes/debug.yml', () => {
        const result = classifyItem('.github/chatmodes/debug.yml');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'modes');
      });
    });

    describe('Copilot plugins (not a Copilot customization)', () => {
      it('should not classify .github/plugins/myplugin/plugin.json', () => {
        const result = classifyItem('.github/plugins/myplugin/plugin.json');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    describe('Copilot workflows (GitHub Actions, not Copilot)', () => {
      it('should not classify .github/workflows/ci.yml', () => {
        const result = classifyItem('.github/workflows/ci.yml');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    // --- Claude Code patterns ---

    describe('Claude Code agents', () => {
      it('should classify .claude/agents/researcher.md', () => {
        const result = classifyItem('.claude/agents/researcher.md');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'agents');
      });
    });

    describe('Claude Code rules', () => {
      it('should classify .claude/rules/style.md', () => {
        const result = classifyItem('.claude/rules/style.md');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'rules');
      });
    });

    describe('Claude Code commands', () => {
      it('should classify .claude/commands/deploy.md', () => {
        const result = classifyItem('.claude/commands/deploy.md');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'commands');
      });
    });

    describe('Claude Code hooks', () => {
      it('should classify .claude/hooks/block-rm.sh', () => {
        const result = classifyItem('.claude/hooks/block-rm.sh');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'hooks');
      });
    });

    describe('CLAUDE.md', () => {
      it('should classify CLAUDE.md as claude-code rules', () => {
        const result = classifyItem('CLAUDE.md');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'rules');
      });
    });

    describe('.claude/settings.json', () => {
      it('should classify .claude/settings.json as claude-code rules', () => {
        const result = classifyItem('.claude/settings.json');
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'rules');
      });
    });

    // --- Unknown patterns ---

    describe('unknown patterns', () => {
      it('should return unknown for unrecognized paths', () => {
        const result = classifyItem('src/index.ts');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for README.md at root', () => {
        const result = classifyItem('README.md');
        assert.strictEqual(result.tool, 'unknown');
      });

      it('should return unknown for .github/dependabot.yml', () => {
        const result = classifyItem('.github/dependabot.yml');
        assert.strictEqual(result.tool, 'unknown');
      });

      it('should return unknown for .gitkeep placeholder files', () => {
        assert.strictEqual(classifyItem('.github/skills/.gitkeep').tool, 'unknown');
        assert.strictEqual(classifyItem('.github/agents/.gitkeep').tool, 'unknown');
        assert.strictEqual(classifyItem('.claude/rules/.gitkeep').tool, 'unknown');
      });

      it('should return unknown for .gitignore files inside categories', () => {
        assert.strictEqual(classifyItem('.github/skills/.gitignore').tool, 'unknown');
        assert.strictEqual(classifyItem('.github/prompts/.gitignore').tool, 'unknown');
      });
    });

    // --- Edge cases ---

    describe('edge cases', () => {
      it('should handle backslash paths', () => {
        const result = classifyItem('.github\\agents\\foo.agent.md');
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'agents');
      });

      it('should handle empty string', () => {
        const result = classifyItem('');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    // --- templates/ prefix stripping ---

    describe('templates prefix', () => {
      it('should return unknown for templates/.github/agents/ (caller must strip prefix)', () => {
        const result = classifyItem('templates/.github/agents/code-reviewer.agent.md');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for templates/.claude/commands/ (caller must strip prefix)', () => {
        const result = classifyItem('templates/.claude/commands/review.md');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for templates/.claude/rules/ (caller must strip prefix)', () => {
        const result = classifyItem('templates/.claude/rules/project-rules.md');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for templates/CLAUDE.md (caller must strip prefix)', () => {
        const result = classifyItem('templates/CLAUDE.md');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for templates/.github/chatmodes/ (caller must strip prefix)', () => {
        const result = classifyItem('templates/.github/chatmodes/debug.chatmode.md');
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should return unknown for templates/src/index.ts', () => {
        const result = classifyItem('templates/src/index.ts');
        assert.strictEqual(result.tool, 'unknown');
      });
    });

    // --- folder prefix stripping + classification ---

    describe('folder prefix stripping + classification', () => {
      const folders = new Set(['templates']);

      it('should classify templates/.github/agents/ after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/.github/agents/code-reviewer.agent.md', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'agents');
      });

      it('should classify templates/.claude/commands/ after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/.claude/commands/review.md', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'commands');
      });

      it('should classify templates/.claude/rules/ after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/.claude/rules/project-rules.md', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'rules');
      });

      it('should classify templates/CLAUDE.md after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/CLAUDE.md', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'claude-code');
        assert.strictEqual(result.category, 'rules');
      });

      it('should classify templates/.github/chatmodes/ after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/.github/chatmodes/debug.chatmode.md', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'copilot');
        assert.strictEqual(result.category, 'modes');
      });

      it('should return unknown for templates/src/index.ts even after stripping prefix', () => {
        const stripped = stripFolderPrefix('templates/src/index.ts', folders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });

      it('should not strip prefix when folder is not in the set', () => {
        const otherFolders = new Set(['other']);
        const stripped = stripFolderPrefix('templates/.github/agents/code-reviewer.agent.md', otherFolders);
        const result = classifyItem(stripped);
        assert.strictEqual(result.tool, 'unknown');
        assert.strictEqual(result.category, 'unknown');
      });
    });
  });
});
