/**
 * Runtime Error Tests
 * Tests scenarios that caused runtime errors in Obsidian
 */
import SemanticSearchPluginMain from '../../main';
import { EmbeddingEngine } from '../../src/services/EmbeddingEngine';

// Mock TensorFlow.js modules for runtime error testing
jest.mock('@tensorflow/tfjs', () => ({
    ready: jest.fn().mockResolvedValue(undefined),
    getBackend: jest.fn().mockReturnValue('cpu'),
    version: { 'tfjs-core': '4.15.0' }
}));

jest.mock('@tensorflow-models/universal-sentence-encoder', () => ({
    load: jest.fn().mockResolvedValue({
        embed: jest.fn().mockImplementation(async (texts) => {
            const textArray = Array.isArray(texts) ? texts : [texts];
            const embeddings = new Float32Array(textArray.length * 512);

            textArray.forEach((text, textIndex) => {
                const source = typeof text === 'string' ? text : String(text ?? '');
                const hash = source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const offset = textIndex * 512;

                for (let i = 0; i < 512; i++) {
                    embeddings[offset + i] = Math.sin((hash + i) / 100) * 0.1;
                }
            });

            return {
                data: jest.fn().mockResolvedValue(embeddings),
                dispose: jest.fn()
            };
        })
    })
}));

