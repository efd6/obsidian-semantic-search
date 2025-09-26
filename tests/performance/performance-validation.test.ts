import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { SemanticSearchEngine } from '../../src/services/SemanticSearchEngine';
import { FileWatcher } from '../../src/services/FileWatcher';
import { EmbeddingEngine } from '../../src/services/EmbeddingEngine';
import { IndexStorage } from '../../src/services/IndexStorage';
import { Document } from '../../src/models/Document';
import { SearchResult } from '../../src/models/SearchResult';
import { MockApp } from '../setup';

describe('Performance Validation Tests', (): void => {
    let indexer: DocumentIndexer;
    let searchEngine: SemanticSearchEngine;
    let fileWatcher: FileWatcher;
    let mockApp: MockApp;
    let storage: IndexStorage;

    beforeEach(async (): Promise<void> => {
        mockApp = new MockApp();
        storage = new IndexStorage();
        indexer = new DocumentIndexer(mockApp, storage);
        searchEngine = new SemanticSearchEngine(storage);
        fileWatcher = new FileWatcher(mockApp, indexer);

        await storage.initialize();
    });

    afterEach(async (): Promise<void> => {
        await storage.close();
    });

    describe('Quickstart Scenario 1: Initial Vault Index (100k lines)', (): void => {
        it('should complete initial indexing within performance targets', async (): Promise<void> => {
            // Generate test vault with ~100k lines (typical: 50 lines per file, 2000 files)
            const testFiles: Array<{ path: string; content: string }> = generateTestVault(100000);

            const startTime: number = Date.now();

            // Mock file reading for test files
            mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                testFiles.map((file): string => file.path)
            );
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                const file = testFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            // Perform initial indexing
            await indexer.indexVault();

            const indexingTime: number = Date.now() - startTime;

            // Initial indexing can take longer (not real-time constraint)
            // But should complete within reasonable time for 100k lines
            expect(indexingTime).toBeLessThan(300000); // 5 minutes max for initial index

            // Verify all files were indexed
            const indexedCount: number = await storage.getDocumentCount();
            expect(indexedCount).toBe(testFiles.length);

            console.log(`Initial indexing of ${testFiles.length} files (100k lines): ${indexingTime}ms`);
        }, 600000); // 10 minute timeout
    });

    describe('Quickstart Scenario 2: Real-time File Updates (30-second target)', (): void => {
        it('should reflect file changes in search within 30 seconds', async (): Promise<void> => {
            // Setup initial small vault
            const initialFiles: Array<{ path: string; content: string }> = generateTestVault(10000); // 10k lines

            mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                initialFiles.map((file): string => file.path)
            );
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                const file = initialFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            // Initial indexing
            await indexer.indexVault();

            // Simulate file modification
            const testFilePath: string = 'test/updated-file.md';
            const originalContent: string = 'Original content about project management and workflows.';
            const updatedContent: string = 'Updated content about semantic search and embedding vectors.';

            // Add original file
            initialFiles.push({ path: testFilePath, content: originalContent });
            await indexer.indexDocument(testFilePath, originalContent);

            // Verify original content is searchable
            const originalResults: SearchResult[] = await searchEngine.search('project management', 5);
            expect(originalResults.length).toBeGreaterThan(0);

            // Simulate file change and measure update time
            const updateStartTime: number = Date.now();

            // Update mock to return new content
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                if (path === testFilePath) {
                    return Promise.resolve(updatedContent);
                }
                const file = initialFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            // Trigger file update through FileWatcher
            await fileWatcher.handleFileChange(testFilePath);

            const updateTime: number = Date.now() - updateStartTime;

            // Verify updated content is searchable within 30 seconds
            expect(updateTime).toBeLessThan(30000); // 30 second target

            const newResults: SearchResult[] = await searchEngine.search('semantic embedding', 5);
            expect(newResults.length).toBeGreaterThan(0);
            expect(newResults[0]?.documentPath).toBe(testFilePath);

            console.log(`File update reflected in search: ${updateTime}ms`);
        }, 45000); // 45 second timeout with buffer
    });

    describe('Scalability Tests: Multiple File Sizes', (): void => {
        const testCases = [
            { lines: 100000, expectedTime: 30000, description: '100k lines' },
            { lines: 200000, expectedTime: 40000, description: '200k lines (+10s)' },
            { lines: 300000, expectedTime: 50000, description: '300k lines (+20s)' },
            { lines: 500000, expectedTime: 70000, description: '500k lines (+40s)' }
        ];

        testCases.forEach(({ lines, expectedTime, description }): void => {
            it(`should handle updates for ${description} within time limits`, async (): Promise<void> => {
                const testFiles: Array<{ path: string; content: string }> = generateTestVault(lines);

                mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                    testFiles.map((file): string => file.path)
                );
                mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                    const file = testFiles.find((f): boolean => f.path === path);
                    return Promise.resolve(file?.content ?? '');
                });

                // Initial indexing (not timed for this test)
                await indexer.indexVault();

                // Test single file update performance
                const testFile: string = testFiles[0]?.path ?? 'test.md';
                const updateStartTime: number = Date.now();

                await fileWatcher.handleFileChange(testFile);

                const updateTime: number = Date.now() - updateStartTime;

                expect(updateTime).toBeLessThan(expectedTime);

                console.log(`Update time for ${description}: ${updateTime}ms (limit: ${expectedTime}ms)`);
            }, expectedTime + 15000); // Add buffer to Jest timeout
        });
    });

    describe('Batch Update Performance', (): void => {
        it('should efficiently handle multiple simultaneous file changes', async (): Promise<void> => {
            const testFiles: Array<{ path: string; content: string }> = generateTestVault(50000);

            mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                testFiles.map((file): string => file.path)
            );
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                const file = testFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            await indexer.indexVault();

            // Simulate 10 files changing simultaneously
            const changedFiles: string[] = testFiles.slice(0, 10).map((file): string => file.path);

            const batchStartTime: number = Date.now();

            // Process all changes (FileWatcher should batch these)
            const updatePromises: Promise<void>[] = changedFiles.map(
                (filePath: string): Promise<void> => fileWatcher.handleFileChange(filePath)
            );

            await Promise.all(updatePromises);

            const batchTime: number = Date.now() - batchStartTime;

            // Batch processing should be more efficient than individual updates
            // Should complete within 30 seconds for 10 files in 50k line vault
            expect(batchTime).toBeLessThan(30000);

            console.log(`Batch update of ${changedFiles.length} files: ${batchTime}ms`);
        }, 45000);
    });

    describe('Memory Usage Validation', (): void => {
        it('should maintain reasonable memory usage during large operations', async (): Promise<void> => {
            const initialMemory: number = process.memoryUsage().heapUsed;

            // Index large vault
            const testFiles: Array<{ path: string; content: string }> = generateTestVault(100000);

            mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                testFiles.map((file): string => file.path)
            );
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                const file = testFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            await indexer.indexVault();

            const peakMemory: number = process.memoryUsage().heapUsed;
            const memoryIncrease: number = peakMemory - initialMemory;

            // Memory increase should be reasonable (less than 500MB for 100k lines)
            expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);

            console.log(`Memory increase for 100k line indexing: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        }, 300000);
    });

    describe('Search Performance Validation', (): void => {
        it('should return search results within 2 seconds', async (): Promise<void> => {
            const testFiles: Array<{ path: string; content: string }> = generateTestVault(100000);

            mockApp.vault.adapter.list = jest.fn().mockResolvedValue(
                testFiles.map((file): string => file.path)
            );
            mockApp.vault.adapter.read = jest.fn().mockImplementation((path: string): Promise<string> => {
                const file = testFiles.find((f): boolean => f.path === path);
                return Promise.resolve(file?.content ?? '');
            });

            await indexer.indexVault();

            // Test various search queries
            const searchQueries: string[] = [
                'project management workflow',
                'machine learning algorithm',
                'database optimization performance',
                'user interface design patterns'
            ];

            for (const query of searchQueries) {
                const searchStartTime: number = Date.now();

                const results: SearchResult[] = await searchEngine.search(query, 10);

                const searchTime: number = Date.now() - searchStartTime;

                expect(searchTime).toBeLessThan(2000); // 2 second limit
                expect(results.length).toBeGreaterThan(0);

                console.log(`Search "${query}": ${searchTime}ms, ${results.length} results`);
            }
        }, 60000);
    });
});

// Utility function to generate test vault content
function generateTestVault(totalLines: number): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    const linesPerFile: number = 50; // Average lines per markdown file
    const fileCount: number = Math.ceil(totalLines / linesPerFile);

    const sampleContent: string[] = [
        'This is a sample document about project management and workflow optimization.',
        'We discuss various methodologies including Agile, Scrum, and Kanban approaches.',
        'Key performance indicators (KPIs) are essential for measuring project success.',
        'Team collaboration tools enhance productivity and communication effectiveness.',
        'Documentation standards ensure consistent knowledge sharing across teams.',
        'Version control systems like Git provide robust change management capabilities.',
        'Continuous integration and deployment (CI/CD) streamline development processes.',
        'Code review practices improve software quality and team knowledge sharing.',
        'Security considerations must be integrated throughout the development lifecycle.',
        'Performance monitoring and optimization are crucial for system reliability.'
    ];

    for (let i = 0; i < fileCount; i++) {
        const fileName: string = `test-file-${i.toString().padStart(4, '0')}.md`;
        const filePath: string = `test/${Math.floor(i / 100).toString().padStart(2, '0')}/${fileName}`;

        let content: string = `# Test Document ${i}\n\n`;

        // Generate content to reach target lines per file
        for (let line = 0; line < linesPerFile - 2; line++) {
            const contentIndex: number = (i + line) % sampleContent.length;
            content += sampleContent[contentIndex] + '\n';
        }

        files.push({ path: filePath, content });
    }

    return files;
}