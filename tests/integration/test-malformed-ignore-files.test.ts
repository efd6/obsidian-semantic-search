/**
 * Integration test for malformed ignore file handling
 * Acceptance Criteria: FR-010
 */

import { Vault } from 'obsidian';
import { IgnorePatternProcessor } from '../../src/services/IgnorePatternProcessor';

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
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    on: jest.fn(),
    off: jest.fn(),
  } as any;
}

describe('Malformed Ignore File Handling Integration', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Invalid Pattern Handling (FR-010)', () => {
    it('should load all non-empty patterns as valid', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.md\n[invalid-regex\nvalid-pattern.txt\n***/broken\nnormal/*.md',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBe(5);
      expect(patterns.every(p => p.isValid)).toBe(true);
    });

    it('should continue filtering files with all loaded patterns', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\ntemp/\n.git/\n*.draft\nArchive/',
      });
      const processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();

      for (const path of ['test.tmp', 'temp/file.md', 'normal.md']) {
        expect(typeof await processor.shouldIndexFile(path)).toBe('boolean');
      }
    });
  });

  describe('Empty and Edge Case Files', () => {
    it('should handle empty ignore files', async () => {
      const vault = createMockVault({ '.obsidianignore': '' });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns).toEqual([]);
    });

    it('should handle ignore files with only comments and whitespace', async () => {
      const vault = createMockVault({
        '.obsidianignore': '# comment\n   # another\n\n  # yet another\n\n',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns).toEqual([]);
    });

    it('should handle ignore files with unusual line endings', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\r\ntemp/\r\n.git/\n*.draft\r',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBe(4);
      const names = patterns.map(p => p.pattern);
      expect(names).toContain('*.tmp');
      expect(names).toContain('temp/');
      expect(names).toContain('.git/');
      expect(names).toContain('*.draft');
    });
  });

  describe('Large File Handling', () => {
    it('should handle extremely large ignore files', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 10000; i++) {
        lines.push(`pattern${i}/*.md`);
      }
      const vault = createMockVault({ '.obsidianignore': lines.join('\n') });
      const processor = new IgnorePatternProcessor(vault);

      const start = Date.now();
      const patterns = await processor.loadIgnorePatterns();
      expect(Date.now() - start).toBeLessThan(10000);
      expect(patterns.length).toBeGreaterThan(5000);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should allow indexing when no patterns are loaded', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();

      expect(processor.getLoadedPatterns().length).toBe(0);
      expect(await processor.shouldIndexFile('any-file.md')).toBe(true);
    });

    it('should allow pattern refresh after clearing cache', async () => {
      const vault = createMockVault({ '.obsidianignore': '*.log' });
      const processor = new IgnorePatternProcessor(vault);

      let patterns = await processor.loadIgnorePatterns();
      expect(patterns.length).toBe(1);

      // Simulate changing the file
      (vault.adapter.read as jest.Mock).mockImplementation(() =>
        Promise.resolve('*.tmp\ntemp/'),
      );
      processor.clearCache();
      patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBe(2);
      expect(patterns.every(p => p.isValid)).toBe(true);
      expect(await processor.shouldIndexFile('test.tmp')).toBe(false);
    });
  });
});
