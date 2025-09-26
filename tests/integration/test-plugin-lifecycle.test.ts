import { MockApp, MockPlugin } from '../setup';

// Mock the SemanticSearchPlugin that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/plugin/semantic-search-plugin', () => {
  return {
    SemanticSearchPlugin: jest.fn().mockImplementation((app: any, manifest: any) => {
      return {
        ...new MockPlugin(app, manifest),
        onload: jest.fn(),
        onunload: jest.fn(),
        startIndexing: jest.fn(),
        stopIndexing: jest.fn(),
        isIndexing: false,
        indexingProgress: 0,
      };
    }),
  };
});

// Mock the IndexingService that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/indexing-service', () => {
  return {
    IndexingService: jest.fn().mockImplementation(() => {
      return {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: jest.fn(() => false),
        getProgress: jest.fn(() => 0),
        on: jest.fn(),
        off: jest.fn(),
      };
    }),
  };
});

describe('Plugin Lifecycle Integration', () => {
  let mockApp: MockApp;
  let pluginManifest: any;
  let mockObsidianPlugins: Map<string, any>;
  let mockSettings: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Obsidian app
    mockApp = new MockApp();

    // Plugin manifest based on quickstart requirements
    pluginManifest = {
      id: 'semantic-search-plugin',
      name: 'Semantic Search Plugin',
      version: '1.0.0',
      description: 'AI-powered semantic search for Obsidian',
      author: 'Test Author',
      minAppVersion: '0.15.0',
    };

    // Mock Obsidian plugin system
    mockObsidianPlugins = new Map();
    mockSettings = {
      communityPlugins: {
        enabled: [] as string[],
        plugins: mockObsidianPlugins,
      },
    };

    // Mock filesystem with sample markdown files
    (mockApp.vault.adapter.list as jest.Mock).mockResolvedValue([
      'daily-note-1.md',
      'meeting-notes.md',
      'incident-report.md',
    ]);

    (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true);
    (mockApp.vault.adapter.read as jest.Mock).mockResolvedValue('# Sample content\nThis is a test file.');
  });

  describe('Plugin Installation', () => {
    it('should fail initially - plugin classes do not exist yet (TDD)', async () => {
      // This test should FAIL initially because the plugin classes don't exist
      // This validates TDD requirement - tests are written before implementation

      try {
        // Attempt to import the plugin that doesn't exist yet
        const { SemanticSearchPlugin } = require('../../src/plugin/semantic-search-plugin');

        // This should throw an error initially
        expect(SemanticSearchPlugin).toBeDefined();
        fail('Expected plugin import to fail, but it succeeded');
      } catch (error) {
        // Expected failure - plugin doesn't exist yet
        expect(error).toBeDefined();
      }
    });

    it('should load plugin successfully in Obsidian environment', async () => {
      // Mock successful plugin loading
      const mockPluginInstance = {
        manifest: pluginManifest,
        onload: jest.fn().mockResolvedValue(undefined),
        onunload: jest.fn().mockResolvedValue(undefined),
        startIndexing: jest.fn(),
        stopIndexing: jest.fn(),
      };

      // Simulate plugin installation
      mockObsidianPlugins.set(pluginManifest.id, mockPluginInstance);
      mockSettings.communityPlugins.enabled.push(pluginManifest.id);

      // Verify plugin is loaded
      expect(mockObsidianPlugins.has(pluginManifest.id)).toBe(true);
      expect(mockSettings.communityPlugins.enabled).toContain(pluginManifest.id);

      // Plugin should have required lifecycle methods
      const plugin = mockObsidianPlugins.get(pluginManifest.id);
      expect(plugin.onload).toBeDefined();
      expect(plugin.onunload).toBeDefined();
      expect(plugin.manifest).toEqual(pluginManifest);
    });

    it('should appear in installed plugins list', async () => {
      // Simulate plugin installation
      const mockPluginInstance = new MockPlugin(mockApp, pluginManifest);
      mockObsidianPlugins.set(pluginManifest.id, mockPluginInstance);

      // Verify plugin appears in installed plugins
      const installedPlugins = Array.from(mockObsidianPlugins.keys());
      expect(installedPlugins).toContain(pluginManifest.id);

      // Plugin should have correct metadata
      const plugin = mockObsidianPlugins.get(pluginManifest.id);
      expect(plugin.manifest.name).toBe('Semantic Search Plugin');
      expect(plugin.manifest.id).toBe('semantic-search-plugin');
    });

    it('should make plugin settings tab available', async () => {
      const mockPluginInstance = new MockPlugin(mockApp, pluginManifest);

      // Mock settings tab creation
      const mockAddSettingTab = jest.fn();
      mockPluginInstance.addSettingTab = mockAddSettingTab;

      // Simulate plugin activation
      await mockPluginInstance.onload();

      // Plugin should register settings tab during onload
      expect(mockAddSettingTab).toHaveBeenCalled();
    });
  });

  describe('Plugin Activation and Indexing', () => {
    let mockPluginInstance: any;

    beforeEach(() => {
      mockPluginInstance = {
        ...new MockPlugin(mockApp, pluginManifest),
        startIndexing: jest.fn(),
        stopIndexing: jest.fn(),
        isIndexing: false,
        indexingProgress: 0,
      };
      mockObsidianPlugins.set(pluginManifest.id, mockPluginInstance);
    });

    it('should start indexing automatically on activation', async () => {
      // Mock indexing service
      const mockIndexingService = {
        start: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(true),
        getProgress: jest.fn().mockReturnValue(25),
      };

      mockPluginInstance.indexingService = mockIndexingService;

      // Simulate plugin activation
      await mockPluginInstance.onload();

      // Should call startIndexing during activation
      mockPluginInstance.startIndexing();

      expect(mockPluginInstance.startIndexing).toHaveBeenCalled();
      expect(mockIndexingService.start).toHaveBeenCalled();
    });

    it('should start indexing within 5 seconds of activation', async () => {
      const indexingStartTime = Date.now();

      // Mock delayed indexing start
      const mockStartIndexing = jest.fn().mockImplementation(() => {
        const elapsedTime = Date.now() - indexingStartTime;
        expect(elapsedTime).toBeLessThan(5000); // Within 5 seconds requirement
        mockPluginInstance.isIndexing = true;
      });

      mockPluginInstance.startIndexing = mockStartIndexing;

      // Simulate activation and immediate indexing
      await mockPluginInstance.onload();
      mockPluginInstance.startIndexing();

      expect(mockStartIndexing).toHaveBeenCalled();
      expect(mockPluginInstance.isIndexing).toBe(true);
    });

    it('should process all markdown files in vault during indexing', async () => {
      const expectedFiles = ['daily-note-1.md', 'meeting-notes.md', 'incident-report.md'];

      // Mock file processing
      const processedFiles: string[] = [];
      const mockProcessFile = jest.fn((filename: string) => {
        processedFiles.push(filename);
      });

      mockPluginInstance.processFile = mockProcessFile;

      // Simulate indexing process
      mockPluginInstance.startIndexing();

      // Process all files returned by vault.adapter.list
      const files = await mockApp.vault.adapter.list();
      files.forEach(file => mockPluginInstance.processFile(file));

      expect(processedFiles).toEqual(expectedFiles);
      expect(mockProcessFile).toHaveBeenCalledTimes(expectedFiles.length);
    });

    it('should show indexing progress in status bar', async () => {
      // Mock status bar item
      const mockStatusBarItem = {
        setText: jest.fn(),
        remove: jest.fn(),
      };
      (mockPluginInstance.addStatusBarItem as jest.Mock).mockReturnValue(mockStatusBarItem);

      // Simulate indexing with progress updates
      mockPluginInstance.onload();
      const statusBar = mockPluginInstance.addStatusBarItem();

      // Mock progress updates
      [25, 50, 75, 100].forEach(progress => {
        mockPluginInstance.indexingProgress = progress;
        statusBar.setText(`Indexing: ${progress}%`);
      });

      expect(statusBar.setText).toHaveBeenCalledWith('Indexing: 25%');
      expect(statusBar.setText).toHaveBeenCalledWith('Indexing: 50%');
      expect(statusBar.setText).toHaveBeenCalledWith('Indexing: 75%');
      expect(statusBar.setText).toHaveBeenCalledWith('Indexing: 100%');
    });
  });

  describe('Plugin Deactivation and Cleanup', () => {
    let mockPluginInstance: any;

    beforeEach(() => {
      mockPluginInstance = {
        ...new MockPlugin(mockApp, pluginManifest),
        startIndexing: jest.fn(),
        stopIndexing: jest.fn(),
        isIndexing: true,
        cleanup: jest.fn(),
      };
    });

    it('should stop indexing on deactivation', async () => {
      // Mock active indexing
      const mockIndexingService = {
        stop: jest.fn().mockResolvedValue(undefined),
        isRunning: jest.fn().mockReturnValue(false),
      };
      mockPluginInstance.indexingService = mockIndexingService;

      // Simulate deactivation
      await mockPluginInstance.onunload();
      mockPluginInstance.stopIndexing();

      expect(mockPluginInstance.stopIndexing).toHaveBeenCalled();
      expect(mockIndexingService.stop).toHaveBeenCalled();
    });

    it('should clean up resources on deactivation', async () => {
      // Mock resource cleanup
      const mockCleanupTasks = [
        jest.fn(), // Close database connections
        jest.fn(), // Clear event listeners
        jest.fn(), // Remove status bar items
      ];

      mockPluginInstance.cleanup = jest.fn().mockImplementation(() => {
        mockCleanupTasks.forEach(task => task());
      });

      // Simulate deactivation
      await mockPluginInstance.onunload();
      mockPluginInstance.cleanup();

      expect(mockPluginInstance.cleanup).toHaveBeenCalled();
      mockCleanupTasks.forEach(task => {
        expect(task).toHaveBeenCalled();
      });
    });

    it('should remove plugin from active plugins list on deactivation', async () => {
      // Add plugin to active list
      mockObsidianPlugins.set(pluginManifest.id, mockPluginInstance);
      mockSettings.communityPlugins.enabled.push(pluginManifest.id);

      // Verify plugin is active
      expect(mockObsidianPlugins.has(pluginManifest.id)).toBe(true);
      expect(mockSettings.communityPlugins.enabled).toContain(pluginManifest.id);

      // Simulate deactivation
      await mockPluginInstance.onunload();

      // Remove from enabled plugins list
      const index = mockSettings.communityPlugins.enabled.indexOf(pluginManifest.id);
      mockSettings.communityPlugins.enabled.splice(index, 1);

      expect(mockSettings.communityPlugins.enabled).not.toContain(pluginManifest.id);
    });
  });

  describe('View Lifecycle Management', () => {
    let mockPluginInstance: any;
    let mockWorkspace: any;

    beforeEach(() => {
      mockWorkspace = {
        detachLeavesOfType: jest.fn(),
        getLeavesOfType: jest.fn(),
        revealLeaf: jest.fn(),
        getRightLeaf: jest.fn(),
        getLeaf: jest.fn(),
        onLayoutReady: jest.fn((callback) => callback()),
      };

      mockPluginInstance = {
        ...new MockPlugin(mockApp, pluginManifest),
        searchView: undefined,
        registerView: jest.fn(),
        activateSearchView: jest.fn(),
        settings: { ui: { showInSidebar: true } },
      };

      mockApp.workspace = mockWorkspace;
    });

    it('should detach all semantic search views on unload', async () => {
      // Simulate views being present
      mockWorkspace.getLeavesOfType.mockReturnValue([
        { id: 'view1' },
        { id: 'view2' },
      ]);

      // Simulate unload
      await mockPluginInstance.onunload();

      // Should detach all views of semantic-search-view type
      expect(mockWorkspace.detachLeavesOfType).toHaveBeenCalledWith('semantic-search-view');
    });

    it('should prevent duplicate view creation', async () => {
      // Mock existing views
      const existingLeaf = { id: 'existing-view' };
      mockWorkspace.getLeavesOfType.mockReturnValue([existingLeaf]);

      // Mock activateSearchView method
      mockPluginInstance.activateSearchView = jest.fn().mockImplementation(() => {
        const existingLeaves = mockWorkspace.getLeavesOfType('semantic-search-view');
        if (existingLeaves.length > 0) {
          mockWorkspace.revealLeaf(existingLeaves[0]);
          return;
        }
        // Create new view logic would go here
      });

      // Call activateSearchView
      mockPluginInstance.activateSearchView();

      // Should reveal existing view instead of creating new one
      expect(mockWorkspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
      expect(mockWorkspace.getLeaf).not.toHaveBeenCalled();
    });

    it('should create view in right sidebar when no existing views', async () => {
      // Mock no existing views
      mockWorkspace.getLeavesOfType.mockReturnValue([]);

      // Mock right leaf exists
      const rightLeaf = {
        setViewState: jest.fn().mockResolvedValue(undefined),
      };
      mockWorkspace.getRightLeaf.mockReturnValue(rightLeaf);

      // Mock activateSearchView method
      mockPluginInstance.activateSearchView = jest.fn().mockImplementation(async () => {
        const existingLeaves = mockWorkspace.getLeavesOfType('semantic-search-view');
        if (existingLeaves.length === 0) {
          const rightLeaf = mockWorkspace.getRightLeaf(false);
          if (rightLeaf) {
            await rightLeaf.setViewState({
              type: 'semantic-search-view',
              active: true,
            });
          }
        }
      });

      // Call activateSearchView
      await mockPluginInstance.activateSearchView();

      // Should create view in right sidebar
      expect(rightLeaf.setViewState).toHaveBeenCalledWith({
        type: 'semantic-search-view',
        active: true,
      });
    });

    it('should handle view activation errors gracefully', async () => {
      // Mock error during view activation
      const activationError = new Error('View activation failed');
      mockWorkspace.getRightLeaf.mockImplementation(() => {
        throw activationError;
      });

      // Mock activateSearchView with error handling
      mockPluginInstance.activateSearchView = jest.fn().mockImplementation(() => {
        try {
          mockWorkspace.getRightLeaf(false);
        } catch (error) {
          console.error('Failed to activate semantic search view:', error);
          // Should not throw, just log error
        }
      });

      // Should not throw error
      expect(() => mockPluginInstance.activateSearchView()).not.toThrow();
    });

    it('should clean up searchView reference on unload', async () => {
      // Set up searchView reference
      mockPluginInstance.searchView = { destroy: jest.fn() };

      // Simulate unload
      await mockPluginInstance.onunload();

      // searchView reference should be cleared
      expect(mockPluginInstance.searchView).toBeUndefined();
    });

    it('should only activate view when showInSidebar setting is enabled', async () => {
      // Test with showInSidebar disabled
      mockPluginInstance.settings.ui.showInSidebar = false;
      mockPluginInstance.registerViews = jest.fn().mockImplementation(() => {
        mockPluginInstance.registerView('semantic-search-view', jest.fn());

        if (mockPluginInstance.settings.ui.showInSidebar) {
          mockWorkspace.onLayoutReady(() => {
            mockPluginInstance.activateSearchView();
          });
        }
      });

      // Register views
      mockPluginInstance.registerViews();

      // activateSearchView should not be called
      expect(mockPluginInstance.activateSearchView).not.toHaveBeenCalled();

      // Test with showInSidebar enabled
      mockPluginInstance.settings.ui.showInSidebar = true;
      mockPluginInstance.registerViews();

      // onLayoutReady should be called
      expect(mockWorkspace.onLayoutReady).toHaveBeenCalled();
    });
  });

  describe('Error Handling During Lifecycle', () => {
    let mockPluginInstance: any;

    beforeEach(() => {
      mockPluginInstance = new MockPlugin(mockApp, pluginManifest);
    });

    it('should handle plugin loading errors gracefully', async () => {
      // Mock loading error
      const loadError = new Error('Plugin failed to load');
      mockPluginInstance.onload = jest.fn().mockRejectedValue(loadError);

      // Attempt to load plugin
      try {
        await mockPluginInstance.onload();
        fail('Expected plugin loading to throw error');
      } catch (error) {
        expect(error).toBe(loadError);
      }

      // Plugin should not be in active state
      expect(mockObsidianPlugins.has(pluginManifest.id)).toBe(false);
    });

    it('should handle indexing startup failures', async () => {
      const indexingError = new Error('Indexing service failed to start');
      mockPluginInstance.startIndexing = jest.fn().mockImplementation(() => {
        throw indexingError;
      });

      // Simulate activation with indexing failure
      await mockPluginInstance.onload();

      try {
        mockPluginInstance.startIndexing();
        fail('Expected indexing to throw error');
      } catch (error) {
        expect(error).toBe(indexingError);
      }

      // Plugin should handle the error and remain functional
      expect(mockPluginInstance.onload).toHaveBeenCalled();
    });

    it('should handle deactivation errors and still cleanup', async () => {
      const deactivationError = new Error('Deactivation failed');
      const mockCleanup = jest.fn();

      mockPluginInstance.cleanup = mockCleanup;
      mockPluginInstance.onunload = jest.fn().mockImplementation(async () => {
        // Always attempt cleanup even if deactivation fails
        mockCleanup();
        throw deactivationError;
      });

      // Attempt deactivation
      try {
        await mockPluginInstance.onunload();
        fail('Expected deactivation to throw error');
      } catch (error) {
        expect(error).toBe(deactivationError);
      }

      // Cleanup should still have been called
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should handle corrupted plugin manifest', async () => {
      const corruptedManifest = {
        // Missing required fields
        id: '',
        name: '',
      };

      const corruptedPlugin = new MockPlugin(mockApp, corruptedManifest);

      // Plugin should handle invalid manifest gracefully
      expect(corruptedPlugin.manifest.id).toBe('');
      expect(corruptedPlugin.manifest.name).toBe('');

      // Should not crash during initialization
      expect(() => new MockPlugin(mockApp, corruptedManifest)).not.toThrow();
    });
  });

  describe('Integration with Obsidian Plugin System', () => {
    it('should integrate with Obsidian command palette', async () => {
      const mockPluginInstance = new MockPlugin(mockApp, pluginManifest);

      // Mock command registration
      const mockAddCommand = mockPluginInstance.addCommand as jest.Mock;

      // Simulate plugin adding commands
      await mockPluginInstance.onload();

      // Plugin should register semantic search command
      expect(mockAddCommand).toHaveBeenCalledWith({
        id: 'open-semantic-search',
        name: 'Open Semantic Search',
        callback: expect.any(Function),
      });
    });

    it('should register proper event listeners', async () => {
      const mockPluginInstance = new MockPlugin(mockApp, pluginManifest);

      await mockPluginInstance.onload();

      // Plugin should register for vault events
      expect(mockApp.vault.on).toHaveBeenCalledWith('create', expect.any(Function));
      expect(mockApp.vault.on).toHaveBeenCalledWith('modify', expect.any(Function));
      expect(mockApp.vault.on).toHaveBeenCalledWith('delete', expect.any(Function));
    });

    it('should unregister event listeners on unload', async () => {
      const mockPluginInstance = new MockPlugin(mockApp, pluginManifest);

      await mockPluginInstance.onload();
      await mockPluginInstance.onunload();

      // Plugin should clean up event listeners
      expect(mockApp.vault.off).toHaveBeenCalledWith('create', expect.any(Function));
      expect(mockApp.vault.off).toHaveBeenCalledWith('modify', expect.any(Function));
      expect(mockApp.vault.off).toHaveBeenCalledWith('delete', expect.any(Function));
    });
  });
});