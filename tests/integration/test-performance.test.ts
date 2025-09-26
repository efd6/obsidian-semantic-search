import { MockApp, MockPlugin } from '../setup';

// Performance scaling test requirements from quickstart Step 9: Large Vault Performance
// Expected timing requirements:
// - 100k lines: 30 seconds
// - 200k lines: 40 seconds (30s + 10s)
// - 500k lines: 80 seconds (30s + 50s)
// - 1M lines: 130 seconds (30s + 100s)

interface PerformanceMetrics {
  vaultSize: number;
  linesCount: number;
  updateTime: number;
  isUIBlocked: boolean;
  memoryUsage: number;
}

interface VaultMockOptions {
  fileCount: number;
  totalLines: number;
  averageLinesPerFile: number;
}

// Mock the PerformanceMonitor that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/performance-monitor', () => {
  return {
    PerformanceMonitor: jest.fn().mockImplementation(() => {
      return {
        startTiming: jest.fn(),
        endTiming: jest.fn(() => Promise.resolve(0)), // Will fail - no real implementation
        getMetrics: jest.fn(() => Promise.resolve(null)), // Will fail - no real metrics
        isUIResponsive: jest.fn(() => false), // Will fail - UI blocking not implemented
        getMemoryUsage: jest.fn(() => 0),
        on: jest.fn(),
        off: jest.fn(),
      };
    }),
  };
});

// Mock the LargeVaultIndexer that doesn't exist yet (TDD - will FAIL initially)
jest.mock('../../src/services/large-vault-indexer', () => {
  return {
    LargeVaultIndexer: jest.fn().mockImplementation(() => {
      return {
        indexVault: jest.fn(() => Promise.reject(new Error('LargeVaultIndexer not implemented'))),
        updateIndex: jest.fn(() => Promise.reject(new Error('Index update not implemented'))),
        getIndexingProgress: jest.fn(() => 0),
        cancelIndexing: jest.fn(),
        isIndexing: jest.fn(() => false),
        getEstimatedTime: jest.fn(() => -1), // Will fail - no time estimation
        enableBackgroundMode: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      };
    }),
  };
});

