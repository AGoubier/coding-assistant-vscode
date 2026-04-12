import * as assert from 'assert';
import { detectFolders, groupByFolder } from '../../src/services/toolDetector';
import { formatFolderName, stripFolderPrefix } from '../../src/utils/pathUtils';
import type { GitHubTreeEntry } from '../../src/models/types';

/** Helper to build a minimal GitHubTreeEntry from a path string. */
function entry(path: string, type: 'blob' | 'tree' = 'blob'): GitHubTreeEntry {
  return { path, mode: '100644', type, sha: 'abc123', url: `https://api.github.com/repos/o/r/git/blobs/abc123` };
}

describe('folderDetection', () => {

  // =========================================================================
  // detectFolders
  // =========================================================================
  describe('detectFolders', () => {

    // --- US-01 Scenario 1: Discover folders from structural markers ---
    it('should detect multiple folders with .github and .claude markers', () => {
      const entries = [
        entry('frontend-team/.github/agents/helper.agent.md'),
        entry('frontend-team/.github/prompts/review.prompt.md'),
        entry('backend-team/.claude/commands/review.md'),
        entry('.github/agents/root.agent.md'),
      ];
      const result = detectFolders(entries);
      const names = result.map(r => r.folderName).sort();
      assert.deepStrictEqual(names, ['backend-team', 'frontend-team']);
    });

    // --- US-01 Scenario 2: No folders yields empty ---
    it('should return empty when no folders exist (root-level only)', () => {
      const entries = [
        entry('.github/agents/helper.agent.md'),
        entry('.claude/commands/review.md'),
        entry('README.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });

    // --- US-01 Scenario 4: First-level depth only ---
    it('should detect only first-level folder even with nested markers', () => {
      const entries = [
        entry('team-a/subproject/.github/agents/x.md'),
        entry('team-a/.github/agents/y.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].folderName, 'team-a');
    });

    // --- US-01 Scenario 5: Ignore directories without markers ---
    it('should not detect folders without .github or .claude markers', () => {
      const entries = [
        entry('docs/README.md'),
        entry('docs/guide.md'),
        entry('src/index.ts'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });

    // --- US-01 Scenario 6: Case-insensitive markers ---
    it('should detect folders with mixed-case .GitHub marker', () => {
      const entries = [
        entry('team/.GitHub/agents/x.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].folderName, 'team');
    });

    it('should detect folders with mixed-case .CLAUDE marker', () => {
      const entries = [
        entry('team/.Claude/commands/x.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].folderName, 'team');
    });

    // --- US-01 Edge Case 1: Empty array ---
    it('should return empty for empty entries array', () => {
      const result = detectFolders([]);
      assert.strictEqual(result.length, 0);
    });

    // --- US-01 Edge Case 3: Pure function (repeated calls) ---
    it('should produce identical results on repeated calls', () => {
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('team-b/.claude/commands/y.md'),
      ];
      const first = detectFolders(entries);
      const second = detectFolders(entries);
      assert.deepStrictEqual(
        first.map(r => r.folderName).sort(),
        second.map(r => r.folderName).sort(),
      );
    });

    // --- FR-001/FR-002: Marker must be directly under first-level dir ---
    it('should not detect folder when .github is not directly under first segment', () => {
      // a/b/.github/... -> .github is at segments[2], not segments[1], so "a" does NOT qualify
      const entries = [
        entry('a/b/.github/agents/x.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });

    // --- Single entry ---
    it('should detect a folder from a single entry', () => {
      const entries = [
        entry('my-team/.github/agents/x.agent.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].folderName, 'my-team');
    });

    // --- Many folders (10+) ---
    it('should handle many folders (10+)', () => {
      const entries: GitHubTreeEntry[] = [];
      for (let i = 0; i < 12; i++) {
        entries.push(entry(`folder-${i}/.github/agents/agent.md`));
      }
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 12);
    });

    // --- Collected entries per folder ---
    it('should collect correct entries per folder', () => {
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('team-a/.github/prompts/y.prompt.md'),
        entry('team-b/.claude/commands/z.md'),
        entry('.github/agents/root.agent.md'),
      ];
      const result = detectFolders(entries);
      const teamA = result.find(r => r.folderName === 'team-a');
      const teamB = result.find(r => r.folderName === 'team-b');
      assert.ok(teamA, 'team-a folder should exist');
      assert.strictEqual(teamA.entries.length, 2);
      assert.ok(teamB, 'team-b folder should exist');
      assert.strictEqual(teamB.entries.length, 1);
    });

    // --- isDefault should be false for detected folders ---
    it('should set isDefault to false for all detected folders', () => {
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('team-b/.claude/commands/y.md'),
      ];
      const result = detectFolders(entries);
      for (const r of result) {
        assert.strictEqual(r.isDefault, false);
      }
    });

    // --- Root-level .github/.claude entries are skipped ---
    it('should not treat root-level .github as a folder', () => {
      const entries = [
        entry('.github/agents/x.md'),
        entry('.github/prompts/y.prompt.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });

    it('should not treat root-level .claude as a folder', () => {
      const entries = [
        entry('.claude/commands/x.md'),
        entry('.claude/rules/y.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });

    // --- Case-sensitive folder names ---
    it('should preserve folder name case exactly', () => {
      const entries = [
        entry('MyTeam/.github/agents/x.md'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result[0].folderName, 'MyTeam');
    });

    // --- Single-segment paths are ignored ---
    it('should skip entries with only one segment (no subfolder)', () => {
      const entries = [
        entry('README.md'),
        entry('LICENSE'),
      ];
      const result = detectFolders(entries);
      assert.strictEqual(result.length, 0);
    });
  });

  // =========================================================================
  // groupByFolder
  // =========================================================================
  describe('groupByFolder', () => {

    it('should group entries by folder name', () => {
      const folders = new Set(['team-a', 'team-b']);
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('team-a/.github/prompts/y.prompt.md'),
        entry('team-b/.claude/commands/z.md'),
      ];
      const result = groupByFolder(entries, folders);
      assert.strictEqual(result.get('team-a')?.length, 2);
      assert.strictEqual(result.get('team-b')?.length, 1);
    });

    // FR-006: Root-level entries grouped under ""
    it('should group root-level .github entries under empty string key', () => {
      const folders = new Set(['team-a']);
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('.github/agents/root.agent.md'),
        entry('.github/prompts/root.prompt.md'),
      ];
      const result = groupByFolder(entries, folders);
      assert.strictEqual(result.get('')?.length, 2);
      assert.strictEqual(result.get('team-a')?.length, 1);
    });

    it('should group root-level .claude entries under empty string key', () => {
      const folders = new Set<string>();
      const entries = [
        entry('.claude/commands/x.md'),
        entry('.claude/rules/y.md'),
      ];
      const result = groupByFolder(entries, folders);
      assert.strictEqual(result.get('')?.length, 2);
    });

    // Entries not matching any folder and not root-level are excluded
    it('should exclude entries not matching any folder and not root-level', () => {
      const folders = new Set(['team-a']);
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('docs/README.md'),
        entry('src/index.ts'),
      ];
      const result = groupByFolder(entries, folders);
      assert.strictEqual(result.get('team-a')?.length, 1);
      assert.strictEqual(result.has('docs'), false);
      assert.strictEqual(result.has('src'), false);
    });

    // Empty entries
    it('should return empty map for empty entries', () => {
      const result = groupByFolder([], new Set(['team-a']));
      assert.strictEqual(result.size, 0);
    });

    // Empty folders set
    it('should only contain root-level group when folders set is empty', () => {
      const entries = [
        entry('.github/agents/x.md'),
        entry('random/file.md'),
      ];
      const result = groupByFolder(entries, new Set());
      assert.strictEqual(result.get('')?.length, 1);
      assert.strictEqual(result.size, 1);
    });

    // Case-insensitive .github/.claude grouping for root
    it('should handle case-insensitive root .GitHub entries', () => {
      const folders = new Set<string>();
      const entries = [
        entry('.GitHub/agents/x.md'),
      ];
      const result = groupByFolder(entries, folders);
      assert.strictEqual(result.get('')?.length, 1);
    });

    // Pure function
    it('should be a pure function with no side effects', () => {
      const folders = new Set(['team-a']);
      const entries = [
        entry('team-a/.github/agents/x.md'),
        entry('.github/agents/root.md'),
      ];
      const before = entries.length;
      groupByFolder(entries, folders);
      assert.strictEqual(entries.length, before);
    });

    // Many folders
    it('should handle many folders (10+)', () => {
      const folderNames: string[] = [];
      const entries: GitHubTreeEntry[] = [];
      for (let i = 0; i < 12; i++) {
        folderNames.push(`folder-${i}`);
        entries.push(entry(`folder-${i}/.github/agents/x.md`));
      }
      const result = groupByFolder(entries, new Set(folderNames));
      assert.strictEqual(result.size, 12);
    });
  });

  // =========================================================================
  // formatFolderName
  // =========================================================================
  describe('formatFolderName', () => {

    // FR-008: Basic dash replacement + title case
    it('should replace dashes with spaces and title case', () => {
      assert.strictEqual(formatFolderName('frontend-team'), 'Frontend Team');
    });

    // FR-008: Underscore replacement + title case
    it('should replace underscores with spaces and title case', () => {
      assert.strictEqual(formatFolderName('backend_team'), 'Backend Team');
    });

    // FR-008: Mixed separators
    it('should handle mixed dashes and underscores', () => {
      assert.strictEqual(formatFolderName('my-cool_project'), 'My Cool Project');
    });

    // FR-008: All-caps handling
    it('should convert ALLCAPS to title case', () => {
      assert.strictEqual(formatFolderName('ALLCAPS'), 'Allcaps');
    });

    // FR-008: Single word
    it('should title case a single word', () => {
      assert.strictEqual(formatFolderName('singleword'), 'Singleword');
    });

    // FR-008: Already title case
    it('should handle already properly cased input', () => {
      assert.strictEqual(formatFolderName('MyTeam'), 'Myteam');
    });

    // FR-008: Empty result fallback
    it('should return raw name when result would be empty (separator-only)', () => {
      assert.strictEqual(formatFolderName('---'), '---');
    });

    it('should return raw name when result would be empty (underscores only)', () => {
      assert.strictEqual(formatFolderName('___'), '___');
    });

    // Edge: empty string
    it('should return raw name for empty string', () => {
      assert.strictEqual(formatFolderName(''), '');
    });

    // Edge: single character
    it('should title case a single character', () => {
      assert.strictEqual(formatFolderName('a'), 'A');
    });

    // Edge: numbers in name
    it('should handle names with numbers', () => {
      assert.strictEqual(formatFolderName('team-42'), 'Team 42');
    });

    // Edge: trailing/leading separators
    it('should trim whitespace from result', () => {
      assert.strictEqual(formatFolderName('-team-'), 'Team');
    });

    // Edge: mixed case with separators
    it('should normalize mixed case with separators', () => {
      assert.strictEqual(formatFolderName('MY-cool-PROJECT'), 'My Cool Project');
    });

    // Edge: consecutive separators
    it('should handle consecutive separators', () => {
      assert.strictEqual(formatFolderName('a--b__c'), 'A  B  C');
    });
  });

  // =========================================================================
  // stripFolderPrefix
  // =========================================================================
  describe('stripFolderPrefix', () => {

    // FR-010: Strip matching folder prefix
    it('should strip folder prefix when first segment matches', () => {
      const folders = new Set(['frontend-team']);
      assert.strictEqual(
        stripFolderPrefix('frontend-team/.github/agents/x.md', folders),
        '.github/agents/x.md',
      );
    });

    // FR-011: Root-level path unchanged
    it('should return root-level path unchanged', () => {
      const folders = new Set(['frontend-team']);
      assert.strictEqual(
        stripFolderPrefix('.github/agents/x.md', folders),
        '.github/agents/x.md',
      );
    });

    // FR-018: templates folder handled like any other folder
    it('should strip templates prefix when templates is in folders set', () => {
      const folders = new Set(['templates']);
      assert.strictEqual(
        stripFolderPrefix('templates/.github/agents/x.md', folders),
        '.github/agents/x.md',
      );
    });

    // Non-matching first segment
    it('should return path unchanged when first segment not in folders', () => {
      const folders = new Set(['frontend-team']);
      assert.strictEqual(
        stripFolderPrefix('other-team/.github/agents/x.md', folders),
        'other-team/.github/agents/x.md',
      );
    });

    // Empty folders set
    it('should return path unchanged with empty folders set', () => {
      assert.strictEqual(
        stripFolderPrefix('a/b/c', new Set()),
        'a/b/c',
      );
    });

    // Single segment path (no slash)
    it('should return single-segment path unchanged', () => {
      const folders = new Set(['README.md']);
      assert.strictEqual(
        stripFolderPrefix('README.md', folders),
        'README.md',
      );
    });

    // Multiple segments after strip
    it('should return all remaining segments after stripping prefix', () => {
      const folders = new Set(['team']);
      assert.strictEqual(
        stripFolderPrefix('team/.github/agents/sub/deep.md', folders),
        '.github/agents/sub/deep.md',
      );
    });

    // Case-sensitive matching
    it('should be case-sensitive for folder name matching', () => {
      const folders = new Set(['Team']);
      assert.strictEqual(
        stripFolderPrefix('team/.github/agents/x.md', folders),
        'team/.github/agents/x.md',
      );
    });

    // Edge: path with only folder name and one segment
    it('should strip prefix leaving single remaining segment', () => {
      const folders = new Set(['team']);
      assert.strictEqual(
        stripFolderPrefix('team/CLAUDE.md', folders),
        'CLAUDE.md',
      );
    });

    // Edge: empty string path
    it('should return empty string for empty path', () => {
      assert.strictEqual(
        stripFolderPrefix('', new Set(['team'])),
        '',
      );
    });
  });
});
