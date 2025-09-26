/**
 * Plugin Interface Contract
 * Defines the public API for the Obsidian Semantic Search Plugin
 * Derived from FR-001, FR-008, FR-009
 */

export interface SemanticSearchPlugin {
  /**
   * Initialize the plugin and start automatic indexing
   * Implements: FR-001 (native plugin integration), FR-002 (automatic indexing)
   */
  onload(): Promise<void>;

  /**
   * Clean up resources when plugin is disabled
   */
  onunload(): Promise<void>;

  /**
   * Get plugin settings and status
   */
  getStatus(): PluginStatus;

  /**
   * Manual index rebuild (for troubleshooting)
   */
  rebuildIndex(): Promise<IndexRebuildResult>;
}

export interface PluginStatus {
  isEnabled: boolean;
  isIndexing: boolean;
  indexStats: {
    documentCount: number;
    lastIndexUpdate: Date;
    indexSizeBytes: number;
    currentDocument?: string;
    processedCount?: number;
    phase?: string;
  };
  version: string;
}

export interface IndexRebuildResult {
  success: boolean;
  documentsProcessed: number;
  timeElapsed: number; // milliseconds
  error?: string;
}