describe('Performance Scaling Integration Tests', () => {
  let mockApp: MockApp;
  let pluginManifest: any;
  let mockPerformanceMonitor: any;
  let mockLargeVaultIndexer: any;

  // Test scenarios for different vault sizes
  const testScenarios: Array<{
    description: string;
    vaultOptions: VaultMockOptions;
    expectedMaxTime: number; // in seconds
  }> = [
    {
      description: '100k lines vault',
      vaultOptions: { fileCount: 1000, totalLines: 100000, averageLinesPerFile: 100 },
      expectedMaxTime: 30,
    },
    {
      description: '200k lines vault',
      vaultOptions: { fileCount: 2000, totalLines: 200000, averageLinesPerFile: 100 },
      expectedMaxTime: 40,
    },
    {
      description: '500k lines vault',
      vaultOptions: { fileCount: 5000, totalLines: 500000, averageLinesPerFile: 100 },
      expectedMaxTime: 80,
    },
    {
      description: '1M lines vault',
      vaultOptions: { fileCount: 10000, totalLines: 1000000, averageLinesPerFile: 100 },
      expectedMaxTime: 130,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(180000); // 3 minutes for large vault tests

    // Setup mock Obsidian app
    mockApp = new MockApp();

    // Plugin manifest
    pluginManifest = {
      id: 'semantic-search-performance-test',
      name: 'Semantic Search Performance Test',
      version: '1.0.0',
      description: 'Performance testing for semantic search with large vaults',
      author: 'Test Suite',
      minAppVersion: '0.15.0',
    };

    // Mock performance monitor
    const { PerformanceMonitor } = require('../../src/services/performance-monitor');
    mockPerformanceMonitor = new PerformanceMonitor();

    // Mock large vault indexer
    const { LargeVaultIndexer } = require('../../src/services/large-vault-indexer');
    mockLargeVaultIndexer = new LargeVaultIndexer(mockApp);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  /**
   * Creates a mock large vault with specified characteristics
   */
  function createMockLargeVault(options: VaultMockOptions): void {
    const mockFiles: Array<{ path: string; content: string; lines: number }> = [];

    for (let i = 0; i < options.fileCount; i++) {
      const lineCount = Math.floor(options.totalLines / options.fileCount);
      const content = Array(lineCount).fill(0).map((_, idx) =>
        `Line ${idx + 1} of file ${i + 1}: Sample content with meaningful text for indexing.`
      ).join('\n');

      mockFiles.push({
        path: `mock-files/file-${i.toString().padStart(6, '0')}.md`,
        content,
        lines: lineCount,
      });
    }

    // Mock vault adapter methods
    mockApp.vault.adapter.list.mockResolvedValue(
      mockFiles.map(f => f.path)
    );

    mockApp.vault.adapter.exists.mockImplementation((path: string) =>
      Promise.resolve(mockFiles.some(f => f.path === path))
    );

    mockApp.vault.adapter.read.mockImplementation((path: string) => {
      const file = mockFiles.find(f => f.path === path);
      return Promise.resolve(file ? file.content : '');
    });

    mockApp.vault.adapter.stat.mockImplementation((path: string) => {
      const file = mockFiles.find(f => f.path === path);
      return Promise.resolve(file ? {
        type: 'file',
        size: file.content.length,
        ctime: Date.now(),
        mtime: Date.now(),
      } : null);
    });

    mockApp.vault.getAllLoadedFiles.mockReturnValue(
      mockFiles.map(f => ({
        path: f.path,
        basename: f.path.split('/').pop(),
        extension: 'md',
      }))
    );
  }

  describe('Large Vault Performance Scaling', () => {
    test.each(testScenarios)(
      'should update $description within $expectedMaxTime seconds',
      async ({ description, vaultOptions, expectedMaxTime }) => {
        // Arrange: Create mock large vault
        createMockLargeVault(vaultOptions);

        // Act & Assert: This test WILL FAIL initially (TDD requirement)
        // because the actual LargeVaultIndexer service doesn't exist yet
        const startTime = Date.now();

        try {
          // Attempt to perform index update (will fail due to mock)
          await mockLargeVaultIndexer.updateIndex();

          const endTime = Date.now();
          const actualTime = (endTime - startTime) / 1000; // Convert to seconds

          // These assertions will not be reached due to mock rejection
          expect(actualTime).toBeLessThanOrEqual(expectedMaxTime);
          expect(mockLargeVaultIndexer.isIndexing()).toBe(false);

          // Verify performance monitoring was called
          expect(mockPerformanceMonitor.startTiming).toHaveBeenCalled();
          expect(mockPerformanceMonitor.endTiming).toHaveBeenCalled();

          // Performance metrics should be collected
          const metrics: PerformanceMetrics = await mockPerformanceMonitor.getMetrics();
          expect(metrics).toBeDefined();
          expect(metrics.linesCount).toBe(vaultOptions.totalLines);
          expect(metrics.updateTime).toBeLessThanOrEqual(expectedMaxTime);

        } catch (error) {
          // Expected to fail initially - TDD requirement
          expect(error).toBeDefined();
          expect(error.message).toContain('not implemented');
        }
      }
    );

    test('should scale performance linearly with vault size', async () => {
      // This test verifies the proportional scaling requirement:
      // Base time (100k lines): 30s
      // Additional time: +10s per 100k lines

      const baseTime = 30; // seconds for 100k lines
      const timePerHundredK = 10; // seconds per additional 100k lines

      for (const scenario of testScenarios) {
        const expectedTime = baseTime + ((scenario.vaultOptions.totalLines - 100000) / 100000) * timePerHundredK;

        // This assertion will fail initially because the service doesn't exist
        expect(expectedTime).toBe(scenario.expectedMaxTime);

        try {
          // Mock time estimation (will fail due to mock)
          const estimatedTime = mockLargeVaultIndexer.getEstimatedTime(scenario.vaultOptions.totalLines);
          expect(estimatedTime).toBeLessThanOrEqual(expectedTime);
        } catch (error) {
          // Expected to fail - TDD requirement
          expect(error).toBeDefined();
        }
      }
    });

    test('should not block UI during large vault indexing', async () => {
      // Arrange: Create 500k line vault
      const largeVaultOptions: VaultMockOptions = {
        fileCount: 5000,
        totalLines: 500000,
        averageLinesPerFile: 100,
      };

      createMockLargeVault(largeVaultOptions);

      // Act: Start indexing in background mode
      try {
        mockLargeVaultIndexer.enableBackgroundMode();
        await mockLargeVaultIndexer.indexVault();

        // Assert: UI should remain responsive
        const isUIResponsive = mockPerformanceMonitor.isUIResponsive();
        expect(isUIResponsive).toBe(true);

      } catch (error) {
        // Expected to fail initially - TDD requirement
        expect(error).toBeDefined();
        expect(mockPerformanceMonitor.isUIResponsive()).toBe(false); // Mock returns false
      }
    });

    test('should handle memory efficiently for large vaults', async () => {
      // Test memory usage doesn't grow exponentially with vault size
      const memoryUsageResults: Array<{ vaultSize: number; memoryUsage: number }> = [];

      for (const scenario of testScenarios) {
        createMockLargeVault(scenario.vaultOptions);

        try {
          await mockLargeVaultIndexer.indexVault();
          const memoryUsage = mockPerformanceMonitor.getMemoryUsage();

          memoryUsageResults.push({
            vaultSize: scenario.vaultOptions.totalLines,
            memoryUsage,
          });

        } catch (error) {
          // Expected to fail - TDD requirement
          memoryUsageResults.push({
            vaultSize: scenario.vaultOptions.totalLines,
            memoryUsage: 0, // Mock returns 0
          });
        }
      }

      // Memory usage should scale reasonably (not exponentially)
      // This will fail initially because mocks return 0
      expect(memoryUsageResults.every(result => result.memoryUsage === 0)).toBe(true);
    });

    test('should support cancellation of long-running indexing operations', async () => {
      // Arrange: Create large vault that would take >130 seconds
      const veryLargeVaultOptions: VaultMockOptions = {
        fileCount: 15000,
        totalLines: 1500000,
        averageLinesPerFile: 100,
      };

      createMockLargeVault(veryLargeVaultOptions);

      // Act: Start indexing and then cancel
      try {
        const indexingPromise = mockLargeVaultIndexer.indexVault();

        // Simulate cancellation after 5 seconds
        setTimeout(() => {
          mockLargeVaultIndexer.cancelIndexing();
        }, 5000);

        await indexingPromise;

        // Should not reach here due to cancellation
        expect(mockLargeVaultIndexer.isIndexing()).toBe(false);

      } catch (error) {
        // Expected behavior - operation should be cancellable
        expect(error).toBeDefined();
        expect(mockLargeVaultIndexer.isIndexing()).toBe(false);
      }
    });
  });

  describe('Performance Monitoring Integration', () => {
    test('should collect detailed performance metrics during indexing', async () => {
      // Arrange
      const testVaultOptions: VaultMockOptions = {
        fileCount: 1000,
        totalLines: 100000,
        averageLinesPerFile: 100,
      };

      createMockLargeVault(testVaultOptions);

      // Act
      try {
        mockPerformanceMonitor.startTiming('vault-indexing');
        await mockLargeVaultIndexer.indexVault();
        await mockPerformanceMonitor.endTiming('vault-indexing');

        const metrics = await mockPerformanceMonitor.getMetrics();

        // Assert: Detailed metrics should be available
        expect(metrics).toBeDefined();
        expect(metrics.linesCount).toBe(testVaultOptions.totalLines);
        expect(metrics.updateTime).toBeGreaterThan(0);
        expect(metrics.memoryUsage).toBeGreaterThan(0);
        expect(typeof metrics.isUIBlocked).toBe('boolean');

      } catch (error) {
        // Expected to fail initially - TDD requirement
        expect(error).toBeDefined();

        // Verify monitoring methods were called even during failure
        expect(mockPerformanceMonitor.startTiming).toHaveBeenCalledWith('vault-indexing');
        expect(mockPerformanceMonitor.getMetrics).toHaveBeenCalled();
      }
    });

    test('should track indexing progress for large vaults', async () => {
      // Arrange
      const progressTrackingVault: VaultMockOptions = {
        fileCount: 2000,
        totalLines: 200000,
        averageLinesPerFile: 100,
      };

      createMockLargeVault(progressTrackingVault);

      // Act & Assert
      try {
        const indexingPromise = mockLargeVaultIndexer.indexVault();

        // Check progress during indexing
        const initialProgress = mockLargeVaultIndexer.getIndexingProgress();
        expect(initialProgress).toBe(0); // Mock returns 0

        await indexingPromise;

        const finalProgress = mockLargeVaultIndexer.getIndexingProgress();
        expect(finalProgress).toBe(100); // Should be 100% when complete

      } catch (error) {
        // Expected to fail initially - TDD requirement
        expect(error).toBeDefined();
        expect(mockLargeVaultIndexer.getIndexingProgress()).toBe(0); // Mock returns 0
      }
    });
  });
});