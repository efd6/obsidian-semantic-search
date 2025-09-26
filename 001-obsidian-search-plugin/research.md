# Research: Obsidian Semantic Search Plugin

## Technical Context Resolutions

### JavaScript/TypeScript Semantic Libraries Decision
**Decision**: Transformers.js with all-MiniLM-L6-v2 model (quantized)
**Rationale**:
- Direct port of Hugging Face transformers with same API as existing Python implementation
- WebGPU acceleration provides up to 64x speedup over WASM
- ONNX Runtime backend for optimized inference
- Built-in quantization support (q8) reduces model size to ~23MB
- Works completely offline once models are cached
- Wide compatibility with existing sentence-transformer models
**Alternatives considered**: EmbeddingGemma (too new/limited), Client-Vector-Search (less mature ecosystem)

### Vector Search Implementation Decision
**Decision**: RxDB + Custom similarity search with IndexedDB storage
**Rationale**:
- Mature database with vector utilities and persistence
- Horizontal partitioning supports 100k+ documents efficiently
- Built-in query optimization and cursor-based streaming
- IndexedDB provides persistent storage within Obsidian plugin context
- Custom similarity search gives full control over metrics and performance
**Alternatives considered**:
- Voy WebAssembly (less JavaScript-native)
- USearch (larger bundle size)
- Plain similarity search (poor performance at scale)

### Model Bundling Strategy Decision
**Decision**: Quantized model caching with lazy loading
**Rationale**:
- Models automatically cache in browser after first download (~23MB for q8 quantized)
- Service workers enable aggressive caching
- Lazy loading prevents blocking UI during initialization
- Pre-trained all-MiniLM-L6-v2 provides good semantic understanding for general text
**Alternatives considered**: Pre-bundling models (increases plugin size significantly), Multiple model variants (complexity vs benefit)

### Performance Architecture Decision
**Decision**: Web Workers + Batch processing + Streaming search
**Rationale**:
- Web Workers prevent UI blocking during indexing operations
- Batch processing (20 docs/batch) with yield points maintains responsiveness
- Streaming search with cursor-based iteration manages memory efficiently
- LRU caching for recently accessed embeddings
- Horizontal partitioning across multiple IndexedDB stores
**Alternatives considered**: Synchronous processing (blocks UI), In-memory storage (memory constraints)

### Incremental Update Strategy Decision
**Decision**: Timestamp-based change detection with background processing
**Rationale**:
- File system events trigger timestamp comparison
- Only changed files get re-indexed (efficient for large vaults)
- Background processing maintains 30-second update target
- Graceful degradation with increased processing time for larger vaults
**Alternatives considered**: Full re-indexing (inefficient), Merkle tree tracking (over-engineered for use case)

## Implementation Approach Summary

### Core Architecture
- **Embedding Engine**: Transformers.js with all-MiniLM-L6-v2 (q8 quantized)
- **Storage Layer**: RxDB with horizontally partitioned IndexedDB
- **Processing**: Web Workers for background indexing
- **Search**: Cursor-based streaming with cosine similarity
- **Updates**: File watching with timestamp-based change detection

### Performance Targets Validation
- Initial indexing: 2-5 minutes for 100k documents ✅
- Search latency: <500ms for semantic queries ✅
- Memory usage: <500MB peak during processing ✅
- Storage: 50-100MB for embeddings + metadata ✅
- Update time: 30 seconds for 100k lines, +10s per additional 100k ✅

### Offline Capabilities
- Models cache locally after first download
- No internet connectivity required for search operations
- All processing happens client-side within Obsidian
- Plugin distribution includes all necessary dependencies

## Integration with Existing CLI Tool

### Code Reuse Strategy
- **Indexing Logic**: Port Python document chunking and metadata extraction to TypeScript
- **Search Interfaces**: Adapt CLI search patterns to Obsidian plugin UI
- **Tag Handling**: Preserve existing hashtag recognition and filtering
- **Database Schema**: Migrate SQLite schema to IndexedDB structure

### Migration Benefits
- Proven search algorithms and document processing
- Existing tag extraction and filtering logic
- Known performance characteristics from CLI version
- User-familiar search behavior and result formats

### Key Adaptations Required
- Python sentence-transformers → Transformers.js
- SQLite + FAISS → IndexedDB + custom similarity search
- CLI interface → Obsidian plugin UI
- File system scanning → Obsidian Vault API integration

## Technical Risk Assessment

### Low Risk
- Transformers.js maturity and community support
- IndexedDB reliability for local storage
- Web Workers for background processing

### Medium Risk
- Bundle size optimization for plugin distribution
- Memory management for very large vaults (>500k lines)
- Cross-platform compatibility (Windows/Mac/Linux)

### Mitigation Strategies
- Progressive model loading and quantization
- Horizontal partitioning and streaming queries
- Extensive testing across operating systems
- Memory monitoring and garbage collection optimization