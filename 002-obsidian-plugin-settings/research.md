# Research: Data Management and File Exclusion Controls

**Feature**: Clear stored data controls + gitignore-style file filtering
**Date**: 2025-09-24

## Research Areas

### 1. Obsidian Plugin Settings UI Patterns

**Decision**: Add button to Advanced Settings section with confirmation modal
**Rationale**: Follows existing plugin settings structure in PluginSettings.ts, prevents accidental data loss
**Alternatives considered**:
- Separate settings tab (too complex for single feature)
- Direct clear without confirmation (dangerous UX)

### 2. RxDB Data Clearing Strategy

**Decision**: Use existing `IndexStorage.destroy()` method with re-initialization
**Rationale**: RxDB provides atomic destroy operation, existing method handles all collections properly
**Alternatives considered**:
- Manual deletion per collection (error-prone, non-atomic)
- Database reset with schema migration (overkill for clear operation)

### 3. Gitignore Pattern Matching Library

**Decision**: Use `micromatch` library for gitignore-style pattern matching
**Rationale**: Well-established library with gitignore compatibility, already used in many TypeScript projects, handles wildcards/negation/directories correctly
**Alternatives considered**:
- `minimatch` (less gitignore-specific features)
- Custom regex parsing (reinventing wheel, bug-prone)
- `ignore` package (heavier dependency, node-specific)

### 4. Obsidian File System Access Patterns

**Decision**: Use `vault.adapter.exists()` and `vault.adapter.read()` for ignore file access
**Rationale**: Standard Obsidian pattern for accessing vault files, handles file system differences across platforms
**Alternatives considered**:
- Direct file system access (breaks Obsidian abstraction)
- Treating ignore files as vault files (incorrect, they're metadata)

### 5. Ignore File Processing Architecture

**Decision**: Load and cache ignore patterns in DocumentIndexer initialization, check patterns before each file index
**Rationale**: Front-loads pattern parsing cost, enables fast per-file checks during bulk indexing
**Alternatives considered**:
- Check patterns during file enumeration (harder to debug, mixed concerns)
- Real-time pattern loading per file (performance impact)

### 6. Error Handling for Malformed Ignore Files

**Decision**: Log warnings for invalid patterns but continue processing, skip unparseable lines
**Rationale**: Graceful degradation - don't break indexing due to typos in ignore files
**Alternatives considered**:
- Fail fast on invalid patterns (too brittle)
- Silent failure (hard to debug ignore issues)

### 7. Command Palette Integration

**Decision**: Add "Clear Search Index Data" command following existing plugin command patterns
**Rationale**: Consistent with existing commands like "Rebuild Search Index", accessible via hotkeys
**Alternatives considered**:
- Only settings UI access (limits power user accessibility)
- Multiple granular clear commands (unnecessary complexity)

## Implementation Dependencies

### Required Libraries
- `micromatch`: Pattern matching for ignore files (~15KB, stable API)
- Obsidian Plugin API: Settings, commands, vault access (already available)
- RxDB: Database operations (already integrated)

### Existing Code Integration Points
- `src/ui/PluginSettings.ts`: Add clear data button to Advanced Settings
- `main.ts`: Register clear data command, load ignore patterns on startup
- `src/services/DocumentIndexer.ts`: Add ignore pattern checking to file processing
- `src/services/IndexStorage.ts`: Extend with clear feedback and re-initialization

### Testing Strategy
- Unit tests: Pattern matching logic, ignore file parsing
- Integration tests: Actual vault files with ignore patterns, storage clearing lifecycle
- Contract tests: Settings UI interactions, command execution

## Risk Assessment

**Low Risk**:
- Extending existing stable patterns
- Well-tested libraries for core functionality
- Non-breaking changes to plugin interface

**Mitigation Strategies**:
- Comprehensive confirmation dialogs for destructive operations
- Detailed logging for ignore pattern processing debugging
- Graceful fallbacks for malformed ignore files