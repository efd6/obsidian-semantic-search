import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { SemanticSearchPlugin, PluginStatus, IndexRebuildResult } from './specs/001-obsidian-search-plugin/contracts/plugin-interface';
import { SearchPluginSettings } from './specs/001-obsidian-search-plugin/contracts/ui-interface';

// Services
import { DocumentIndexer } from './src/services/DocumentIndexer';
import { SemanticSearchEngine } from './src/services/SemanticSearchEngine';
import { EmbeddingEngine } from './src/services/EmbeddingEngine';
import { FileWatcher } from './src/services/FileWatcher';
import { IgnorePatternProcessor } from './src/services/IgnorePatternProcessor';
import { DataManager } from './src/services/DataManager';
import { PersistedIndex } from './src/services/PersistedIndex';

// UI Components
import { PluginSettings } from './src/ui/PluginSettings';
import { SearchModal } from './src/ui/SearchModal';
import { SearchView, SEARCH_VIEW_TYPE } from './src/ui/SearchView';
import { StatusBarDisplayImpl } from './src/ui/StatusBarDisplay';

const DEFAULT_SETTINGS: SearchPluginSettings = {
    enabled: true,
    maxResults: 10,
    chunkSize: 1800,
    updateInterval: 30_000,
    defaultToHybrid: true,
    minSemanticScore: 0.3,
    keywordMatch: 'all' as const,
    persistIndex: false,
    performance: {
        batchSize: 10,
        maxMemoryMB: 512,
        backgroundProcessing: true,
    },
    ui: {
        showInSidebar: true,
        searchHotkey: 'Ctrl+Shift+S',
        snippetLength: 200,
        theme: 'default' as const,
    },
    advanced: {
        model: {
            name: 'universal-sentence-encoder',
            quantization: 'fp32' as const,
        },
        debugMode: false,
        fileFilters: ['*.md'],
    },
};

export default class SemanticSearchPluginMain extends Plugin implements SemanticSearchPlugin {
    settings: SearchPluginSettings = DEFAULT_SETTINGS;
    documentIndexer!: DocumentIndexer;
    semanticSearchEngine!: SemanticSearchEngine;
    embeddingEngine!: EmbeddingEngine;
    fileWatcher!: FileWatcher;
    ignorePatternProcessor!: IgnorePatternProcessor;
    dataManager!: DataManager;
    persistedIndex!: PersistedIndex;
    ribbonIcon: HTMLElement | null = null;
    private _pluginSettings?: PluginSettings;
    private _searchModal?: SearchModal;
    searchView!: SearchView;
    private statusBar!: StatusBarDisplayImpl;

    // Lazy getters for UI components
    private get pluginSettings(): PluginSettings {
        if (!this._pluginSettings) {
            this._pluginSettings = new PluginSettings(
                this.app,
                this,
                this.settings,
                (settings: SearchPluginSettings) => this.updateSettings(settings),
                this.dataManager
            );
        }
        return this._pluginSettings;
    }

    private get searchModal(): SearchModal {
        if (!this._searchModal) {
            this._searchModal = new SearchModal(this.app, this.semanticSearchEngine);
        }
        return this._searchModal;
    }

    async onload(): Promise<void> {
        try {
            await this.loadSettings();
            await this.initializeServices();
            this.initializeUI();
            this.registerCommands();
            this.registerViews();

            if (this.settings.enabled) {
                // Wait for workspace to be ready before indexing to ensure vault is fully loaded
                this.app.workspace.onLayoutReady(async () => {
                    await this.startIndexing();
                });
            }
        } catch (error) {
            console.error('Semantic Search Plugin initialization failed:', error);
            // Continue loading with limited functionality
        }
    }

