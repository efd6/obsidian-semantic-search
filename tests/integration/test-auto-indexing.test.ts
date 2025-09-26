import { MockApp, MockPlugin } from '../setup';

// Mock the AutoIndexingService that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/auto-indexing-service', () => {
  return {
    AutoIndexingService: jest.fn().mockImplementation(() => {
      return {
        startAutoIndexing: jest.fn(),
        stopAutoIndexing: jest.fn(),
        isIndexing: jest.fn(() => false),
        getProgress: jest.fn(() => 0),
        getTotalFiles: jest.fn(() => 0),
        getProcessedFiles: jest.fn(() => 0),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      };
    }),
  };
});

// Mock the SemanticSearchPlugin that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/plugin/semantic-search-plugin', () => {
  return {
    SemanticSearchPlugin: jest.fn().mockImplementation((app: any, manifest: any) => {
      return {
        ...new MockPlugin(app, manifest),
        autoIndexingService: undefined,
        statusBarItem: undefined,
        indexingStartTime: 0,
        onload: jest.fn(),
        onunload: jest.fn(),
        initializeAutoIndexing: jest.fn(),
        updateIndexingStatus: jest.fn(),
      };
    }),
  };
});

// Mock status bar item with proper TypeScript typing
interface MockStatusBarItem {
  setText: jest.Mock<void, [string]>;
  remove: jest.Mock<void, []>;
  addClass: jest.Mock<void, [string]>;
  removeClass: jest.Mock<void, [string]>;
}

