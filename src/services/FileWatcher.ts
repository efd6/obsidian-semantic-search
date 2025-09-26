import { TAbstractFile, TFile, Vault, Component } from 'obsidian';
import { FileWatcher as IFileWatcher } from '../../specs/001-obsidian-search-plugin/contracts/indexing-interface';
import { DocumentIndexer } from './DocumentIndexer';

/**
 * FileWatcher service for real-time file monitoring and index updates
 * Implements debouncing and batch processing to optimize performance
 */
export class FileWatcher extends Component implements IFileWatcher {
  private vault: Vault;
  private indexer: DocumentIndexer;
  private isWatching = false;
  private pendingFiles = new Set<string>();
  private updateInterval = 30_000; // 30 seconds default
  private batchTimer: NodeJS.Timeout | null = null;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(vault: Vault, indexer: DocumentIndexer) {
    super();
    this.vault = vault;
    this.indexer = indexer;
  }

  start(): void {
    if (this.isWatching) return;

    this.isWatching = true;
    this.registerEvent(
      this.vault.on('create', (file: TAbstractFile) => {
        if (this.isMarkdownFile(file)) {
          this.handleFileChange(file.path);
        }
      })
    );

    this.registerEvent(
      this.vault.on('modify', (file: TAbstractFile) => {
        if (this.isMarkdownFile(file)) {
          this.handleFileChange(file.path);
        }
      })
    );

    this.registerEvent(
      this.vault.on('delete', (file: TAbstractFile) => {
        if (this.isMarkdownFile(file)) {
          this.handleFileDelete(file.path);
        }
      })
    );

    this.registerEvent(
      this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (this.isMarkdownFile(file)) {
          this.handleFileRename(oldPath, file.path);
        }
      })
    );

    this.scheduleBatchProcess();
  }

  stop(): void {
    if (!this.isWatching) return;

    this.isWatching = false;
    this.clearBatchTimer();
    this.clearAllDebounceTimers();
    this.pendingFiles.clear();
  }

  getPendingFiles(): string[] {
    return [...this.pendingFiles];
  }

  triggerUpdate(filePath: string): void {
    this.pendingFiles.add(filePath);
    void this.processBatch();
  }

  setUpdateInterval(milliseconds: number): void {
    this.updateInterval = Math.max(5000, milliseconds); // Minimum 5 seconds
    if (this.isWatching) {
      this.rescheduleBatchProcess();
    }
  }

  initialize(): void {
    this.start();
  }

  dispose(): void {
    this.stop();
  }

  private handleFileChange(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      this.pendingFiles.add(filePath);
    });
  }

  private handleFileDelete(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      void this.indexer.removeDocument(filePath);
      this.pendingFiles.delete(filePath);
    });
  }

  private handleFileRename(oldPath: string, newPath: string): void {
    this.debounceFileOperation(newPath, () => {
      void this.indexer.removeDocument(oldPath);
      this.pendingFiles.add(newPath);
      this.pendingFiles.delete(oldPath);
    });
  }

  private debounceFileOperation(filePath: string, operation: () => void): void {
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      operation();
      this.debounceTimers.delete(filePath);
    }, 1000); // 1 second debounce

    this.debounceTimers.set(filePath, timer);
  }

  private async processBatch(): Promise<void> {
    if (this.pendingFiles.size === 0) return;

    const filesToProcess = [...this.pendingFiles];
    this.pendingFiles.clear();

    // Process files in parallel with limit to avoid overwhelming system
    const batchSize = Math.min(10, filesToProcess.length);
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(filePath => this.indexer.indexDocument(filePath))
      );
    }
  }

  private scheduleBatchProcess(): void {
    this.clearBatchTimer();
    this.batchTimer = setTimeout(() => {
      void (async (): Promise<void> => {
        await this.processBatch();
        if (this.isWatching) {
          this.scheduleBatchProcess();
        }
      })();
    }, this.updateInterval);
  }

  private rescheduleBatchProcess(): void {
    if (this.isWatching) {
      this.scheduleBatchProcess();
    }
  }

  private clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private clearAllDebounceTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private isMarkdownFile(file: TAbstractFile): file is TFile {
    return file instanceof TFile && file.extension === 'md';
  }
}