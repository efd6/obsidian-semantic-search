import { TAbstractFile, TFile, Vault } from 'obsidian';
import {
  DocumentIndexer as IDocumentIndexer,
  IndexingResult,
  DocumentIndexResult,
  IndexingStatus,
  DocumentMetadata,
  IndexingFailure,
  IndexStats
} from '../../specs/001-obsidian-search-plugin/contracts/indexing-interface';
import { Chunk } from '../models/Chunk';
import { Document } from '../models/Document';
import { createHash } from '../utils/crypto';
import { IgnorePatternProcessor } from './IgnorePatternProcessor';

// Type definitions for plugin compatibility
interface CompatibleSearchEngine {
  addDocument?(document: Document): void;
  addChunk?(chunk: Chunk): void;
  removeDocument?(documentId: string): void;
}

interface CompatibleEmbeddingEngine {
  generateEmbedding?(content: string): Promise<Float32Array>;
}

export class DocumentIndexer implements IDocumentIndexer {
  private vault: Vault;
  private fileWatcher: boolean = false;
  private status: IndexingStatus = this.createInitialStatus();
  chunkSize: number = 1800; // Characters, leaving room for overlap while staying under 2048 limit
  private readonly overlapSize = 200; // Characters
  private backgroundIndexingActive = false;
  private cancelIndexing = false;

