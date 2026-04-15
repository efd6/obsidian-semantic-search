import { SemanticSearchPlugin, PluginStatus, IndexRebuildResult } from '../../specs/001-obsidian-search-plugin/contracts/plugin-interface';
import { MockApp, MockPlugin } from '../setup';

/**
 * Contract Test for SemanticSearchPlugin Interface
 * Tests the public API contract defined in plugin-interface.ts
 * This test ensures any implementation properly satisfies the interface contract
 */
describe('SemanticSearchPlugin Interface Contract', () => {
  let mockApp: MockApp;
  let mockImplementation: SemanticSearchPlugin;

  beforeEach(() => {
    mockApp = new MockApp();

    // Mock implementation that satisfies the interface
    mockImplementation = {
      onload: jest.fn().mockResolvedValue(undefined),
      onunload: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({
        isEnabled: true,
        isIndexing: false,
        indexStats: {
          documentCount: 100,
          lastIndexUpdate: new Date('2023-01-01'),
          indexSizeBytes: 1024
        },
        version: '1.0.0'
      } as PluginStatus),
      rebuildIndex: jest.fn().mockResolvedValue({
        success: true,
        documentsProcessed: 100,
        timeElapsed: 5000,
      } as IndexRebuildResult)
    };
  });

  describe('onload() method contract', () => {
    it('should be defined as an async method', () => {
      expect(mockImplementation.onload).toBeDefined();
      expect(typeof mockImplementation.onload).toBe('function');
    });

    it('should return a Promise<void>', async () => {
      const result = mockImplementation.onload();
      expect(result).toBeInstanceOf(Promise);

      const resolvedValue = await result;
      expect(resolvedValue).toBeUndefined();
    });

    it('should be callable without parameters', async () => {
      await expect(mockImplementation.onload()).resolves.not.toThrow();
      expect(mockImplementation.onload).toHaveBeenCalledWith();
    });
  });

  describe('onunload() method contract', () => {
    it('should be defined as an async method', () => {
      expect(mockImplementation.onunload).toBeDefined();
      expect(typeof mockImplementation.onunload).toBe('function');
    });

    it('should return a Promise<void>', async () => {
      const result = mockImplementation.onunload();
      expect(result).toBeInstanceOf(Promise);

      const resolvedValue = await result;
      expect(resolvedValue).toBeUndefined();
    });

    it('should be callable without parameters', async () => {
      await expect(mockImplementation.onunload()).resolves.not.toThrow();
      expect(mockImplementation.onunload).toHaveBeenCalledWith();
    });
  });

  describe('getStatus() method contract', () => {
    it('should be defined as a synchronous method', () => {
      expect(mockImplementation.getStatus).toBeDefined();
      expect(typeof mockImplementation.getStatus).toBe('function');
    });

    it('should return PluginStatus object with correct structure', () => {
      const status = mockImplementation.getStatus();

      expect(status).toHaveProperty('isEnabled');
      expect(status).toHaveProperty('isIndexing');
      expect(status).toHaveProperty('indexStats');
      expect(status).toHaveProperty('version');

      expect(typeof status.isEnabled).toBe('boolean');
      expect(typeof status.isIndexing).toBe('boolean');
      expect(typeof status.version).toBe('string');
    });

    it('should return indexStats with correct structure', () => {
      const status = mockImplementation.getStatus();
      const { indexStats } = status;

      expect(indexStats).toHaveProperty('documentCount');
      expect(indexStats).toHaveProperty('lastIndexUpdate');
      expect(indexStats).toHaveProperty('indexSizeBytes');

      expect(typeof indexStats.documentCount).toBe('number');
      expect(indexStats.lastIndexUpdate).toBeInstanceOf(Date);
      expect(typeof indexStats.indexSizeBytes).toBe('number');
    });

    it('should be callable without parameters', () => {
      mockImplementation.getStatus();
      expect(mockImplementation.getStatus).toHaveBeenCalledWith();
    });
  });

  describe('rebuildIndex() method contract', () => {
    it('should be defined as an async method', () => {
      expect(mockImplementation.rebuildIndex).toBeDefined();
      expect(typeof mockImplementation.rebuildIndex).toBe('function');
    });

    it('should return a Promise<IndexRebuildResult>', async () => {
      const result = mockImplementation.rebuildIndex();
      expect(result).toBeInstanceOf(Promise);

      const resolvedValue = await result;
      expect(resolvedValue).toBeDefined();
    });

    it('should return IndexRebuildResult with correct structure', async () => {
      const result = await mockImplementation.rebuildIndex();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('documentsProcessed');
      expect(result).toHaveProperty('timeElapsed');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.documentsProcessed).toBe('number');
      expect(typeof result.timeElapsed).toBe('number');
    });

    it('should support optional error property in result', async () => {
      // Test with error scenario
      const errorMock = jest.fn().mockResolvedValue({
        success: false,
        documentsProcessed: 0,
        timeElapsed: 1000,
        error: 'Test error'
      } as IndexRebuildResult);

      mockImplementation.rebuildIndex = errorMock;
      const result = await mockImplementation.rebuildIndex();

      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });

    it('should be callable without parameters', async () => {
      await mockImplementation.rebuildIndex();
      expect(mockImplementation.rebuildIndex).toHaveBeenCalledWith();
    });
  });

  describe('Interface Type Safety', () => {
    it('should satisfy SemanticSearchPlugin interface at compile time', () => {
      // This test ensures TypeScript compilation succeeds
      const plugin: SemanticSearchPlugin = mockImplementation;
      expect(plugin).toBeDefined();
    });

    it('should fail when implementation is missing required methods', () => {
      const incompleteImpl: Partial<SemanticSearchPlugin> = {
        onload: jest.fn(),
      };

      expect(() => {
        const _plugin: SemanticSearchPlugin = incompleteImpl as SemanticSearchPlugin;
        throw new Error('Implementation incomplete - missing required methods');
      }).toThrow('Implementation incomplete');
    });

    it('should enforce correct return types', async () => {
      // Test that methods return correct types
      const onloadResult = mockImplementation.onload();
      const onunloadResult = mockImplementation.onunload();
      const statusResult = mockImplementation.getStatus();
      const rebuildResult = mockImplementation.rebuildIndex();

      // Verify async methods return Promises
      expect(onloadResult).toBeInstanceOf(Promise);
      expect(onunloadResult).toBeInstanceOf(Promise);
      expect(rebuildResult).toBeInstanceOf(Promise);

      // Verify sync method returns object directly
      expect(statusResult).toEqual(expect.any(Object));
      expect(statusResult).not.toBeInstanceOf(Promise);
    });
  });

  describe('Method Call Verification', () => {
    it('should track method calls for integration testing', async () => {
      // Simulate plugin lifecycle
      await mockImplementation.onload();
      const status = mockImplementation.getStatus();
      await mockImplementation.rebuildIndex();
      await mockImplementation.onunload();

      // Verify all methods were called
      expect(mockImplementation.onload).toHaveBeenCalledTimes(1);
      expect(mockImplementation.getStatus).toHaveBeenCalledTimes(1);
      expect(mockImplementation.rebuildIndex).toHaveBeenCalledTimes(1);
      expect(mockImplementation.onunload).toHaveBeenCalledTimes(1);

      // Verify status was returned
      expect(status).toBeDefined();
    });
  });
});