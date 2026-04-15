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
    getAbstractFileByPath: jest.fn((path: string) => {
      if (path in files) return { path, name: path };
      return null;
    }),
    read: jest.fn((file: any) => {
      const content = files[file.path];
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    }),
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

    it('should set parseError on any pattern that micromatch rejects', () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);

      // micromatch.makeRe is extremely lenient, so most "malformed"
      // patterns are accepted. This test verifies the structural
      // contract: IF any are rejected, they carry a parseError.
      const patterns = processor.parseIgnoreFile(
        '*.md\n[bracket\nvalid.txt\n',
        '.obsidianignore',
      );

      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach(p => {
        if (!p.isValid) {
          expect(p.parseError).toBeDefined();
          expect(typeof p.parseError).toBe('string');
        }
      });
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
