/**
 * Data Management Interface Contract
 * Implements: FR-001, FR-002, FR-003, FR-009, FR-011, FR-012
 */

export interface DataClearOperation {
  /** Current status of the clear operation */
  readonly status: 'idle' | 'confirming' | 'clearing' | 'complete' | 'failed';

  /** Operation progress (0-100) */
  readonly progress: number;

  /** Error message if operation failed */
  readonly error?: string;

  /** Number of items cleared so far */
  readonly itemsCleared: number;

  /** Operation start timestamp */
  readonly startTime?: Date;
}

export interface DataClearResult {
  /** Whether the clear operation succeeded */
  success: boolean;

  /** Number of documents cleared */
  documentsCleared: number;

  /** Number of chunks cleared */
  chunksCleared: number;

  /** Number of embeddings cleared */
  embeddingsCleared: number;

  /** Total operation time in milliseconds */
  timeElapsed: number;

  /** Error message if operation failed */
  error?: string;
}

export interface DataManager {
  /**
   * Clear all stored index data with user confirmation
   * Implements: FR-001, FR-002
   */
  clearAllData(): Promise<DataClearResult>;

  /**
   * Get current clear operation status
   * Implements: FR-012 (prevent concurrent operations)
   */
  getClearStatus(): DataClearOperation;

  /**
   * Show confirmation dialog before clearing
   * Implements: FR-002
   */
  showClearConfirmation(): Promise<boolean>;

  /**
   * Re-initialize storage after clearing
   * Implements: FR-011
   */
  reinitializeStorage(): Promise<void>;

  /**
   * Show user feedback after operation
   * Implements: FR-009
   */
  showClearFeedback(result: DataClearResult): void;
}

export interface DataClearCommand {
  /**
   * Execute clear data command from command palette
   * Implements: FR-003
   */
  executeClearCommand(): Promise<void>;

  /**
   * Register clear data command with Obsidian
   * Implements: FR-003
   */
  registerClearCommand(): void;
}