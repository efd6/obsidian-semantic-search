/**
 * Indexing Interface Contract
 * Defines the document indexing and update API
 * Derived from FR-002, FR-006, FR-007, FR-010, FR-011, FR-013, FR-014
 */

export interface DocumentIndexer {
  /**
   * Index all documents in the vault
   * Implements: FR-002 (automatic vault indexing)
   */
  indexVault(): Promise<IndexingResult>;

  /**
   * Index a specific document
   * Implements: FR-010 (file watching), FR-013 (tag extraction)
   */
  indexDocument(filePath: string): Promise<DocumentIndexResult>;

  /**
   * Remove document from index
   */
  removeDocument(filePath: string): Promise<boolean>;

  /**
   * Get indexing status and progress
   */
  getIndexingStatus(): IndexingStatus;

  /**
   * Start file watching for automatic updates
   * Implements: FR-010 (file watching), FR-006 (30-second updates)
   */
  startFileWatching(): void;

  /**
   * Stop file watching
   */
  stopFileWatching(): void;
}

export interface IndexingResult {
  /** Total documents processed */
  totalDocuments: number;

  /** Successfully indexed documents */
  successfullyIndexed: number;

  /** Failed document paths with error reasons */
  failures: IndexingFailure[];

  /** Time taken for full indexing */
  timeElapsed: number; // milliseconds

  /** Index statistics */
  stats: IndexStats;
}

export interface DocumentIndexResult {
  /** Document file path */
  filePath: string;

  /** Whether indexing was successful */
  success: boolean;

  /** Whether the note was skipped because its content had not changed */
  unchanged?: boolean;

  /** Error message if failed */
  error?: string;

  /** Extracted metadata */
  metadata?: DocumentMetadata;

  /** Number of chunks created */
  chunkCount: number;

  /** Time taken to index this document */
  timeElapsed: number; // milliseconds
}

export interface IndexingFailure {
  filePath: string;
  error: string;
  errorType: 'parsing' | 'embedding' | 'storage' | 'permission';
}

export interface IndexingStatus {
  /** Whether indexing is currently in progress */
  isIndexing: boolean;

  /** Current indexing phase */
  phase: 'idle' | 'scanning' | 'processing' | 'embedding' | 'storing';

  /** Progress information */
  progress: {
    currentDocument: string;
    processedCount: number;
    totalCount: number;
    estimatedTimeRemaining: number; // milliseconds
  };

  /** Whether file watching is active */
  fileWatchingEnabled: boolean;

  /** Last index update timestamp */
  lastUpdate: Date;
}

export interface DocumentMetadata {
  /** Document title (from heading or filename) */
  title: string;

  /** Extracted tags without # prefix */
  tags: string[]; // Implements FR-013 (tag preservation)

  /** File creation timestamp */
  created: Date;

  /** Last modification timestamp */
  modified: Date;

  /** Word count */
  wordCount: number;

  /** Document checksum for change detection */
  checksum: string;
}

export interface IndexStats {
  /** Total number of documents in index */
  documentCount: number;

  /** Total number of chunks */
  chunkCount: number;

  /** Total storage size in bytes */
  storageSizeBytes: number;

  /** Unique tags count */
  uniqueTags: number;

  /** Index creation timestamp */
  created: Date;

  /** Last update timestamp */
  lastUpdated: Date;

  /** Model information */
  model: {
    name: string;
    version: string;
    dimensions: number;
  };
}

/**
 * File Watcher Interface
 * Implements: FR-006 (30-second updates), FR-007 (scaling)
 */
export interface FileWatcher {
  /** Start watching for file changes */
  start(): void;

  /** Stop watching */
  stop(): void;

  /** Get list of files pending indexing */
  getPendingFiles(): string[];

  /** Manually trigger update for specific file */
  triggerUpdate(filePath: string): void;

  /** Configure update timing */
  setUpdateInterval(milliseconds: number): void;
}
