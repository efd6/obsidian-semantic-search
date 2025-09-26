/**
 * Contract test for IgnorePatternProcessor interface
 * Verifies that implementations properly adhere to the interface contract
 */

import {
  IgnorePatternProcessor,
  IgnorePatternMatcher,
  FileFilterResult,
  IgnorePattern
} from '../../src/types/ignore-patterns';

describe('IgnorePatternProcessor Interface Contract', () => {
  let processor: IgnorePatternProcessor;

  beforeEach(() => {
    // This will fail until IgnorePatternProcessor is implemented
    const { IgnorePatternProcessorImpl } = require('../../src/services/IgnorePatternProcessor');
    processor = new IgnorePatternProcessorImpl();
  });

  describe('loadIgnorePatterns method', () => {
    it('should return IgnorePatternMatcher with required fields', async () => {
      const matcher = await processor.loadIgnorePatterns();

      expect(matcher).toBeDefined();
      expect(Array.isArray(matcher.patterns)).toBe(true);
      expect(typeof matcher.isLoaded).toBe('boolean');
      expect(Array.isArray(matcher.loadErrors)).toBe(true);

      // Validate pattern structure
      matcher.patterns.forEach(pattern => {
        expect(typeof pattern.pattern).toBe('string');
        expect(['.obsidianignore', '.obsidian-search-ignore']).toContain(pattern.sourceFile);
        expect(typeof pattern.isValid).toBe('boolean');
        if (pattern.parseError) {
          expect(typeof pattern.parseError).toBe('string');
        }
      });
    });

    it('should handle successful pattern loading', async () => {
      const matcher = await processor.loadIgnorePatterns();

      if (matcher.isLoaded) {
        expect(matcher.loadErrors.length).toBe(0);
      }
    });

    it('should handle pattern loading errors gracefully', async () => {
      const matcher = await processor.loadIgnorePatterns();

      if (!matcher.isLoaded) {
        expect(matcher.loadErrors.length).toBeGreaterThan(0);
        matcher.loadErrors.forEach(error => {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('shouldIndexFile method', () => {
    it('should return FileFilterResult with required fields', () => {
      const result = processor.shouldIndexFile('test.md');

      expect(result).toBeDefined();
      expect(typeof result.shouldIndex).toBe('boolean');

      if (result.matchedPattern) {
        expect(typeof result.matchedPattern).toBe('string');
      }

      if (result.sourceIgnore) {
        expect(['.obsidianignore', '.obsidian-search-ignore']).toContain(result.sourceIgnore);
      }
    });

    it('should handle various file path formats', () => {
      const testPaths = [
        'test.md',
        'folder/test.md',
        'deep/nested/folder/test.md',
        '.hidden.md',
        'file-with-dashes.md',
        'file_with_underscores.md'
      ];

      testPaths.forEach(path => {
        const result = processor.shouldIndexFile(path);
        expect(typeof result.shouldIndex).toBe('boolean');
      });
    });

    it('should default to allowing indexing when no patterns match', () => {
      // This assumes empty patterns, will be validated with actual implementation
      const result = processor.shouldIndexFile('definitely-unique-filename.md');

      // If no patterns loaded or no match, should default to indexing
      if (!result.matchedPattern) {
        expect(result.shouldIndex).toBe(true);
      }
    });
  });

  describe('parseIgnoreFile method', () => {
    it('should parse gitignore-style patterns correctly', () => {
      const testContent = `
# This is a comment
*.tmp
temp/
.git/
!important.tmp
`;

      const patterns = processor.parseIgnoreFile(testContent, '.obsidianignore');

      expect(Array.isArray(patterns)).toBe(true);

      patterns.forEach(pattern => {
        expect(typeof pattern.pattern).toBe('string');
        expect(pattern.sourceFile).toBe('.obsidianignore');
        expect(typeof pattern.isValid).toBe('boolean');

        // Should not include comments or empty lines
        expect(pattern.pattern).not.toMatch(/^#/);
        expect(pattern.pattern.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty content gracefully', () => {
      const patterns = processor.parseIgnoreFile('', '.obsidian-search-ignore');
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBe(0);
    });

    it('should handle malformed patterns gracefully', () => {
      const malformedContent = `
*.md
[invalid-regex
valid-pattern.txt
***/broken
`;

      const patterns = processor.parseIgnoreFile(malformedContent, '.obsidianignore');
      expect(Array.isArray(patterns)).toBe(true);

      // Should include both valid and invalid patterns, marking invalid ones
      const invalidPatterns = patterns.filter(p => !p.isValid);
      const validPatterns = patterns.filter(p => p.isValid);

      expect(validPatterns.length).toBeGreaterThan(0);

      invalidPatterns.forEach(pattern => {
        expect(pattern.parseError).toBeDefined();
        expect(typeof pattern.parseError).toBe('string');
      });
    });
  });

  describe('handleIgnoreFileErrors method', () => {
    it('should accept error array without throwing', () => {
      const errors = ['Error 1', 'Error 2'];
      expect(() => processor.handleIgnoreFileErrors(errors)).not.toThrow();
    });

    it('should handle empty error array', () => {
      expect(() => processor.handleIgnoreFileErrors([])).not.toThrow();
    });
  });

  describe('getIgnoreConfiguration method', () => {
    it('should return current IgnorePatternMatcher', () => {
      const config = processor.getIgnoreConfiguration();

      expect(config).toBeDefined();
      expect(Array.isArray(config.patterns)).toBe(true);
      expect(typeof config.isLoaded).toBe('boolean');
      expect(Array.isArray(config.loadErrors)).toBe(true);
    });
  });
});