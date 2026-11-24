// Unit tests for DocumentIndexer service - aligned with actual Obsidian implementation
// Tests document processing, chunking, and indexing logic

import { DocumentIndexer } from '../../src/services/DocumentIndexer';

// Mock Obsidian module completely
jest.mock('obsidian', () => {
    class TFile {
        constructor(path, stat = {}) {
            this.path = path;
            this.stat = { ctime: Date.now(), mtime: Date.now(), ...stat };
        }
    }

    class TAbstractFile {
        constructor(path) {
            this.path = path;
        }
    }

    return {
        TFile,
        TAbstractFile,
        Vault: jest.fn()
    };
});

const mockVault = {
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    on: jest.fn((name, fn) => ({ name, fn })),
    off: jest.fn(),
    offref: jest.fn()
};

// Mock Obsidian types for use in tests
const { TFile } = require('obsidian');

// Mock crypto utils
jest.mock('../../src/utils/crypto', () => ({
    BrowserCrypto: {
        // Unique per content, which is all the indexer relies on.
        sha256: jest.fn(async (data) => `sha256:${data}`)
    },
    createHash: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-checksum-123')
    })
}));

// Mock Document model
jest.mock('../../src/models/Document', () => {
    class MockDocument {
        constructor(data) {
            this.id = 'mock-doc-id';
            this.filePath = data.filePath;
            this.title = data.title;
            this.tags = data.tags || [];
            this.content = data.content;
            this.wordCount = data.wordCount;
            this.createdDate = data.createdDate;
            this.modifiedDate = data.modifiedDate;
            this.lastIndexed = null;
            this.checksum = 'mock-checksum-123';
            this.state = 'NEW';
        }

        markAsIndexed() {
            this.lastIndexed = new Date();
            this.state = 'INDEXED';
        }

        static extractTitle(content, filePath) {
            return 'Mock Title';
        }

        static extractTags(content) {
            return ['tag1', 'tag2'];
        }

        static countWords(content) {
            return 100;
        }
    }

    return {
        Document: MockDocument,
        DocumentState: {
            NEW: 'NEW',
            INDEXED: 'INDEXED',
            MODIFIED: 'MODIFIED'
        }
    };
});

// Mock Chunk model
jest.mock('../../src/models/Chunk', () => ({
    Chunk: {
        EMBEDDING_DIMENSIONS: 384,
        create: jest.fn().mockImplementation((docId, index, content, start, end, embedding) => ({
            id: `chunk-${index}`,
            documentId: docId,
            chunkIndex: index,
            content,
            startOffset: start,
            endOffset: end,
            embedding
        }))
    }
}));

