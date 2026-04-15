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

function mockDatabase(): any {
  const emptyCollection = {
    count: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  return {
    collections: {
      documents: emptyCollection,
      chunks: emptyCollection,
      embeddings: emptyCollection,
    },
  };
}

describe('Clear Data Command Integration', () => {
  describe('DataManager.clearAllData', () => {
    it('should complete when database has empty collections', async () => {
      const dm = new DataManager(createMockApp(), mockDatabase());
      await expect(dm.clearAllData()).resolves.not.toThrow();

      const status = dm.getClearStatus();
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
    });

    it('should reject when no database is configured', async () => {
      const dm = new DataManager(createMockApp());
      await expect(dm.clearAllData()).rejects.toThrow('Database not initialized');

      const status = dm.getClearStatus();
      expect(status.status).toBe('failed');
    });

    it('should track progress through collections', async () => {
      const makeCol = (n: number) => ({
        count: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(n) }),
        remove: jest.fn().mockResolvedValue(undefined),
      });
      const db = {
        collections: {
          documents: makeCol(10),
          chunks: makeCol(50),
          embeddings: makeCol(50),
        },
      };

      const dm = new DataManager(createMockApp(), db as any);
      await dm.clearAllData();

      const status = dm.getClearStatus();
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
      expect(status.itemsCleared).toBe(110);
    });
  });

  describe('Concurrent Operation Prevention (FR-012)', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      const db = mockDatabase();
      // Slow down the first collection removal to create a window.
      db.collections.documents.remove.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 50)),
      );

      const dm = new DataManager(createMockApp(), db);

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
      const dm = new DataManager(createMockApp(), mockDatabase());
      await dm.clearAllData();
      expect(dm.getClearStatus().status).toBe('complete');

      dm.resetClearStatus();
      expect(dm.getClearStatus().status).toBe('idle');
    });
  });
});
