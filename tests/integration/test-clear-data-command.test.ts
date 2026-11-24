/**
 * Integration test for clear data via command palette
 * Acceptance Criteria: FR-003, FR-012
 *
 * The clear-search-data command lives in main.ts, registered during
 * onload(). These tests exercise the DataManager methods that the
 * command invokes rather than trying to load the full plugin.
 */

import { App } from 'obsidian';
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

// testIndex is a stand-in for the search index that counts as cleared n
// documents, optionally after a delay.
function testIndex(n = 0, delay = 0): { clear: jest.Mock } {
  return {
    clear: jest.fn(() => new Promise(resolve => setTimeout(() => resolve(n), delay))),
  };
}

describe('Clear Data Command Integration', () => {
  describe('DataManager.clearAllData', () => {
    it('should complete when the index is empty', async () => {
      const dm = new DataManager(createMockApp(), testIndex());
      await expect(dm.clearAllData()).resolves.not.toThrow();

      const status = dm.getClearStatus();
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
    });

    it('should reject when no index is configured', async () => {
      const dm = new DataManager(createMockApp());
      await expect(dm.clearAllData()).rejects.toThrow('Search index not available');

      const status = dm.getClearStatus();
      expect(status.status).toBe('failed');
    });

    it('should report the number of documents cleared', async () => {
      const index = testIndex(10);
      const dm = new DataManager(createMockApp(), index);
      await dm.clearAllData();

      const status = dm.getClearStatus();
      expect(index.clear).toHaveBeenCalledTimes(1);
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
      expect(status.itemsCleared).toBe(10);
    });
  });

  describe('Concurrent Operation Prevention (FR-012)', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      // A slow clear leaves a window for the second call.
      const dm = new DataManager(createMockApp(), testIndex(0, 50));

      const first = dm.clearAllData();
      const second = dm.clearAllData();

      const results = await Promise.allSettled([first, second]);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });
  });

  describe('resetClearStatus', () => {
    it('should allow a new clear after reset', async () => {
      const dm = new DataManager(createMockApp(), testIndex());
      await dm.clearAllData();
      expect(dm.getClearStatus().status).toBe('complete');

      dm.resetClearStatus();
      expect(dm.getClearStatus().status).toBe('idle');
    });
  });
});
