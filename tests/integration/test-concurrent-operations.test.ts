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

function mockDatabase(removeDelay = 0): any {
  const makeCollection = () => ({
    count: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(5) }),
    remove: jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, removeDelay)),
    ),
  });
  return {
    collections: {
      documents: makeCollection(),
      chunks: makeCollection(),
      embeddings: makeCollection(),
    },
  };
}

describe('Concurrent Operation Prevention Integration', () => {
  describe('Clear Operation Concurrency Control', () => {
    it('should prevent multiple simultaneous clear operations', async () => {
      const dm = new DataManager(createMockApp(), mockDatabase(50));

      const ops = [dm.clearAllData(), dm.clearAllData(), dm.clearAllData()];
      const results = await Promise.allSettled(ops);

      const ok = results.filter(r => r.status === 'fulfilled');
      const fail = results.filter(r => r.status === 'rejected');

      expect(ok.length).toBe(1);
      expect(fail.length).toBe(2);
    });

    it('should track clear operation status correctly', async () => {
      const dm = new DataManager(createMockApp(), mockDatabase());

      expect(dm.getClearStatus().status).toBe('idle');
      await dm.clearAllData();
      expect(dm.getClearStatus().status).toBe('complete');
      expect(dm.getClearStatus().progress).toBe(100);
    });

    it('should allow new operation after reset', async () => {
      const dm = new DataManager(createMockApp(), mockDatabase());

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

      // Reset and provide a working database.
      dm.resetClearStatus();
      (dm as any).database = mockDatabase();

      await expect(dm.clearAllData()).resolves.not.toThrow();
      expect(dm.getClearStatus().status).toBe('complete');
    });
  });
});
