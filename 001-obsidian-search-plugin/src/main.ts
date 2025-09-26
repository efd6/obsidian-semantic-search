import { Plugin } from 'obsidian';
import {
  SemanticSearchPlugin as ISemanticSearchPlugin,
  PluginStatus,
  IndexRebuildResult
} from '../contracts/plugin-interface';
import { DocumentIndexer } from '../contracts/indexing-interface';
import { SearchEngine } from '../contracts/search-interface';
import { SearchUI, SearchModal, PluginSettings, StatusBarDisplay } from '../contracts/ui-interface';

// Service imports (to be implemented)
import { DocumentIndexerImpl } from './services/document-indexer';
import { SemanticSearchEngineImpl } from './services/search-engine';
import { FileWatcherImpl } from './services/file-watcher';
import { IndexStorageImpl } from './services/index-storage';
import { EmbeddingEngineImpl } from './services/embedding-engine';

// UI component imports (to be implemented)
import { SearchViewImpl } from './ui/search-view';
import { SearchModalImpl } from './ui/search-modal';
import { PluginSettingsImpl } from './ui/plugin-settings';
import { StatusBarDisplayImpl } from './ui/status-bar';

export default class SemanticSearchPlugin extends Plugin implements ISemanticSearchPlugin {
  private documentIndexer!: DocumentIndexer;
  private searchEngine!: SearchEngine;
  private searchUI!: SearchUI;
  private searchModal!: SearchModal;
  private pluginSettings!: PluginSettings;
  private statusBar!: StatusBarDisplay;

  private isEnabled = false;
  private version = '1.0.0';

  async onload(): Promise<void> {
    console.log('Loading Semantic Search Plugin');

    // Initialize storage first
    const storage = new IndexStorageImpl();
    await storage.initialize(this.app.vault.adapter.path);

    // Initialize services with dependency injection
    const embeddingEngine = new EmbeddingEngineImpl();
    const fileWatcher = new FileWatcherImpl(this.app.vault);

    this.documentIndexer = new DocumentIndexerImpl(
      this.app.vault,
      storage,
      embeddingEngine,
      fileWatcher
    );

    this.searchEngine = new SemanticSearchEngineImpl(
      storage,
      embeddingEngine
    );

    // Initialize UI components
    this.searchUI = new SearchViewImpl(this.app.workspace);
    this.searchModal = new SearchModalImpl(this.app);
    this.pluginSettings = new PluginSettingsImpl(this.app, this);
    this.statusBar = new StatusBarDisplayImpl(this.addStatusBarItem());

    // Register commands
    this.addCommand({
      id: 'semantic-search',
      name: 'Open Semantic Search',
      callback: () => this.searchModal.open()
    });

    this.addCommand({
      id: 'rebuild-index',
      name: 'Rebuild Search Index',
      callback: () => this.rebuildIndex()
    });

    // Add settings tab
    this.addSettingTab(this.pluginSettings as any);

    // Start automatic indexing
    await this.startIndexing();

    this.isEnabled = true;
  }

  async onunload(): Promise<void> {
    console.log('Unloading Semantic Search Plugin');

    // Stop file watching
    this.documentIndexer.stopFileWatching();

    // Clear UI components
    this.statusBar.clear();

    this.isEnabled = false;
  }

  getStatus(): PluginStatus {
    const indexingStatus = this.documentIndexer.getIndexingStatus();

    return {
      isEnabled: this.isEnabled,
      isIndexing: indexingStatus.isIndexing,
      indexStats: {
        documentCount: 0, // Will be populated from storage stats
        lastIndexUpdate: indexingStatus.lastUpdate,
        indexSizeBytes: 0 // Will be populated from storage stats
      },
      version: this.version
    };
  }

  async rebuildIndex(): Promise<IndexRebuildResult> {
    const startTime = Date.now();
    this.statusBar.update(this.getStatus());

    try {
      const result = await this.documentIndexer.indexVault();
      const timeElapsed = Date.now() - startTime;

      return {
        success: true,
        documentsProcessed: result.successfullyIndexed,
        timeElapsed,
        error: result.failures.length > 0
          ? `${result.failures.length} documents failed to index`
          : undefined
      };
    } catch (error) {
      const timeElapsed = Date.now() - startTime;
      return {
        success: false,
        documentsProcessed: 0,
        timeElapsed,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async startIndexing(): Promise<void> {
    this.statusBar.showProgress(0, 1);

    // Start file watching for automatic updates
    this.documentIndexer.startFileWatching();

    // Perform initial index if needed
    try {
      await this.documentIndexer.indexVault();
      this.statusBar.update(this.getStatus());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.statusBar.showError(`Indexing failed: ${errorMsg}`);
    }
  }
}