# Data Model: Data Management and File Exclusion Controls

**Feature**: Clear stored data controls + gitignore-style file filtering
**Date**: 2025-09-24

## Core Entities

### Index Data Collection
**Purpose**: Represents all stored plugin data that can be cleared as a unit
**Fields**:
- `documents`: Collection of stored document records
- `chunks`: Collection of document content fragments with embeddings
- `embeddings`: Collection of vector representations
- `metadata`: Collection of plugin state and statistics

**Relationships**:
- One-to-many: Document → Chunks
- One-to-one: Chunk → Embedding
- Aggregates all storage collections for atomic clear operations

**Validation Rules**:
- Clear operation must be atomic (all or nothing)
- Must verify storage state before clearing
- Must handle partial clear failures gracefully

**State Transitions**:
```
Populated → Clearing → Empty
     ↑         ↓
     ← Failed ←
```

### Ignore Pattern Configuration
**Purpose**: Manages file exclusion rules from multiple ignore files
**Fields**:
- `patterns`: Array of gitignore-style pattern strings
- `sourceFile`: Origin file path (.obsidianignore vs .obsidian-search-ignore)
- `isValid`: Boolean indicating pattern parsing success
- `compiledMatcher`: Compiled pattern matcher for performance

**Relationships**:
- Many-to-one: Pattern → Source File
- Independent collections merged for evaluation

**Validation Rules**:
- Patterns must follow gitignore syntax
- Invalid patterns logged but not rejected
- Empty or missing files result in empty pattern set

**State Transitions**:
```
Unloaded → Loading → Loaded
    ↓         ↓        ↓
   Error ← Failed → Active
```

### File Index Decision
**Purpose**: Result of applying ignore patterns to determine indexing eligibility
**Fields**:
- `filePath`: Target file path being evaluated
- `shouldIndex`: Boolean result of pattern matching
- `matchedPattern`: Pattern that caused exclusion (if any)
- `sourceIgnore`: Which ignore file provided the matching pattern

**Relationships**:
- Many-to-one: Decision → Ignore Pattern Configuration
- One-to-one: Decision → File Path

**Validation Rules**:
- Must check all pattern sources
- Later patterns can override earlier ones (negation)
- Default to index if no patterns match

### Clear Data Operation
**Purpose**: Tracks progress and status of data clearing operations
**Fields**:
- `status`: 'idle' | 'confirming' | 'clearing' | 'complete' | 'failed'
- `startTime`: Operation start timestamp
- `progress`: Percentage complete (0-100)
- `error`: Error message if failed
- `itemsCleared`: Count of records removed

**Relationships**:
- One-to-one: Operation → Index Data Collection

**Validation Rules**:
- Only one clear operation at a time
- Must complete or fail before new operation
- Progress must be monotonically increasing

**State Transitions**:
```
Idle → Confirming → Clearing → Complete
  ↑        ↓           ↓          ↓
  ← Failed ← Failed ← Failed    Idle
```

## Data Flow Patterns

### Ignore Pattern Processing
```
Vault Files (.obsidianignore, .obsidian-search-ignore)
    ↓ (read & parse)
Ignore Pattern Configuration
    ↓ (compile patterns)
Pattern Matcher Functions
    ↓ (apply to file paths)
File Index Decisions
```

### Data Clear Operation
```
User Action (Settings UI / Command)
    ↓ (confirmation)
Clear Data Operation (initiated)
    ↓ (destroy storage)
Index Data Collection (cleared)
    ↓ (re-initialize)
Empty Storage State
    ↓ (user feedback)
Operation Complete
```

## Integration Points

### Existing Storage Schema
- Extends `IndexStorage` with clear operation tracking
- Maintains compatibility with existing RxDB collections
- No schema changes to document/chunk/embedding structures

### Settings Configuration
- Adds clear data controls to existing `SearchPluginSettings`
- No changes to existing settings fields or structure
- Preserves settings during clear operation

### Command Interface
- Integrates with existing command registration pattern
- Follows same confirmation/feedback patterns as rebuild command
- No changes to existing command interfaces