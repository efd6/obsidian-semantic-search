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

/**
 * Storage Interface
 * Implements: FR-011 (local persistence), FR-014 (packaging)
 */
export interface IndexStorage {
  /** Initialize storage for the vault */
  initialize(vaultPath: string): Promise<void>;

  /** Store document metadata and chunks */
  storeDocument(document: StoredDocument): Promise<void>;

  /** Retrieve document by path */
  getDocument(filePath: string): Promise<StoredDocument | null>;

  /** Store embeddings data */
  storeEmbeddings(documentId: string, embeddings: EmbeddingData[]): Promise<void>;

  /** Retrieve embeddings for search */
  getEmbeddings(documentIds: string[]): Promise<EmbeddingData[]>;

  /** Get storage statistics */
  getStats(): Promise<StorageStats>;

  /** Cleanup old or invalid data */
  cleanup(): Promise<void>;
}

export interface StoredDocument {
  id: string;
  filePath: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

export interface EmbeddingData {
  chunkId: string;
  embedding: Float32Array;
  version: string;
}

export interface StorageStats {
  documentsStored: number;
  chunksStored: number;
  embeddingsStored: number;
  totalSizeBytes: number;
}