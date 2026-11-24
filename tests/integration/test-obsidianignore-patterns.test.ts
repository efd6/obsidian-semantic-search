/**
 * Integration test for .obsidianignore pattern processing
 * Acceptance Criteria: FR-004, FR-006, FR-008
 */

import { Vault, TFile } from 'obsidian';
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

describe('.obsidianignore Pattern Processing Integration', () => {
  describe('Ignore File Loading (FR-004)', () => {
    it('should load patterns from .obsidianignore', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\ntemp/\n.git/\n!important.tmp',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle missing .obsidianignore gracefully', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns).toEqual([]);
    });
  });

  describe('Pattern Parsing', () => {
    it('should parse gitignore-style patterns correctly', async () => {
      const content = [
        '# Comments should be ignored',
        '*.tmp',
        'temp/',
        '.git/',
        '!important.tmp',
        '',
        '# Empty lines should be ignored',
        '*.draft',
      ].join('\n');

      const vault = createMockVault({ '.obsidianignore': content });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBe(5);

      const names = patterns.map(p => p.pattern);
      expect(names).toContain('*.tmp');
      expect(names).toContain('temp/');
      expect(names).toContain('.git/');
      expect(names).toContain('!important.tmp');
      expect(names).toContain('*.draft');
      expect(names).not.toContain('# Comments should be ignored');
    });

    it('should handle negation patterns (!pattern)', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\n!important.tmp\ntemp/\n!temp/keep.md',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      const negations = patterns.filter(p => p.pattern.startsWith('!'));
      expect(negations.length).toBe(2);
      expect(negations[0].pattern).toBe('!important.tmp');
      expect(negations[1].pattern).toBe('!temp/keep.md');
    });
  });

  describe('File Filtering (FR-006, FR-008)', () => {
    let processor: IgnorePatternProcessor;

    beforeEach(async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\n!important.tmp\ntemp/\n.git/',
      });
      processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();
    });

    it('should exclude files matching patterns', async () => {
      expect(await processor.shouldIndexFile('test.tmp')).toBe(false);
      expect(await processor.shouldIndexFile('document.tmp')).toBe(false);
      expect(await processor.shouldIndexFile('temp/file.md')).toBe(false);
      expect(await processor.shouldIndexFile('temp/subfolder/file.md')).toBe(false);
      expect(await processor.shouldIndexFile('.git/config')).toBe(false);
    });

    it('should include files not matching patterns', async () => {
      for (const path of ['normal.md', 'document.md', 'folder/file.md', 'notes/important.md']) {
        expect(await processor.shouldIndexFile(path)).toBe(true);
      }
    });

    it('should re-include files via negation patterns', async () => {
      expect(await processor.shouldIndexFile('test.tmp')).toBe(false);
      expect(await processor.shouldIndexFile('important.tmp')).toBe(true);
    });

    it('should handle directory patterns', async () => {
      expect(await processor.shouldIndexFile('temp/file.md')).toBe(false);
      expect(await processor.shouldIndexFile('temp/sub/file.md')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should continue when ignore file has mixed valid/invalid patterns', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.md\n[invalid-regex\nvalid-pattern.txt\n***/broken',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      const valid = patterns.filter(p => p.isValid);
      expect(valid.length).toBeGreaterThan(0);

      expect(typeof await processor.shouldIndexFile('test.md')).toBe('boolean');
    });
  });
});
