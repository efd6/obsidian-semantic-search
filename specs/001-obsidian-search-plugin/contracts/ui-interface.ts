/**
 * UI Interface Contract
 * Defines the user interface components and interactions
 * Derived from FR-008, FR-009, Obsidian plugin requirements
 */

import { SearchResponse, SearchResult } from './search-interface';
import { IndexingStatus } from './indexing-interface';
import { PluginStatus } from './plugin-interface';

export interface SearchUI {
  /**
   * Create and show the search interface
   * Implements: FR-008 (searchable user interface)
   */
  createSearchView(): SearchView;

  /**
   * Show search results
   * Implements: FR-009 (display results with file names and snippets)
   */
  displayResults(response: SearchResponse): void;

  /**
   * Handle search result clicks
   * Implements: FR-009 (clickable links to open files)
   */
  onResultClick(result: SearchResult): void;

  /**
   * Show search suggestions as user types
   */
  showSuggestions(suggestions: string[]): void;

  /**
   * Update UI with indexing progress
   */
  updateIndexingProgress(status: IndexingStatus): void;
}

export interface SearchView {
  /** The container element for the search interface */
  containerEl: HTMLElement;

  /** Show/hide the search view */
  show(): void;
  hide(): void;

  /** Focus the search input */
  focus(): void;

  /** Clear search results */
  clearResults(): void;

  /** Set loading state */
  setLoading(loading: boolean): void;
}

/**
 * Search Modal Interface
 * Quick search overlay accessible via hotkey
 */
export interface SearchModal {
  /** Open the search modal */
  open(): void;

  /** Close the modal */
  close(): void;

  /** Set initial search query */
  setQuery(query: string): void;
}

/**
 * Settings Interface
 * Plugin configuration UI
 */
export interface PluginSettings {
  /** Show plugin settings tab */
  show(): void;

  /** Get current settings */
  getSettings(): SearchPluginSettings;

  /** Save settings */
  saveSettings(settings: SearchPluginSettings): Promise<void>;
}

export interface SearchPluginSettings {
  /** Enable/disable the plugin */
  enabled: boolean;

  /** Search result limit */
  maxResults: number;

  /** Document chunk size for indexing */
  chunkSize: number;

  /** Update interval for file watching (milliseconds) */
  updateInterval: number;

  /** Enable hybrid search by default */
  defaultToHybrid: boolean;

  /** Index update performance settings */
  performance: {
    /** Batch size for processing documents */
    batchSize: number;

    /** Maximum memory usage (MB) */
    maxMemoryMB: number;

    /** Enable background processing */
    backgroundProcessing: boolean;
  };

  /** UI preferences */
  ui: {
    /** Show search in sidebar */
    showInSidebar: boolean;

    /** Hotkey for search modal */
    searchHotkey: string;

    /** Result snippet length */
    snippetLength: number;

    /** Theme for search results */
    theme: 'default' | 'compact' | 'detailed';
  };

  /** Advanced settings */
  advanced: {
    /** Embedding model configuration */
    model: {
      name: string;
      quantization: 'fp32' | 'fp16' | 'q8' | 'q4';
    };

    /** Debug logging */
    debugMode: boolean;

    /** Custom file filters */
    fileFilters: string[];
  };
}

/**
 * Status Bar Interface
 * Shows indexing status in Obsidian status bar
 */
export interface StatusBarDisplay {
  /** Update status bar with current state */
  update(status: PluginStatus): void;

  /** Show indexing progress */
  showProgress(progress: number, total: number): void;

  /** Show error state */
  showError(message: string): void;

  /** Clear status display */
  clear(): void;
}

/**
 * Command Interface
 * Obsidian command palette integration
 */
export interface PluginCommands {
  /** Register all plugin commands */
  registerCommands(): void;

  /** Command to open search modal */
  openSearch(): void;

  /** Command to rebuild index */
  rebuildIndex(): void;

  /** Command to show plugin settings */
  openSettings(): void;

  /** Command to show index statistics */
  showStats(): void;
}

/**
 * Event System Interface
 * Plugin event handling and notifications
 */
export interface PluginEvents {
  /** Emit plugin events */
  emit(event: PluginEvent): void;

  /** Subscribe to plugin events */
  on(eventType: PluginEventType, handler: (event: PluginEvent) => void): void;

  /** Unsubscribe from events */
  off(eventType: PluginEventType, handler: (event: PluginEvent) => void): void;
}

export type PluginEventType =
  | 'indexing-started'
  | 'indexing-progress'
  | 'indexing-completed'
  | 'indexing-error'
  | 'search-performed'
  | 'file-indexed'
  | 'settings-changed';

export interface PluginEvent {
  type: PluginEventType;
  timestamp: Date;
  data?: any;
}

/**
 * Obsidian Integration Interface
 * Defines how the plugin integrates with Obsidian's API
 */
export interface ObsidianIntegration {
  /** Register with Obsidian's file system events */
  registerFileEvents(): void;

  /** Access to Obsidian's vault API */
  getVaultAdapter(): VaultAdapter;

  /** Register workspace leaves and views */
  registerViews(): void;

  /** Handle plugin lifecycle */
  handleLifecycle(): void;
}

export interface VaultAdapter {
  /** Get all markdown files in vault */
  getAllMarkdownFiles(): string[];

  /** Read file content */
  readFile(path: string): Promise<string>;

  /** Check if file exists */
  exists(path: string): boolean;

  /** Get file stats (size, modified date, etc.) */
  getFileStats(path: string): FileStats;

  /** Watch for file changes */
  watchFiles(callback: (path: string, event: 'create' | 'modify' | 'delete') => void): void;
}

export interface FileStats {
  size: number;
  created: Date;
  modified: Date;
  path: string;
}