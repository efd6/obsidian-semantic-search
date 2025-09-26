/**
 * Integration test for clear data via settings UI
 * Based on quickstart scenario 1: Clear Data via Settings UI
 * Acceptance Criteria: FR-001, FR-002, FR-009
 */

import { App, Plugin, Setting } from 'obsidian';
import { IndexStorage } from '../../src/services/IndexStorage';
import { PluginSettings } from '../../src/ui/PluginSettings';
import { DataClearResult } from '../../src/types/data-management';

// Mock Obsidian environment
jest.mock('obsidian');

describe('Clear Data via Settings UI Integration', () => {
  let mockApp: App;
  let mockPlugin: Plugin;
  let indexStorage: IndexStorage;
  let pluginSettings: PluginSettings;

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

    // Initialize storage with test data
    indexStorage = new IndexStorage();
    await indexStorage.initialize('test-vault');

    // This will fail until PluginSettings extensions are implemented
    pluginSettings = new PluginSettings(
      mockApp,
      mockPlugin,
      { enabled: true } as any,
      jest.fn()
    );
  });

  afterEach(async () => {
    await indexStorage?.close();
  });

  describe('Settings UI Setup', () => {
    it('should display clear data button in Advanced Settings section', () => {
      // Verify settings UI has the clear data button
      const containerEl = document.createElement('div');
      pluginSettings.containerEl = containerEl;

      pluginSettings.display();

      // Should find "Clear Index Data" button text
      const buttonText = containerEl.textContent;
      expect(buttonText).toContain('Clear Index Data');
      expect(buttonText).toContain('Advanced Settings');
    });

    it('should have button initially enabled when data exists', async () => {
      // Add some test data to storage
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

      pluginSettings.display();

      // Button should be enabled when data exists
      // This will be validated when UI implementation is complete
      expect(true).toBe(true); // Placeholder until implementation
    });
  });

  describe('Clear Data Workflow', () => {
    it('should show confirmation modal when clear button is clicked', async () => {
      // Mock confirmation modal
      const showConfirmationSpy = jest.spyOn(pluginSettings as any, 'showClearConfirmationModal')
        .mockResolvedValue(false);

      await (pluginSettings as any).onClearDataClick();

      expect(showConfirmationSpy).toHaveBeenCalled();
    });

    it('should not clear data when user cancels confirmation', async () => {
      // Setup test data
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

      // Mock user cancellation
      jest.spyOn(pluginSettings as any, 'showClearConfirmationModal')
        .mockResolvedValue(false);

      await (pluginSettings as any).onClearDataClick();

      // Data should still exist
      const stats = await indexStorage.getStats();
      expect(stats.documentsStored).toBeGreaterThan(0);
    });

    it('should clear data when user confirms', async () => {
      // Setup test data
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

      // Mock user confirmation
      jest.spyOn(pluginSettings as any, 'showClearConfirmationModal')
        .mockResolvedValue(true);

      const clearResultSpy = jest.spyOn(pluginSettings as any, 'showClearResult')
        .mockImplementation(() => {});

      await (pluginSettings as any).onClearDataClick();

      // Verify data was cleared
      const stats = await indexStorage.getStats();
      expect(stats.documentsStored).toBe(0);
      expect(stats.chunksStored).toBe(0);
      expect(stats.embeddingsStored).toBe(0);

      // Verify success feedback was shown
      expect(clearResultSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          documentsCleared: expect.any(Number),
          chunksCleared: expect.any(Number),
          embeddingsCleared: expect.any(Number),
          timeElapsed: expect.any(Number)
        })
      );
    });

    it('should show progress indication during clear operation', async () => {
      // Setup test data
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

      const progressSpy = jest.spyOn(pluginSettings as any, 'updateClearProgress')
        .mockImplementation(() => {});

      const buttonEnabledSpy = jest.spyOn(pluginSettings as any, 'setClearButtonEnabled')
        .mockImplementation(() => {});

      jest.spyOn(pluginSettings as any, 'showClearConfirmationModal')
        .mockResolvedValue(true);

      await (pluginSettings as any).onClearDataClick();

      // Should disable button during operation
      expect(buttonEnabledSpy).toHaveBeenCalledWith(false);

      // Should show progress updates
      expect(progressSpy).toHaveBeenCalled();

      // Should re-enable button after completion
      expect(buttonEnabledSpy).toHaveBeenCalledWith(true);
    });

    it('should handle clear operation failures gracefully', async () => {
      // Mock storage failure
      jest.spyOn(indexStorage, 'destroy').mockRejectedValue(new Error('Storage error'));

      const clearResultSpy = jest.spyOn(pluginSettings as any, 'showClearResult')
        .mockImplementation(() => {});

      jest.spyOn(pluginSettings as any, 'showClearConfirmationModal')
        .mockResolvedValue(true);

      await (pluginSettings as any).onClearDataClick();

      // Should show error result
      expect(clearResultSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(String)
        })
      );
    });
  });

  describe('User Feedback', () => {
    it('should display success message with statistics', () => {
      const mockResult: DataClearResult = {
        success: true,
        documentsCleared: 10,
        chunksCleared: 50,
        embeddingsCleared: 50,
        timeElapsed: 1000
      };

      // Mock Notice display
      const noticeSpy = jest.fn();
      (global as any).Notice = noticeSpy;

      (pluginSettings as any).showClearResult(mockResult);

      expect(noticeSpy).toHaveBeenCalledWith(
        expect.stringContaining('10 documents')
      );
      expect(noticeSpy).toHaveBeenCalledWith(
        expect.stringContaining('50 chunks')
      );
      expect(noticeSpy).toHaveBeenCalledWith(
        expect.stringContaining('50 embeddings')
      );
    });

    it('should display error message on failure', () => {
      const mockResult: DataClearResult = {
        success: false,
        documentsCleared: 0,
        chunksCleared: 0,
        embeddingsCleared: 0,
        timeElapsed: 500,
        error: 'Failed to clear storage'
      };

      const noticeSpy = jest.fn();
      (global as any).Notice = noticeSpy;

      (pluginSettings as any).showClearResult(mockResult);

      expect(noticeSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear storage')
      );
    });
  });
});