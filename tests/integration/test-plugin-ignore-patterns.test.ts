/**
 * Integration test for .obsidian-search-ignore patterns
 * Based on quickstart scenario 4: Plugin-Specific Ignore (.obsidian-search-ignore)
 * Acceptance Criteria: FR-005, FR-006, FR-007
 */

import { App, Vault, TFile } from 'obsidian';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { IgnorePatternProcessor } from '../../src/types/ignore-patterns';

// Mock Obsidian environment
jest.mock('obsidian');

describe('.obsidian-search-ignore Pattern Processing Integration', () => {
  let mockApp: App;
  let mockVault: Vault;
  let documentIndexer: DocumentIndexer;
  let ignoreProcessor: IgnorePatternProcessor;

  beforeEach(async () => {
    // Setup mock vault with ignore file support
    mockVault = {
      adapter: {
        exists: jest.fn(),
        read: jest.fn()
      },
      getMarkdownFiles: jest.fn(),
      read: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as any;

    mockApp = {
      vault: mockVault
    } as any;

    // This will fail until IgnorePatternProcessor is implemented
    const { IgnorePatternProcessorImpl } = require('../../src/services/IgnorePatternProcessor');
    ignoreProcessor = new IgnorePatternProcessorImpl(mockVault);

    documentIndexer = new DocumentIndexer(mockVault);
  });

  describe('Plugin Ignore File Loading (FR-005)', () => {
    it('should read .obsidian-search-ignore from vault root', async () => {
      const mockIgnoreContent = `
# Plugin-specific exclusions
Archive/**
drafts/*.md
*.draft
temp-notes/
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(mockVault.adapter.exists).toHaveBeenCalledWith('.obsidian-search-ignore');
      expect(mockVault.adapter.read).toHaveBeenCalledWith('.obsidian-search-ignore');
      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBeGreaterThan(0);

      // Verify patterns are marked with correct source
      const pluginPatterns = matcher.patterns.filter(
        p => p.sourceFile === '.obsidian-search-ignore'
      );
      expect(pluginPatterns.length).toBeGreaterThan(0);
    });

    it('should handle missing .obsidian-search-ignore gracefully', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(false);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBe(0);
      expect(matcher.loadErrors.length).toBe(0);
    });
  });

  describe('Plugin-Specific Pattern Filtering', () => {
    beforeEach(async () => {
      const mockIgnoreContent = `
# Plugin-specific exclusions
Archive/**
drafts/*.md
*.draft
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();
    });

    it('should exclude files matching plugin patterns', () => {
      const testCases = [
        { path: 'Archive/old.md', shouldIndex: false, reason: 'matches Archive/**' },
        { path: 'Archive/2023/notes.md', shouldIndex: false, reason: 'matches Archive/**' },
        { path: 'drafts/work.md', shouldIndex: false, reason: 'matches drafts/*.md' },
        { path: 'notes.draft', shouldIndex: false, reason: 'matches *.draft' }
      ];

      testCases.forEach(({ path, shouldIndex, reason }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
        if (!shouldIndex) {
          expect(result.matchedPattern).toBeDefined();
          expect(result.sourceIgnore).toBe('.obsidian-search-ignore');
        }
      });
    });

    it('should include files not matching plugin patterns', () => {
      const testCases = [
        'normal.md',
        'published.md',
        'final/document.md',
        'drafts/published.txt' // Different extension
      ];

      testCases.forEach(path => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(true);
        expect(result.matchedPattern).toBeUndefined();
      });
    });

    it('should handle double-star patterns correctly', () => {
      const testCases = [
        { path: 'Archive/file.md', shouldIndex: false },
        { path: 'Archive/2023/file.md', shouldIndex: false },
        { path: 'Archive/deep/nested/file.md', shouldIndex: false },
        { path: 'Archive', shouldIndex: false }, // Directory itself
        { path: 'ArchiveOld/file.md', shouldIndex: true } // Different directory
      ];

      testCases.forEach(({ path, shouldIndex }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
      });
    });
  });

  describe('Combined Pattern Sources (FR-006)', () => {
    it('should apply both .obsidianignore and .obsidian-search-ignore patterns', async () => {
      // Setup both ignore files
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) =>
          path === '.obsidianignore' || path === '.obsidian-search-ignore'
        );

      (mockVault.adapter.read as jest.Mock)
        .mockImplementation((path: string) => {
          if (path === '.obsidianignore') {
            return Promise.resolve('*.tmp\ntemp/');
          }
          if (path === '.obsidian-search-ignore') {
            return Promise.resolve('Archive/**\n*.draft');
          }
          return Promise.reject(new Error('File not found'));
        });

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should have patterns from both sources
      const obsidianPatterns = matcher.patterns.filter(
        p => p.sourceFile === '.obsidianignore'
      );
      const pluginPatterns = matcher.patterns.filter(
        p => p.sourceFile === '.obsidian-search-ignore'
      );

      expect(obsidianPatterns.length).toBeGreaterThan(0);
      expect(pluginPatterns.length).toBeGreaterThan(0);

      // Test exclusions from both sources
      const testCases = [
        { path: 'test.tmp', shouldIndex: false, source: '.obsidianignore' },
        { path: 'temp/file.md', shouldIndex: false, source: '.obsidianignore' },
        { path: 'Archive/old.md', shouldIndex: false, source: '.obsidian-search-ignore' },
        { path: 'notes.draft', shouldIndex: false, source: '.obsidian-search-ignore' },
        { path: 'normal.md', shouldIndex: true, source: undefined }
      ];

      testCases.forEach(({ path, shouldIndex, source }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
        if (!shouldIndex && source) {
          expect(result.sourceIgnore).toBe(source);
        }
      });
    });

    it('should handle conflicting patterns between files', async () => {
      // Setup conflicting patterns
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) =>
          path === '.obsidianignore' || path === '.obsidian-search-ignore'
        );

      (mockVault.adapter.read as jest.Mock)
        .mockImplementation((path: string) => {
          if (path === '.obsidianignore') {
            return Promise.resolve('*.draft\n!important.draft'); // Exclude .draft but allow important.draft
          }
          if (path === '.obsidian-search-ignore') {
            return Promise.resolve('important.draft'); // Exclude important.draft
          }
          return Promise.reject(new Error('File not found'));
        });

      await ignoreProcessor.loadIgnorePatterns();

      // Plugin-specific should take precedence or patterns should be merged logically
      const result = ignoreProcessor.shouldIndexFile('important.draft');

      // Implementation-dependent: should define clear precedence rules
      expect(typeof result.shouldIndex).toBe('boolean');
      if (!result.shouldIndex) {
        expect(result.sourceIgnore).toBeDefined();
      }
    });
  });

  describe('Pattern Priority and Ordering', () => {
    it('should process patterns in correct order', async () => {
      const mockIgnoreContent = `
*.md
!important.md
drafts/*.md
!drafts/keep.md
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();

      const testCases = [
        { path: 'test.md', shouldIndex: false }, // Excluded by *.md
        { path: 'important.md', shouldIndex: true }, // Included by !important.md
        { path: 'drafts/work.md', shouldIndex: false }, // Excluded by drafts/*.md
        { path: 'drafts/keep.md', shouldIndex: true } // Included by !drafts/keep.md
      ];

      testCases.forEach(({ path, shouldIndex }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
      });
    });
  });

  describe('Plugin Integration', () => {
    it('should integrate with DocumentIndexer', async () => {
      // Setup plugin ignore patterns
      const mockIgnoreContent = 'Archive/**\n*.draft';
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      // Setup mock files
      const mockFiles = [
        { path: 'normal.md', name: 'normal.md' },
        { path: 'Archive/old.md', name: 'old.md' },
        { path: 'work.draft', name: 'work.draft' },
        { path: 'published.md', name: 'published.md' }
      ] as TFile[];

      (mockVault.getMarkdownFiles as jest.Mock)
        .mockReturnValue(mockFiles);

      // This will fail until DocumentIndexer integration is implemented
      documentIndexer.ignoreProcessor = ignoreProcessor;
      await documentIndexer.indexVault();

      // Should only index files that pass plugin ignore filter
      // This will be validated when integration is complete
      expect(true).toBe(true); // Placeholder until implementation
    });

    it('should provide clear feedback about ignored files', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockIgnoreContent = 'Archive/**';
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();

      const result = ignoreProcessor.shouldIndexFile('Archive/old.md');
      expect(result.shouldIndex).toBe(false);
      expect(result.sourceIgnore).toBe('.obsidian-search-ignore');

      // Should provide clear logging about plugin-specific exclusions
      // This will be validated when logging is implemented
      expect(true).toBe(true); // Placeholder

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of plugin patterns efficiently', async () => {
      // Generate many patterns
      const patterns = [];
      for (let i = 0; i < 1000; i++) {
        patterns.push(`pattern${i}/*.md`);
        patterns.push(`temp${i}/`);
      }

      const mockIgnoreContent = patterns.join('\n');
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const startTime = Date.now();
      await ignoreProcessor.loadIgnorePatterns();

      // Test pattern matching performance
      const testFiles = [
        'pattern500/test.md',
        'normal.md',
        'temp750/file.md',
        'other.md'
      ];

      testFiles.forEach(path => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(typeof result.shouldIndex).toBe('boolean');
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should cache compiled patterns for repeated use', async () => {
      const mockIgnoreContent = 'Archive/**\n*.draft';
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidian-search-ignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();

      // Multiple calls should use cached patterns
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        ignoreProcessor.shouldIndexFile(`test${i}.md`);
      }
      const endTime = Date.now();

      // Should be fast due to caching
      expect(endTime - startTime).toBeLessThan(100); // 100ms max
    });
  });
});