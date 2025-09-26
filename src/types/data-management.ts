/**
 * Type definitions for data management functionality
 * Based on contracts/data-management-interface.ts
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
   */
  clearAllData(): Promise<DataClearResult>;

  /**
   * Get current clear operation status
   */
  getClearStatus(): DataClearOperation;

  /**
   * Show confirmation dialog before clearing
   */
  showClearConfirmation(): Promise<boolean>;

  /**
   * Re-initialize storage after clearing
   */
  reinitializeStorage(): Promise<void>;

  /**
   * Show user feedback after operation
   */
  showClearFeedback(result: DataClearResult): void;
}

export interface DataClearCommand {
  /**
   * Execute clear data command from command palette
   */
  executeClearCommand(): Promise<void>;

  /**
   * Register clear data command with Obsidian
   */
  registerClearCommand(): void;
}

export interface DataManagementSettings {
  /**
   * Add clear data button to settings UI
   */
  addClearDataButton(): void;

  /**
   * Handle clear data button click with confirmation
   */
  onClearDataClick(): Promise<void>;

  /**
   * Show confirmation modal before clearing data
   */
  showClearConfirmationModal(): Promise<boolean>;

  /**
   * Display clear operation feedback
   */
  showClearResult(result: DataClearResult): void;

  /**
   * Update UI during clear operation
   */
  updateClearProgress(progress: number): void;

  /**
   * Disable clear button during operation
   */
  setClearButtonEnabled(enabled: boolean): void;
}