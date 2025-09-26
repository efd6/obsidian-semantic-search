# Quickstart Guide: Obsidian Semantic Search Plugin

This guide provides step-by-step validation of all functional requirements and user scenarios.

## Prerequisites

- Obsidian installed on desktop (Windows/Mac/Linux)
- Test vault with sample markdown files containing various tags
- At least 50-100 test documents for meaningful semantic search testing

## Installation and Setup

### Step 1: Plugin Installation
**Validates**: FR-001 (native plugin integration)

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Search for "Semantic Search Plugin"
4. Install and enable the plugin
5. **Expected**: Plugin appears in installed plugins list
6. **Expected**: Plugin settings tab becomes available

### Step 2: Initial Indexing
**Validates**: FR-002 (automatic indexing on activation)

1. Navigate to a vault with markdown files
2. Activate the semantic search plugin
3. **Expected**: Plugin automatically starts indexing vault content
4. **Expected**: Status bar shows indexing progress
5. **Expected**: Indexing completes without errors
6. **Expected**: All markdown files are processed and indexed

**Acceptance Criteria**:
- Indexing starts within 5 seconds of activation
- No manual intervention required
- All .md files in vault are indexed
- Progress indicator shows current status

## Core Search Functionality

### Step 3: Basic Semantic Search
**Validates**: FR-003 (semantic search capabilities), FR-008 (searchable UI)

1. Open the semantic search interface (via command palette or hotkey)
2. Enter search query: "incident management process"
3. **Expected**: Search results appear showing relevant documents
4. **Expected**: Results include documents that discuss incidents, even without exact phrase match
5. **Expected**: Results are ranked by semantic relevance

**Test Queries**:
- "daily standup meetings" → should find meeting notes, daily logs
- "performance review process" → should find HR docs, performance-related content
- "database optimization" → should find technical docs about DB improvements

### Step 4: Tag-Based Filtering
**Validates**: FR-004 (tag-based filtering), FR-013 (tag metadata preservation)

1. In search interface, enter query: "meeting notes"
2. Add tag filter: `#meeting`
3. **Expected**: Results only show documents tagged with #meeting
4. Test additional filters: `#dailies`, `#incident`, `#planning`
5. **Expected**: Multiple tag filters work as AND operation
6. **Expected**: Tag suggestions appear as you type

**Test Scenarios**:
- Search "standup" with tag filter `#dailies` → only daily meeting notes
- Search "issues" with tags `#incident` AND `#meeting` → incident meetings only

### Step 5: Offline Operation
**Validates**: FR-005 (offline functionality)

1. Disconnect from internet
2. Perform semantic search: "team collaboration"
3. **Expected**: Search works without internet connection
4. **Expected**: Results are generated using local embeddings
5. **Expected**: No network error messages appear

### Step 6: Result Display and Navigation
**Validates**: FR-009 (display with file names, snippets, clickable links)

1. Perform search: "project planning"
2. **Expected**: Each result shows:
   - File name/title
   - Relevant content snippet (highlighted)
   - File path or location
   - Tags associated with document
3. Click on a search result
4. **Expected**: Obsidian opens the corresponding file
5. **Expected**: File opens at or near the relevant section

## Performance and Updating

### Step 7: Real-Time Index Updates
**Validates**: FR-006 (30-second update window), FR-010 (file watching)

1. Create a new markdown file with content: "quarterly business review meeting"
2. Add tags: `#meeting #quarterly`
3. Save the file
4. Wait 30 seconds
5. Search for "quarterly review"
6. **Expected**: New file appears in search results within 30 seconds
7. **Expected**: Tags are properly indexed and filterable

### Step 8: File Modification Updates
**Validates**: FR-006 (update timing), FR-010 (change detection)

1. Open an existing indexed file
2. Add new content: "implementing new data analytics dashboard"
3. Save the file
4. Wait 30 seconds
5. Search for "analytics dashboard"
6. **Expected**: Updated content appears in search results
7. **Expected**: Previous content is still searchable if relevant