describe('Runtime Error Fixes', () => {
  describe('WorkspaceLeaf Null Reference Error', () => {
    let plugin: SemanticSearchPluginMain;
    let mockApp: any;

    beforeEach(() => {
      const { createTestApp } = require('obsidian');
      mockApp = createTestApp();
      plugin = new SemanticSearchPluginMain(mockApp, {
        id: 'semantic-search-plugin',
        name: 'Semantic Search Plugin',
        version: '1.0.0',
        author: 'Test Author',
        minAppVersion: '0.15.0',
        description: 'Test plugin'
      });
    });

    afterEach(async () => {
      await plugin.onunload();
    });

    it('should handle getRightLeaf returning null gracefully', async () => {
      // Set environment variable to simulate getRightLeaf returning null
      process.env.TEST_LAYOUT_FAILURE = 'true';

      // Should not throw an error during plugin load
      await expect(plugin.onload()).resolves.not.toThrow();

      // Cleanup
      delete process.env.TEST_LAYOUT_FAILURE;
    });

    it('should defer view registration until layout is ready', async () => {
      const layoutReadySpy = jest.spyOn(mockApp.workspace, 'onLayoutReady');

      await plugin.onload();

      expect(layoutReadySpy).toHaveBeenCalled();
    });

    it('should create fallback leaf when getRightLeaf fails', async () => {
      process.env.TEST_LAYOUT_FAILURE = 'true';
      const getLeafSpy = jest.spyOn(mockApp.workspace, 'getLeaf');

      await plugin.onload();

      // activateSearchView is the code path that calls getRightLeaf/getLeaf;
      // onload + triggerLayoutReady only starts indexing.
      (plugin as any).activateSearchView();

      expect(getLeafSpy).toHaveBeenCalledWith('split', 'vertical');

      delete process.env.TEST_LAYOUT_FAILURE;
    });
  });

  describe('Model Loading Path Error', () => {
    let embeddingEngine: EmbeddingEngine;

    beforeEach(async () => {
      embeddingEngine = EmbeddingEngine.getInstance();
      // Reset the singleton state completely
      await embeddingEngine.cleanup();
      (embeddingEngine as any).pipeline = null;
      (embeddingEngine as any).modelPath = null;
      (embeddingEngine as any).isLoading = false;
      (embeddingEngine as any).loadPromise = null;
    });

    afterEach(async () => {
      await embeddingEngine.cleanup();
    });

    it('should initialize TensorFlow.js model correctly', async () => {
      await embeddingEngine.initialize();

      // Check that the model was loaded
      expect((embeddingEngine as any).model).toBeDefined();
    });

    it('should handle multiple initialization calls', async () => {
      await embeddingEngine.initialize();
      await embeddingEngine.initialize();

      // Should not throw errors on multiple calls
      expect((embeddingEngine as any).model).toBeDefined();
    });
  });

  describe('Plugin Integration', () => {
    let plugin: SemanticSearchPluginMain;
    let mockApp: any;

    beforeEach(async () => {
      const { createTestApp } = require('obsidian');
      mockApp = createTestApp();

      // Set up a test vault path with proper file:// URL format
      process.env.TEST_VAULT_PATH = 'file:///test/vault';

      // Reset the EmbeddingEngine singleton state before each test
      const embeddingEngine = EmbeddingEngine.getInstance();
      if (typeof embeddingEngine.cleanup === 'function') {
        await embeddingEngine.cleanup();
      }
      // Reset TensorFlow.js specific state
      (embeddingEngine as any).model = null;
      (embeddingEngine as any).isLoading = false;
      (embeddingEngine as any).loadPromise = null;

      plugin = new SemanticSearchPluginMain(mockApp, {
        id: 'semantic-search-plugin',
        name: 'Semantic Search Plugin',
        version: '1.0.0',
        author: 'Test Author',
        minAppVersion: '0.15.0',
        description: 'Test plugin'
      });
    });

    afterEach(async () => {
      await plugin.onunload();
      delete process.env.TEST_VAULT_PATH;
    });

    it('should initialize TensorFlow.js Universal Sentence Encoder correctly', async () => {
      await plugin.onload();

      const embeddingEngine = (plugin as any).embeddingEngine;

      // TensorFlow.js implementation doesn't use local model paths
      // Instead verify the embedding engine is properly initialized
      expect(embeddingEngine).toBeDefined();
      expect(typeof embeddingEngine.generateEmbedding).toBe('function');

      // Test that it can generate embeddings
      const embedding = await embeddingEngine.generateEmbedding('test text');
      expect(embedding).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should handle complete plugin lifecycle without errors', async () => {
      // Should initialize without throwing
      await expect(plugin.onload()).resolves.not.toThrow();

      // Should unload without throwing
      await expect(plugin.onunload()).resolves.not.toThrow();
    });

    it('should handle settings correctly', async () => {
      await plugin.onload();

      const newSettings = { maxResults: 25 };
      await expect(plugin.updateSettings(newSettings)).resolves.not.toThrow();

      expect(plugin.settings.maxResults).toBe(25);
    });
  });

  describe('Error Recovery', () => {
    let plugin: SemanticSearchPluginMain;
    let mockApp: any;

    beforeEach(() => {
      const { createTestApp } = require('obsidian');
      mockApp = createTestApp();
      plugin = new SemanticSearchPluginMain(mockApp, {
        id: 'semantic-search-plugin',
        name: 'Semantic Search Plugin',
        version: '1.0.0',
        author: 'Test Author',
        minAppVersion: '0.15.0',
        description: 'Test plugin'
      });
    });

    afterEach(async () => {
      await plugin.onunload();
    });

    it('should continue loading with limited functionality on service initialization failure', async () => {
      // Mock a service initialization failure
      const mockError = new Error('Service initialization failed');
      jest.spyOn(plugin as any, 'initializeServices').mockRejectedValueOnce(mockError);

      // Plugin should still load (catching the error internally)
      await expect(plugin.onload()).resolves.not.toThrow();
    });

    it('should handle TensorFlow.js model loading failures gracefully', async () => {
      // Mock TensorFlow.js model loading failure
      const tensorflowMock = require('@tensorflow-models/universal-sentence-encoder');
      tensorflowMock.load.mockRejectedValueOnce(new Error('Model loading failed'));

      const embeddingEngine = EmbeddingEngine.getInstance();
      // Reset to ensure clean state
      await embeddingEngine.cleanup();
      (embeddingEngine as any).model = null;

      // Should throw a descriptive error about model initialization
      await expect(embeddingEngine.initialize())
        .rejects.toThrow();
    });
  });
});
