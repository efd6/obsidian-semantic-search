/**
 * Type definitions for ignore pattern functionality
 * Based on contracts/ignore-pattern-interface.ts
 */

export interface IgnorePattern {
  /** The pattern string (gitignore syntax) */
  pattern: string;

  /** Source file that defined this pattern */
  sourceFile: '.obsidianignore' | '.obsidian-search-ignore';

  /** Whether this pattern was parsed successfully */
  isValid: boolean;

  /** Error message for invalid patterns */
  parseError?: string;
}

export interface IgnorePatternMatcher {
  /** Compiled patterns for fast matching */
  readonly patterns: IgnorePattern[];

  /** Whether patterns were loaded successfully */
  readonly isLoaded: boolean;

  /** Errors encountered during loading */
  readonly loadErrors: string[];
}

export interface FileFilterResult {
  /** Whether the file should be indexed */
  shouldIndex: boolean;

  /** Pattern that matched (if excluded) */
  matchedPattern?: string;

  /** Source file that provided the matching pattern */
  sourceIgnore?: '.obsidianignore' | '.obsidian-search-ignore';
}

export interface IgnorePatternProcessor {
  /**
   * Load and parse ignore patterns from vault files
   */
  loadIgnorePatterns(): Promise<IgnorePatternMatcher>;

  /**
   * Check if a file should be indexed based on ignore patterns
   */
  shouldIndexFile(filePath: string): FileFilterResult;

  /**
   * Parse gitignore-style patterns from file content
   */
  parseIgnoreFile(content: string, sourceFile: '.obsidianignore' | '.obsidian-search-ignore'): IgnorePattern[];

  /**
   * Handle errors in ignore file processing gracefully
   */
  handleIgnoreFileErrors(errors: string[]): void;

  /**
   * Get current ignore pattern configuration
   */
  getIgnoreConfiguration(): IgnorePatternMatcher;
}

export interface VaultIgnoreFileAccess {
  /**
   * Read .obsidianignore file from vault root
   */
  readObsidianIgnore(): Promise<string | null>;

  /**
   * Read .obsidian-search-ignore file from vault root
   */
  readPluginIgnore(): Promise<string | null>;

  /**
   * Check if ignore files exist
   */
  ignoreFilesExist(): Promise<{
    obsidianIgnore: boolean;
    pluginIgnore: boolean;
  }>;
}