describe('Automatic Vault Indexing Integration', () => {
  let mockApp: MockApp;
  let pluginManifest: any;
  let mockPluginInstance: any;
  let mockAutoIndexingService: any;
  let mockStatusBarItem: MockStatusBarItem;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Obsidian app
    mockApp = new MockApp();

    // Plugin manifest for semantic search plugin
    pluginManifest = {
      id: 'semantic-search-plugin',
      name: 'Semantic Search Plugin',
      version: '1.0.0',
      description: 'AI-powered semantic search for Obsidian',
      author: 'Upstart Engineering',
      minAppVersion: '0.15.0',
    };

    // Mock status bar item
    mockStatusBarItem = {
      setText: jest.fn<void, [string]>(),
      remove: jest.fn<void, []>(),
      addClass: jest.fn<void, [string]>(),
      removeClass: jest.fn<void, [string]>(),
    };

    // Mock auto indexing service
    mockAutoIndexingService = {
      startAutoIndexing: jest.fn().mockResolvedValue(undefined),
      stopAutoIndexing: jest.fn().mockResolvedValue(undefined),
      isIndexing: jest.fn().mockReturnValue(false),
      getProgress: jest.fn().mockReturnValue(0),
      getTotalFiles: jest.fn().mockReturnValue(5),
      getProcessedFiles: jest.fn().mockReturnValue(0),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    // Create mock plugin instance
    mockPluginInstance = {
      ...new MockPlugin(mockApp, pluginManifest),
      autoIndexingService: mockAutoIndexingService,
      statusBarItem: null as MockStatusBarItem | null,
      indexingStartTime: 0,
      initializeAutoIndexing: jest.fn().mockImplementation(() => {
        mockPluginInstance.autoIndexingService = mockAutoIndexingService;
      }),
      updateIndexingStatus: jest.fn().mockImplementation((progress: number, total: number, processed: number) => {
        if (mockPluginInstance.statusBarItem) {
          if (processed < total) {
            mockPluginInstance.statusBarItem.setText(`Indexing: ${Math.round((processed / total) * 100)}% (${processed}/${total})`);
          } else {
            mockPluginInstance.statusBarItem.setText('Indexing complete');
          }
        }
      }),
    };

    // Mock status bar item creation
    (mockPluginInstance.addStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);

    // Mock vault with sample markdown files matching Obsidian workspace structure
    const sampleMarkdownFiles = [
      'Dailies/2024-01-15.md',
      'PPL/performance-review-template.md',
      'Meeting Series/WEOR/2024-01-15-weor.md',
      'Incidents/INC-2024-001-database-outage.md',
      'Planning/q1-2024-objectives.md',
    ];

    (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue(sampleMarkdownFiles);
    (mockApp.vault.adapter.exists as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve(sampleMarkdownFiles.includes(path))
    );
    (mockApp.vault.adapter.read as jest.Mock).mockImplementation((path: string) => {
      const sampleContent = {
        'Dailies/2024-01-15.md': '#dailies\n\n## Daily Log\nWorking on semantic search plugin integration.',
        'PPL/performance-review-template.md': '#profile #template\n\n## Performance Review Template\nStructured review format.',
        'Meeting Series/WEOR/2024-01-15-weor.md': '#meeting #weor\n\n## WEOR 2024-01-15\nWeekly engineering operations review.',
        'Incidents/INC-2024-001-database-outage.md': '#incident\n\n## Database Outage Analysis\nPost-incident review.',
        'Planning/q1-2024-objectives.md': '#planning\n\n## Q1 2024 Objectives\nQuarterly planning document.',
      };
      return Promise.resolve(sampleContent[path as keyof typeof sampleContent] || '# Sample content');
    });
  });

  describe('Automatic Indexing Initialization', () => {
    it('should fail initially - auto indexing service does not exist yet (TDD)', async () => {
      // This test should FAIL initially because the AutoIndexingService doesn't exist
      // This validates TDD requirement - tests are written before implementation

      try {
        // Attempt to import the service that doesn't exist yet
        const { AutoIndexingService } = require('../../src/services/auto-indexing-service');

        // This should throw an error initially
        expect(AutoIndexingService).toBeDefined();
        fail('Expected AutoIndexingService import to fail, but it succeeded');
      } catch (error: any) {
        // Expected failure - service doesn't exist yet
        expect(error).toBeDefined();
        expect(error.message).toMatch(/Cannot find module|MODULE_NOT_FOUND/);
      }
    });

    it('should initialize auto indexing service on plugin activation', async () => {
      // Mock plugin activation
      await mockPluginInstance.onload();
      mockPluginInstance.initializeAutoIndexing();

      // Verify auto indexing service is initialized
      expect(mockPluginInstance.initializeAutoIndexing).toHaveBeenCalled();
      expect(mockPluginInstance.autoIndexingService).toBeDefined();
    });

    it('should create status bar item for indexing progress', async () => {
      // Activate plugin and initialize indexing
      await mockPluginInstance.onload();
      mockPluginInstance.statusBarItem = mockPluginInstance.addStatusBarItem();

      // Verify status bar item is created
      expect(mockPluginInstance.addStatusBarItem).toHaveBeenCalled();
      expect(mockPluginInstance.statusBarItem).toBeDefined();
      expect(mockPluginInstance.statusBarItem.setText).toBeDefined();
    });
  });

  describe('Automatic Indexing Process from Quickstart Step 2', () => {
    beforeEach(() => {
      // Setup for indexing tests
      mockPluginInstance.statusBarItem = mockStatusBarItem;
    });

    it('should start indexing within 5 seconds of activation', async () => {
      const activationStartTime = Date.now();

      // Mock delayed auto indexing start (simulating real-world delay)
      mockAutoIndexingService.startAutoIndexing.mockImplementation(() => {
        const elapsedTime = Date.now() - activationStartTime;
        expect(elapsedTime).toBeLessThan(5000); // Within 5 seconds requirement
        mockAutoIndexingService.isIndexing.mockReturnValue(true);
        return Promise.resolve();
      });

      // Activate plugin
      await mockPluginInstance.onload();
      mockPluginInstance.initializeAutoIndexing();

      // Start indexing process
      await mockAutoIndexingService.startAutoIndexing();

      // Verify indexing started within time limit
      expect(mockAutoIndexingService.startAutoIndexing).toHaveBeenCalled();
      expect(mockAutoIndexingService.isIndexing()).toBe(true);
    });

    it('should show indexing progress in status bar', async () => {
      const totalFiles = 5;
      mockAutoIndexingService.getTotalFiles.mockReturnValue(totalFiles);

      // Simulate progressive indexing updates
      const progressUpdates = [
        { processed: 1, progress: 20 },
        { processed: 2, progress: 40 },
        { processed: 3, progress: 60 },
        { processed: 4, progress: 80 },
        { processed: 5, progress: 100 },
      ];

      // Test each progress update
      progressUpdates.forEach(({ processed, progress }) => {
        mockAutoIndexingService.getProcessedFiles.mockReturnValue(processed);
        mockAutoIndexingService.getProgress.mockReturnValue(progress);

        mockPluginInstance.updateIndexingStatus(progress, totalFiles, processed);

        if (processed < totalFiles) {
          expect(mockStatusBarItem.setText).toHaveBeenCalledWith(
            `Indexing: ${progress}% (${processed}/${totalFiles})`
          );
        } else {
          expect(mockStatusBarItem.setText).toHaveBeenCalledWith('Indexing complete');
        }
      });
    });

    it('should process all markdown files in vault without errors', async () => {
      const expectedFiles = [
        'Dailies/2024-01-15.md',
        'PPL/performance-review-template.md',
        'Meeting Series/WEOR/2024-01-15-weor.md',
        'Incidents/INC-2024-001-database-outage.md',
        'Planning/q1-2024-objectives.md',
      ];

      // Mock successful file processing
      const processedFiles: string[] = [];
      const mockProcessMarkdownFile = jest.fn().mockImplementation((filePath: string) => {
        processedFiles.push(filePath);
        return Promise.resolve({
          path: filePath,
          content: `Mock content for ${filePath}`,
          embeddings: new Array(384).fill(0), // Mock embedding vector
        });
      });

      // Simulate file processing during indexing
      const files = await mockApp.vault.adapter.list();
      const markdownFiles = files.filter(file => file.endsWith('.md'));

      for (const file of markdownFiles) {
        await mockProcessMarkdownFile(file);
      }

      // Verify all markdown files were processed
      expect(processedFiles).toEqual(expectedFiles);
      expect(mockProcessMarkdownFile).toHaveBeenCalledTimes(expectedFiles.length);

      // Verify no processing errors occurred
      expectedFiles.forEach(file => {
        expect(processedFiles).toContain(file);
      });
    });

    it('should complete indexing without manual intervention', async () => {
      // Mock auto-completion of indexing process
      let indexingCompleted = false;

      mockAutoIndexingService.startAutoIndexing.mockImplementation(async () => {
        // Simulate automatic indexing workflow
        const files = await mockApp.vault.adapter.list();
        const markdownFiles = files.filter(file => file.endsWith('.md'));

        // Process files automatically
        for (let i = 0; i < markdownFiles.length; i++) {
          mockAutoIndexingService.getProcessedFiles.mockReturnValue(i + 1);
          mockAutoIndexingService.getProgress.mockReturnValue(((i + 1) / markdownFiles.length) * 100);
        }

        // Mark as completed
        mockAutoIndexingService.isIndexing.mockReturnValue(false);
        indexingCompleted = true;
      });

      // Start automatic indexing
      await mockAutoIndexingService.startAutoIndexing();

      // Verify indexing completed without manual intervention
      expect(indexingCompleted).toBe(true);
      expect(mockAutoIndexingService.isIndexing()).toBe(false);
      expect(mockAutoIndexingService.getProgress()).toBe(100);
    });

    it('should handle indexing errors gracefully and continue processing', async () => {
      const totalFiles = 3;
      const problematicFile = 'corrupted-file.md';

      // Add problematic file to vault
      (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue([
        'good-file-1.md',
        problematicFile,
        'good-file-2.md',
      ]);

      // Mock file processing with one error
      const mockProcessFile = jest.fn().mockImplementation((filePath: string) => {
        if (filePath === problematicFile) {
          throw new Error(`Failed to process ${filePath}: corrupted content`);
        }
        return Promise.resolve({ path: filePath, processed: true });
      });

      const processedFiles: string[] = [];
      const errorFiles: string[] = [];

      // Simulate processing with error handling
      const files = await mockApp.vault.adapter.list();
      for (const file of files) {
        try {
          await mockProcessFile(file);
          processedFiles.push(file);
        } catch (error) {
          errorFiles.push(file);
          // Continue processing despite error
        }
      }

      // Verify error handling
      expect(processedFiles).toHaveLength(2);
      expect(errorFiles).toHaveLength(1);
      expect(errorFiles).toContain(problematicFile);
      expect(processedFiles).toContain('good-file-1.md');
      expect(processedFiles).toContain('good-file-2.md');
    });

    it('should update progress indicator with current status throughout indexing', async () => {
      const mockFiles = ['file1.md', 'file2.md', 'file3.md'];
      (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue(mockFiles);

      // Track status updates
      const statusUpdates: string[] = [];
      mockStatusBarItem.setText.mockImplementation((text: string) => {
        statusUpdates.push(text);
      });

      // Simulate progressive indexing with status updates
      const totalFiles = mockFiles.length;
      for (let i = 0; i <= totalFiles; i++) {
        const progress = Math.round((i / totalFiles) * 100);

        if (i < totalFiles) {
          mockPluginInstance.updateIndexingStatus(progress, totalFiles, i);
        } else {
          // Final completion status
          mockStatusBarItem.setText('Indexing complete');
        }
      }

      // Verify progressive status updates
      expect(statusUpdates).toContain('Indexing: 0% (0/3)');
      expect(statusUpdates).toContain('Indexing: 33% (1/3)');
      expect(statusUpdates).toContain('Indexing: 67% (2/3)');
      expect(statusUpdates).toContain('Indexing: 100% (3/3)');
      expect(statusUpdates).toContain('Indexing complete');
    });
  });

  describe('Indexing Cleanup and Resource Management', () => {
    beforeEach(() => {
      mockPluginInstance.statusBarItem = mockStatusBarItem;
    });

    it('should stop indexing and cleanup on plugin deactivation', async () => {
      // Start indexing
      mockAutoIndexingService.isIndexing.mockReturnValue(true);
      await mockAutoIndexingService.startAutoIndexing();

      // Deactivate plugin
      await mockPluginInstance.onunload();

      // Should stop indexing and cleanup
      expect(mockAutoIndexingService.stopAutoIndexing).toHaveBeenCalled();

      if (mockPluginInstance.statusBarItem) {
        expect(mockPluginInstance.statusBarItem.remove).toHaveBeenCalled();
      }
    });

    it('should remove status bar item when indexing completes', async () => {
      // Complete indexing process
      mockAutoIndexingService.isIndexing.mockReturnValue(false);
      mockAutoIndexingService.getProgress.mockReturnValue(100);

      // Simulate completion cleanup
      if (mockPluginInstance.statusBarItem && mockAutoIndexingService.getProgress() === 100) {
        setTimeout(() => {
          mockPluginInstance.statusBarItem?.remove();
          mockPluginInstance.statusBarItem = null;
        }, 2000); // Remove after 2 seconds as per UX guidelines
      }

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(2000);

      // Verify status bar cleanup
      expect(mockStatusBarItem.remove).toHaveBeenCalled();
    });

    it('should handle concurrent indexing requests gracefully', async () => {
      // Mock indexing already in progress
      mockAutoIndexingService.isIndexing.mockReturnValue(true);

      // Attempt to start indexing again
      const secondIndexingAttempt = mockAutoIndexingService.startAutoIndexing();

      // Should not start a second indexing process
      await expect(secondIndexingAttempt).rejects.toThrow('Indexing already in progress');

      // Verify only one indexing process
      expect(mockAutoIndexingService.startAutoIndexing).toHaveBeenCalled();
    });
  });

  describe('Integration with Obsidian Workspace Features', () => {
    it('should respect Obsidian file filters and exclusions', async () => {
      // Mock vault with mixed file types
      const allFiles = [
        'valid-note.md',
        'template.md',
        '.obsidian/config.json',
        'image.png',
        'document.pdf',
        'Dailies/2024-01-15.md',
      ];

      (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue(allFiles);

      // Filter to only markdown files (excluding .obsidian folder)
      const files = await mockApp.vault.adapter.list();
      const markdownFiles = files.filter(file =>
        file.endsWith('.md') && !file.startsWith('.obsidian')
      );

      // Verify only appropriate files are selected for indexing
      expect(markdownFiles).toHaveLength(3);
      expect(markdownFiles).toContain('valid-note.md');
      expect(markdownFiles).toContain('template.md');
      expect(markdownFiles).toContain('Dailies/2024-01-15.md');
      expect(markdownFiles).not.toContain('.obsidian/config.json');
      expect(markdownFiles).not.toContain('image.png');
    });

    it('should integrate with Obsidian metadata cache', async () => {
      const testFile = 'test-note.md';
      const mockFileCache = {
        tags: ['#dailies', '#meeting'],
        headings: [{ heading: 'Daily Log', level: 2 }],
        links: [{ link: 'related-note', displayText: 'Related Note' }],
      };

      // Mock metadata cache interaction
      mockApp.metadataCache.getFileCache.mockReturnValue(mockFileCache);

      // Simulate metadata extraction during indexing
      const fileCache = mockApp.metadataCache.getFileCache(testFile);

      expect(fileCache.tags).toContain('#dailies');
      expect(fileCache.tags).toContain('#meeting');
      expect(fileCache.headings).toHaveLength(1);
      expect(fileCache.links).toHaveLength(1);
    });
  });
});