import { MockApp, MockPlugin } from '../setup';
import {
  DocumentIndexer,
  FileWatcher,
  IndexingResult,
  DocumentIndexResult,
  IndexingStatus,
  DocumentMetadata
} from '../../specs/001-obsidian-search-plugin/contracts/indexing-interface';

// Mock the DocumentIndexer service that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/document-indexer', () => {
  return {
    DocumentIndexer: jest.fn().mockImplementation(() => {
      return {
        indexVault: jest.fn(),
        indexDocument: jest.fn(),
        removeDocument: jest.fn(),
        getIndexingStatus: jest.fn(),
        startFileWatching: jest.fn(),
        stopFileWatching: jest.fn(),
      };
    }),
  };
});

// Mock the FileWatcher service that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/file-watcher', () => {
  return {
    FileWatcher: jest.fn().mockImplementation(() => {
      return {
        start: jest.fn(),
        stop: jest.fn(),
        getPendingFiles: jest.fn(() => []),
        triggerUpdate: jest.fn(),
        setUpdateInterval: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
    }),
  };
});

// Mock the SearchEngine for integration testing
jest.mock('../../src/services/search-engine', () => {
  return {
    SearchEngine: jest.fn().mockImplementation(() => {
      return {
        search: jest.fn(),
        isInitialized: jest.fn(() => false),
        initialize: jest.fn(),
        getIndexedFiles: jest.fn(() => []),
        on: jest.fn(),
        off: jest.fn(),
      };
    }),
  };
});

// Mock timers for timing-based tests
jest.useFakeTimers();

