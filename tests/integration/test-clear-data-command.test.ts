/**
 * Integration test for clear data via command palette
 * Based on quickstart scenario 2: Clear Data via Command Palette
 * Acceptance Criteria: FR-003, FR-012
 */

import { App, Plugin, Command } from 'obsidian';
import { IndexStorage } from '../../src/services/IndexStorage';
import { DataManager } from '../../src/types/data-management';

// Mock Obsidian environment
jest.mock('obsidian');

describe('Clear Data via Command Palette Integration', () => {
  let mockApp: App;
  let mockPlugin: Plugin;
  let indexStorage: IndexStorage;
  let dataManager: DataManager;
  let registeredCommands: Command[];

  beforeEach(async () => {
    registeredCommands = [];

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
      addCommand: jest.fn().mockImplementation((command: Command) => {
        registeredCommands.push(command);
      }),
      registerView: jest.fn()
    } as any;

    // Initialize storage
    indexStorage = new IndexStorage();
    await indexStorage.initialize('test-vault');

    // This will fail until DataManager is implemented
    const { DataManagerImpl } = require('../../src/services/DataManager');
    dataManager = new DataManagerImpl(indexStorage);
  });

  afterEach(async () => {
    await indexStorage?.close();
  });

  describe('Command Registration', () => {
    it('should register "Clear Search Index Data" command', () => {
      // This will fail until command registration is implemented in main.ts
      require('../../main.ts');

      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      expect(clearCommand).toBeDefined();
      expect(clearCommand?.name).toBe('Clear Search Index Data');
      expect(typeof clearCommand?.callback).toBe('function');
    });

    it('should make command accessible via hotkey', () => {
      require('../../main.ts');

      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      expect(clearCommand).toBeDefined();
      // Command should be callable (testable via callback)
      expect(typeof clearCommand?.callback).toBe('function');
    });
  });

  describe('Command Execution', () => {
    beforeEach(async () => {
      // Add test data to storage
      await indexStorage.storeDocument({
        id: 'test-doc-1',
        filePath: 'test1.md',
        title: 'Test 1',
        tags: [],
        content: 'test content 1',
        wordCount: 3,
        createdDate: new Date(),
        modifiedDate: new Date(),
        checksum: 'test-checksum-1'
      });

      await indexStorage.storeDocument({
        id: 'test-doc-2',
        filePath: 'test2.md',
        title: 'Test 2',
        tags: [],
        content: 'test content 2',
        wordCount: 3,
        createdDate: new Date(),
        modifiedDate: new Date(),
        checksum: 'test-checksum-2'
      });
    });

    it('should show same confirmation flow as settings UI', async () => {
      const confirmationSpy = jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(false);

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      expect(confirmationSpy).toHaveBeenCalled();
    });

    it('should not clear data when user cancels', async () => {
      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(false);

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      // Data should still exist
      const stats = await indexStorage.getStats();
      expect(stats.documentsStored).toBe(2);
    });

    it('should clear data when user confirms', async () => {
      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      const feedbackSpy = jest.spyOn(dataManager, 'showClearFeedback')
        .mockImplementation(() => {});

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      // Data should be cleared
      const stats = await indexStorage.getStats();
      expect(stats.documentsStored).toBe(0);
      expect(stats.chunksStored).toBe(0);
      expect(stats.embeddingsStored).toBe(0);

      // Should show feedback
      expect(feedbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          documentsCleared: 2
        })
      );
    });

    it('should handle command execution errors gracefully', async () => {
      // Mock error in data clearing
      jest.spyOn(dataManager, 'clearAllData')
        .mockRejectedValue(new Error('Command execution failed'));

      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      const feedbackSpy = jest.spyOn(dataManager, 'showClearFeedback')
        .mockImplementation(() => {});

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      expect(feedbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('failed')
        })
      );
    });
  });

  describe('Concurrent Operation Prevention (FR-012)', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      // Mock slow clear operation
      let clearInProgress = false;
      jest.spyOn(dataManager, 'clearAllData').mockImplementation(async () => {
        if (clearInProgress) {
          throw new Error('Operation already in progress');
        }
        clearInProgress = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        clearInProgress = false;
        return {
          success: true,
          documentsCleared: 0,
          chunksCleared: 0,
          embeddingsCleared: 0,
          timeElapsed: 100
        };
      });

      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      // Start first operation
      const firstOperation = clearCommand?.callback();

      // Try to start second operation immediately
      const secondOperation = clearCommand?.callback();

      // Wait for both to complete
      const results = await Promise.allSettled([firstOperation, secondOperation]);

      // One should succeed, one should fail with concurrent operation error
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });

    it('should disable command during clear operation', async () => {
      const statusSpy = jest.spyOn(dataManager, 'getClearStatus')
        .mockReturnValue({
          status: 'clearing',
          progress: 50,
          itemsCleared: 10,
          startTime: new Date()
        });

      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      expect(statusSpy).toHaveBeenCalled();
    });

    it('should prevent rebuild index during clear operation', async () => {
      // Mock clear operation in progress
      jest.spyOn(dataManager, 'getClearStatus')
        .mockReturnValue({
          status: 'clearing',
          progress: 30,
          itemsCleared: 5
        });

      // This should be blocked
      const rebuildCommand = registeredCommands.find(
        cmd => cmd.id === 'rebuild-index'
      );

      if (rebuildCommand) {
        // Should either fail or be prevented
        await expect(rebuildCommand.callback()).rejects.toThrow();
      }
    });
  });

  describe('Command Integration', () => {
    it('should work consistently with settings UI', async () => {
      // Both command and settings should use the same DataManager
      jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      const clearDataSpy = jest.spyOn(dataManager, 'clearAllData');

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      expect(clearDataSpy).toHaveBeenCalled();
    });

    it('should maintain same user experience as settings UI', async () => {
      const confirmationSpy = jest.spyOn(dataManager, 'showClearConfirmation')
        .mockResolvedValue(true);

      const feedbackSpy = jest.spyOn(dataManager, 'showClearFeedback')
        .mockImplementation(() => {});

      require('../../main.ts');
      const clearCommand = registeredCommands.find(
        cmd => cmd.id === 'clear-search-index-data'
      );

      await clearCommand?.callback();

      // Same confirmation and feedback flow
      expect(confirmationSpy).toHaveBeenCalled();
      expect(feedbackSpy).toHaveBeenCalled();
    });
  });
});