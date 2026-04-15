/**
 * Contract test for DataManager
 * Verifies that the class honours its public API contract.
 */

import { DataManager } from '../../src/services/DataManager';
import { App } from 'obsidian';

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

describe('DataManager contract', () => {
  let dm: DataManager;

  beforeEach(() => {
    dm = new DataManager(createMockApp());
  });

  describe('getClearStatus', () => {
    it('should return a DataClearOperation with required fields', () => {
      const status = dm.getClearStatus();

      expect(status).toBeDefined();
      expect(['idle', 'confirming', 'clearing', 'complete', 'failed']).toContain(status.status);
      expect(typeof status.progress).toBe('number');
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
      expect(typeof status.itemsCleared).toBe('number');
    });

    it('should start in idle status', () => {
      const status = dm.getClearStatus();
      expect(status.status).toBe('idle');
      expect(status.progress).toBe(0);
      expect(status.itemsCleared).toBe(0);
    });
  });

  describe('clearAllData', () => {
    it('should reject when no database is configured', async () => {
      await expect(dm.clearAllData()).rejects.toThrow('Database not initialized');
    });

    it('should throw when a clear is already in progress', async () => {
      // First call sets status to 'clearing' and then throws because
      // there's no database — but the status stays 'clearing'.
      await expect(dm.clearAllData()).rejects.toThrow();

      // Manually reset to 'clearing' to simulate an in-progress op.
      (dm as any).clearOperation = { status: 'clearing', progress: 0, itemsCleared: 0 };
      await expect(dm.clearAllData()).rejects.toThrow('already in progress');
    });
  });

  describe('resetClearStatus', () => {
    it('should reset to idle', () => {
      // Simulate a completed clear.
      (dm as any).clearOperation = { status: 'complete', progress: 100, itemsCleared: 5 };
      dm.resetClearStatus();

      const status = dm.getClearStatus();
      expect(status.status).toBe('idle');
      expect(status.progress).toBe(0);
      expect(status.itemsCleared).toBe(0);
    });
  });
});
