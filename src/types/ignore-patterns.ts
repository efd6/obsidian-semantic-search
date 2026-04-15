/**
 * Type definitions for ignore pattern functionality.
 * Aligned with IgnorePatternProcessor in src/services/IgnorePatternProcessor.ts.
 */

export interface IgnorePattern {
  /** The pattern string (gitignore syntax) */
  pattern: string;

  /** Source file that defined this pattern */
  sourceFile: '.obsidianignore' | '.obsidian-search-ignore';

  /** Whether this pattern was parsed successfully */
  isValid: boolean;
}