    async onunload(): Promise<void> {
        console.log('🧹 Semantic search plugin unloading - cleaning up views');

        try {
            // Get all leaves of our view type before detaching
            const existingLeaves = this.app.workspace.getLeavesOfType(SEARCH_VIEW_TYPE);
            console.log(`Found ${existingLeaves.length} semantic search views to clean up`);

            // Detach all semantic search views
            this.app.workspace.detachLeavesOfType(SEARCH_VIEW_TYPE);

            // Verify cleanup worked
            const remainingLeaves = this.app.workspace.getLeavesOfType(SEARCH_VIEW_TYPE);
            console.log(`After cleanup: ${remainingLeaves.length} views remaining`);

            // Clean up UI components
            this.statusBar?.clear();

            // Clean up services
            this.fileWatcher?.dispose();
            await this.persistedIndex?.flush();
            await this.embeddingEngine?.cleanup();

            // Clear service references
            this.embeddingEngine = undefined as any as EmbeddingEngine;
            this.fileWatcher = undefined as any as FileWatcher;
            this.searchView = undefined as any as SearchView;
            this.ignorePatternProcessor = undefined as any as IgnorePatternProcessor;
            this.dataManager = undefined as any as DataManager;

            console.log('✅ Semantic search plugin cleanup complete');
        } catch (error) {
            console.error('❌ Error during plugin cleanup:', error);
        }
    }

    private async loadSettings(): Promise<void> {
        const data = await this.loadData() as Partial<SearchPluginSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    }

    private async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    private async initializeServices(): Promise<void> {
        // Phase 1: Initialize independent services
        this.ignorePatternProcessor = await this.initializeIgnorePatternProcessor();
        this.embeddingEngine = this.initializeEmbeddingEngine();

        // Phase 2: Initialize services that depend on Phase 1 results
        this.documentIndexer = new DocumentIndexer(this.app.vault);
        this.documentIndexer.embeddingEngine = this.embeddingEngine;
        this.documentIndexer.ignorePatternProcessor = this.ignorePatternProcessor;
        this.documentIndexer.debug = this.settings.advanced.debugMode;
        this.documentIndexer.chunkSize = this.settings.chunkSize;

        this.semanticSearchEngine = new SemanticSearchEngine();
        this.semanticSearchEngine.minSemanticScore = this.settings.minSemanticScore;
        this.semanticSearchEngine.keywordMatch = this.settings.keywordMatch;
        this.semanticSearchEngine.maxResults = this.settings.maxResults;

        // The saved index lives in this plugin's folder in the vault, so each
        // vault has its own.
        const pluginDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
        this.persistedIndex = new PersistedIndex(
            this.app.vault.adapter,
            `${pluginDir}/index.json`,
            this.semanticSearchEngine,
            () => this.documentIndexer.chunkSize,
        );
        this.semanticSearchEngine.onChange = (): void => this.persistedIndex.changed();

        // Connect DocumentIndexer to SemanticSearchEngine for proper data flow
        this.documentIndexer.searchEngine = this.semanticSearchEngine;

        this.fileWatcher = new FileWatcher(this.app.vault, this.documentIndexer);

        this.dataManager = new DataManager(this.app, {
            clear: async (): Promise<number> => {
                // Stop a running scan so it doesn't refill the index straight away.
                this.documentIndexer.cancelBackgroundIndexing();
                const cleared = this.semanticSearchEngine.clear();
                await this.persistedIndex.remove();
                return cleared;
            },
        });
    }

    private async initializeIgnorePatternProcessor(): Promise<IgnorePatternProcessor> {
        const processor = new IgnorePatternProcessor(this.app.vault);
        // Pre-load ignore patterns to avoid delays during indexing
        await processor.loadIgnorePatterns();
        return processor;
    }

    private initializeEmbeddingEngine(): EmbeddingEngine {
        const engine = EmbeddingEngine.getInstance();
        // Start model loading but don't wait for it to complete
        // This allows the plugin to become functional while model loads in background
        void engine.initialize().catch(error => {
            console.error('EmbeddingEngine initialization failed:', error);
            const reason = error instanceof Error ? error.message : String(error);
            new Notice(`Semantic Search: could not load the embedding model. ${reason}`, 0);
        });
        return engine;
    }

