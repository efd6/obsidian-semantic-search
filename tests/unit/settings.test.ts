import { App, Plugin } from 'obsidian';
import { SearchPluginSettings } from '../../specs/001-obsidian-search-plugin/contracts/ui-interface';
import { defaultSettings, withDefaults } from '../../src/settings';
import { PluginSettings } from '../../src/ui/PluginSettings';
import { DataManager } from '../../src/services/DataManager';

describe('settings defaults', () => {
  it('Reset to Defaults applies the settings a new install gets', async () => {
    const save = jest.fn((): Promise<void> => Promise.resolve());
    const changed = { ...defaultSettings(), chunkSize: 900, maxResults: 50 };
    const tab = new PluginSettings({} as App, {} as Plugin, changed, save, {} as DataManager);

    // The Reset button saves getDefaultSettings() through saveSettings.
    const reset = (tab as unknown as { getDefaultSettings(): SearchPluginSettings }).getDefaultSettings();
    await tab.saveSettings(reset);

    expect(save).toHaveBeenCalledWith(defaultSettings());
    expect(defaultSettings()).toMatchObject({ chunkSize: 1800, maxResults: 10, persistIndex: false });
  });

  it('defaultSettings returns a new copy each time', () => {
    const edited = defaultSettings();
    edited.advanced.debugMode = true;
    edited.performance.batchSize = 99;

    expect(defaultSettings().advanced.debugMode).toBe(false);
    expect(defaultSettings().performance.batchSize).toBe(10);
  });

  it('withDefaults fills in fields missing from saved settings, including inside groups', () => {
    const saved = { maxResults: 25, advanced: { debugMode: true } } as unknown as Partial<SearchPluginSettings>;

    const settings = withDefaults(saved);

    expect(settings.maxResults).toBe(25);
    expect(settings.advanced.debugMode).toBe(true);
    expect(settings.advanced.model).toEqual(defaultSettings().advanced.model);
    expect(settings.chunkSize).toBe(1800);
    expect(withDefaults(null)).toEqual(defaultSettings());
  });

  it('withDefaults does not share objects with the defaults', () => {
    const settings = withDefaults(null);
    settings.advanced.debugMode = true;

    expect(withDefaults(null).advanced.debugMode).toBe(false);
  });
});
