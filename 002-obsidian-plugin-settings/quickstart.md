# Quickstart: Data Management and File Exclusion Controls

**Feature**: Clear stored data controls + gitignore-style file filtering
**Date**: 2025-09-24
**Purpose**: Validate implementation through user acceptance scenarios

## Prerequisites

1. Obsidian semantic search plugin installed and active
2. Test vault with indexed content (documents, chunks, embeddings)
3. Sample ignore files for pattern testing

## Test Scenario 1: Clear Data via Settings UI
**Acceptance Criteria**: FR-001, FR-002, FR-009

### Setup
```bash
# Ensure plugin has indexed data
# Check storage stats show non-zero counts
```

### Steps
1. Open Obsidian Settings → Plugin Options → Semantic Search Plugin
2. Navigate to Advanced Settings section
3. Locate "Clear Index Data" button
4. Click "Clear Index Data" button

**Expected**: Confirmation modal appears asking "Are you sure you want to clear all search index data? This cannot be undone."

5. Click "Cancel" in confirmation modal

**Expected**: Modal closes, no data is cleared

6. Click "Clear Index Data" button again
7. Click "Confirm" in confirmation modal

**Expected**:
- Progress indication appears
- All stored data (embeddings, documents, chunks) is cleared
- Success notice appears: "Search index data cleared successfully. X documents, Y chunks, Z embeddings removed."
- Button becomes available again

### Validation
```typescript
// Verify storage is empty
const stats = await indexStorage.getStats();
assert(stats.documentsStored === 0);
assert(stats.chunksStored === 0);
assert(stats.embeddingsStored === 0);
```

## Test Scenario 2: Clear Data via Command Palette
**Acceptance Criteria**: FR-003, FR-012

### Setup
```bash
# Ensure plugin has indexed data
```

### Steps
1. Open Command Palette (Ctrl/Cmd + P)
2. Type "Clear Search Index Data"
3. Select "Clear Search Index Data" command

**Expected**: Same confirmation flow as settings UI

4. Confirm the operation

**Expected**: Same clearing behavior and feedback as settings UI

### Validation
- Storage is cleared completely
- Command is disabled during clearing operation
- Command becomes available after completion

## Test Scenario 3: Ignore Pattern Processing (.obsidianignore)
**Acceptance Criteria**: FR-004, FR-006, FR-008

### Setup
Create `.obsidianignore` in vault root:
```gitignore
# Test patterns
*.tmp
temp/
.git/
!important.tmp
```

### Steps
1. Restart plugin or trigger index rebuild
2. Add files matching patterns:
   - `test.tmp` (should be ignored)
   - `temp/file.md` (should be ignored)
   - `important.tmp` (should be indexed - negation pattern)
   - `normal.md` (should be indexed)

### Expected Results
```typescript
// Check which files were indexed
const shouldIndex = ignoreProcessor.shouldIndexFile('test.tmp');
assert(shouldIndex.shouldIndex === false);
assert(shouldIndex.matchedPattern === '*.tmp');

const shouldIndexNegated = ignoreProcessor.shouldIndexFile('important.tmp');
assert(shouldIndexNegated.shouldIndex === true);
```

## Test Scenario 4: Plugin-Specific Ignore (.obsidian-search-ignore)
**Acceptance Criteria**: FR-005, FR-006, FR-007

### Setup
Create `.obsidian-search-ignore` in vault root:
```gitignore
# Plugin-specific exclusions
Archive/**
drafts/*.md
*.draft
```

### Steps
1. Create test files:
   - `Archive/old.md`
   - `drafts/work.md`
   - `notes.draft`
   - `published.md`

2. Trigger indexing

### Expected Results
- Archive and drafts files are excluded from indexing
- Plugin-specific patterns work alongside .obsidianignore
- Published.md is indexed normally

## Test Scenario 5: Malformed Ignore File Handling
**Acceptance Criteria**: FR-010

### Setup
Create `.obsidianignore` with invalid patterns:
```gitignore
*.md
[invalid-regex
valid-pattern.txt
***/broken
```

### Steps
1. Trigger ignore pattern loading

### Expected Results
- Valid patterns are processed normally
- Invalid patterns are logged as warnings
- Indexing continues despite invalid patterns
- No crash or failure occurs

### Validation
```typescript
const config = ignoreProcessor.getIgnoreConfiguration();
assert(config.loadErrors.length > 0);
assert(config.isLoaded === true); // Still loaded despite errors
```

## Test Scenario 6: Concurrent Operation Prevention
**Acceptance Criteria**: FR-012

### Setup
```bash
# Large vault with significant data to clear
```

### Steps
1. Start clear data operation from settings
2. While clearing is in progress, try to:
   - Click clear data button again
   - Execute clear command from palette
   - Start index rebuild

### Expected Results
- Clear button is disabled during operation
- Command palette command is disabled
- Operations are prevented until clearing completes
- Progress feedback is shown throughout

## Performance Validation

### Clear Operation Performance
- Data clearing should complete within 30 seconds for 10,000 documents
- UI should remain responsive during operation
- Progress feedback should update at least every 2 seconds

### Ignore Pattern Performance
- Pattern matching should add <50ms to indexing per file
- Pattern loading should complete within 5 seconds
- Memory usage should not increase significantly

## Integration Testing

### Existing Functionality Preservation
1. Verify semantic search continues working after clear/rebuild
2. Confirm settings UI layout remains intact
3. Ensure file watching continues to work with ignore patterns
4. Validate existing commands remain functional

### Error Recovery
1. Test partial clear failure scenarios
2. Verify ignore file permission errors are handled
3. Confirm storage re-initialization after failures
4. Test ignore pattern updates during active indexing

## Automated Test Requirements

The quickstart scenarios should be automated as:
1. **Contract tests**: Interface compliance validation
2. **Integration tests**: Real plugin environment testing
3. **E2E tests**: Full user workflow validation
4. **Performance tests**: Timing and resource usage verification

Each test must pass before feature is considered complete.