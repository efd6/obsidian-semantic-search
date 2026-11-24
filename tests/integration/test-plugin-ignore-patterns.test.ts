/**
 * Integration test for .obsidian-search-ignore patterns
 * Acceptance Criteria: FR-005, FR-006, FR-007
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

describe('.obsidian-search-ignore Pattern Processing Integration', () => {
  describe('Plugin Ignore File Loading (FR-005)', () => {
    it('should load patterns from .obsidian-search-ignore', async () => {
      const vault = createMockVault({
        '.obsidian-search-ignore': 'Archive/**\ndrafts/*.md\n*.draft\ntemp-notes/',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns.length).toBeGreaterThan(0);

      const pluginPatterns = patterns.filter(
        p => p.sourceFile === '.obsidian-search-ignore',
      );
      expect(pluginPatterns.length).toBeGreaterThan(0);
    });

    it('should handle missing .obsidian-search-ignore gracefully', async () => {
      const vault = createMockVault();
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      expect(patterns).toEqual([]);
    });
  });

  describe('Plugin-Specific Pattern Filtering', () => {
    let processor: IgnorePatternProcessor;

    beforeEach(async () => {
      const vault = createMockVault({
        '.obsidian-search-ignore': 'Archive/**\ndrafts/*.md\n*.draft',
      });
      processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();
    });

    it('should exclude files matching plugin patterns', async () => {
      const excluded = [
        'Archive/old.md',
        'Archive/2023/notes.md',
        'drafts/work.md',
        'notes.draft',
      ];
      for (const path of excluded) {
        expect(await processor.shouldIndexFile(path)).toBe(false);
      }
    });

    it('should include files not matching plugin patterns', async () => {
      const included = [
        'normal.md',
        'published.md',
        'final/document.md',
      ];
      for (const path of included) {
        expect(await processor.shouldIndexFile(path)).toBe(true);
      }
    });

    it('should handle double-star patterns correctly', async () => {
      expect(await processor.shouldIndexFile('Archive/file.md')).toBe(false);
      expect(await processor.shouldIndexFile('Archive/2023/file.md')).toBe(false);
      expect(await processor.shouldIndexFile('Archive/deep/nested/file.md')).toBe(false);
    });
  });

  describe('Combined Pattern Sources (FR-006)', () => {
    it('should apply both .obsidianignore and .obsidian-search-ignore patterns', async () => {
      const vault = createMockVault({
        '.obsidianignore': '*.tmp\ntemp/',
        '.obsidian-search-ignore': 'Archive/**\n*.draft',
      });
      const processor = new IgnorePatternProcessor(vault);
      const patterns = await processor.loadIgnorePatterns();

      const obsidianPatterns = patterns.filter(p => p.sourceFile === '.obsidianignore');
      const pluginPatterns = patterns.filter(p => p.sourceFile === '.obsidian-search-ignore');

      expect(obsidianPatterns.length).toBeGreaterThan(0);
      expect(pluginPatterns.length).toBeGreaterThan(0);

      expect(await processor.shouldIndexFile('test.tmp')).toBe(false);
      expect(await processor.shouldIndexFile('Archive/old.md')).toBe(false);
      expect(await processor.shouldIndexFile('notes.draft')).toBe(false);
      expect(await processor.shouldIndexFile('normal.md')).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of plugin patterns efficiently', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`pattern${i}/*.md`);
        lines.push(`temp${i}/`);
      }
      const vault = createMockVault({
        '.obsidian-search-ignore': lines.join('\n'),
      });
      const processor = new IgnorePatternProcessor(vault);

      const start = Date.now();
      await processor.loadIgnorePatterns();

      expect(await processor.shouldIndexFile('pattern500/test.md')).toBe(false);
      expect(await processor.shouldIndexFile('normal.md')).toBe(true);

      expect(Date.now() - start).toBeLessThan(5000);
    });

    it('should cache compiled patterns for repeated use', async () => {
      const vault = createMockVault({
        '.obsidian-search-ignore': 'Archive/**\n*.draft',
      });
      const processor = new IgnorePatternProcessor(vault);
      await processor.loadIgnorePatterns();

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await processor.shouldIndexFile(`test${i}.md`);
      }
      expect(Date.now() - start).toBeLessThan(100);
    });
  });
});
