import { Plugin, Notice } from 'obsidian';
import { PluginStatus } from '../types/plugin-interface';
import { StatusBarDisplay } from '../types/ui-interface';

export class StatusBarDisplayImpl implements StatusBarDisplay {
  private statusBarItem: HTMLElement;
  private plugin: Plugin;
  private currentState: 'idle' | 'indexing' | 'error' | 'complete' = 'idle';
  private lastError: string = '';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.statusBarItem = plugin.addStatusBarItem();
    this.setupStatusBar();
  }

  private setupStatusBar(): void {
    this.statusBarItem.addClass('semantic-search-status');
    this.statusBarItem.createEl('span', { text: '🔍' });
    this.statusBarItem.addEventListener('click', () => this.handleClick());
    this.clear();
  }

  update(status: PluginStatus): void {
    if (!status.isEnabled) {
      this.clear();
      return;
    }

    if (status.isIndexing) {
      this.currentState = 'indexing';
      this.showIndexingStatus();
    } else {
      this.currentState = status.indexStats.documentCount > 0 ? 'complete' : 'idle';
      this.showIdleStatus(status);
    }
  }

  showProgress(progress: number, total: number): void {
    if (total === 0) {
      this.statusBarItem.setText('🔍 Scanning...');
      return;
    }

    const percentage = Math.round((progress / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    this.statusBarItem.setText(`🔍 ${progressBar} ${percentage}% (${progress}/${total})`);
    this.statusBarItem.setAttr('title', `Indexing: ${progress} of ${total} files processed`);
  }

  showError(message: string): void {
    this.currentState = 'error';
    this.lastError = message;
    this.statusBarItem.setText('🔍 ⚠️ Error');
    this.statusBarItem.setAttr('title', `Semantic Search Error: ${message}`);
    this.statusBarItem.addClass('semantic-search-error');
  }

  clear(): void {
    this.currentState = 'idle';
    this.statusBarItem.setText('🔍');
    this.statusBarItem.setAttr('title', 'Semantic Search - Click to open search or settings');
    this.statusBarItem.removeClass('semantic-search-error');
  }

  private showIndexingStatus(): void {
    this.statusBarItem.setText('🔍 ⚡ Indexing...');
    this.statusBarItem.setAttr('title', 'Semantic Search - Indexing in progress');
  }

  private showIdleStatus(status: PluginStatus): void {
    const docCount = status.indexStats.documentCount;
    const lastUpdate = this.formatLastUpdate(status.indexStats.lastIndexUpdate);

    this.statusBarItem.setText(`🔍 ${docCount} docs`);
    this.statusBarItem.setAttr('title', `Semantic Search - ${docCount} documents indexed (${lastUpdate})`);
  }

  private createProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private formatLastUpdate(date: Date): string {
    const now = new Date();
    const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)}h ago`;
    return `${Math.round(diffMinutes / 1440)}d ago`;
  }

  private handleClick(): void {
    switch (this.currentState) {
      case 'error': {
        this.openSettings();
        break;
      }
      case 'indexing': {
        this.showIndexingDetails();
        break;
      }
      default: {
        this.openSearch();
        break;
      }
    }
  }

  private openSearch(): void {
    // Trigger search modal or command
    const app = this.plugin.app as unknown as {
      commands: { executeCommandById: (id: string) => void };
    };
    app.commands.executeCommandById('semantic-search:open-search');
  }

  private openSettings(): void {
    // Open plugin settings
    const app = this.plugin.app as unknown as {
      setting: { openTabById: (id: string) => void };
    };
    app.setting.openTabById(this.plugin.manifest.id);
  }

  private showIndexingDetails(): void {
    // Show indexing progress details or cancel option
    new Notice('Indexing in progress... Click plugin settings to view details');
  }

  dispose(): void {
    this.statusBarItem?.remove();
  }
}