    private initializeUI(): void {
        // Only create immediately visible UI components
        this.statusBar = new StatusBarDisplayImpl(this);

        // Add settings tab (lazy-loaded)
        this.addSettingTab(this.pluginSettings);

        // Create ribbon icon (lazy-loads modal on click)
        this.ribbonIcon = this.addRibbonIcon('text-search', 'Semantic Search', () => {
            this.searchModal.open();
        });
    }

    private registerCommands(): void {
        this.addCommand({
            id: 'open-semantic-search',
            name: 'Open Semantic Search',
            callback: () => this.searchModal.open(),
        });

        this.addCommand({
            id: 'open-semantic-search-view',
            name: 'Open Semantic Search View',
            callback: () => this.activateSearchView(),
        });

        this.addCommand({
            id: 'rebuild-index',
            name: 'Rebuild Search Index',
            callback: async () => {
                const result = await this.rebuildIndex();
                if (result.success) {
                    new Notice(`Index rebuilt: ${result.documentsProcessed} documents processed`);
                } else {
                    new Notice(`Index rebuild failed: ${result.error}`);
                }
            },
        });

        this.addCommand({
            id: 'show-search-stats',
            name: 'Show Search Statistics',
            callback: () => {
                const status = this.getStatus();
                const message = `Documents: ${status.indexStats.documentCount}, ` +
                    `Last update: ${status.indexStats.lastIndexUpdate.toLocaleString()}`;
                new Notice(message);
            },
        });

        this.addCommand({
            id: 'clear-search-data',
            name: 'Clear Search Index Data',
            callback: async () => {
                const confirmed = await this.dataManager.showClearConfirmation();
                if (confirmed) {
                    try {
                        await this.dataManager.clearAllData();
                        // Reset status after successful clear
                        this.dataManager.resetClearStatus();
                    } catch (error) {
                        console.error('Failed to clear search data:', error);
                    }
                }
            },
        });
    }

    private registerViews(): void {
        // Register the view type only - don't automatically create it
        this.registerView(SEARCH_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
            console.log('🔍 Creating semantic search view instance');
            this.searchView = new SearchView(leaf, this.semanticSearchEngine);
            return this.searchView;
        });

