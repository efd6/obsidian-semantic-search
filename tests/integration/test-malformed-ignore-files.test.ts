/**
 * Integration test for malformed ignore file handling
 * Based on quickstart scenario 5: Malformed Ignore File Handling
 * Acceptance Criteria: FR-010
 */

import { App, Vault } from 'obsidian';
import { IgnorePatternProcessor } from '../../src/types/ignore-patterns';
import { DocumentIndexer } from '../../src/services/DocumentIndexer';

// Mock Obsidian environment
jest.mock('obsidian');

describe('Malformed Ignore File Handling Integration', () => {
  let mockApp: App;
  let mockVault: Vault;
  let ignoreProcessor: IgnorePatternProcessor;
  let documentIndexer: DocumentIndexer;
  let consoleSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Setup mock vault
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

    // Spy on console to verify error logging
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // This will fail until IgnorePatternProcessor is implemented
    const { IgnorePatternProcessorImpl } = require('../../src/services/IgnorePatternProcessor');
    ignoreProcessor = new IgnorePatternProcessorImpl(mockVault);

    documentIndexer = new DocumentIndexer(mockVault);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Invalid Pattern Handling (FR-010)', () => {
    it('should handle malformed patterns gracefully', async () => {
      const malformedContent = `
*.md
[invalid-regex
valid-pattern.txt
***/broken
(?invalid-lookbehind
normal/*.md
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should still load successfully
      expect(matcher.isLoaded).toBe(true);

      // Should have some valid patterns
      const validPatterns = matcher.patterns.filter(p => p.isValid);
      expect(validPatterns.length).toBeGreaterThan(0);

      // Should identify invalid patterns
      const invalidPatterns = matcher.patterns.filter(p => !p.isValid);
      expect(invalidPatterns.length).toBeGreaterThan(0);

      // Invalid patterns should have error messages
      invalidPatterns.forEach(pattern => {
        expect(pattern.parseError).toBeDefined();
        expect(typeof pattern.parseError).toBe('string');
        expect(pattern.parseError!.length).toBeGreaterThan(0);
      });
    });

    it('should log warnings for invalid patterns without breaking', async () => {
      const malformedContent = `
*.md
[invalid-regex
normal-pattern.txt
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      await ignoreProcessor.loadIgnorePatterns();

      // Should log warnings for invalid patterns
      expect(consoleSpy).toHaveBeenCalled();

      // Should contain information about invalid patterns
      const warningCalls = consoleSpy.mock.calls;
      const hasInvalidPatternWarning = warningCalls.some(call =>
        call.some(arg => typeof arg === 'string' && arg.includes('invalid'))
      );
      expect(hasInvalidPatternWarning).toBe(true);
    });

    it('should continue processing valid patterns despite invalid ones', async () => {
      const mixedContent = `
# Valid patterns
*.tmp
temp/
.git/

# Invalid patterns
[broken-regex
(?invalid

# More valid patterns
*.draft
Archive/
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(mixedContent);

      await ignoreProcessor.loadIgnorePatterns();

      // Should be able to filter files using valid patterns
      const testCases = [
        { path: 'test.tmp', shouldBeDefined: true },
        { path: 'temp/file.md', shouldBeDefined: true },
        { path: 'normal.md', shouldBeDefined: true }
      ];

      testCases.forEach(({ path, shouldBeDefined }) => {
        const result = ignoreProcessor.shouldIndexFile(path);
        expect(result).toBeDefined();
        expect(typeof result.shouldIndex).toBe('boolean');
      });
    });
  });

  describe('File Read Error Handling', () => {
    it('should handle ignore file permission errors', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockRejectedValue(new Error('Permission denied'));

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should handle gracefully
      expect(matcher.isLoaded).toBe(true); // May still be loaded with errors
      expect(matcher.loadErrors.length).toBeGreaterThan(0);
      expect(matcher.loadErrors[0]).toContain('Permission denied');
    });

    it('should handle ignore file encoding issues', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockRejectedValue(new Error('Invalid character encoding'));

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.loadErrors.length).toBeGreaterThan(0);
      expect(matcher.loadErrors[0]).toContain('encoding');
    });

    it('should handle extremely large ignore files', async () => {
      // Generate very large ignore file content
      const largePatterns = [];
      for (let i = 0; i < 10000; i++) {
        largePatterns.push(`pattern${i}/*.md`);
      }
      const largeContent = largePatterns.join('\n');

      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(largeContent);

      const startTime = Date.now();
      const matcher = await ignoreProcessor.loadIgnorePatterns();
      const endTime = Date.now();

      // Should handle large files without excessive delay
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBeGreaterThan(5000); // Should load most patterns
    });
  });

  describe('Empty and Edge Case Files', () => {
    it('should handle empty ignore files', async () => {
      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue('');

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBe(0);
      expect(matcher.loadErrors.length).toBe(0);
    });

    it('should handle ignore files with only comments and whitespace', async () => {
      const commentOnlyContent = `
# This is a comment
   # Another comment

  # Yet another comment

`;

      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(commentOnlyContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBe(0);
      expect(matcher.loadErrors.length).toBe(0);
    });

    it('should handle ignore files with unusual line endings', async () => {
      // Test different line ending styles
      const content = '*.tmp\r\ntemp/\r\n.git/\n*.draft\r';

      (mockVault.adapter.exists as jest.Mock)
        .mockReturnValue(true);
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(content);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      expect(matcher.isLoaded).toBe(true);
      expect(matcher.patterns.length).toBe(4);

      // Should properly parse patterns regardless of line endings
      const patternStrings = matcher.patterns.map(p => p.pattern);
      expect(patternStrings).toContain('*.tmp');
      expect(patternStrings).toContain('temp/');
      expect(patternStrings).toContain('.git/');
      expect(patternStrings).toContain('*.draft');
    });
  });

  describe('Integration with Indexing Process', () => {
    it('should not break indexing when ignore files are malformed', async () => {
      // Setup malformed ignore file
      const malformedContent = `
*.md
[invalid-regex
normal-pattern.txt
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      // Setup mock files to index
      const mockFiles = [
        { path: 'normal.md', name: 'normal.md' },
        { path: 'test.txt', name: 'test.txt' }
      ];

      (mockVault.getMarkdownFiles as jest.Mock)
        .mockReturnValue(mockFiles);

      // This will fail until DocumentIndexer integration is implemented
      documentIndexer.ignoreProcessor = ignoreProcessor;

      // Should not throw despite malformed ignore file
      await expect(documentIndexer.indexVault()).resolves.not.toThrow();
    });

    it('should provide clear error reporting for debugging', async () => {
      const malformedContent = `
*.tmp
[invalid-regex-pattern
(?invalid-lookbehind
normal/*.md
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should provide detailed error information
      const invalidPatterns = matcher.patterns.filter(p => !p.isValid);
      expect(invalidPatterns.length).toBeGreaterThan(0);

      invalidPatterns.forEach(pattern => {
        expect(pattern.parseError).toBeDefined();
        expect(pattern.parseError).toContain(pattern.pattern);
      });

      // Should also be available in load errors
      expect(matcher.loadErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should gracefully degrade to no filtering when all patterns are invalid', async () => {
      const allInvalidContent = `
[invalid-regex1
(?invalid-lookbehind
***/broken-glob
(?:invalid-syntax
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(allInvalidContent);

      const matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should load but with errors
      expect(matcher.isLoaded).toBe(true);
      expect(matcher.loadErrors.length).toBeGreaterThan(0);

      // Should default to allowing all files when no valid patterns
      const validPatterns = matcher.patterns.filter(p => p.isValid);
      if (validPatterns.length === 0) {
        const result = ignoreProcessor.shouldIndexFile('any-file.md');
        expect(result.shouldIndex).toBe(true);
      }
    });

    it('should allow manual pattern refresh after fixing malformed files', async () => {
      // Start with malformed file
      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue('[invalid-regex');

      let matcher = await ignoreProcessor.loadIgnorePatterns();
      expect(matcher.loadErrors.length).toBeGreaterThan(0);

      // Fix the file content
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue('*.tmp\ntemp/');

      // Reload patterns
      matcher = await ignoreProcessor.loadIgnorePatterns();

      // Should now work correctly
      expect(matcher.loadErrors.length).toBe(0);
      expect(matcher.patterns.length).toBe(2);

      const result = ignoreProcessor.shouldIndexFile('test.tmp');
      expect(result.shouldIndex).toBe(false);
    });
  });

  describe('Error Reporting and Logging', () => {
    it('should provide actionable error messages', async () => {
      const malformedContent = `
*.md
[invalid-regex-pattern
normal-pattern.txt
`;

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      await ignoreProcessor.loadIgnorePatterns();

      // Should log specific errors that help users fix the issues
      expect(consoleSpy).toHaveBeenCalled();

      const warningMessages = consoleSpy.mock.calls.flat().join(' ');
      expect(warningMessages).toContain('.obsidianignore');
      expect(warningMessages).toContain('invalid-regex-pattern');
    });

    it('should not spam console with repeated errors', async () => {
      const malformedContent = '[invalid-regex';

      (mockVault.adapter.exists as jest.Mock)
        .mockImplementation((path: string) => path === '.obsidianignore');
      (mockVault.adapter.read as jest.Mock)
        .mockResolvedValue(malformedContent);

      // Load patterns multiple times
      await ignoreProcessor.loadIgnorePatterns();
      await ignoreProcessor.loadIgnorePatterns();
      await ignoreProcessor.loadIgnorePatterns();

      // Should not result in excessive console spam
      const warningCount = consoleSpy.mock.calls.length;
      expect(warningCount).toBeLessThan(10); // Reasonable limit
    });
  });
});