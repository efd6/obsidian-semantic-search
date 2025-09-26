/**
 * Settings Interface Contract Extensions
 * Implements: FR-001, FR-002, FR-009
 */

import { DataClearResult } from './data-management-interface';

export interface DataManagementSettings {
  /**
   * Add clear data button to settings UI
   * Implements: FR-001
   */
  addClearDataButton(): void;

  /**
   * Handle clear data button click with confirmation
   * Implements: FR-001, FR-002
   */
  onClearDataClick(): Promise<void>;

  /**
   * Show confirmation modal before clearing data
   * Implements: FR-002
   */
  showClearConfirmationModal(): Promise<boolean>;

  /**
   * Display clear operation feedback
   * Implements: FR-009
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

export interface IgnorePatternSettings {
  /**
   * Display current ignore pattern status in settings
   */
  showIgnorePatternStatus(): void;

  /**
   * Show ignore pattern loading errors
   */
  displayIgnorePatternErrors(errors: string[]): void;

  /**
   * Refresh ignore patterns manually
   */
  refreshIgnorePatterns(): Promise<void>;
}

export interface ExtendedPluginSettings extends DataManagementSettings, IgnorePatternSettings {
  /**
   * Initialize all new settings functionality
   */
  initializeDataManagement(): void;

  /**
   * Clean up data management UI elements
   */
  cleanupDataManagement(): void;
}