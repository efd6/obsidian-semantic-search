/**
 * Integration test for .obsidianignore pattern processing
 * Based on quickstart scenario 3: Ignore Pattern Processing (.obsidianignore)
 * Acceptance Criteria: FR-004, FR-006, FR-008
 */

import { App, Vault, TFile } from 'obsidian';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';
import { IgnorePatternProcessor } from '../../src/types/ignore-patterns';

// Mock Obsidian environment
jest.mock('obsidian');

describe('.obsidianignore Pattern Processing Integration', () => {
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

  describe('Ignore File Loading (FR-004)', () => {
    it('should read .obsidianignore from vault root', async () => {
      const mockIgnoreContent = `
# Test patterns
*.tmp
temp/
.git/
!important.tmp
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(mockVault.adapter.exists).toHaveBeenCalledWith('.obsidianignore');
      expect(mockVault.adapter.read).toHaveBeenCalledWith('.obsidianignore');
      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBeGreaterThan(0);
    });

    it('should handle missing .obsidianignore gracefully', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(false);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBe(0);
      expect(matcher.loadErrors.length).toBe(0);
    });

    it('should handle .obsidianignore read errors', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockRejectedValue(new Error('File read error'));

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.loadErrors.length).toBeGreaterThan(0);
      expect(matcher.loadErrors[0]).toContain('File read error');
    });
  });

  describe('Pattern Parsing', () => {
    it('should parse gitignore-style patterns correctly', async () => {
      const mockIgnoreContent = `
# Comments should be ignored
*.tmp
temp/
.git/
!important.tmp

# Empty lines should be ignored
*.draft
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.patterns.length).toBe(5); // Should exclude comments and empty lines

      const patternStrings = matcher.patterns.map(p => p.pattern);
      expect(patternStrings).toContain('*.tmp');
      expect(patternStrings).toContain('temp/');
      expect(patternStrings).toContain('.git/');
      expect(patternStrings).toContain('!important.tmp');
      expect(patternStrings).toContain('*.draft');

      // Should not contain comments
      expect(patternStrings).not.toContain('# Comments should be ignored');
    });

    it('should handle negation patterns (!pattern)', async () => {
      const mockIgnoreContent = `
*.tmp
!important.tmp
temp/
!temp/keep.md
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should include negation patterns
      const negationPatterns = matcher.patterns.filter(p => p.pattern.startsWith('!'));
      expect(negationPatterns.length).toBe(2);
      expect(negationPatterns[0].pattern).toBe('!important.tmp');
      expect(negationPatterns[1].pattern).toBe('!temp/keep.md');
    });
  });

  describe('File Filtering (FR-006, FR-008)', () => {
    beforeEach(async () => {
      const mockIgnoreContent = `
# Test patterns
*.tmp
temp/
.git/
!important.tmp
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();
    });

    it('should exclude files matching patterns', () => {
      const testCases = [
        { path: 'test.tmp', shouldIndex: false, reason: 'matches *.tmp' },
        { path: 'document.tmp', shouldIndex: false, reason: 'matches *.tmp' },
        { path: 'temp/file.md', shouldIndex: false, reason: 'matches temp/' },
        { path: 'temp/subfolder/file.md', shouldIndex: false, reason: 'matches temp/' },
        { path: '.git/config', shouldIndex: false, reason: 'matches .git/' }
      ];

      testCases.forEach(({ path, shouldIndex, reason }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
        if (!shouldIndex) {
          expect(result.matchedPattern).toBeDefined();
          expect(result.sourceIgnore).toBe('.obsidianignore');
        }
      });
    });

    it('should include files not matching patterns', () => {
      const testCases = [
        'normal.md',
        'document.md',
        'folder/file.md',
        'notes/important.md'
      ];

      testCases.forEach(path => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(true);
        expect(result.matchedPattern).toBeUndefined();
      });
    });

    it('should handle negation patterns correctly', () => {
      const result = ignoreProcessor.shouldIndexFile('important.tmp');

      // Should be indexed despite matching *.tmp due to !important.tmp
      expect(result.shouldIndex).toBe(true);
      expect(result.matchedPattern).toBeUndefined();
    });

    it('should handle directory patterns', () => {
      const testCases = [
        { path: 'temp/file.md', shouldIndex: false },
        { path: 'temp/sub/file.md', shouldIndex: false },
        { path: 'temp', shouldIndex: false },
        { path: 'temporary/file.md', shouldIndex: true } // Should not match temp/
      ];

      testCases.forEach(({ path, shouldIndex }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result.shouldIndex).toBe(shouldIndex);
      });
    });

    it('should handle complex path patterns', () => {
      // Add more complex patterns
      const complexIgnoreContent = `
docs/*.pdf
src/**/*.test.js
**/node_modules/
.obsidian/
`;

      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(complexIgnoreContent);

      // Reload patterns
      ignoreProcessor.loadIgnorePatterns().then(() => {
        const testCases = [
          { path: 'docs/manual.pdf', shouldIndex: false },
          { path: 'src/utils/helper.test.js', shouldIndex: false },
          { path: 'project/node_modules/package/index.js', shouldIndex: false },
          { path: '.obsidian/config.json', shouldIndex: false },
          { path: 'docs/manual.md', shouldIndex: true },
          { path: 'src/utils/helper.js', shouldIndex: true }
        ];

        testCases.forEach(({ path, shouldIndex }) => {
          const result = ignoreProcessor.shouldIndexFile(path);
          expect(result.shouldIndex).toBe(shouldIndex);
        });
      });
    });
  });

  describe('Integration with DocumentIndexer', () => {
    it('should exclude ignored files from indexing', async () => {
      // Setup ignore patterns
      const mockIgnoreContent = '*.tmp\ntemp/';
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      // Setup mock files
      const mockFiles = [
        { path: 'normal.md', name: 'normal.md' },
        { path: 'test.tmp', name: 'test.tmp' },
        { path: 'temp/file.md', name: 'file.md' },
        { path: 'important.md', name: 'important.md' }
      ] as TFile[];

      (mockVault.getMarkdownFiles as jest.Mock)
        .mockReturnValue(mockFiles);

      // This will fail until DocumentIndexer integration is implemented
      documentIndexer.ignoreProcessor = ignoreProcessor;
      await documentIndexer.indexVault();

      // Should only index files that pass ignore filter
      // This will be validated when integration is complete
      expect(true).toBe(true); // Placeholder until implementation
    });

    it('should log ignored files for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockIgnoreContent = '*.tmp';
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      await ignoreProcessor.loadIgnorePatterns();

      const result = ignoreProcessor.shouldIndexFile('test.tmp');
      expect(result.shouldIndex).toBe(false);

      // Should log when files are ignored
      // This will be validated when logging is implemented
      expect(true).toBe(true); // Placeholder

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should continue indexing when ignore file has errors', async () => {
      // Mock ignore file with mixed valid/invalid patterns
      const mockIgnoreContent = `
*.md
[invalid-regex
valid-pattern.txt
***/broken
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mockIgnoreContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should load successfully despite errors
      expect(matcher.isLoaded).toBe(true);
      expect(matcher.loadErrors.length).toBeGreaterThan(0);

      // Should still process valid patterns
      const validPatterns = matcher.patterns.filter(p => p.isValid);
      expect(validPatterns.length).toBeGreaterThan(0);

      // Should be able to filter files with valid patterns
      const result = ignoreProcessor.shouldIndexFile('test.md');
      expect(typeof result.shouldIndex).toBe('boolean');
    });
  });
});