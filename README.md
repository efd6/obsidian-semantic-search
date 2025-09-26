# Obsidian Semantic Search Plugin

An advanced semantic search plugin for Obsidian that enables AI-powered content discovery using offline embedding models. Find notes by meaning, not just keywords.

## Features

- **🧠 Semantic Search**: Find content by meaning using state-of-the-art embedding models
- **📱 Offline Operation**: Runs entirely offline with pre-bundled AI models
- **⚡ Real-time Updates**: Search reflects file changes within 30 seconds
- **🎯 Smart Chunking**: Intelligent text segmentation for better search granularity
- **🏷️ Tag Integration**: Full support for Obsidian tags and frontmatter
- **🔍 Multiple Interfaces**: Search view, quick modal, and status bar integration
- **📊 Performance Optimized**: Handles 100k+ lines with scalable performance

## Quick Start

### Installation

1. Download the latest release from GitHub
2. Extract to your Obsidian plugins folder: `VaultFolder/.obsidian/plugins/semantic-search/`
3. Enable the plugin in Obsidian Settings → Community Plugins
4. Wait for initial indexing to complete (shown in status bar)

### Basic Usage

**Search View**: Click the brain icon in the ribbon or use `Ctrl+Shift+S` (Cmd+Shift+S on Mac)

**Quick Search**: Use command palette → "Semantic Search: Quick Search" or `Ctrl+Shift+F`

**Example Searches**:
- "project management methodology" → finds content about Agile, Scrum, planning
- "debugging techniques" → discovers troubleshooting approaches across notes
- "meeting notes from last week" → locates recent meeting documentation

## Configuration

Access settings via Settings → Semantic Search Plugin:

### Index Settings
- **Auto-index on startup**: Automatically rebuild index when Obsidian opens
- **Index update interval**: How often to check for file changes (default: 30 seconds)
- **Chunk size**: Text chunk size for embedding (default: 500 characters)
- **Chunk overlap**: Overlap between chunks (default: 50 characters)

### Search Settings
- **Maximum results**: Number of search results to display (default: 20)
- **Similarity threshold**: Minimum similarity score for results (default: 0.3)
- **Enable tag filtering**: Include tag-based filtering in searches
- **Snippet length**: Length of preview snippets (default: 150 characters)

### Performance Settings
- **Batch size**: Number of files to process simultaneously (default: 10)
- **Memory limit**: Maximum memory usage for indexing (default: 500MB)
- **Background processing**: Use web workers for non-blocking operations

## Architecture

### Core Components

- **DocumentIndexer**: Manages vault indexing and file processing
- **SemanticSearchEngine**: Handles embedding generation and similarity search
- **FileWatcher**: Monitors file changes for real-time updates
- **IndexStorage**: RxDB-based local storage with horizontal partitioning
- **EmbeddingEngine**: Transformers.js integration for offline AI models

### Data Flow

1. **Indexing**: Files → Chunks → Embeddings → IndexedDB
2. **Search**: Query → Embedding → Similarity Calculation → Ranked Results
3. **Updates**: File Change → Re-embedding → Index Update

### AI Model

Uses `all-MiniLM-L6-v2` quantized model (384 dimensions):
- **Size**: ~23MB bundled with plugin
- **Language**: Optimized for English text
- **Performance**: ~100ms per embedding on modern hardware
- **Quality**: State-of-the-art sentence similarity

## Performance

### Benchmarks

| Vault Size | Initial Index | Update Time | Search Time | Memory Usage |
|------------|---------------|-------------|-------------|--------------|
| 10k lines  | 30 seconds    | 5 seconds   | 200ms       | 50MB         |
| 100k lines | 5 minutes     | 30 seconds  | 500ms       | 200MB        |
| 1M lines   | 30 minutes    | 60 seconds  | 1000ms      | 500MB        |

### Optimization Tips

1. **Exclude large files**: Use `.obsidian-search-ignore` to skip binary/large files
2. **Adjust chunk size**: Smaller chunks = more precise search, larger chunks = better context
3. **Tune similarity threshold**: Lower values = more results, higher values = more precise
4. **Enable background processing**: Prevents UI blocking during large operations

## Development

### Prerequisites

```bash
node --version  # v16+ required
npm --version   # v7+ required
```

### Setup

```bash
# Clone and install
git clone <repository-url>
cd obsidian-semantic-search
npm install

# Development build
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run performance tests
npm run test:performance

# Lint code
npm run lint
```

### Project Structure

```
src/
├── models/           # Data models (Document, Chunk, Tag, etc.)
├── services/         # Core services (Indexer, Search, Storage)
├── ui/               # User interface components
└── workers/          # Web Workers for background processing

tests/
├── unit/             # Unit tests for utilities
├── integration/      # Integration tests
├── contracts/        # Interface contract tests
└── performance/      # Performance validation

specs/
└── 001-obsidian-search-plugin/
    ├── spec.md       # Feature specification
    ├── research.md   # Technical research
    └── contracts/    # TypeScript interfaces
```

### Adding New Features

1. **Define Interface**: Add contracts in `specs/001-obsidian-search-plugin/contracts/`
2. **Write Tests**: Create failing tests following TDD approach
3. **Implement Model**: Add data models in `src/models/`
4. **Create Service**: Implement business logic in `src/services/`
5. **Build UI**: Add interface components in `src/ui/`
6. **Integration**: Wire components in `main.ts`

### Testing Strategy

- **Contract Tests**: Verify interface compliance
- **Unit Tests**: Test individual utilities and functions
- **Integration Tests**: Validate component interactions
- **Performance Tests**: Ensure scalability requirements

## Troubleshooting

### Common Issues

**"Indexing failed" error**:
- Check available disk space (needs ~500MB for large vaults)
- Verify file permissions in vault folder
- Check browser console for detailed error messages

**Slow search performance**:
- Reduce similarity threshold in settings
- Enable background processing
- Close other resource-intensive applications

**Missing search results**:
- Wait for indexing to complete (check status bar)
- Lower similarity threshold
- Verify files contain searchable text content

**High memory usage**:
- Reduce batch size in settings
- Enable background processing
- Restart Obsidian to clear memory

### Debug Mode

Enable debug logging in settings for detailed troubleshooting:

```javascript
// Browser console
localStorage.setItem('semantic-search-debug', 'true');
```

### Support

- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions on GitHub
- **Documentation**: Visit plugin wiki for advanced guides

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Make changes following coding standards
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Submit pull request with detailed description

### Code Standards

- **TypeScript**: Strict mode enabled, all types explicit
- **ESLint**: Use provided configuration
- **Testing**: TDD approach, 80%+ coverage
- **Documentation**: JSDoc comments for public APIs
- **Performance**: Consider impact on large vaults

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0 (Initial Release)
- Offline semantic search using Transformers.js
- Real-time index updates within 30 seconds
- Support for 100k+ line vaults
- Multiple search interfaces (view, modal, status bar)
- Comprehensive test suite and performance validation
- Full Obsidian plugin integration

## Acknowledgments

- [Transformers.js](https://huggingface.co/docs/transformers.js) for offline AI models
- [RxDB](https://rxdb.info/) for reactive database functionality
- [Obsidian](https://obsidian.md/) for the excellent plugin API
- Sentence Transformers team for the embedding model