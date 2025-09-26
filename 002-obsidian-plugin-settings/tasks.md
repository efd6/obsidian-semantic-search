# Tasks: Data Management and File Exclusion Controls

**Input**: Design documents from `/specs/002-obsidian-plugin-settings/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript 4.x+, Obsidian Plugin API, RxDB, micromatch
   → Structure: Single project extending existing plugin
2. Load optional design documents:
   → data-model.md: 4 entities → model/service tasks
   → contracts/: 3 files → contract test tasks
   → quickstart.md: 6 scenarios → integration test tasks
   → research.md: Key decisions → setup tasks
3. Generate tasks by category:
   → Setup: micromatch dependency, type definitions
   → Tests: contract tests, integration tests for all scenarios
   → Core: ignore pattern processing, data clearing, settings UI
   → Integration: command registration, DocumentIndexer enhancement
   → Polish: error handling, performance validation
4. Apply task rules:
   → Contract tests [P] (different files)
   → Integration tests [P] (different files)
   → Implementation tasks sequential (modify same existing files)
5. TDD order: Tests before implementation
6. SUCCESS: 27 tasks ready for execution
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Extends existing Obsidian plugin structure

## Phase 3.1: Setup
- [ ] T001 Add micromatch dependency to package.json and install
- [ ] T002 [P] Add type definitions for ignore pattern interfaces in src/types/ignore-patterns.ts
- [ ] T003 [P] Add type definitions for data management interfaces in src/types/data-management.ts

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [ ] T004 [P] Contract test DataManager interface in tests/contract/test-data-management-interface.test.ts
- [ ] T005 [P] Contract test IgnorePatternProcessor interface in tests/contract/test-ignore-pattern-interface.test.ts
- [ ] T006 [P] Contract test ExtendedPluginSettings interface in tests/contract/test-settings-interface.test.ts

### Integration Tests (from quickstart scenarios)
- [ ] T007 [P] Integration test clear data via settings UI in tests/integration/test-clear-data-settings.test.ts
- [ ] T008 [P] Integration test clear data via command palette in tests/integration/test-clear-data-command.test.ts
- [ ] T009 [P] Integration test .obsidianignore pattern processing in tests/integration/test-obsidianignore-patterns.test.ts
- [ ] T010 [P] Integration test .obsidian-search-ignore patterns in tests/integration/test-plugin-ignore-patterns.test.ts
- [ ] T011 [P] Integration test malformed ignore file handling in tests/integration/test-malformed-ignore-files.test.ts
- [ ] T012 [P] Integration test concurrent operation prevention in tests/integration/test-concurrent-operations.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Ignore Pattern Processing
- [ ] T013 Add IgnorePatternProcessor class in src/services/IgnorePatternProcessor.ts
- [ ] T014 Add VaultIgnoreFileAccess implementation in src/services/VaultIgnoreFileAccess.ts
- [ ] T015 Extend DocumentIndexer with ignore pattern support in src/services/DocumentIndexer.ts

### Data Management
- [ ] T016 Add DataManager implementation in src/services/DataManager.ts
- [ ] T017 Extend IndexStorage with clear data tracking in src/services/IndexStorage.ts

### Settings UI
- [ ] T018 Add clear data button to PluginSettings in src/ui/PluginSettings.ts
- [ ] T019 Add confirmation modal component in src/ui/ClearDataModal.ts

### Command Integration
- [ ] T020 Add clear data command registration in main.ts
- [ ] T021 Add ignore pattern loading on startup in main.ts

## Phase 3.4: Integration
- [ ] T022 Connect IgnorePatternProcessor to DocumentIndexer indexVault method
- [ ] T023 Connect DataManager to settings UI button handlers
- [ ] T024 Add error handling and user feedback for all operations

## Phase 3.5: Polish
- [ ] T025 [P] Performance validation for ignore pattern matching in tests/performance/test-ignore-pattern-performance.test.ts
- [ ] T026 [P] Update plugin documentation in README.md with new features
- [ ] T027 Run quickstart validation scenarios manually

## Dependencies
- Setup (T001-T003) before all other tasks
- Contract/Integration tests (T004-T012) before implementation (T013-T024)
- T013 (IgnorePatternProcessor) blocks T015 (DocumentIndexer integration)
- T014 (VaultIgnoreFileAccess) blocks T013 (IgnorePatternProcessor)
- T016 (DataManager) blocks T017 (IndexStorage) and T023 (Settings UI)
- T018-T019 (Settings UI) before T023 (Integration)
- T020-T021 (Commands) can run in parallel with T018-T019
- Implementation (T013-T021) before integration (T022-T024)
- Integration before polish (T025-T027)

## Parallel Example - Contract Tests
```bash
# Launch T004-T006 together:
# Task: "Contract test DataManager interface in tests/contract/test-data-management-interface.test.ts"
# Task: "Contract test IgnorePatternProcessor interface in tests/contract/test-ignore-pattern-interface.test.ts"
# Task: "Contract test ExtendedPluginSettings interface in tests/contract/test-settings-interface.test.ts"
```

## Parallel Example - Integration Tests
```bash
# Launch T007-T012 together:
# Task: "Integration test clear data via settings UI in tests/integration/test-clear-data-settings.test.ts"
# Task: "Integration test clear data via command palette in tests/integration/test-clear-data-command.test.ts"
# Task: "Integration test .obsidianignore pattern processing in tests/integration/test-obsidianignore-patterns.test.ts"
# Task: "Integration test .obsidian-search-ignore patterns in tests/integration/test-plugin-ignore-patterns.test.ts"
# Task: "Integration test malformed ignore file handling in tests/integration/test-malformed-ignore-files.test.ts"
# Task: "Integration test concurrent operation prevention in tests/integration/test-concurrent-operations.test.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing (TDD requirement)
- Commit after each task completion
- All tasks extend existing plugin architecture - no breaking changes
- micromatch library handles gitignore-style pattern matching
- Use existing IndexStorage.destroy() for atomic clear operations

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - 3 contract files → 3 contract test tasks [P] ✓
   - Each interface → implementation task ✓

2. **From Data Model**:
   - 4 entities → service/model tasks ✓
   - Clear operation → DataManager service ✓

3. **From Quickstart Scenarios**:
   - 6 scenarios → 6 integration tests [P] ✓
   - UI scenarios → settings enhancement tasks ✓

4. **Ordering**:
   - Setup → Tests → Models → Services → UI → Commands → Integration → Polish ✓

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding tests (T004-T006)
- [x] All entities have implementation tasks (T013-T017)
- [x] All tests come before implementation (T004-T012 before T013-T024)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] TDD order enforced (tests fail before implementation)
- [x] Integration scenarios covered (6 quickstart scenarios → 6 integration tests)