/**
 * ObsidianAdapter Service - Bridges Obsidian API and plugin services
 * Implements ObsidianIntegration and VaultAdapter interfaces
 */
import { App, TFile, Plugin, WorkspaceLeaf, MetadataCache, Workspace } from 'obsidian';
import { ObsidianIntegration, VaultAdapter, FileStats } from '../specs/001-obsidian-search-plugin/contracts/ui-interface';

export class ObsidianAdapter implements ObsidianIntegration, VaultAdapter {
  private fileWatchCallbacks = new Set<(path: string, event: 'create' | 'modify' | 'delete') => void>();

  constructor(private app: App, private plugin: Plugin) {}

  // ObsidianIntegration implementation
  registerFileEvents(): void {
    this.plugin.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile) this.notifyFileChange(file.path, 'create');
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) this.notifyFileChange(file.path, 'modify');
      })
    );

    this.plugin.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) this.notifyFileChange(file.path, 'delete');
      })
    );
  }

  getVaultAdapter(): VaultAdapter { return this; }

  registerViews(): void {
    // View registration is now handled by the main plugin class
    // This method is kept for interface compliance but implementation moved to main.ts
    // to have access to the complete plugin context and services
  }

  handleLifecycle(): void {
    this.registerFileEvents();
    // View registration is handled by the main plugin class
  }

  // VaultAdapter implementation
  getAllMarkdownFiles(): string[] {
    try {
      return this.app.vault.getMarkdownFiles().map(file => file.path);
    } catch (error) {
      console.error('Failed to get markdown files:', error);
      return [];
    }
  }

  async readFile(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);
    return await this.app.vault.read(file);
  }

  exists(path: string): boolean {
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  getFileStats(path: string): FileStats {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error(`File not found: ${path}`);

    return {
      size: file.stat.size,
      created: new Date(file.stat.ctime),
      modified: new Date(file.stat.mtime),
      path: file.path
    };
  }

  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Obsidian file watching requires callback pattern
  watchFiles(callback: (path: string, event: 'create' | 'modify' | 'delete') => void): void {
    this.fileWatchCallbacks.add(callback);
  }

  // Helper methods
  private notifyFileChange(path: string, event: 'create' | 'modify' | 'delete'): void {
    for (const callback of this.fileWatchCallbacks) {
      try {
        // eslint-disable-next-line promise/prefer-await-to-callbacks -- Callback required by Obsidian file watching API
        callback(path, event);
      } catch (error) {
        console.error('File watch callback error:', error);
      }
    }
  }

  // Utility methods for integration
  getMetadataCache(): MetadataCache { return this.app.metadataCache; }
  getWorkspace(): Workspace { return this.app.workspace; }

  async openFile(path: string, newLeaf?: boolean): Promise<WorkspaceLeaf | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;

    const leaf = this.app.workspace.getLeaf(newLeaf ?? false);
    await leaf.openFile(file);
    return leaf;
  }
}