  // Plugin compatibility properties
  embeddingEngine?: CompatibleEmbeddingEngine;
  searchEngine?: CompatibleSearchEngine;
  ignorePatternProcessor?: IgnorePatternProcessor;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async indexVault(): Promise<IndexingResult> {
    const startTime = Date.now();
    this.status.isIndexing = true;
    this.status.phase = 'scanning';
    this.cancelIndexing = false;

    const allMdFiles = this.vault.getMarkdownFiles();

    // Filter files using ignore patterns if processor is available
    let mdFiles = allMdFiles;
    if (this.ignorePatternProcessor) {
      const filteredFiles = [];
      for (const file of allMdFiles) {
        const shouldIndex = await this.ignorePatternProcessor.shouldIndexFile(file.path);
        if (shouldIndex) {
          filteredFiles.push(file);
        } else {
          // Drop anything indexed before the file was ignored.
          this.searchEngine?.removeDocument?.(Document.idFor(file.path));
          console.log(`⏭️ Skipping ignored file: ${file.path}`);
        }
      }
      mdFiles = filteredFiles;
      console.log(`🔍 DocumentIndexer: Filtered ${allMdFiles.length - mdFiles.length} files using ignore patterns`);
    }

    const results: DocumentIndexResult[] = [];
    const failures: IndexingFailure[] = [];

    console.log(`🔍 DocumentIndexer: Starting vault indexing (${mdFiles.length} markdown files)`);

    this.status.progress.totalCount = mdFiles.length;
    this.status.phase = 'processing';

    for (const [index, file] of mdFiles.entries()) {
      if (this.cancelIndexing) {
        console.log('🛑 Indexing cancelled');
        break;
      }

      this.status.progress.currentDocument = file.path;
      console.log(`📄 Indexing (${index + 1}/${mdFiles.length}): ${file.path}`);
      try {
        const result = await this.indexDocument(file.path);
        results.push(result);
        if (!result.success && result.error) {
          failures.push({ filePath: file.path, error: result.error, errorType: 'parsing' });
          console.warn(`❌ Failed to index: ${file.path} - ${result.error}`);
        } else {
          console.log(`✅ Indexed: ${file.path} (${result.chunkCount} chunks)`);
        }
      } catch (error) {
        failures.push({ filePath: file.path, error: String(error), errorType: 'parsing' });
        console.error(`❌ Error indexing: ${file.path}`, error);
      }
      this.status.progress.processedCount++;

      // Yield control after each document to keep UI responsive
      if ((index + 1) % 5 === 0) {
        await this.yieldControl();
      }
    }

    const timeElapsed = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    console.log(`🎉 DocumentIndexer: Indexing complete!`);
    console.log(`  📊 Total: ${mdFiles.length} files`);
    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failures.length}`);
    console.log(`  ⏱️ Time: ${(timeElapsed / 1000).toFixed(2)}s`);

    this.status.isIndexing = false;
    this.status.phase = 'idle';
    this.status.lastUpdate = new Date();

    return {
      totalDocuments: mdFiles.length,
      successfullyIndexed: successful,
      failures,
      timeElapsed,
      stats: await this.calculateStats()
    };
  }

  async indexVaultInBackground(): Promise<void> {
    if (this.backgroundIndexingActive) {
      console.log('⚠️ Background indexing already active');
      return;
    }

    this.backgroundIndexingActive = true;
    console.log('🚀 Starting background indexing');

    try {
      await this.indexVault();
    } catch (error) {
      console.error('❌ Background indexing failed:', error);
    } finally {
      this.backgroundIndexingActive = false;
    }
  }

  cancelBackgroundIndexing(): void {
    this.cancelIndexing = true;
    console.log('🛑 Cancelling background indexing');
  }

  isBackgroundIndexingActive(): boolean {
    return this.backgroundIndexingActive;
  }

  private async yieldControl(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Use requestIdleCallback if available, otherwise setTimeout
      if (typeof requestIdleCallback === 'undefined') {
        setTimeout(() => resolve(), 0);
      } else {
        requestIdleCallback(() => resolve());
      }
    });
  }

  async indexDocument(filePath: string): Promise<DocumentIndexResult> {
    const startTime = Date.now();

    try {
      // Every route into the index comes through here, including the file
      // watcher, so this is where the ignore rules must be applied. A note that
      // has become ignored is also removed.
      if (this.ignorePatternProcessor && !await this.ignorePatternProcessor.shouldIndexFile(filePath)) {
        this.searchEngine?.removeDocument?.(Document.idFor(filePath));
        return {
          filePath,
          success: false,
          error: 'File is excluded by ignore rules',
          chunkCount: 0,
          timeElapsed: Date.now() - startTime
        };
      }

      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file?.path.endsWith('.md')) {
        throw new Error('File not found or not a markdown file');
      }

      // Check if it's a TFile or mock TFile (for testing)
      const isValidFile = (file instanceof TFile) ||
                         (file.constructor?.name === 'TFile') ||
                         (file.path && file.name);

      if (!isValidFile) {
        throw new Error('Invalid file type');
      }

      const content = await this.vault.read(file as TFile);
      const metadata = this.extractMetadata(file as TFile, content);

      // Create document instance first
      const document = new Document({
        filePath: file.path,
        title: metadata.title,
        tags: metadata.tags,
        content,
        wordCount: metadata.wordCount,
        createdDate: metadata.created,
        modifiedDate: metadata.modified
      });

      // Create chunks using the document's actual ID
      const chunks = await this.createChunks(content, document.id);

      document.markAsIndexed();

      // Remove the previous version first. Otherwise, when a note gets shorter,
      // its old trailing chunks stay searchable.
      this.searchEngine?.removeDocument?.(document.id);

      // Add document and chunks to search engine if available
      if (this.searchEngine?.addDocument) {
        this.searchEngine.addDocument(document);
      }

      // Add chunks to search engine
      if (this.searchEngine?.addChunk) {
        for (const chunk of chunks) {
          this.searchEngine.addChunk(chunk);
        }
      }

      return {
        filePath,
        success: true,
        metadata,
        chunkCount: chunks.length,
        timeElapsed: Date.now() - startTime
      };
    } catch (error) {
      return {
        filePath,
        success: false,
        error: String(error),
        chunkCount: 0,
        timeElapsed: Date.now() - startTime
      };
    }
  }

  async removeDocument(filePath: string): Promise<boolean> {
    try {
      await Promise.resolve(); // Satisfy require-await rule
      // Remove from search engine if available
      if (this.searchEngine?.removeDocument) {
        this.searchEngine.removeDocument(Document.idFor(filePath));
      }

      this.status.lastUpdate = new Date();
      return true;
    } catch {
      return false;
    }
  }

  getIndexingStatus(): IndexingStatus {
    return { ...this.status };
  }

  startFileWatching(): void {
    if (this.fileWatcher) return;

    this.fileWatcher = true;
    this.status.fileWatchingEnabled = true;

    // Set up file watching with 30-second intervals
    this.vault.on('modify', (file) => void this.handleFileChange(file));
    this.vault.on('create', (file) => void this.handleFileChange(file));
    this.vault.on('delete', (file) => void this.handleFileDelete(file));
  }

  stopFileWatching(): void {
    this.fileWatcher = false;
    this.status.fileWatchingEnabled = false;
    this.vault.off('modify', (file: TAbstractFile) => void this.handleFileChange(file));
    this.vault.off('create', (file: TAbstractFile) => void this.handleFileChange(file));
    this.vault.off('delete', (file: TAbstractFile) => void this.handleFileDelete(file));
  }

  private createInitialStatus(): IndexingStatus {
    return {
      isIndexing: false,
      phase: 'idle',
      progress: { currentDocument: '', processedCount: 0, totalCount: 0, estimatedTimeRemaining: 0 },
      fileWatchingEnabled: false,
      lastUpdate: new Date()
    };
  }

  private extractMetadata(file: TFile, content: string): DocumentMetadata {
    return {
      title: Document.extractTitle(content, file.path),
      tags: Document.extractTags(content),
      created: new Date(file.stat.ctime),
      modified: new Date(file.stat.mtime),
      wordCount: Document.countWords(content),
      checksum: this.calculateChecksum(content, file.stat.mtime)
    };
  }

  private async createChunks(content: string, documentId: string): Promise<Chunk[]> {
    const chunks: Chunk[] = [];

    // Chunk by characters instead of words to respect the 2048 character limit
    for (let i = 0; i < content.length; i += this.chunkSize - this.overlapSize) {
      const chunkContent = content.slice(i, i + this.chunkSize).trim();

      // Skip empty chunks
      if (!chunkContent) {
        continue;
      }

      const startOffset = i;
      const endOffset = Math.min(i + chunkContent.length, content.length);

      // Without an embedding engine (as in some tests) use a deterministic
      // stand-in. When the engine fails, the note fails: made-up embeddings
      // would put meaningless entries in the index.
      const embedding = typeof this.embeddingEngine?.generateEmbedding === 'function'
        ? await this.embeddingEngine.generateEmbedding(chunkContent)
        : this.generateTestEmbedding(chunkContent);

      chunks.push(Chunk.create(
        documentId, // Use the passed document ID
        chunks.length,
        chunkContent,
        startOffset,
        endOffset,
        embedding
      ));
    }

    return chunks;
  }

  private generateTestEmbedding(text: string): Float32Array {
    // Generate deterministic embedding based on text content (similar to PluginLifecycle tests)
    const embedding = new Float32Array(Chunk.EMBEDDING_DIMENSIONS);
    const hash = [...text].reduce((acc, char) => acc + char.codePointAt(0)!, 0);
    for (let i = 0; i < Chunk.EMBEDDING_DIMENSIONS; i++) {
      embedding[i] = Math.sin((hash + i) / 100) * 0.1;
    }
    return embedding;
  }

  private calculateChecksum(content: string, mtime: number): string {
    return createHash('simple').update(content + mtime).digest('hex');
  }

  private async calculateStats(): Promise<IndexStats> {
    await Promise.resolve(); // Satisfy require-await rule
    const mdFiles = this.vault.getMarkdownFiles();
    return {
      documentCount: mdFiles.length,
      chunkCount: 0, // Would be calculated from storage
      storageSizeBytes: 0,
      uniqueTags: 0,
      created: new Date(),
      lastUpdated: new Date(),
      model: { name: 'universal-sentence-encoder', version: '1.0.0', dimensions: 512 }
    };
  }

  private async handleFileChange(file: TAbstractFile): Promise<void> {
    await Promise.resolve(); // Satisfy require-await rule
    if (file instanceof TFile && file.path.endsWith('.md')) {
      setTimeout(() => void this.indexDocument(file.path), 30_000); // 30-second delay
    }
  }

  private async handleFileDelete(file: TAbstractFile): Promise<void> {
    if (file instanceof TFile && file.path.endsWith('.md')) {
      await this.removeDocument(file.path);
    }
  }
}