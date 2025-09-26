
# Implementation Plan: Obsidian Semantic Search Plugin

**Branch**: `001-obsidian-search-plugin` | **Date**: 2025-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/nigel.stuke/My Drive/Obsidian/Work-Upstart/specs/001-obsidian-search-plugin/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Port existing CLI-based semantic search tool to native Obsidian plugin. Primary requirement: provide semantic search capabilities within Obsidian interface that work offline, automatically index vault content, and update search results within 30 seconds of file changes for vaults up to 100k lines. Technical approach will involve adapting the existing Python-based search engine (with FAISS indexing and sentence transformers) to TypeScript/JavaScript for Obsidian's plugin architecture, packaging models for offline operation, and implementing file watching for incremental updates.

## Technical Context
**Language/Version**: TypeScript 4.x+ (Obsidian plugin requirement)
**Primary Dependencies**: Transformers.js (all-MiniLM-L6-v2 quantized), RxDB + IndexedDB, Web Workers
**Storage**: Local files (plugin data directory, vault-specific storage)
**Testing**: Jest with TypeScript (standard for Obsidian plugins)
**Target Platform**: Desktop (Windows/Mac/Linux) within Obsidian application
**Project Type**: single (Obsidian plugin structure)
**Performance Goals**: Index update within 30 seconds for 100k lines, scale +10s per 100k lines
**Constraints**: Offline-capable, fully packageable, no internet dependency for search operations
**Scale/Scope**: Support vaults up to 1M+ lines, handle 1000+ markdown files efficiently

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Tool-First**: ✅ PASS - Converting existing CLI tool to plugin, maintaining standalone functionality
**II. CLI Interface**: ❌ CONDITIONAL - Plugin UI instead of CLI, but maintains text-based search I/O
**III. Test-First**: ✅ PASS - Will use TDD with TypeScript/Jest, ESLint for type safety
**IV. Integration Testing**: ✅ PASS - Must test Obsidian plugin integration and cross-tool workflows
**V. Observability**: ✅ PASS - Plugin will provide structured output and debug modes
**VI. Versioning**: ✅ PASS - Will follow semantic versioning for plugin releases
**VII. Simplicity**: ✅ PASS - Enhancing existing tool rather than creating new one

**Constitutional Compliance**: PASS with justification for Principle II deviation - Obsidian plugins inherently use GUI interface rather than CLI, but will maintain text-based input/output paradigm for search queries and results.

**Post-Design Constitution Check**: ✅ PASS - Design maintains constitutional compliance with same justification as initial check. Plugin architecture aligns with Tool-First principle by extending existing CLI tool functionality.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 1 (Single project) - Obsidian plugin structure with TypeScript source

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model creation task [P] 
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before services before UI
- Mark [P] for parallel execution (independent files)

**Task Generation Strategy for Obsidian Plugin**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each TypeScript interface → contract test task [P]
- Each entity (Document, Chunk, Tag, etc.) → model creation task [P]
- Each functional requirement → integration test task
- Plugin lifecycle tasks (onload, onunload, settings)
- UI component tasks (search view, modal, status bar)
- Implementation tasks to make tests pass

**Ordering Strategy for Plugin Development**:
- TDD order: Contract tests → Interface implementations → UI components
- Dependency order: Core models → Storage layer → Search engine → UI
- Plugin structure: Main plugin class → Services → UI components
- Mark [P] for parallel execution (independent TypeScript files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md covering full plugin implementation

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `/.specify/memory/constitution.md`*