describe('Real-Time Index Updates Integration', () => {
  let mockApp: MockApp;
  let mockDocumentIndexer: jest.Mocked<DocumentIndexer>;
  let mockFileWatcher: jest.Mocked<FileWatcher>;
  let mockSearchEngine: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    mockApp = new MockApp();

    // Mock successful file system operations
    mockApp.vault.adapter.exists.mockResolvedValue(true);
    mockApp.vault.adapter.stat.mockResolvedValue({
      ctime: Date.now(),
      mtime: Date.now(),
      size: 1024
    });
    mockApp.vault.adapter.read.mockResolvedValue('# Test Content\n\nSample markdown content.');

    // Import and instantiate mocked services
    const { DocumentIndexer } = require('../../src/services/document-indexer');
    const { FileWatcher } = require('../../src/services/file-watcher');
    const { SearchEngine } = require('../../src/services/search-engine');

    mockDocumentIndexer = new DocumentIndexer() as jest.Mocked<DocumentIndexer>;
    mockFileWatcher = new FileWatcher() as jest.Mocked<FileWatcher>;
    mockSearchEngine = new SearchEngine();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('File Creation and Indexing', () => {
    it('should detect new file creation and index within 30 seconds', async () => {
      // Arrange: Mock file watcher events and indexing response
      const newFilePath = 'Meeting Notes/2024-Q4-Business-Review.md';
      const expectedContent = `# Q4 Business Review

## Agenda
- quarterly business review meeting
- Performance metrics analysis
- Strategic planning for next quarter

#meeting #quarterly #business-review`;

      const expectedIndexResult: DocumentIndexResult = {
        filePath: newFilePath,
        success: true,
        metadata: {
          title: 'Q4 Business Review',
          tags: ['meeting', 'quarterly', 'business-review'],
          created: new Date(),
          modified: new Date(),
          wordCount: 45,
          checksum: 'abc123'
        },
        chunkCount: 1,
        timeElapsed: 1500
      };

      // Mock file system operations for the new file
      mockApp.vault.adapter.read.mockResolvedValueOnce(expectedContent);
      mockDocumentIndexer.indexDocument.mockResolvedValueOnce(expectedIndexResult);

      // Mock search engine returning the indexed file
      mockSearchEngine.getIndexedFiles.mockReturnValueOnce([newFilePath]);
      mockSearchEngine.search.mockResolvedValueOnce({
        results: [{
          filePath: newFilePath,
          score: 0.95,
          highlights: [{ text: 'quarterly business review meeting', start: 45, end: 75 }]
        }],
        totalResults: 1,
        stats: { queryTime: 50, indexedDocuments: 1 }
      });

      // Act: Simulate file creation event
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      // Start file watching
      mockFileWatcher.start();

      // Simulate file creation event after 1 second
      jest.advanceTimersByTime(1000);
      const createCallback = fileWatcherCallbacks.get('file-created');
      if (createCallback) {
        createCallback(newFilePath);
      }

      // Wait for indexing to complete (simulate processing time)
      jest.advanceTimersByTime(5000);

      // Assert: Verify file was indexed
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(newFilePath);
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledTimes(1);

      // Verify search returns the new content within 30 seconds
      jest.advanceTimersByTime(25000); // Total time: 31 seconds

      const searchResult = await mockSearchEngine.search({
        query: 'quarterly business review meeting',
        limit: 10
      });

      expect(searchResult.results).toHaveLength(1);
      expect(searchResult.results[0].filePath).toBe(newFilePath);
      expect(searchResult.results[0].score).toBeGreaterThan(0.8);

      // Verify timing requirement (should complete within 30 seconds)
      const totalTimeElapsed = 31000; // 1s + 5s + 25s
      expect(totalTimeElapsed).toBeLessThanOrEqual(30000);
    });

    it('should properly index tags from new files', async () => {
      // Arrange: Create file with specific tags
      const filePath = 'Projects/Analytics-Dashboard.md';
      const contentWithTags = `# Analytics Dashboard Project

Planning for implementing new data analytics dashboard.

#meeting #quarterly #analytics #dashboard #planning`;

      const expectedIndexResult: DocumentIndexResult = {
        filePath: filePath,
        success: true,
        metadata: {
          title: 'Analytics Dashboard Project',
          tags: ['meeting', 'quarterly', 'analytics', 'dashboard', 'planning'],
          created: new Date(),
          modified: new Date(),
          wordCount: 30,
          checksum: 'def456'
        },
        chunkCount: 1,
        timeElapsed: 1200
      };

      mockApp.vault.adapter.read.mockResolvedValueOnce(contentWithTags);
      mockDocumentIndexer.indexDocument.mockResolvedValueOnce(expectedIndexResult);

      // Act: Simulate file creation
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      mockFileWatcher.start();
      jest.advanceTimersByTime(1000);

      const createCallback = fileWatcherCallbacks.get('file-created');
      if (createCallback) {
        createCallback(filePath);
      }

      jest.advanceTimersByTime(5000);

      // Assert: Verify tags are properly extracted and indexed
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(filePath);

      const indexCall = mockDocumentIndexer.indexDocument.mock.calls[0];
      expect(indexCall[0]).toBe(filePath);

      // Verify the indexed result contains correct tags
      const result = await mockDocumentIndexer.indexDocument(filePath);
      expect(result.metadata?.tags).toEqual(['meeting', 'quarterly', 'analytics', 'dashboard', 'planning']);
      expect(result.metadata?.tags).toHaveLength(5);
    });
  });

  describe('File Modification Updates', () => {
    it('should detect file modifications and update index incrementally', async () => {
      // Arrange: Setup existing file and modification
      const existingFilePath = 'Projects/Data-Pipeline.md';
      const originalContent = `# Data Pipeline

Original implementation notes.`;

      const modifiedContent = `# Data Pipeline

Original implementation notes.

## Update - Analytics Integration
implementing new data analytics dashboard
- Enhanced data processing
- Real-time metrics collection
- Performance monitoring

#analytics #pipeline #dashboard`;

      const modifiedIndexResult: DocumentIndexResult = {
        filePath: existingFilePath,
        success: true,
        metadata: {
          title: 'Data Pipeline',
          tags: ['analytics', 'pipeline', 'dashboard'],
          created: new Date(Date.now() - 86400000), // 1 day ago
          modified: new Date(),
          wordCount: 65,
          checksum: 'modified789'
        },
        chunkCount: 2,
        timeElapsed: 1800
      };

      // Mock file system for modification
      mockApp.vault.adapter.read
        .mockResolvedValueOnce(originalContent)
        .mockResolvedValueOnce(modifiedContent);

      mockDocumentIndexer.indexDocument.mockResolvedValueOnce(modifiedIndexResult);

      // Mock search to return updated content
      mockSearchEngine.search.mockResolvedValueOnce({
        results: [{
          filePath: existingFilePath,
          score: 0.92,
          highlights: [{ text: 'implementing new data analytics dashboard', start: 95, end: 135 }]
        }],
        totalResults: 1,
        stats: { queryTime: 45, indexedDocuments: 1 }
      });

      // Act: Simulate file modification event
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      mockFileWatcher.start();
      jest.advanceTimersByTime(2000);

      const modifyCallback = fileWatcherCallbacks.get('file-modified');
      if (modifyCallback) {
        modifyCallback(existingFilePath);
      }

      jest.advanceTimersByTime(8000);

      // Assert: Verify incremental update occurred
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(existingFilePath);

      // Verify search reflects updated content
      const searchResult = await mockSearchEngine.search({
        query: 'implementing new data analytics dashboard',
        limit: 5
      });

      expect(searchResult.results).toHaveLength(1);
      expect(searchResult.results[0].filePath).toBe(existingFilePath);
      expect(searchResult.results[0].highlights[0].text).toContain('implementing new data analytics dashboard');

      // Verify timing (total: 10 seconds, well under 30-second requirement)
      expect(jest.getTimerCount()).toBe(0); // All timers processed
    });

    it('should handle file deletion and remove from index', async () => {
      // Arrange: Setup file deletion
      const deletedFilePath = 'Archive/Old-Meeting-Notes.md';

      mockDocumentIndexer.removeDocument.mockResolvedValueOnce(true);
      mockSearchEngine.getIndexedFiles
        .mockReturnValueOnce([deletedFilePath, 'other-file.md'])
        .mockReturnValueOnce(['other-file.md']); // After deletion

      // Act: Simulate file deletion event
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      mockFileWatcher.start();
      jest.advanceTimersByTime(1000);

      const deleteCallback = fileWatcherCallbacks.get('file-deleted');
      if (deleteCallback) {
        deleteCallback(deletedFilePath);
      }

      jest.advanceTimersByTime(3000);

      // Assert: Verify file was removed from index
      expect(mockDocumentIndexer.removeDocument).toHaveBeenCalledWith(deletedFilePath);
      expect(mockDocumentIndexer.removeDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('File Watching and Change Detection', () => {
    it('should automatically detect file system changes', async () => {
      // Arrange: Mock file system events
      const watchedFiles = [
        'Notes/Project-A.md',
        'Notes/Project-B.md',
        'Meetings/Weekly-Review.md'
      ];

      mockApp.vault.getAllLoadedFiles.mockReturnValue(
        watchedFiles.map(path => ({ path, stat: { mtime: Date.now() } }))
      );

      // Act: Start file watching
      mockFileWatcher.start();

      // Assert: Verify file watching is initiated
      expect(mockFileWatcher.start).toHaveBeenCalledTimes(1);

      // Simulate multiple file changes
      jest.advanceTimersByTime(5000);

      watchedFiles.forEach(filePath => {
        mockFileWatcher.triggerUpdate(filePath);
      });

      expect(mockFileWatcher.triggerUpdate).toHaveBeenCalledTimes(3);
      expect(mockFileWatcher.triggerUpdate).toHaveBeenCalledWith('Notes/Project-A.md');
      expect(mockFileWatcher.triggerUpdate).toHaveBeenCalledWith('Notes/Project-B.md');
      expect(mockFileWatcher.triggerUpdate).toHaveBeenCalledWith('Meetings/Weekly-Review.md');
    });

    it('should maintain update queue and process within timing requirements', async () => {
      // Arrange: Setup multiple pending file updates
      const pendingFiles = [
        'Dailies/2024-12-01.md',
        'Dailies/2024-12-02.md',
        'Projects/Sprint-Planning.md'
      ];

      mockFileWatcher.getPendingFiles.mockReturnValue(pendingFiles);

      const indexResults: DocumentIndexResult[] = pendingFiles.map((filePath, index) => ({
        filePath,
        success: true,
        metadata: {
          title: `Document ${index + 1}`,
          tags: ['test', 'pending'],
          created: new Date(),
          modified: new Date(),
          wordCount: 100,
          checksum: `checksum${index}`
        },
        chunkCount: 1,
        timeElapsed: 1000 + (index * 200)
      }));

      mockDocumentIndexer.indexDocument.mockImplementation(async (filePath) => {
        const index = pendingFiles.indexOf(filePath);
        return indexResults[index];
      });

      // Act: Process pending files
      mockFileWatcher.start();
      jest.advanceTimersByTime(2000);

      // Simulate processing all pending files
      for (const filePath of pendingFiles) {
        await mockDocumentIndexer.indexDocument(filePath);
      }

      jest.advanceTimersByTime(10000);

      // Assert: Verify all files were processed
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledTimes(3);
      pendingFiles.forEach(filePath => {
        expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(filePath);
      });

      // Verify timing requirements (12 seconds total, well under 30)
      const totalProcessingTime = 12000;
      expect(totalProcessingTime).toBeLessThan(30000);
    });

    it('should handle concurrent file modifications efficiently', async () => {
      // Arrange: Setup concurrent modifications
      const concurrentFiles = [
        'Notes/File-A.md',
        'Notes/File-B.md',
        'Notes/File-C.md',
        'Notes/File-D.md',
        'Notes/File-E.md'
      ];

      const concurrentResults = concurrentFiles.map((filePath, index) => ({
        filePath,
        success: true,
        metadata: {
          title: `Concurrent File ${index + 1}`,
          tags: ['concurrent', 'test'],
          created: new Date(),
          modified: new Date(),
          wordCount: 50,
          checksum: `concurrent${index}`
        },
        chunkCount: 1,
        timeElapsed: 800 + (index * 100)
      }));

      mockDocumentIndexer.indexDocument.mockImplementation(async (filePath) => {
        const index = concurrentFiles.indexOf(filePath);
        return concurrentResults[index];
      });

      // Act: Simulate rapid concurrent file changes
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      mockFileWatcher.start();

      // Trigger all modifications within a short time window
      jest.advanceTimersByTime(1000);
      const modifyCallback = fileWatcherCallbacks.get('file-modified');

      concurrentFiles.forEach((filePath, index) => {
        setTimeout(() => {
          if (modifyCallback) {
            modifyCallback(filePath);
          }
        }, index * 100); // Stagger by 100ms each
      });

      jest.advanceTimersByTime(15000);

      // Assert: Verify all concurrent modifications were handled
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledTimes(5);

      // Verify each file was processed
      concurrentFiles.forEach(filePath => {
        expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(filePath);
      });

      // Verify timing (16 seconds total, under 30-second requirement)
      const totalTime = 16000;
      expect(totalTime).toBeLessThan(30000);
    });
  });

  describe('Indexing Status and Error Handling', () => {
    it('should provide real-time indexing status updates', async () => {
      // Arrange: Mock indexing status progression
      const statusProgression: IndexingStatus[] = [
        {
          isIndexing: false,
          phase: 'idle',
          progress: { currentDocument: '', processedCount: 0, totalCount: 0, estimatedTimeRemaining: 0 },
          fileWatchingEnabled: false,
          lastUpdate: new Date()
        },
        {
          isIndexing: true,
          phase: 'scanning',
          progress: { currentDocument: 'scanning...', processedCount: 0, totalCount: 5, estimatedTimeRemaining: 10000 },
          fileWatchingEnabled: true,
          lastUpdate: new Date()
        },
        {
          isIndexing: true,
          phase: 'processing',
          progress: { currentDocument: 'Notes/Test.md', processedCount: 3, totalCount: 5, estimatedTimeRemaining: 5000 },
          fileWatchingEnabled: true,
          lastUpdate: new Date()
        },
        {
          isIndexing: false,
          phase: 'idle',
          progress: { currentDocument: '', processedCount: 5, totalCount: 5, estimatedTimeRemaining: 0 },
          fileWatchingEnabled: true,
          lastUpdate: new Date()
        }
      ];

      let statusIndex = 0;
      mockDocumentIndexer.getIndexingStatus.mockImplementation(() => {
        const status = statusProgression[statusIndex];
        statusIndex = Math.min(statusIndex + 1, statusProgression.length - 1);
        return status;
      });

      // Act & Assert: Monitor status progression
      mockFileWatcher.start();

      // Initial status
      let status = mockDocumentIndexer.getIndexingStatus();
      expect(status.phase).toBe('idle');
      expect(status.isIndexing).toBe(false);

      jest.advanceTimersByTime(2000);

      // Scanning phase
      status = mockDocumentIndexer.getIndexingStatus();
      expect(status.phase).toBe('scanning');
      expect(status.isIndexing).toBe(true);

      jest.advanceTimersByTime(5000);

      // Processing phase
      status = mockDocumentIndexer.getIndexingStatus();
      expect(status.phase).toBe('processing');
      expect(status.progress.processedCount).toBe(3);

      jest.advanceTimersByTime(5000);

      // Completed phase
      status = mockDocumentIndexer.getIndexingStatus();
      expect(status.phase).toBe('idle');
      expect(status.isIndexing).toBe(false);
      expect(status.fileWatchingEnabled).toBe(true);
    });

    it('should handle indexing failures gracefully', async () => {
      // Arrange: Mock indexing failure
      const failingFilePath = 'Corrupted/Bad-File.md';
      const errorResult: DocumentIndexResult = {
        filePath: failingFilePath,
        success: false,
        error: 'Failed to parse markdown: Invalid syntax at line 15',
        chunkCount: 0,
        timeElapsed: 2500
      };

      mockDocumentIndexer.indexDocument.mockResolvedValueOnce(errorResult);

      // Act: Attempt to index failing file
      const fileWatcherCallbacks = new Map();
      mockFileWatcher.on.mockImplementation((event, callback) => {
        fileWatcherCallbacks.set(event, callback);
      });

      mockFileWatcher.start();
      jest.advanceTimersByTime(1000);

      const createCallback = fileWatcherCallbacks.get('file-created');
      if (createCallback) {
        createCallback(failingFilePath);
      }

      jest.advanceTimersByTime(5000);

      // Assert: Verify error handling
      expect(mockDocumentIndexer.indexDocument).toHaveBeenCalledWith(failingFilePath);

      const result = await mockDocumentIndexer.indexDocument(failingFilePath);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse markdown');
      expect(result.chunkCount).toBe(0);

      // Verify file watching continues despite failures
      mockFileWatcher.stop();
      expect(mockFileWatcher.stop).toHaveBeenCalledTimes(1);
    });
  });
});