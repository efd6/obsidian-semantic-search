/**
 * Integration test for concurrent operation prevention
 * Acceptance Criteria: FR-012
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

// testIndex is a stand-in for the search index that counts as cleared five
// documents after delay milliseconds.
function testIndex(delay = 0): { clear: () => Promise<number> } {
  return {
    clear: () => new Promise(resolve => setTimeout(() => resolve(5), delay)),
  };
}

describe('Concurrent Operation Prevention Integration', () => {
  describe('Clear Operation Concurrency Control', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      const dm = new DataManager(createMockApp(), testIndex(50));

      const ops = [dm.clearAllData(), dm.clearAllData(), dm.clearAllData()];
      const results = await Promise.allSettled(ops);

      const ok = results.filter(r => r.status === 'fulfilled');
      const fail = results.filter(r => r.status === 'rejected');

      expect(ok.length).toBe(1);
      expect(fail.length).toBe(2);
    });

    it('should track clear operation status correctly', async () => {
      const dm = new DataManager(createMockApp(), testIndex());

      expect(dm.getClearStatus().status).toBe('idle');
      await dm.clearAllData();
      expect(dm.getClearStatus().status).toBe('complete');
      expect(dm.getClearStatus().progress).toBe(100);
    });

    it('should allow new operation after reset', async () => {
      const dm = new DataManager(createMockApp(), testIndex());

      await dm.clearAllData();
      dm.resetClearStatus();
      expect(dm.getClearStatus().status).toBe('idle');

      await expect(dm.clearAllData()).resolves.not.toThrow();
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should set status to failed on error', async () => {
      const dm = new DataManager(createMockApp());
      await expect(dm.clearAllData()).rejects.toThrow();
      expect(dm.getClearStatus().status).toBe('failed');
    });

    it('should allow retry after failure and reset', async () => {
      const dm = new DataManager(createMockApp());

      await expect(dm.clearAllData()).rejects.toThrow();
      expect(dm.getClearStatus().status).toBe('failed');

      // Reset and provide a working index.
      dm.resetClearStatus();
      (dm as any).index = testIndex();

      await expect(dm.clearAllData()).resolves.not.toThrow();
      expect(dm.getClearStatus().status).toBe('complete');
    });
  });
});
