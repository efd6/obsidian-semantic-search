// Integration tests for plugin lifecycle and service initialization
// Tests complete plugin loading, service initialization, and UI interactions

import SemanticSearchPluginMain from '../../main';
import { createTestApp, createTestPlugin } from '../setup/ObsidianMocks';

// Mock TensorFlow.js modules for integration testing
jest.mock('@tensorflow/tfjs', () => ({
    ready: jest.fn().mockResolvedValue(undefined),
    getBackend: jest.fn().mockReturnValue('cpu'),
    version: { 'tfjs-core': '4.15.0' }
}));

jest.mock('@tensorflow-models/universal-sentence-encoder', () => ({
    load: jest.fn().mockResolvedValue({
        embed: jest.fn().mockImplementation(async (texts) => {
            const textArray = Array.isArray(texts) ? texts : [texts];
            const embeddings = new Float32Array(textArray.length * 512);

            textArray.forEach((text, textIndex) => {
                const source = typeof text === 'string' ? text : String(text ?? '');
                const hash = source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const offset = textIndex * 512;

                for (let i = 0; i < 512; i++) {
                    embeddings[offset + i] = Math.sin((hash + i) / 100) * 0.1;
                }
            });

            return {
                data: jest.fn().mockResolvedValue(embeddings),
                dispose: jest.fn()
            };
        })
    })
}));


