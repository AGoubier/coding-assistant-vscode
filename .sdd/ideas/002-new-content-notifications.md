# Ideation Brief: New Content Notifications

## Problem Statement

When new agents, skills, prompts, instructions, hooks, modes, rules, or commands are added to remote source repositories declared in the master index (or user-configured sources), users have **no way to know** unless they manually browse the tree and notice new items. The current update detection system only tracks changes to **already-installed items** via commit SHA comparison. New content appearing upstream is invisible.

## Current State

### What works today

| Capability | Mechanism | Trigger |
|---|---|---|
| Installed item updates | SHA comparison (installed vs. latest commit) | Auto-check on activation (5s delay) + configurable interval (default 60 min) |
| Update badges | Tree item description + cloud-download icon | After `checkForUpdates()` completes |
| Update notification | `vscode.window.showInformationMessage` | When update count > 0 |
| Manual check | "Check for Updates" command | User-initiated |

### What does NOT work today

| Gap | Description |
|---|---|
| New item detection | A new `security-auditor.agent.md` added to a source repo produces zero signal |
| Source-level changes | A new source added to the master index goes unnoticed until the user restarts or refreshes |
| Category additions | A source gaining a new category (e.g., hooks added to a previously agent-only repo) is invisible |
| Removed item awareness | Items deleted upstream remain in the tree until cache clears; no "deprecated" signal |

## Existing Infrastructure to Build On

1. **`getRepoTree()` (GitHubClient)** - fetches full recursive tree with ETag caching; tree snapshots can be compared
2. **`CacheManager`** - ETag-based storage; can persist previous tree snapshots
3. **Manifest schema** - currently tracks installations; could be extended with a "seen items" registry
4. **Auto-check interval** - already runs periodically; new-content detection can piggyback
5. **Tree badges** - rendering pipeline supports custom descriptions and icons per item
6. **`showInformationMessage`** - notification API with action buttons

## Proposed Approaches

### Approach A: Tree Snapshot Diffing (Recommended)

**Concept**: On each auto-check cycle, compare the current repo tree against a stored previous snapshot. Surface new paths as "new" items.

**Flow**:
1. On first load (or after cache clear), store the full tree snapshot hash set (all classified paths)
2. On subsequent checks, fetch tree and diff against stored snapshot
3. New paths = items that exist now but did not exist in the stored snapshot
4. Surface these as:
   - "New" badge on tree items (e.g., `$(sparkle) new`)
   - Source-level count in the source node description (e.g., "3 new items")
   - Information message: "Awesome Coding Assistants: 3 new items in 2 sources"
5. Mark as "seen" when user expands the category or clicks the item
6. Persist the snapshot in extension global state (not workspace-level - new content is repo-level, not workspace-level)

**Storage**: 
```
globalState["treeSeen:{sourceUrl}"] = Set<string> of all known paths
```

**Pros**: Simple, leverages existing tree fetch, no extra API calls (ETag cache handles it), granular per-item  
**Cons**: First activation after install shows everything as "new" (solvable: treat first snapshot as baseline)

### Approach B: Commit Timestamp Comparison

**Concept**: Track "last checked" timestamp per source. On each check, fetch commits since that timestamp and classify affected paths.

**Flow**:
1. Store `lastCheckedAt` per source URL in global state
2. On check, call GitHub API: `GET /repos/{owner}/{repo}/commits?since={lastCheckedAt}&per_page=100`
3. For each commit, check which paths were affected
4. Classify affected paths to determine new/updated items
5. Surface similarly to Approach A

**Pros**: Also detects modifications (not just additions)  
**Cons**: Requires extra API calls per source (rate limit concern), complex commit parsing, doesn't distinguish new vs. modified

### Approach C: Index-Level Metadata

**Concept**: Extend the master index schema with version/timestamp per source. Sources declare their own "last updated" date.

**Flow**:
1. Add `lastUpdated` and `itemCount` fields to index source entries
2. Extension compares against stored values
3. When `lastUpdated` changes or `itemCount` increases, flag the source

**Pros**: Zero extra API calls (piggybacks on index fetch), source maintainers control the signal  
**Cons**: Requires cooperation from all source maintainers, coarse granularity (source-level, not item-level), easy to forget updating

## Notification UX Options

### Option 1: Badge + Toast (Minimal)

- "New" badge on tree items (auto-dismisses after first view)
- Single information message on check: "5 new items available in Awesome Coding Assistants"
- No persistent UI element

### Option 2: Badge + Status Bar (Persistent)

- Same badges as Option 1
- Status bar item showing count: `$(sparkle) 5 new` (click opens tree view)
- Count clears as items are viewed

### Option 3: Badge + Tree View Title Badge

- VS Code's `TreeView.badge` API to show count on the view title
- Combined with item-level "new" badges
- No toast notification (less intrusive)

### Option 4: Digest Notification (Rich)

- Periodic digest: "This week: 3 new agents, 2 new prompts from 2 sources"
- Action buttons: "View New Items" / "Dismiss"
- Categorized breakdown in the message

## "Seen" State Management

Critical design decision: when does a "new" item stop being "new"?

| Trigger | UX Impact |
|---|---|
| User clicks/previews the item | Most precise; requires tracking per-item interaction |
| User expands the category | Good balance; marks all items in category as seen |
| User clicks "Dismiss" on notification | Bulk clear; less precise but simpler |
| After N hours | Time-based auto-clear; no interaction needed |
| Next check cycle | Simplest; "new" only lasts one interval |

**Recommendation**: Mark as seen when user expands the category (clears "new" for all items in it). Add a "Mark All as Seen" command for bulk dismissal.

## Scope Considerations

### What this does NOT cover

- **Content quality signals** - no rating, stars, or download counts
- **Breaking changes** - no way to signal that an update is incompatible
- **Recommendation engine** - no "you might like this" based on detected tools
- **Push notifications** - no webhook/real-time; remains pull-based
- **Cross-source deduplication** - if two sources add the same agent, both show as new

### Rate Limit Impact

With Approach A (tree snapshot diffing):
- **Additional API calls per check**: 0 (tree is already fetched for rendering; ETag handles 304s)
- **Storage cost**: ~1-5 KB per source (set of path strings)
- **Compute cost**: Set difference operation (negligible)

## Recommendations

1. **Approach A (Tree Snapshot Diffing)** for detection - zero extra API calls, simple, per-item granularity
2. **Option 3 (TreeView.badge)** for notification UX - native VS Code pattern, persistent but not intrusive
3. **Category-expand** for "seen" clearing - good balance of precision and simplicity
4. **Extension globalState** for persistence - survives restarts, not workspace-specific
5. **Piggyback on existing auto-check** - no new timer or infrastructure needed
