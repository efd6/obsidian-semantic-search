/**
 * Type definitions for data management functionality.
 * Aligned with DataManager in src/services/DataManager.ts.
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