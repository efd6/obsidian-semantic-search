/**
 * Contract test for DataManager interface
 * Verifies that implementations properly adhere to the interface contract
 */

import { DataManager, DataClearResult, DataClearOperation } from '../../src/types/data-management';

describe('DataManager Interface Contract', () => {
  let dataManager: DataManager;

  beforeEach(() => {
    // This will fail until DataManager is implemented
    const { DataManagerImpl } = require('../../src/services/DataManager');
    dataManager = new DataManagerImpl();
  });

  describe('clearAllData method', () => {
    it('should return a DataClearResult with required fields', async () => {
      const result = await dataManager.clearAllData();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.documentsCleared).toBe('number');
      expect(typeof result.chunksCleared).toBe('number');
      expect(typeof result.embeddingsCleared).toBe('number');
      expect(typeof result.timeElapsed).toBe('number');

      // Error should be string if present
      if (result.error) {
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle successful clear operation', async () => {
      const result = await dataManager.clearAllData();

      if (result.success) {
        expect(result.documentsCleared).toBeGreaterThanOrEqual(0);
        expect(result.chunksCleared).toBeGreaterThanOrEqual(0);
        expect(result.embeddingsCleared).toBeGreaterThanOrEqual(0);
        expect(result.timeElapsed).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      }
    });

    it('should handle failed clear operation', async () => {
      // Test will be updated when implementation supports error simulation
      const result = await dataManager.clearAllData();

      if (!result.success && result.error) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getClearStatus method', () => {
    it('should return a DataClearOperation with required fields', () => {
      const status = dataManager.getClearStatus();

      expect(status).toBeDefined();
      expect(['idle', 'confirming', 'clearing', 'complete', 'failed']).toContain(status.status);
      expect(typeof status.progress).toBe('number');
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(typeof status.itemsCleared).toBe('number');
      expect(status.itemsCleared).toBeGreaterThanOrEqual(0);

      if (status.error) {
        expect(typeof status.error).toBe('string');
      }

      if (status.startTime) {
        expect(status.startTime).toBeInstanceOf(Date);
      }
    });

    it('should start in idle status', () => {
      const status = dataManager.getClearStatus();
      expect(status.status).toBe('idle');
      expect(status.progress).toBe(0);
      expect(status.itemsCleared).toBe(0);
    });
  });

  describe('showClearConfirmation method', () => {
    it('should return a boolean promise', async () => {
      const confirmation = await dataManager.showClearConfirmation();
      expect(typeof confirmation).toBe('boolean');
    });
  });

  describe('reinitializeStorage method', () => {
    it('should complete without throwing', async () => {
      await expect(dataManager.reinitializeStorage()).resolves.not.toThrow();
    });
  });

  describe('showClearFeedback method', () => {
    it('should accept DataClearResult without throwing', () => {
      const mockResult: DataClearResult = {
        success: true,
        documentsCleared: 10,
        chunksCleared: 50,
        embeddingsCleared: 50,
        timeElapsed: 1000
      };

      expect(() => dataManager.showClearFeedback(mockResult)).not.toThrow();
    });
  });
});