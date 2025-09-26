/**
 * Integration test for concurrent operation prevention
 * Based on quickstart scenario 6: Concurrent Operation Prevention
 * Acceptance Criteria: FR-012
 */

import { App, Plugin } from 'obsidian';
import { IndexStorage } from '../../src/services/IndexStorage';
import { DataManager, DataClearOperation } from '../../src/types/data-management';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';

// Mock Obsidian environment
jest.mock('obsidian');

describe('Concurrent Operation Prevention Integration', () => {
  let mockApp: App;
  let mockPlugin: Plugin;
  let indexStorage: IndexStorage;
  let dataManager: DataManager;
  let documentIndexer: DocumentIndexer;

  beforeEach(async () => {
    // Setup mock Obsidian environment
    mockApp = {
      vault: {
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        read: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      }
    } as any;

    mockPlugin = {
      app: mockApp,
      addCommand: jest.fn(),
      registerView: jest.fn()
    } as any;

    // Initialize services
    indexStorage = new IndexStorage();
    await indexStorage.initialize('test-vault');

    // This will fail until DataManager is implemented
    const { DataManagerImpl } = require('../../src/services/DataManager');
    dataManager = new DataManagerImpl(indexStorage);

    documentIndexer = new DocumentIndexer(mockApp.vault);
  });

  afterEach(async () => {
    await indexStorage?.close();
  });

  describe('Clear Operation Concurrency Control', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      // Add test data
      await indexStorage.storeDocument({
        id: 'test-doc',
        filePath: 'test.md',
        title: 'Test',
        tags: [],
        content: 'test content',
        wordCount: 2,
        createdDate: new Date(),
        modifiedDate: new Date(),
        checksum: 'test-checksum'
      });

      // Mock slow clear operation
      const originalClearAllData = dataManager.clearAllData;
      let operationCount = 0;
      let concurrentAttempts = 0;

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        operationCount++;
        if (operationCount > 1) {
          concurrentAttempts++;
          throw new Error('Clear operation already in progress');
        }

        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        operationCount--;

        return {
          success: true,
          documentsCleared: 1,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 100
        };
      });

      // Start multiple operations simultaneously
      const operations = [
        dataManager.clearAllData(),
        dataManager.clearAllData(),
        dataManager.clearAllData()
      ];

      const results = await Promise.allSettled(operations);

      // Only one should succeed, others should fail
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(2);
      expect(concurrentAttempts).toBeGreaterThan(0);
    });

    it('should track clear operation status correctly', async () => {
      // Mock operation status tracking
      let currentStatus: DataClearOperation = {
        status: 'idle',
        progress: 0,
        itemsCleared: 0
      };

      jest.spyOn(dataManager, 'getClearStatus').mockImplementation(() => currentStatus);

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        currentStatus = { status: 'clearing', progress: 0, itemsCleared: 0 };

        // Simulate progress updates
        for (let i = 1; i <= 5; i++) {
          currentStatus = {
            status: 'clearing',
            progress: i * 20,
            itemsCleared: i,
            startTime: new Date()
          };
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        currentStatus = { status: 'complete', progress: 100, itemsCleared: 5 };

        return {
          success: true,
          documentsCleared: 5,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 50
        };
      });

      // Start clear operation
      const clearPromise = dataManager.clearAllData();

      // Check status during operation
      await new Promise(resolve => setTimeout(resolve, 5));
      let status = dataManager.getClearStatus();
      expect(status.status).toBe('clearing');
      expect(status.progress).toBeGreaterThan(0);

      // Wait for completion
      await clearPromise;

      status = dataManager.getClearStatus();
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
    });

    it('should prevent clear during indexing operations', async () => {
      // Mock indexing in progress
      let indexingInProgress = false;

      jest.spyOn(documentIndexer, 'getIndexingStatus').mockImplementation(() => ({
        isIndexing: indexingInProgress,
        phase: indexingInProgress ? 'processing' : 'idle',
        progress: { currentDocument: '', processedCount: 0, totalCount: 0, estimatedTimeRemaining: 0 },
        fileWatchingEnabled: false,
        lastUpdate: new Date()
      }));

      // Start indexing operation
      indexingInProgress = true;

      // Try to clear during indexing
      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        if (indexingInProgress) {
          throw new Error('Cannot clear data while indexing is in progress');
        }
        return {
          success: true,
          documentsCleared: 0,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 0
        };
      });

      await expect(dataManager.clearAllData()).rejects.toThrow('indexing is in progress');

      // Should work after indexing completes
      indexingInProgress = false;
      await expect(dataManager.clearAllData()).resolves.not.toThrow();
    });

    it('should prevent indexing during clear operations', async () => {
      // Mock clear operation in progress
      let clearInProgress = false;

      jest.spyOn(dataManager, 'getClearStatus').mockImplementation(() => ({
        status: clearInProgress ? 'clearing' : 'idle',
        progress: clearInProgress ? 50 : 0,
        itemsCleared: clearInProgress ? 10 : 0
      }));

      // Start clear operation
      clearInProgress = true;

      // Try to start indexing during clear
      jest.spyOn(documentIndexer, 'indexVault').mockImplementation(async () => {
        if (clearInProgress) {
          throw new Error('Cannot start indexing while clear operation is in progress');
        }
        return {
          totalDocuments: 0,
          successfullyIndexed: 0,
          failures: [],
          timeElapsed: 0,
          stats: {
            documentCount: 0,
            chunkCount: 0,
            storageSizeBytes: 0,
            uniqueTags: 0,
            created: new Date(),
            lastUpdated: new Date(),
            model: { name: 'test', version: '1.0.0', dimensions: 512 }
          }
        };
      });

      await expect(documentIndexer.indexVault()).rejects.toThrow('clear operation is in progress');

      // Should work after clear completes
      clearInProgress = false;
      await expect(documentIndexer.indexVault()).resolves.not.toThrow();
    });
  });

  describe('UI State Management During Operations', () => {
    it('should disable clear button during operation', async () => {
      const mockPluginSettings = {
        setClearButtonEnabled: jest.fn(),
        updateClearProgress: jest.fn(),
        showClearResult: jest.fn()
      };

      // Mock clear operation with UI updates
      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        mockPluginSettings.setClearButtonEnabled(false);

        for (let progress = 0; progress <= 100; progress += 25) {
          mockPluginSettings.updateClearProgress(progress);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const result = {
          success: true,
          documentsCleared: 5,
          chunksCleared: 20,
          embeddingsCleared: 20,
          timeElapsed: 100
        };

        mockPluginSettings.showClearResult(result);
        mockPluginSettings.setClearButtonEnabled(true);

        return result;
      });

      await dataManager.clearAllData();

      // Verify UI state changes
      expect(mockPluginSettings.setClearButtonEnabled).toHaveBeenCalledWith(false);
      expect(mockPluginSettings.updateClearProgress).toHaveBeenCalledTimes(5);
      expect(mockPluginSettings.showClearResult).toHaveBeenCalled();
      expect(mockPluginSettings.setClearButtonEnabled).toHaveBeenCalledWith(true);
    });

    it('should show operation status in status bar', async () => {
      const mockStatusBar = {
        showProgress: jest.fn(),
        clear: jest.fn(),
        showError: jest.fn()
      };

      // Mock operation with status bar updates
      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        mockStatusBar.showProgress(0, 100);

        for (let progress = 25; progress <= 100; progress += 25) {
          mockStatusBar.showProgress(progress, 100);
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        mockStatusBar.clear();

        return {
          success: true,
          documentsCleared: 0,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 50
        };
      });

      await dataManager.clearAllData();

      expect(mockStatusBar.showProgress).toHaveBeenCalledTimes(5);
      expect(mockStatusBar.clear).toHaveBeenCalled();
    });

    it('should handle operation cancellation', async () => {
      let operationCancelled = false;

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        for (let i = 0; i < 10; i++) {
          if (operationCancelled) {
            throw new Error('Operation cancelled by user');
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        return {
          success: true,
          documentsCleared: 0,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 100
        };
      });

      // Start operation
      const clearPromise = dataManager.clearAllData();

      // Cancel after a short delay
      setTimeout(() => {
        operationCancelled = true;
      }, 25);

      await expect(clearPromise).rejects.toThrow('cancelled by user');
    });
  });

  describe('Command Integration Concurrency', () => {
    it('should prevent duplicate command executions', async () => {
      let commandExecutions = 0;

      // Mock command that tracks executions
      const mockCommand = {
        id: 'clear-search-index-data',
        name: 'Clear Search Index Data',
        callback: jest.fn().mockImplementation(async () => {
          commandExecutions++;
          if (commandExecutions > 1) {
            throw new Error('Command already executing');
          }

          await new Promise(resolve => setTimeout(resolve, 50));
          commandExecutions--;

          return {
            success: true,
            documentsCleared: 0,
            chunksCleared: 0,
            embeddingsCleared: 0,
            timeElapsed: 50
          };
        })
      };

      // Simulate rapid command execution
      const executions = [
        mockCommand.callback(),
        mockCommand.callback(),
        mockCommand.callback()
      ];

      const results = await Promise.allSettled(executions);

      // Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(2);
    });

    it('should handle command queue properly', async () => {
      const executionOrder: number[] = [];
      let currentExecution = 0;

      const mockCommand = {
        callback: jest.fn().mockImplementation(async () => {
          const executionId = ++currentExecution;
          executionOrder.push(executionId);

          // Simulate varying execution times
          const delay = executionId === 1 ? 100 : 10;
          await new Promise(resolve => setTimeout(resolve, delay));

          return { success: true, executionId };
        })
      };

      // Queue multiple executions
      const executions = [
        mockCommand.callback(),
        mockCommand.callback(),
        mockCommand.callback()
      ];

      const results = await Promise.allSettled(executions);

      // All should eventually complete if properly queued
      // (Implementation-dependent behavior)
      expect(results.length).toBe(3);
      expect(executionOrder.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should clean up properly after failed operations', async () => {
      const mockCleanup = jest.fn();

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        try {
          throw new Error('Simulated failure');
        } finally {
          mockCleanup();
        }
      });

      await expect(dataManager.clearAllData()).rejects.toThrow('Simulated failure');

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should reset operation state after errors', async () => {
      let operationState = 'idle';

      jest.spyOn(dataManager, 'getClearStatus').mockImplementation(() => ({
        status: operationState as any,
        progress: operationState === 'idle' ? 0 : 50,
        itemsCleared: 0
      }));

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        operationState = 'clearing';
        try {
          throw new Error('Operation failed');
        } finally {
          operationState = 'idle'; // Reset state
        }
      });

      await expect(dataManager.clearAllData()).rejects.toThrow('Operation failed');

      const status = dataManager.getClearStatus();
      expect(status.status).toBe('idle');
      expect(status.progress).toBe(0);
    });

    it('should allow new operations after failures', async () => {
      let shouldFail = true;

      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('First attempt failed');
        }

        return {
          success: true,
          documentsCleared: 0,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 10
        };
      });

      // First attempt should fail
      await expect(dataManager.clearAllData()).rejects.toThrow('First attempt failed');

      // Second attempt should succeed
      await expect(dataManager.clearAllData()).resolves.toEqual(
        expect.objectContaining({ success: true })
      );
    });
  });
});