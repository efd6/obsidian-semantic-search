# Tasks: Obsidian Semantic Search Plugin

**Input**: Design documents from `/Users/nigel.stuke/My Drive/Obsidian/Work-Upstart/specs/001-obsidian-search-plugin/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory ✓
   → Extract: TypeScript 4.x+, Transformers.js, RxDB + IndexedDB, Web Workers
2. Load design documents: ✓
   → data-model.md: 5 entities → 5 model tasks
   → contracts/: 4 files → 4 contract test tasks
   → quickstart.md: 10 scenarios → integration tests
3. Generate tasks by category: ✓
   → Setup: Obsidian plugin init, TypeScript, dependencies
   → Tests: contract tests, integration tests
   → Core: models, services, search engine, UI components
   → Integration: plugin lifecycle, file watching, storage
   → Polish: unit tests, performance, documentation
4. Apply task rules: ✓
   → Different files = mark [P] for parallel
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T035)
6. Validate completeness: ✓
   → All 4 contracts have tests ✓
   → All 5 entities have models ✓
   → All key scenarios covered ✓
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Plugin follows Obsidian structure at repository root

## Path Conventions
- **Plugin source**: `src/` (TypeScript files for Obsidian plugin)
- **Tests**: `tests/` (Jest test files)
- **Plugin config**: `manifest.json`, `main.ts` at root
- **Dependencies**: `package.json`, `tsconfig.json` at root

## Phase 3.1: Setup
- [ ] T001 Create Obsidian plugin project structure (manifest.json, package.json, tsconfig.json)
- [ ] T002 Initialize TypeScript project with Obsidian plugin dependencies and Jest
- [ ] T003 [P] Configure ESLint and TypeScript strict mode per constitutional requirements
- [ ] T004 [P] Set up Jest testing framework with TypeScript configuration in tests/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests [P]
- [ ] T005 [P] Contract test SemanticSearchPlugin interface in tests/contract/test-plugin-interface.test.ts
- [ ] T006 [P] Contract test SearchEngine interface in tests/contract/test-search-interface.test.ts
- [ ] T007 [P] Contract test DocumentIndexer interface in tests/contract/test-indexing-interface.test.ts
- [ ] T008 [P] Contract test SearchUI interface in tests/contract/test-ui-interface.test.ts

### Integration Tests [P]
- [ ] T009 [P] Integration test plugin installation and activation in tests/integration/test-plugin-lifecycle.test.ts
- [ ] T010 [P] Integration test automatic vault indexing in tests/integration/test-auto-indexing.test.ts
- [ ] T011 [P] Integration test semantic search functionality in tests/integration/test-semantic-search.test.ts
- [ ] T012 [P] Integration test tag-based filtering in tests/integration/test-tag-filtering.test.ts
- [ ] T013 [P] Integration test offline operation in tests/integration/test-offline-mode.test.ts
- [ ] T014 [P] Integration test real-time index updates in tests/integration/test-index-updates.test.ts
- [ ] T015 [P] Integration test performance scaling in tests/integration/test-performance.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models [P]
- [ ] T016 [P] Document model with validation rules in src/models/Document.ts
- [ ] T017 [P] Chunk model with embedding support in src/models/Chunk.ts
- [ ] T018 [P] Tag model with metadata tracking in src/models/Tag.ts
- [ ] T019 [P] SearchIndex model with version control in src/models/SearchIndex.ts
- [ ] T020 [P] SearchResult model with scoring in src/models/SearchResult.ts

### Core Services
- [ ] T021 DocumentIndexer service implementing indexing-interface in src/services/DocumentIndexer.ts
- [ ] T022 SemanticSearchEngine implementing search-interface in src/services/SemanticSearchEngine.ts
- [ ] T023 FileWatcher service for real-time updates in src/services/FileWatcher.ts
- [ ] T024 IndexStorage service for RxDB/IndexedDB persistence in src/services/IndexStorage.ts
- [ ] T025 EmbeddingEngine service with Transformers.js integration in src/services/EmbeddingEngine.ts

### UI Components [P]
- [ ] T026 [P] SearchView component implementing search UI in src/ui/SearchView.ts
- [ ] T027 [P] SearchModal for quick search overlay in src/ui/SearchModal.ts
- [ ] T028 [P] PluginSettings configuration interface in src/ui/PluginSettings.ts
- [ ] T029 [P] StatusBarDisplay for indexing progress in src/ui/StatusBarDisplay.ts

## Phase 3.4: Integration
- [ ] T030 Main plugin class implementing SemanticSearchPlugin interface in main.ts
- [ ] T031 Plugin lifecycle management (onload, onunload, settings) in main.ts
- [ ] T032 Obsidian API integration (vault events, file watching) in src/ObsidianAdapter.ts
- [ ] T033 Web Worker setup for background processing in src/workers/IndexingWorker.ts
- [ ] T034 Error handling and logging throughout plugin components

## Phase 3.5: Polish
- [ ] T035 [P] Unit tests for utility functions in tests/unit/test-utils.test.ts
- [ ] T036 Performance validation (30-second update target) per quickstart scenarios
- [ ] T037 [P] Plugin documentation and README.md updates
- [ ] T038 Bundle optimization and dependency packaging for offline operation
- [ ] T039 Cross-platform testing (Windows/Mac/Linux) validation
- [ ] T040 Execute complete quickstart validation scenarios

## Dependencies
- Setup (T001-T004) before everything else
- All tests (T005-T015) before any implementation (T016-T034)
- Models (T016-T020) before services (T021-T025)
- Core services (T021-T025) before UI components (T026-T029)
- Core implementation (T016-T029) before integration (T030-T034)
- Integration (T030-T034) before polish (T035-T040)

### Specific Dependencies
- T021 (DocumentIndexer) depends on T016 (Document), T017 (Chunk)
- T022 (SearchEngine) depends on T020 (SearchResult), T025 (EmbeddingEngine)
- T024 (IndexStorage) depends on T016-T020 (all models)
- T030 (main plugin) depends on T021-T029 (all services and UI)
- T032 (Obsidian integration) depends on T021, T023 (indexer, file watcher)

## Parallel Example

### Contract Tests Phase (T005-T008)
```bash
# Launch contract tests together:
Task: "Contract test SemanticSearchPlugin interface in tests/contract/test-plugin-interface.test.ts"
Task: "Contract test SearchEngine interface in tests/contract/test-search-interface.test.ts"
Task: "Contract test DocumentIndexer interface in tests/contract/test-indexing-interface.test.ts"
Task: "Contract test SearchUI interface in tests/contract/test-ui-interface.test.ts"
```

### Integration Tests Phase (T009-T015)
```bash
# Launch integration tests together:
Task: "Integration test plugin installation and activation in tests/integration/test-plugin-lifecycle.test.ts"
Task: "Integration test automatic vault indexing in tests/integration/test-auto-indexing.test.ts"
Task: "Integration test semantic search functionality in tests/integration/test-semantic-search.test.ts"
Task: "Integration test tag-based filtering in tests/integration/test-tag-filtering.test.ts"
Task: "Integration test offline operation in tests/integration/test-offline-mode.test.ts"
Task: "Integration test real-time index updates in tests/integration/test-index-updates.test.ts"
Task: "Integration test performance scaling in tests/integration/test-performance.test.ts"
```

### Model Creation Phase (T016-T020)
```bash
# Launch model implementations together:
Task: "Document model with validation rules in src/models/Document.ts"
Task: "Chunk model with embedding support in src/models/Chunk.ts"
Task: "Tag model with metadata tracking in src/models/Tag.ts"
Task: "SearchIndex model with version control in src/models/SearchIndex.ts"
Task: "SearchResult model with scoring in src/models/SearchResult.ts"
```

### UI Components Phase (T026-T029)
```bash
# Launch UI components together:
Task: "SearchView component implementing search UI in src/ui/SearchView.ts"
Task: "SearchModal for quick search overlay in src/ui/SearchModal.ts"
Task: "PluginSettings configuration interface in src/ui/PluginSettings.ts"
Task: "StatusBarDisplay for indexing progress in src/ui/StatusBarDisplay.ts"
```

## Notes
- [P] tasks target different files with no shared dependencies
- Verify all tests fail before implementing (TDD requirement)
- Commit after each completed task
- Plugin must work offline (no internet dependency for search)
- Target 30-second index updates for 100k lines per constitutional requirements
- Use TypeScript strict mode and ESLint per constitutional requirements

## Task Generation Rules Applied

1. **From Contracts**: ✓
   - 4 contract files → 4 contract test tasks [P] (T005-T008)
   - 4 interfaces → 4+ implementation tasks (T021-T030)

2. **From Data Model**: ✓
   - 5 entities → 5 model creation tasks [P] (T016-T020)
   - Relationships → service layer tasks (T021-T025)

3. **From Quickstart Scenarios**: ✓
   - 10 scenarios → 7 integration tests [P] (T009-T015)
   - Validation scenarios → polish tasks (T036-T040)

4. **Ordering**: ✓
   - Setup → Tests → Models → Services → UI → Integration → Polish
   - TDD enforced with explicit dependency blocking

## Validation Checklist ✓
- [x] All 4 contracts have corresponding tests (T005-T008)
- [x] All 5 entities have model tasks (T016-T020)
- [x] All tests come before implementation (T005-T015 before T016+)
- [x] Parallel tasks truly independent (different files, no shared state)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Constitutional requirements addressed (TypeScript strict, ESLint, TDD)