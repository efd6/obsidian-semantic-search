import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PluginSettings as IPluginSettings, SearchPluginSettings } from '../../specs/001-obsidian-search-plugin/contracts/ui-interface';
import { DataManager } from '../services/DataManager';
import { EmbeddingEngine } from '../services/EmbeddingEngine';

export class PluginSettings extends PluginSettingTab implements IPluginSettings {
    private settings: SearchPluginSettings;
    private saveCallback: (settings: SearchPluginSettings) => Promise<void>;
    private dataManager: DataManager;

    constructor(
        app: App,
        plugin: Plugin,
        settings: SearchPluginSettings,
        saveCallback: (settings: SearchPluginSettings) => Promise<void>,
        dataManager: DataManager
    ) {
        super(app, plugin);
        this.settings = { ...settings };
        this.saveCallback = saveCallback;
        this.dataManager = dataManager;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Semantic Search Plugin Settings' });

        this.addGeneralSettings();
        this.addPerformanceSettings();
        this.addUISettings();
        this.addAdvancedSettings();
        this.addDataManagementSettings();
        this.addResetSettings();
    }

    show(): void {
        this.display();
    }

    getSettings(): SearchPluginSettings {
        return { ...this.settings };
    }

    async saveSettings(settings: SearchPluginSettings): Promise<void> {
        this.settings = { ...settings };
        await this.saveCallback(settings);
        this.display(); // Refresh UI
    }