### Step 9: Large Vault Performance
**Validates**: FR-007 (scaling performance)

**For 100k lines test**:
1. Use vault with approximately 100,000 lines of content
2. Make a significant edit to a file
3. Time how long until search reflects the change
4. **Expected**: Update completes within 30 seconds

**For larger vaults**:
- 200k lines: Update within 40 seconds
- 500k lines: Update within 80 seconds
- 1M lines: Update within 130 seconds

## Advanced Features

### Step 10: Hybrid Search
**Validates**: FR-012 (hybrid semantic + keyword search)

1. Enable hybrid search mode in settings
2. Search for exact phrase: "daily standup"
3. **Expected**: Results include both semantic matches AND exact keyword matches
4. **Expected**: Exact matches are ranked higher than semantic-only matches
5. Compare results with semantic-only mode
6. **Expected**: Hybrid mode returns more comprehensive results

### Step 11: Package Completeness
**Validates**: FR-014 (fully packageable with dependencies)

1. Install plugin on offline machine
2. **Expected**: All required models and dependencies are included
3. **Expected**: No additional downloads required during operation
4. **Expected**: Plugin works immediately after installation

## Integration Testing

### Step 12: Obsidian Workspace Integration
**Validates**: Plugin integration with Obsidian ecosystem

1. Test search while other plugins are active
2. **Expected**: No conflicts with other plugins
3. **Expected**: Search integrates with Obsidian's command palette
4. **Expected**: Plugin respects Obsidian's theme settings
5. Test with different vault structures (nested folders, etc.)
6. **Expected**: All organizational structures are properly indexed

### Step 13: Settings and Configuration
1. Access plugin settings
2. Modify search result limit, update intervals
3. **Expected**: Settings persist across Obsidian restarts
4. **Expected**: Changes take effect immediately or after confirmation
5. Test performance settings for different hardware capabilities

## Error Handling and Edge Cases

### Step 14: Corrupted File Handling
1. Create a markdown file with malformed content
2. Include invalid characters or encoding issues
3. **Expected**: Plugin handles gracefully without crashing
4. **Expected**: Error is logged but indexing continues for other files

### Step 15: Search Before Indexing Complete
1. Start plugin with large vault
2. Immediately try to search while indexing is in progress
3. **Expected**: Partial results are returned from already-indexed content
4. **Expected**: UI indicates indexing is still in progress
5. **Expected**: Results update as more content becomes available

## Validation Checklist

- [ ] Plugin installs through Community Plugins interface
- [ ] Automatic indexing starts on activation
- [ ] Semantic search returns relevant results
- [ ] Tag filtering works correctly
- [ ] Offline operation functions without internet
- [ ] Results display properly with clickable links
- [ ] File changes reflect in search within 30 seconds
- [ ] Performance scales appropriately with vault size
- [ ] Hybrid search combines semantic and keyword matching
- [ ] Plugin is fully self-contained and packageable
- [ ] Integration with Obsidian workspace is seamless
- [ ] Settings persist and take effect properly
- [ ] Error conditions are handled gracefully

## Performance Benchmarks

Document these actual measurements during testing:

| Vault Size | Files | Total Lines | Initial Index Time | Update Time | Search Latency |
|------------|-------|-------------|-------------------|-------------|----------------|
| Small      | <50   | <10k        | _____ sec         | _____ sec   | _____ ms       |
| Medium     | 50-200| 10k-50k     | _____ sec         | _____ sec   | _____ ms       |
| Large      | 200-500| 50k-100k   | _____ sec         | _____ sec   | _____ ms       |
| Very Large | 500+  | 100k+       | _____ sec         | _____ sec   | _____ ms       |

## Success Criteria

✅ **All functional requirements validated**
✅ **Performance targets met**
✅ **Integration requirements satisfied**
✅ **Error handling verified**
✅ **User scenarios completed successfully**

This quickstart guide validates that the plugin meets all specified requirements and provides a reliable semantic search experience within the Obsidian environment.