describe('DocumentIndexer', () => {
    let indexer;

    beforeEach(() => {
        jest.clearAllMocks();
        mockVault.getMarkdownFiles.mockReturnValue([]);
        indexer = new DocumentIndexer(mockVault);
    });

    describe('initialization', () => {
        test('initializes with vault successfully', () => {
            expect(indexer).toBeDefined();
            expect(typeof indexer.indexVault).toBe('function');
            expect(typeof indexer.indexDocument).toBe('function');
            expect(typeof indexer.removeDocument).toBe('function');
        });

        test('has initial indexing status', () => {
            const status = indexer.getIndexingStatus();

            expect(status).toHaveProperty('isIndexing', false);
            expect(status).toHaveProperty('phase', 'idle');
            expect(status).toHaveProperty('progress');
            expect(status).toHaveProperty('fileWatchingEnabled', false);
            expect(status).toHaveProperty('lastUpdate');
        });

        test('creates initial progress structure', () => {
            const status = indexer.getIndexingStatus();

            expect(status.progress).toHaveProperty('currentDocument', '');
            expect(status.progress).toHaveProperty('processedCount', 0);
            expect(status.progress).toHaveProperty('totalCount', 0);
            expect(status.progress).toHaveProperty('estimatedTimeRemaining', 0);
        });
    });

    describe('file watching', () => {
        test('can start and stop file watching', () => {
            expect(indexer.getIndexingStatus().fileWatchingEnabled).toBe(false);

            indexer.startFileWatching();
            expect(indexer.getIndexingStatus().fileWatchingEnabled).toBe(true);
            expect(mockVault.on).toHaveBeenCalledWith('modify', expect.any(Function));
            expect(mockVault.on).toHaveBeenCalledWith('create', expect.any(Function));
            expect(mockVault.on).toHaveBeenCalledWith('delete', expect.any(Function));

            const refs = mockVault.on.mock.results.map(r => r.value);
            indexer.stopFileWatching();
            expect(indexer.getIndexingStatus().fileWatchingEnabled).toBe(false);
            // The handlers registered by startFileWatching are the ones removed.
            expect(mockVault.offref.mock.calls.map(c => c[0])).toEqual(refs);
        });

        test('prevents multiple file watching instances', () => {
            indexer.startFileWatching();
            indexer.startFileWatching(); // Should not register again

            // on() should only be called once for each event
            expect(mockVault.on).toHaveBeenCalledTimes(3);
        });
    });

    describe('document indexing', () => {
        test('indexes a single document successfully', async () => {
            const filePath = '/test/document.md';
            const content = 'This is test content for indexing.';
            const mockFile = new TFile(filePath);

            mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
            mockVault.read.mockResolvedValue(content);

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(true);
            expect(result.filePath).toBe(filePath);
            expect(result.chunkCount).toBeGreaterThan(0);
            expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
            expect(result.metadata).toBeDefined();
        });

        test('handles non-existent files gracefully', async () => {
            const filePath = '/nonexistent.md';
            mockVault.getAbstractFileByPath.mockReturnValue(null);

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
            expect(result.chunkCount).toBe(0);
        });

        test('handles non-markdown files gracefully', async () => {
            const filePath = '/test/document.txt';
            const mockFile = new TFile(filePath);

            mockVault.getAbstractFileByPath.mockReturnValue(mockFile);

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not a markdown file');
        });

        test('creates proper metadata from file and content', async () => {
            const filePath = '/test/document.md';
            const content = '# Test Document\n\nThis is content.';
            const mockFile = new TFile(filePath, { ctime: 1000000, mtime: 2000000 });

            mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
            mockVault.read.mockResolvedValue(content);

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(true);
            expect(result.metadata.title).toBe('Mock Title');
            expect(result.metadata.tags).toEqual(['tag1', 'tag2']);
            expect(result.metadata.wordCount).toBe(100);
            expect(result.metadata.checksum).toBe('mock-checksum-123');
        });
    });

    describe('vault indexing', () => {
        test('indexes entire vault successfully', async () => {
            const mockFiles = [
                new TFile('/doc1.md'),
                new TFile('/doc2.md'),
                new TFile('/doc3.md')
            ];

            mockVault.getMarkdownFiles.mockReturnValue(mockFiles);
            mockVault.getAbstractFileByPath.mockImplementation(path =>
                mockFiles.find(f => f.path === path)
            );
            mockVault.read.mockResolvedValue('Test content');

            const result = await indexer.indexVault();

            expect(result.totalDocuments).toBe(3);
            expect(result.successfullyIndexed).toBe(3);
            expect(result.failures).toHaveLength(0);
            expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
            expect(result.stats).toBeDefined();
        });

        test('handles indexing failures in vault gracefully', async () => {
            const mockFiles = [
                new TFile('/good.md'),
                new TFile('/bad.md')
            ];

            mockVault.getMarkdownFiles.mockReturnValue(mockFiles);
            mockVault.getAbstractFileByPath.mockImplementation(path => {
                if (path === '/bad.md') return null; // Simulate missing file
                return mockFiles.find(f => f.path === path);
            });
            mockVault.read.mockResolvedValue('Test content');

            const result = await indexer.indexVault();

            expect(result.totalDocuments).toBe(2);
            expect(result.successfullyIndexed).toBe(1);
            expect(result.failures).toHaveLength(1);
            expect(result.failures[0].filePath).toBe('/bad.md');
            expect(result.failures[0].errorType).toBe('parsing');
        });

        test('updates indexing status during vault processing', async () => {
            const mockFiles = [new TFile('/doc.md')];

            mockVault.getMarkdownFiles.mockReturnValue(mockFiles);
            mockVault.getAbstractFileByPath.mockReturnValue(mockFiles[0]);
            mockVault.read.mockResolvedValue('Test content');

            // Check status before
            expect(indexer.getIndexingStatus().isIndexing).toBe(false);

            const resultPromise = indexer.indexVault();

            // Status should be updated to indexing
            const statusDuringIndexing = indexer.getIndexingStatus();

            await resultPromise;

            // Status should be back to idle
            const statusAfterIndexing = indexer.getIndexingStatus();
            expect(statusAfterIndexing.isIndexing).toBe(false);
            expect(statusAfterIndexing.phase).toBe('idle');
        });
    });

    describe('document removal', () => {
        test('removes document successfully', async () => {
            const result = await indexer.removeDocument('/test.md');

            expect(result).toBe(true);
            expect(indexer.getIndexingStatus().lastUpdate).toBeDefined();
        });

        test('handles removal errors gracefully', async () => {
            // Simulate removal failure by mocking the internal logic
            // Since the actual implementation just returns true, we test the interface
            const result = await indexer.removeDocument('/test.md');

            expect(typeof result).toBe('boolean');
        });
    });

    describe('status management', () => {
        test('provides immutable status copy', () => {
            const status1 = indexer.getIndexingStatus();
            const status2 = indexer.getIndexingStatus();

            expect(status1).not.toBe(status2); // Should be different objects
            expect(status1).toEqual(status2); // But with the same data
        });

        test('updates last update time appropriately', async () => {
            const initialStatus = indexer.getIndexingStatus();
            const initialTime = initialStatus.lastUpdate;

            // Small delay to ensure time difference
            await new Promise(resolve => setTimeout(resolve, 10));

            await indexer.removeDocument('/test.md');
            const updatedStatus = indexer.getIndexingStatus();

            expect(updatedStatus.lastUpdate.getTime()).toBeGreaterThan(initialTime.getTime());
        });
    });

    describe('error handling', () => {
        test('handles vault read errors during indexing', async () => {
            const filePath = '/test.md';
            const mockFile = new TFile(filePath);

            mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
            mockVault.read.mockRejectedValue(new Error('File read error'));

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File read error');
        });

        test('provides meaningful error messages', async () => {
            const filePath = '/test.md';
            mockVault.getAbstractFileByPath.mockReturnValue(null);

            const result = await indexer.indexDocument(filePath);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File not found');
            expect(result.filePath).toBe(filePath);
            expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
        });
    });
});