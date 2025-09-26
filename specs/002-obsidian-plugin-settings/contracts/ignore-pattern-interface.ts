/**
 * Ignore Pattern Interface Contract
 * Implements: FR-004, FR-005, FR-006, FR-007, FR-008, FR-010
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
   * Implements: FR-004, FR-005
   */
  loadIgnorePatterns(): Promise<IgnorePatternMatcher>;

  /**
   * Check if a file should be indexed based on ignore patterns
   * Implements: FR-006, FR-007, FR-008
   */
  shouldIndexFile(filePath: string): FileFilterResult;

  /**
   * Parse gitignore-style patterns from file content
   * Implements: FR-007, FR-010
   */
  parseIgnoreFile(content: string, sourceFile: '.obsidianignore' | '.obsidian-search-ignore'): IgnorePattern[];

  /**
   * Handle errors in ignore file processing gracefully
   * Implements: FR-010
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
   * Implements: FR-004
   */
  readObsidianIgnore(): Promise<string | null>;

  /**
   * Read .obsidian-search-ignore file from vault root
   * Implements: FR-005
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