        // Don't automatically create the view on load - let users open it manually
        // This prevents accumulation of ghost views during development reloads
        console.log(`✅ Semantic search view type registered: ${SEARCH_VIEW_TYPE} (manual activation only)`);
    }

    private activateSearchView(): void {
        try {
            console.log('🔍 Attempting to activate semantic search view');

            // Check if the view already exists to prevent duplicates
            const existingLeaves = this.app.workspace.getLeavesOfType(SEARCH_VIEW_TYPE);
            console.log(`Found ${existingLeaves.length} existing semantic search views`);

            if (existingLeaves.length > 0) {
                // View already exists, just reveal it
                console.log('📍 Revealing existing semantic search view');
                void this.app.workspace.revealLeaf(existingLeaves[0]);
                return;
            }

            // Try to get a right sidebar leaf
            const rightLeaf = this.app.workspace.getRightLeaf(false);
            if (rightLeaf) {
                console.log('📝 Creating semantic search view in right sidebar');
                void rightLeaf.setViewState({
                    type: SEARCH_VIEW_TYPE,
                    active: true,
                });
            } else {
                // Create a new right sidebar leaf if none exists
                console.log('📝 Creating new leaf for semantic search view');
                const newLeaf = this.app.workspace.getLeaf('split', 'vertical');
                void newLeaf.setViewState({
                    type: SEARCH_VIEW_TYPE,
                    active: true,
                });
            }

            console.log('✅ Semantic search view activation completed');
        } catch (error) {
            console.error('❌ Failed to activate semantic search view:', error);
        }
    }

    private async startIndexing(): Promise<void> {
        // Restore the saved index first, so only notes that have changed since
        // it was saved are embedded again.
        const restored = await this.persistedIndex.start(this.settings.persistIndex);
        if (restored > 0) {
            console.log(`Restored ${restored} notes from the saved index`);
        }

        // Start background indexing without waiting for it to complete
        void (async (): Promise<void> => {
            await this.documentIndexer.indexVaultInBackground();
            await this.persistedIndex.flush();
        })();
        this.fileWatcher.initialize();
    }

    getStatus(): PluginStatus {
        const indexingStatus = this.documentIndexer?.getIndexingStatus?.() ?? {
            isIndexing: false,
            phase: 'idle' as const,
            progress: {
                processedCount: 0,
                totalCount: 0,
                currentDocument: '',
                estimatedTimeRemaining: 0
            },
            lastUpdate: new Date(),
            fileWatchingEnabled: false
        };

        return {
            isEnabled: this.settings.enabled,
            isIndexing: indexingStatus.isIndexing,
            indexStats: {
                documentCount: indexingStatus.progress.totalCount || 0,
                lastIndexUpdate: indexingStatus.lastUpdate,
                indexSizeBytes: 0, // TODO: Get from storage
                currentDocument: indexingStatus.progress.currentDocument,
                processedCount: indexingStatus.progress.processedCount,
                phase: indexingStatus.phase
            },
            version: this.manifest.version,
        };
    }

    async rebuildIndex(): Promise<IndexRebuildResult> {
        const startTime = Date.now();
        try {
            this.statusBar.update(this.getStatus());
            // Start from empty so every note is embedded again, for example
            // after the chunk size has changed.
            this.semanticSearchEngine.clear();
            await this.documentIndexer.indexVault();
            return {
                success: true,
                documentsProcessed: 0, // TODO: Get actual count from indexer
                timeElapsed: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                documentsProcessed: 0,
                timeElapsed: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async updateSettings(newSettings: Partial<SearchPluginSettings>): Promise<void> {
        this.settings = { ...this.settings, ...newSettings };
        await this.saveSettings();

        // Apply settings to services. The settings tab edits the settings
        // object in place, so apply values rather than look for changes.
        if (this.documentIndexer) {
            this.documentIndexer.debug = this.settings.advanced.debugMode;
        }
        await this.persistedIndex?.setEnabled(this.settings.persistIndex);
        if (this.documentIndexer && this.settings.chunkSize !== this.documentIndexer.chunkSize) {
            // Chunks of different sizes shouldn't be mixed in one index, or in
            // its saved copy, so rebuild with the new size.
            this.documentIndexer.chunkSize = this.settings.chunkSize;
            void this.rebuildIndex();
        }
        if (this.semanticSearchEngine && newSettings.maxResults) {
            this.semanticSearchEngine.maxResults = newSettings.maxResults;
        }
        if (this.semanticSearchEngine && newSettings.minSemanticScore !== undefined) {
            this.semanticSearchEngine.minSemanticScore = newSettings.minSemanticScore;
        }
        if (this.semanticSearchEngine && newSettings.keywordMatch !== undefined) {
            this.semanticSearchEngine.keywordMatch = newSettings.keywordMatch;
        }
    }

    getPerformanceStats(): {
        documentsIndexed: number;
        totalChunks: number;
        indexingTime: number;
        searchStats?: {
            totalSearches: number;
            averageSearchTime: number;
        };
    } {
        // Get document and chunk counts from search engine
        const documentCount = this.semanticSearchEngine?.getDocumentCount?.() || 0;
        const chunkCount = this.semanticSearchEngine?.getChunkCount?.() || 0;

        return {
            documentsIndexed: documentCount,
            totalChunks: chunkCount,
            indexingTime: 0, // TODO: Track actual indexing time
            searchStats: this.semanticSearchEngine?.getSearchStats?.() || {
                totalSearches: 0,
                averageSearchTime: 0
            }
        };
    }
}
