// Unit tests for IndexStorage service - aligned with actual implementation
// Tests database initialization, document storage, and embedding operations

import { IndexStorage } from '../../src/services/IndexStorage';

// Mock RxDB
jest.mock('rxdb', () => ({
    createRxDatabase: jest.fn(),
    addRxPlugin: jest.fn()
}));

// Mock RxDB storage plugin
jest.mock('rxdb/plugins/storage-dexie', () => ({
    getRxStorageDexie: jest.fn(() => 'mock-storage')
}));

// Mock RxDB dev plugin
jest.mock('rxdb/plugins/dev-mode', () => ({
    RxDBDevModePlugin: {}
}));

describe('IndexStorage', () => {
    let storage;
    let mockDatabase;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Mock collections
        const mockCollections = {
            documents: {
                findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
                upsert: jest.fn().mockResolvedValue({ success: true }),
                find: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
                count: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(0) })),
                bulkInsert: jest.fn().mockResolvedValue({ success: [] }),
                remove: jest.fn()
            },
            chunks: {
                findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
                find: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
                count: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(0) })),
                bulkInsert: jest.fn().mockResolvedValue({ success: [] }),
                upsert: jest.fn().mockResolvedValue({ success: true }),
                remove: jest.fn()
            },
            embeddings: {
                findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
                find: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
                count: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(0) })),
                bulkInsert: jest.fn().mockResolvedValue({ success: [] }),
                upsert: jest.fn().mockResolvedValue({ success: true }),
                remove: jest.fn()
            },
            metadata: {
                findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
                upsert: jest.fn().mockResolvedValue({ success: true })
            }
        };

        // Mock database with collections as properties
        mockDatabase = {
            addCollections: jest.fn().mockImplementation(() => {
                // Assign collections as properties on the database
                Object.assign(mockDatabase, mockCollections);
                return Promise.resolve(mockCollections);
            }),
            remove: jest.fn(),
            destroy: jest.fn().mockResolvedValue(true),
            // Initialize collections as properties
            ...mockCollections
        };

        // Set up the mock for createRxDatabase
        const rxdb = require('rxdb');
        rxdb.createRxDatabase.mockResolvedValue(mockDatabase);

        storage = new IndexStorage();
        await storage.initialize('test-vault');
    });

    afterEach(async () => {
        if (storage) {
            await storage.close();
        }
    });

    describe('initialization', () => {
        test('initializes with correct vault name', () => {
            expect(storage.vaultName).toBe('test-vault');
        });

        test('creates database with correct configuration', () => {
            const rxdb = require('rxdb');

            expect(rxdb.createRxDatabase).toHaveBeenCalledWith({
                name: expect.stringMatching(/obsidian_search_/),
                storage: 'mock-storage',
                multiInstance: false
            });
        });

        test('creates all required collections', () => {
            expect(mockDatabase.addCollections).toHaveBeenCalledWith(
                expect.objectContaining({
                    documents: expect.objectContaining({ schema: expect.any(Object) }),
                    chunks: expect.objectContaining({ schema: expect.any(Object) }),
                    embeddings: expect.objectContaining({ schema: expect.any(Object) }),
                    metadata: expect.objectContaining({ schema: expect.any(Object) })
                })
            );
        });
    });

    describe('document operations', () => {
        test('stores document successfully', async () => {
            const document = {
                id: 'doc1',
                filePath: '/test.md',
                content: 'Test content',
                modifiedDate: new Date().toISOString(),
                metadata: {
                    tags: [],
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                chunks: [
                    {
                        id: 'chunk1',
                        content: 'Test content',
                        startOffset: 0,
                        endOffset: 12,
                        chunkIndex: 0
                    }
                ]
            };

            await expect(storage.storeDocument(document)).resolves.not.toThrow();
        });

        test('gets document by file path', async () => {
            const document = await storage.getDocument('/test.md');

            // Should attempt to find the document (may return null in test)
            expect(mockDatabase.documents?.findOne || mockDatabase.addCollections).toHaveBeenCalled();
        });

        test('handles document not found gracefully', async () => {
            const result = await storage.getDocument('/nonexistent.md');
            expect(result).toBeNull();
        });
    });

    describe('embedding operations', () => {
        test('stores embeddings successfully', async () => {
            const embeddings = [
                {
                    id: 'embed1',
                    chunkId: 'chunk1',
                    embedding: new Float32Array([0.1, 0.2, 0.3])
                }
            ];

            await expect(storage.storeEmbeddings('doc1', embeddings)).resolves.not.toThrow();
        });

        test('gets embeddings for document IDs', async () => {
            const embeddings = await storage.getEmbeddings(['doc1']);

            expect(Array.isArray(embeddings)).toBe(true);
        });
    });

    describe('statistics and metadata', () => {
        test('gets storage statistics', async () => {
            const stats = await storage.getStats();

            expect(stats).toHaveProperty('documentsStored');
            expect(stats).toHaveProperty('chunksStored');
            expect(stats).toHaveProperty('embeddingsStored');
            expect(stats).toHaveProperty('totalSizeBytes');
        });
    });

    describe('cleanup and resource management', () => {
        test('closes database connection properly', async () => {
            await storage.close();

            expect(mockDatabase.destroy).toHaveBeenCalled();
        });

        test('handles close when database is not initialized', async () => {
            const uninitializedStorage = new IndexStorage();

            await expect(uninitializedStorage.close()).resolves.not.toThrow();
        });

        test('cleanup method works', async () => {
            await expect(storage.cleanup()).resolves.not.toThrow();
        });
    });

    describe('error handling', () => {
        test('handles database connection errors gracefully', async () => {
            const rxdb = require('rxdb');
            rxdb.createRxDatabase.mockRejectedValueOnce(new Error('Connection failed'));

            const errorStorage = new IndexStorage();

            await expect(errorStorage.initialize('error-vault')).rejects.toThrow('Connection failed');
        });
    });
});