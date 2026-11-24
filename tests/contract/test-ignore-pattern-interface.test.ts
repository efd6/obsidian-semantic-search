/**
 * Contract test for IgnorePatternProcessor
 * Verifies that the class honours its public API contract.
 */

import { IgnorePattern } from '../../src/types/ignore-patterns';
import { IgnorePatternProcessor } from '../../src/services/IgnorePatternProcessor';
import { Vault } from 'obsidian';

jest.mock('obsidian');

function createMockVault(files: Record<string, string> = {}): Vault {
  return {
    // Like Obsidian, paths starting with a dot are not in the vault's file
    // tree, so the ignore files are only reachable through the adapter.
    getAbstractFileByPath: jest.fn(() => null),
    read: jest.fn(() => Promise.reject(new Error('not in vault tree'))),
    adapter: {
      exists: jest.fn((path: string) => Promise.resolve(path in files)),
      read: jest.fn((path: string) => {
        const content = files[path];
        if (content !== undefined) return Promise.resolve(content);
        return Promise.reject(new Error('File not found'));
      }),
    },
  } as any;
}

describe('IgnorePatternProcessor contract', () => {
  describe('loadIgnorePatterns', () => {
    it('should return an array of IgnorePattern', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\ntemp/',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(Array.isArray(patterns)).toBe(true);
      patterns.forEach((p: IgnorePattern) => {
        expect(typeof p.pattern).toBe('string');
        expect(['.obsidianignore', '.obsidian-search-ignore']).toContain(p.sourceFile);
        expect(typeof p.isValid).toBe('boolean');
      });
    });

    it('should return empty array when no ignore files exist', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns).toEqual([]);
    });
  });

  describe('shouldIndexFile', () => {
    it('should return a boolean (async)', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      const result = await processor.shouldIndexFile('test.md');

      expect(typeof result).toBe('boolean');
    });

    it('should handle various path formats', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);

      const paths = [
        'test.md',
        'folder/test.md',
        'deep/nested/folder/test.md',
        '.hidden.md',
        'file-with-dashes.md',
      ];

      for (const path of paths) {
        expect(typeof await processor.shouldIndexFile(path)).toBe('boolean');
      }
    });

    it('should default to allowing indexing when no patterns match', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);

      expect(await processor.shouldIndexFile('definitely-unique-filename.md')).toBe(true);
    });
  });

  describe('parseIgnoreFile', () => {
    it('should parse gitignore-style patterns', () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);

      const patterns = processor.parseIgnoreFile(
        '# comment\n*.tmp\ntemp/\n!important.tmp\n',
        '.obsidianignore',
      );

      expect(Array.isArray(patterns)).toBe(true);
      patterns.forEach(p => {
        expect(typeof p.pattern).toBe('string');
        expect(p.sourceFile).toBe('.obsidianignore');
        expect(p.pattern).not.toMatch(/^#/);
        expect(p.pattern.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for empty content', () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      const patterns = processor.parseIgnoreFile('', '.obsidian-search-ignore');

      expect(patterns).toEqual([]);
    });

    it('should mark all non-empty non-comment patterns as valid', () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);

      const patterns = processor.parseIgnoreFile(
        '*.md\n[bracket\nvalid.txt\n',
        '.obsidianignore',
      );

      expect(patterns.length).toBe(3);
      expect(patterns.every(p => p.isValid)).toBe(true);
    });
  });

  describe('getLoadedPatterns', () => {
    it('should return loaded patterns', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp',
      });
      const processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();

      const loaded = processor.getLoadedPatterns();
      expect(Array.isArray(loaded)).toBe(true);
      expect(loaded.length).toBeGreaterThan(0);
    });
  });
});
