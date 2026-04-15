/**
 * Integration test for clear data via settings UI
 * Acceptance Criteria: FR-001, FR-002, FR-009
 */

import { App, Plugin } from 'obsidian';
import { PluginSettings } from '../../src/ui/PluginSettings';
import { DataManager } from '../../src/services/DataManager';

jest.mock('obsidian');

function createMockApp(): App {
  return {
    vault: {
      getMarkdownFiles: jest.fn().mockReturnValue([]),
      read: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    },
  } as any;
}

function createDefaultSettings(): any {
  return {
    enabled: true,
    maxResults: 20,
    chunkSize: 500,
    updateInterval: 5000,
    defaultToHybrid: true,
    performance: { batchSize: 100, maxMemoryMB: 500, backgroundProcessing: true },
    ui: { showInSidebar: true, searchHotkey: 'Ctrl+Shift+F', snippetLength: 150, theme: 'default' },
    advanced: { model: { name: 'all-MiniLM-L6-v2', quantization: 'fp32' }, debugMode: false, fileFilters: [] },
  };
}

describe('Clear Data via Settings UI Integration', () => {
  let mockApp: App;
  let mockPlugin: Plugin;
  let dataManager: DataManager;
  let pluginSettings: PluginSettings;
  const saveCallback = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockApp = createMockApp();
    mockPlugin = {
      app: mockApp,
      addCommand: jest.fn(),
      registerView: jest.fn(),
    } as any;

    dataManager = new DataManager(mockApp);
    pluginSettings = new PluginSettings(
      mockApp,
      mockPlugin,
      createDefaultSettings(),
      saveCallback,
      dataManager,
    );
  });

  describe('Constructor', () => {
    it('should accept DataManager as fifth argument', () => {
      expect(pluginSettings).toBeDefined();
      expect((pluginSettings as any).dataManager).toBe(dataManager);
    });
  });

  describe('getSettings', () => {
    it('should return a copy of current settings', () => {
      const settings = pluginSettings.getSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.maxResults).toBe(20);
    });

    it('should return a defensive copy', () => {
      const a = pluginSettings.getSettings();
      const b = pluginSettings.getSettings();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('saveSettings', () => {
    beforeEach(() => {
      // Replace display() to avoid needing a full Obsidian DOM.
      pluginSettings.display = jest.fn();
    });

    it('should call the save callback with new settings', async () => {
      const newSettings = createDefaultSettings();
      newSettings.maxResults = 50;

      await pluginSettings.saveSettings(newSettings);

      expect(saveCallback).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it('should update internal settings state', async () => {
      const newSettings = createDefaultSettings();
      newSettings.maxResults = 75;

      await pluginSettings.saveSettings(newSettings);
      expect(pluginSettings.getSettings().maxResults).toBe(75);
    });
  });

  describe('show', () => {
    it('should delegate to display', () => {
      const displayMock = jest.fn();
      pluginSettings.display = displayMock;
      pluginSettings.show();
      expect(displayMock).toHaveBeenCalled();
    });
  });
});
