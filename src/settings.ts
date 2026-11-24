import { SearchPluginSettings } from '../specs/001-obsidian-search-plugin/contracts/ui-interface';

// defaultSettings returns a new copy of the default settings. It returns a
// new copy each time because the settings tab edits settings in place, and
// an edit must not change the defaults.
export function defaultSettings(): SearchPluginSettings {
    return {
        enabled: true,
        maxResults: 10,
        chunkSize: 1800,
        updateInterval: 30_000,
        defaultToHybrid: true,
        minSemanticScore: 0.3,
        keywordMatch: 'all',
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
            theme: 'default',
        },
        advanced: {
            model: {
                name: 'universal-sentence-encoder',
                quantization: 'fp32',
            },
            debugMode: false,
            fileFilters: ['*.md'],
        },
    };
}

// withDefaults returns saved settings with anything missing taken from the
// defaults, including fields inside the nested groups, so that settings saved
// by an older version pick up new fields.
export function withDefaults(saved: Partial<SearchPluginSettings> | null): SearchPluginSettings {
    const defaults = defaultSettings();
    const s = saved ?? {};
    return {
        ...defaults,
        ...s,
        performance: { ...defaults.performance, ...s.performance },
        ui: { ...defaults.ui, ...s.ui },
        advanced: {
            ...defaults.advanced,
            ...s.advanced,
            model: { ...defaults.advanced.model, ...s.advanced?.model },
        },
    };
}