    private addGeneralSettings(): void {
        this.containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(this.containerEl)
            .setName('Enable Plugin')
            .setDesc('Toggle plugin functionality on/off')
            .addToggle(toggle => toggle
                .setValue(this.settings.enabled)
                .onChange(async (value) => {
                    this.settings.enabled = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Max Results')
            .setDesc('Maximum number of search results to display')
            .addSlider(slider => slider
                .setLimits(5, 100, 5)
                .setValue(this.settings.maxResults)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.maxResults = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Default to Hybrid Search')
            .setDesc('Use hybrid search mode by default')
            .addToggle(toggle => toggle
                .setValue(this.settings.defaultToHybrid)
                .onChange(async (value) => {
                    this.settings.defaultToHybrid = value;
                    await this.saveCallback(this.settings);
                }));
    }

    private addPerformanceSettings(): void {
        this.containerEl.createEl('h3', { text: 'Performance Settings' });

        new Setting(this.containerEl)
            .setName('Batch Size')
            .setDesc('Number of documents to process at once')
            .addSlider(slider => slider
                .setLimits(10, 500, 10)
                .setValue(this.settings.performance.batchSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.performance.batchSize = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Max Memory (MB)')
            .setDesc('Maximum memory usage limit')
            .addSlider(slider => slider
                .setLimits(100, 2000, 50)
                .setValue(this.settings.performance.maxMemoryMB)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.performance.maxMemoryMB = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Background Processing')
            .setDesc('Enable background indexing')
            .addToggle(toggle => toggle
                .setValue(this.settings.performance.backgroundProcessing)
                .onChange(async (value) => {
                    this.settings.performance.backgroundProcessing = value;
                    await this.saveCallback(this.settings);
                }));
    }

    private addUISettings(): void {
        this.containerEl.createEl('h3', { text: 'UI Settings' });

        new Setting(this.containerEl)
            .setName('Show in Sidebar')
            .addToggle(toggle => toggle
                .setValue(this.settings.ui.showInSidebar)
                .onChange(async (value) => {
                    this.settings.ui.showInSidebar = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Snippet Length')
            .addSlider(slider => slider
                .setLimits(50, 500, 25)
                .setValue(this.settings.ui.snippetLength)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.settings.ui.snippetLength = value;
                    await this.saveCallback(this.settings);
                }));

        new Setting(this.containerEl)
            .setName('Theme')
            .addDropdown(dropdown => dropdown
                .addOptions({ 'default': 'Default', 'compact': 'Compact', 'detailed': 'Detailed' })
                .setValue(this.settings.ui.theme)
                .onChange(async (value: 'default' | 'compact' | 'detailed') => {
                    this.settings.ui.theme = value;
                    await this.saveCallback(this.settings);
                }));
    }

    private addAdvancedSettings(): void {
        this.containerEl.createEl('h3', { text: 'Advanced Settings' });

        new Setting(this.containerEl)
            .setName('Debug Mode')
            .addToggle(toggle => toggle
                .setValue(this.settings.advanced.debugMode)
                .onChange(async (value) => {
                    this.settings.advanced.debugMode = value;
                    await this.saveCallback(this.settings);
                }));
    }

    private addDataManagementSettings(): void {
        this.containerEl.createEl('h3', { text: 'Data Management' });

        const clearDataSetting = new Setting(this.containerEl)
            .setName('Clear Search Index Data')
            .setDesc('Permanently delete all stored search data (embeddings, documents, chunks). Your files will not be affected.');

        // Add status display
        const statusEl = clearDataSetting.settingEl.createDiv('data-clear-status');

        // Add clear button
        clearDataSetting.addButton(button => {
            button
                .setButtonText('Clear All Data')
                .setWarning()
                .onClick(async () => {
                    try {
                        const confirmed = await this.dataManager.showClearConfirmation();
                        if (confirmed) {
                            // Update button state during operation
                            button.setButtonText('Clearing...');
                            button.setDisabled(true);

                            await this.dataManager.clearAllData();

                            // Reset status and button
                            this.dataManager.resetClearStatus();
                            button.setButtonText('Clear All Data');
                            button.setDisabled(false);

                            // Update status display
                            statusEl.empty();
                            statusEl.createSpan({ text: '✅ Data cleared successfully', cls: 'success-text' });

                            // Clear status message after a few seconds
                            setTimeout(() => {
                                statusEl.empty();
                            }, 3000);
                        }
                    } catch (error) {
                        // Reset button state on error
                        button.setButtonText('Clear All Data');
                        button.setDisabled(false);

                        // Show error message
                        statusEl.empty();
                        statusEl.createSpan({
                            text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            cls: 'error-text'
                        });
                    }
                });
        });

        new Setting(this.containerEl)
            .setName('Clear model cache')
            .setDesc('Remove the cached embedding model. It will be re-downloaded on next use.')
            .addButton(button => button
                .setButtonText('Clear Model Cache')
                .setWarning()
                .onClick(async () => {
                    button.setButtonText('Clearing...');
                    button.setDisabled(true);
                    try {
                        await EmbeddingEngine.clearModelCache();
                        button.setButtonText('Clear Model Cache');
                        button.setDisabled(false);
                        new Notice('Model cache cleared');
                    } catch {
                        button.setButtonText('Clear Model Cache');
                        button.setDisabled(false);
                        new Notice('Failed to clear model cache');
                    }
                }));
    }

    private addResetSettings(): void {
        new Setting(this.containerEl)
            .setName('Reset to Defaults')
            .setDesc('Reset all settings to default values')
            .addButton(button => button
                .setButtonText('Reset')
                .setCta()
                .onClick(async () => {
                    await this.saveSettings(this.getDefaultSettings());
                }));
    }

    private getDefaultSettings(): SearchPluginSettings {
        return {
            enabled: true,
            maxResults: 20,
            chunkSize: 500,
            updateInterval: 5000,
            defaultToHybrid: true,
            performance: { batchSize: 100, maxMemoryMB: 500, backgroundProcessing: true },
            ui: { showInSidebar: true, searchHotkey: 'Ctrl+Shift+F', snippetLength: 150, theme: 'default' },
            advanced: { model: { name: 'all-MiniLM-L6-v2', quantization: 'fp32' }, debugMode: false, fileFilters: [] }
        };
    }
}