---
lane: planned
---

# WP10 - Search and Filter (P2)

> **Spec**: `specs/001-awesome-coding-assistants.spec.md`
> **Status**: Not Started
> **Priority**: P2
> **Goal**: Users can search across all sources by keyword to find customizations without manually expanding every category.
> **Independent Test**: Type "typescript" in the tree view filter/search box. Verify only items with "typescript" in name, description, or tags appear. Search for a non-existent term and verify "No items match" empty state.
> **Depends on**: WP01, WP02, WP03
> **Parallelisable**: Yes (can be worked after WP03, independent of WP04-WP09)
> **Prompt**: `plans/WP10-search.md`

## Objective

Implement keyword search and filtering across all configured sources. Users can type a search query and the tree view narrows to matching items based on name, description, or content. This delivers US-08 (Search and Filter) and improves discoverability in large catalogs.

## Spec References

- Section 5 US-08 (Search and Filter)
- Section 8.1 Commands (implied: search/filter command)
- Section 9.1 Components (tree view filtering)

## Tasks

### T10-01 - Search input UI

- **Description**: Add a search input to the tree view that accepts keyword queries. VS Code tree views support a built-in filter via `TreeView.filterOnType` or a custom search box via view title input.
- **Spec refs**: US-08 (search box in tree view)
- **Parallel**: No
- **Acceptance criteria**:
  - [ ] Search input is accessible from the tree view header area
  - [ ] User can type a query string and press Enter (or filter as they type)
  - [ ] Clearing the search restores the full unfiltered tree
  - [ ] Search box has placeholder text: "Search customizations..."
  - [ ] Search is case-insensitive
- **Test requirements**: unit (search state management)
- **Depends on**: WP03 (CatalogTreeProvider)
- **Implementation Guidance**:
  - Option A: Use VS Code's built-in tree view filtering (`TreeView` with `canSelectMany: false` + `filterOnType` property). This is the simplest but limited to label matching.
  - Option B: Implement a custom search command `awesome-coding-assistants.search` that shows an InputBox, stores the query, and triggers a tree refresh with filtering applied.
  - Option B is recommended for richer matching (name + description + tags, not just label).
  - Register command: `awesome-coding-assistants.search` with QuickInput or InputBox

### T10-02 - Search matching logic

- **Description**: Implement the matching algorithm that determines which items match a search query.
- **Spec refs**: US-08 Scenario 1 (match by name, description, or tags)
- **Parallel**: Yes (independent of T10-01 UI)
- **Acceptance criteria**:
  - [ ] `matchesSearch(item: CatalogItem, query: string): boolean` function
  - [ ] Matches against item name (case-insensitive substring match)
  - [ ] Matches against item description if present (case-insensitive substring)
  - [ ] Matches against item path (e.g., `agents/typescript` matches query "typescript")
  - [ ] Matches against tool type (e.g., query "copilot" matches all Copilot items)
  - [ ] Matches against category (e.g., query "agents" matches all items in agents category)
  - [ ] Multi-word queries: all words must match (AND logic) across any of the fields
  - [ ] Empty query matches everything (no filter)
- **Test requirements**: unit (various query patterns)
- **Depends on**: WP02 T02-01 (CatalogItem type)
- **Implementation Guidance**:
  - Split query by whitespace into words: `const words = query.toLowerCase().split(/\s+/)`
  - For each word, check if it appears in the combined searchable text: `[item.name, item.description, item.path, item.tool, item.category].join(' ').toLowerCase()`
  - Return true only if all words match (AND semantics)

### T10-03 - Filtered tree rendering

- **Description**: Modify CatalogTreeProvider to apply search filter when a query is active.
- **Spec refs**: US-08 Scenarios 1-2 (filtered results, empty state)
- **Parallel**: No (depends on T10-01, T10-02)
- **Acceptance criteria**:
  - [ ] When search query is active, `getChildren()` filters items using `matchesSearch()`
  - [ ] Source and category nodes are still shown if they contain at least one matching child
  - [ ] Source and category nodes with no matching children are hidden
  - [ ] If no items match across all sources, show an empty state item: "No items match '{query}'"
  - [ ] Category count badges update to show filtered count
  - [ ] Search results preserve the Source > Category > Item hierarchy (not flattened)
  - [ ] Tree refreshes on query change
- **Test requirements**: unit (mock data, verify filtered tree), BDD
- **Depends on**: T10-01, T10-02, WP03 (CatalogTreeProvider)
- **Implementation Guidance**:
  - Store current search query in CatalogTreeProvider as a private field
  - In `getChildren(category)`, after loading items, filter with `items.filter(i => matchesSearch(i, this.searchQuery))`
  - For empty state: return `[new TreeItem('No items match...')]` with no collapsible state
  - Fire `onDidChangeTreeData` when search query changes

### T10-04 - Clear search / reset filter

- **Description**: Provide a clear/reset action to remove the search filter and restore the full tree.
- **Spec refs**: US-08 (implicit: clearing search)
- **Parallel**: Yes
- **Acceptance criteria**:
  - [ ] "Clear Search" button/action visible when a search query is active
  - [ ] Clicking clear resets the query to empty and refreshes the tree
  - [ ] Keyboard shortcut: Escape in the search input clears the filter
  - [ ] View title shows search state indicator when filter is active
- **Test requirements**: unit (verify state reset)
- **Depends on**: T10-01
- **Implementation Guidance**:
  - Add a `view/title` menu action "Clear Search" with `when: awesome-coding-assistants.searchActive`
  - Set context: `vscode.commands.executeCommand('setContext', 'awesome-coding-assistants.searchActive', true/false)`

### T10-05 - Unit tests for search

- **Description**: Test search matching and filtered tree rendering.
- **Spec refs**: US-08 Scenarios 1-2
- **Parallel**: No (depends on T10-01 through T10-04)
- **Acceptance criteria**:
  - [ ] Test: query "typescript" matches item named "TypeScript Best Practices Agent"
  - [ ] Test: query "typescript" matches item with path containing "typescript"
  - [ ] Test: query "copilot agents" matches Copilot agent items (AND logic)
  - [ ] Test: query "nonexistent" returns no matches
  - [ ] Test: empty query returns all items
  - [ ] Test: filtered tree hides empty categories
  - [ ] Test: empty state message shown when no results
  - [ ] Test: clearing search restores full tree
  - [ ] All tests pass with `npm test`
- **Test requirements**: This IS the test deliverable
- **Depends on**: T10-01 through T10-04
- **Implementation Guidance**:
  - Create fixture CatalogItem data covering various tools, categories, and names
  - Test matchesSearch directly with different query strings
  - Test tree provider getChildren with mock data and active search query

## Implementation Notes

- VS Code's built-in tree filtering (`filterOnType`) only matches against the label field, which may be insufficient for matching descriptions or tags
- The custom search approach is more flexible but requires managing search state explicitly
- Consider debouncing the search input to avoid excessive tree refreshes during typing

## Parallel Opportunities

- T10-01 (UI) and T10-02 (matching logic) are independent
- T10-04 (clear action) can be done after T10-01

## Risks & Mitigations

- **Performance with large catalogs**: Searching 1000+ items should still be fast since matching is in-memory string operations. Mitigation: no concern for expected catalog sizes (10-500 items per source).
- **VS Code tree view limitations**: Built-in filtering may not support custom matching. Mitigation: use custom search command approach.

## Activity Log

- 2026-03-15T00:00:00Z - planner - lane=planned - Work package created