describe('Plugin Lifecycle Integration', () => {
    let plugin;
    let mockApp;
    let testFiles;

    beforeEach(() => {
        // Set up test Obsidian environment
        testFiles = {
            '/daily/2023-01-01.md': `# Daily Note

            Today I worked on machine learning algorithms and reviewed neural network architectures.

            #daily #ml #notes`,

            '/projects/web-app.md': `# Web Application Project

            Building a React-based frontend with Node.js backend.

            ## Features
            - User authentication
            - Real-time data updates
            - Responsive design

            #project #web-development #react #nodejs`,

            '/research/ai-papers.md': `# AI Research Papers

            ## Recent Papers
            1. "Attention is All You Need" - Transformer architecture
            2. "BERT: Pre-training Deep Bidirectional Transformers"
            3. "GPT-3: Language Models are Few-Shot Learners"

            #research #ai #papers #transformers`
        };

        mockApp = createTestApp(testFiles);
        plugin = new SemanticSearchPluginMain(mockApp, {
            id: 'semantic-search-plugin',
            name: 'Semantic Search Plugin',
            version: '1.0.0'
        });
    });

    afterEach(async () => {
        if (plugin && plugin.onunload) {
            await plugin.onunload();
        }
    });

    describe('plugin initialization', () => {
        test('loads and initializes all services successfully', async () => {
            // Act: Load plugin
            await plugin.onload();

            // Assert: All services should be initialized
            expect(plugin.indexStorage).toBeDefined();
            expect(plugin.embeddingEngine).toBeDefined();
            expect(plugin.documentIndexer).toBeDefined();
            expect(plugin.semanticSearchEngine).toBeDefined();
            expect(plugin.fileWatcher).toBeDefined();

            // Check that services are properly connected
            expect(plugin.documentIndexer.storage).toBe(plugin.indexStorage);
            expect(plugin.documentIndexer.embeddingEngine).toBe(plugin.embeddingEngine);
            expect(plugin.semanticSearchEngine.storage).toBe(plugin.indexStorage);
            expect(plugin.semanticSearchEngine.embeddingEngine).toBe(plugin.embeddingEngine);
        }, 30000);

        test('registers commands and UI elements', async () => {
            await plugin.onload();

            // Assert: Commands should be registered
            expect(plugin.commands.length).toBeGreaterThan(0);

            const commandIds = plugin.commands.map(cmd => cmd.id);
            expect(commandIds).toContain('open-semantic-search');
            expect(commandIds).toContain('rebuild-index');

            // Check that ribbon icon was added (if implemented)
            expect(plugin.ribbonIcon).toBeDefined();
        }, 10000);

    });

    describe('file watching and auto-indexing', () => {
        test('automatically indexes vault files on startup', async () => {
            await plugin.onload();

            // Wait for initial indexing to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Assert: Should have indexed the test files
            const searchResults = await plugin.semanticSearchEngine.semanticSearch({
                text: 'machine learning',
                limit: 10
            });
            expect(searchResults.results.length).toBeGreaterThan(0);

            const webResults = await plugin.semanticSearchEngine.semanticSearch({
                text: 'React frontend',
                limit: 10
            });
            expect(webResults.results.length).toBeGreaterThan(0);
        }, 30000);

        test('reindexes files when they change', async () => {
            await plugin.onload();

            // Wait for initial indexing
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Simulate file modification
            const updatedContent = `# Updated Daily Note

            Today I learned about advanced deep learning techniques and transformer models.

            #daily #deep-learning #transformers`;

            mockApp.vault.addFile('/daily/2023-01-01.md', updatedContent);

            // Simulate file change event
            mockApp.vault.trigger('modify', { path: '/daily/2023-01-01.md' });

            // Wait for reindexing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Assert: Updated content should be searchable
            const results = await plugin.semanticSearchEngine.semanticSearch({
                text: 'deep learning transformers',
                limit: 10
            });
            expect(results.results.length).toBeGreaterThan(0);

            const updatedResult = results.results.find(r =>
                r.filePath === '/daily/2023-01-01.md'
            );
            expect(updatedResult).toBeDefined();
        }, 30000);

        test('removes indexed content when files are deleted', async () => {
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify file is indexed
            let results = await plugin.semanticSearchEngine.semanticSearch({
                text: 'AI research papers',
                limit: 10
            });
            expect(results.results.length).toBeGreaterThan(0);

            // Simulate file deletion with proper MockTFile
            const mockDeletedFile = new (require('../setup/ObsidianMocks').TFile)('/research/ai-papers.md');
            mockApp.vault.trigger('delete', mockDeletedFile);

            // Wait for cleanup (debounce + processing time)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Assert: Deleted file content should no longer appear
            results = await plugin.semanticSearchEngine.semanticSearch({
                text: 'AI research papers',
                limit: 10
            });
            const deletedResult = results.results.find(r =>
                r.filePath === '/research/ai-papers.md'
            );
            expect(deletedResult).toBeUndefined();
        }, 20000);
    });

    describe('search functionality', () => {
        test('provides semantic search through command palette', async () => {
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate executing search command
            const searchCommand = plugin.commands.find(cmd => cmd.id === 'open-semantic-search');
            expect(searchCommand).toBeDefined();

            // Mock search modal interaction
            const mockModal = {
                open: jest.fn(),
                close: jest.fn(),
                setQuery: jest.fn(),
                getResults: jest.fn().mockResolvedValue([])
            };

            // Execute search command
            await searchCommand.callback();

            // Search functionality should be accessible
            expect(true).toBe(true); // Test that command executes without error
        }, 15000);

        test('handles search queries with various complexity', async () => {
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Test various search patterns
            const queries = [
                'machine learning',
                'web development React',
                'AI research transformers',
                'daily notes',
                'authentication backend'
            ];

            for (const query of queries) {
                const results = await plugin.semanticSearchEngine.semanticSearch({
                    text: query,
                    limit: 10
                });
                expect(results.results).toBeInstanceOf(Array);
                // Results may be empty, but should not throw errors
            }
        }, 20000);
    });

    describe('settings and configuration', () => {
        test('loads and saves plugin settings', async () => {
            await plugin.onload();

            // Test default settings
            expect(plugin.settings).toBeDefined();
            expect(plugin.settings.chunkSize).toBe(1800);
            expect(plugin.settings.maxResults).toBe(10);

            // Test settings update
            const newSettings = {
                chunkSize: 300,
                maxResults: 20,
                minSimilarity: 0.15
            };

            await plugin.updateSettings(newSettings);

            expect(plugin.settings.chunkSize).toBe(300);
            expect(plugin.settings.maxResults).toBe(20);
        }, 10000);

        test('applies settings changes to services', async () => {
            await plugin.onload();

            // Update chunk size
            await plugin.updateSettings({ chunkSize: 200 });

            // Services should reflect new settings
            expect(plugin.documentIndexer.chunkSize).toBe(200);
            expect(plugin.semanticSearchEngine.maxResults).toBe(plugin.settings.maxResults);
        }, 10000);
    });

    describe('performance monitoring', () => {
        test('tracks indexing performance metrics', async () => {
            await plugin.onload();

            // Wait for indexing to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Check performance stats
            const stats = plugin.getPerformanceStats();
            expect(stats).toHaveProperty('documentsIndexed');
            expect(stats).toHaveProperty('totalChunks');
            expect(stats).toHaveProperty('indexingTime');
            expect(stats.documentsIndexed).toBeGreaterThan(0);
        }, 15000);

        test('monitors search performance', async () => {
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Perform several searches
            const queries = ['test query 1', 'test query 2', 'test query 3'];
            for (const query of queries) {
                await plugin.semanticSearchEngine.semanticSearch({
                    text: query,
                    limit: 10
                });
            }

            // Check search stats
            const searchStats = plugin.semanticSearchEngine.getSearchStats();
            expect(searchStats.totalSearches).toBeGreaterThanOrEqual(3);
            expect(searchStats.averageSearchTime).toBeGreaterThan(0);
        }, 15000);
    });

    describe('error recovery and resilience', () => {
        test('recovers from temporary service failures', async () => {
            await plugin.onload();

            // Simulate service failure and recovery
            const originalSearch = plugin.semanticSearchEngine.semanticSearch;
            plugin.semanticSearchEngine.semanticSearch = jest.fn().mockRejectedValue(new Error('Temporary failure'));

            // Search should fail gracefully
            await expect(plugin.semanticSearchEngine.semanticSearch({
                text: 'test',
                limit: 10
            })).rejects.toThrow();

            // Restore service
            plugin.semanticSearchEngine.semanticSearch = originalSearch;

            // Should work again after restoration
            const results = await plugin.semanticSearchEngine.semanticSearch({
                text: 'machine learning',
                limit: 10
            });
            expect(results.results).toBeInstanceOf(Array);
        }, 15000);

        test('handles plugin reload gracefully', async () => {
            // Initial load
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Unload
            await plugin.onunload();

            // Reload
            plugin = new SemanticSearchPluginMain(mockApp, {
            id: 'semantic-search-plugin',
            name: 'Semantic Search Plugin',
            version: '1.0.0'
        });
            await plugin.onload();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Should work after reload
            const results = await plugin.semanticSearchEngine.semanticSearch({
                text: 'web development',
                limit: 10
            });
            expect(results.results).toBeInstanceOf(Array);
        }, 20000);
    });

    describe('cleanup and resource management', () => {
        test('properly cleans up resources on unload', async () => {
            await plugin.onload();

            // Track resource usage
            const initialResources = {
                storage: plugin.indexStorage,
                embedding: plugin.embeddingEngine,
                fileWatcher: plugin.fileWatcher
            };

            // Unload plugin
            await plugin.onunload();

            // Resources should be cleaned up
            expect(plugin.indexStorage).toBeUndefined();
            expect(plugin.embeddingEngine).toBeUndefined();
            expect(plugin.fileWatcher).toBeUndefined();
        }, 10000);

        test('handles multiple unload calls safely', async () => {
            await plugin.onload();

            // Multiple unload calls should not cause errors
            await plugin.onunload();
            await plugin.onunload();
            await plugin.onunload();

            expect(true).toBe(true); // Should not throw
        }, 10000);
    });
});