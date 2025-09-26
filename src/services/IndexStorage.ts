import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import {
  IndexStorage as IIndexStorage,
  StoredDocument,
  DocumentChunk,
  EmbeddingData,
  StorageStats
} from '../../specs/001-obsidian-search-plugin/contracts/indexing-interface';
import { IChunk } from '../models/Chunk';
import { IDocument, DocumentState } from '../models/Document';
import { BrowserCrypto } from '../utils/crypto';

// RxDB plugins - only add dev mode plugin in development
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  addRxPlugin(RxDBDevModePlugin);
}

interface DatabaseSchema {
  documents: RxCollection<IDocument>;
  chunks: RxCollection<IChunk>;
  embeddings: RxCollection<EmbeddingData>;
  metadata: RxCollection<{ key: string; value: unknown }>;
}

export class IndexStorage implements IIndexStorage {
  private database: RxDatabase<DatabaseSchema> | null = null;
  private vaultPath: string = '';

  // Index signature for CompatibleStorage compatibility
  [key: string]: unknown;

  get vaultName(): string {
    return this.vaultPath;
  }

  get db(): RxDatabase<DatabaseSchema> | null {
    return this.database;
  }

  async initialize(vaultPath?: string): Promise<void> {
    this.vaultPath = vaultPath ?? 'default';
    const dbName = this.getDatabaseName(this.vaultPath);

    this.database = await createRxDatabase<DatabaseSchema>({
      name: dbName,
      storage: getRxStorageDexie(),
      multiInstance: false
    });

    await this.createCollections();
  }

  private getDatabaseName(vaultPath: string): string {
    return `obsidian_search_${BrowserCrypto.md5(vaultPath)}`;
  }

  private async createCollections(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    await this.database.addCollections({
      documents: {
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 128 },
            filePath: { type: 'string', maxLength: 1000 },
            title: { type: 'string', maxLength: 500 },
            tags: { type: 'array', items: { type: 'string', maxLength: 100 } },
            content: { type: 'string', maxLength: 1_000_000 },
            wordCount: { type: 'number' },
            createdDate: { type: 'string', format: 'date-time' },
            modifiedDate: { type: 'string', format: 'date-time', maxLength: 30 },
            lastIndexed: { type: ['string', 'null'], format: 'date-time' },
            checksum: { type: 'string', maxLength: 64 },
            state: { type: 'string', maxLength: 50 }
          },
          required: ['id', 'filePath', 'title', 'content', 'checksum'],
          indexes: ['filePath', 'modifiedDate']
        }
      },

      chunks: {
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 128 },
            documentId: { type: 'string', maxLength: 128 },
            chunkIndex: { type: 'number', multipleOf: 1, minimum: 0, maximum: 10_000 },
            content: { type: 'string', maxLength: 10_000 },
            startOffset: { type: 'number' },
            endOffset: { type: 'number' },
            embedding: { type: 'object' },
            embeddingVersion: { type: 'string', maxLength: 50 }
          },
          required: ['id', 'documentId', 'chunkIndex', 'content'],
          indexes: ['documentId', 'chunkIndex']
        }
      },

      embeddings: {
        schema: {
          version: 0,
          primaryKey: 'chunkId',
          type: 'object',
          properties: {
            chunkId: { type: 'string', maxLength: 128 },
            embedding: { type: 'object' },
            version: { type: 'string', maxLength: 50 }
          },
          required: ['chunkId', 'embedding', 'version']
        }
      },

      metadata: {
        schema: {
          version: 0,
          primaryKey: 'key',
          type: 'object',
          properties: {
            key: { type: 'string', maxLength: 256 },
            value: {}
          },
          required: ['key', 'value']
        }
      }
    });
  }

  async storeDocument(document: StoredDocument): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    // Convert chunks to storage format
    const chunks: IChunk[] = [];

    for (const chunk of document.chunks) {
      const chunkData: IChunk = {
        id: chunk.id,
        documentId: document.id,
        chunkIndex: chunks.length,
        content: chunk.content,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        embedding: new Float32Array(),
        embeddingVersion: 'pending'
      };
      chunks.push(chunkData);
    }

    // Store document using partition
    await this.database.documents.upsert({
      ...document.metadata,
      id: document.id,
      filePath: document.filePath,
      content: '', // Content stored in chunks
      tags: document.metadata.tags || [],
      createdDate: document.metadata.created,
      modifiedDate: document.metadata.modified,
      lastIndexed: null,
      state: DocumentState.NEW
    });

    // Store chunks
    for (const chunk of chunks) {
      await this.database.chunks.upsert(chunk);
    }
  }

  async getDocument(filePath: string): Promise<StoredDocument | null> {
    if (!this.database) throw new Error('Database not initialized');

    const docResult = await this.database.documents.findOne({
      selector: { filePath }
    }).exec();

    if (!docResult) return null;

    const doc = docResult.toJSON() as IDocument;
    const chunksResult = await this.database.chunks.find({
      selector: { documentId: doc.id }
    }).exec();

    const chunks: DocumentChunk[] = chunksResult.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset
    }));

    return {
      id: doc.id,
      filePath: doc.filePath,
      metadata: {
        title: doc.title,
        tags: doc.tags,
        created: new Date(doc.createdDate),
        modified: new Date(doc.modifiedDate),
        wordCount: doc.wordCount,
        checksum: doc.checksum
      },
      chunks
    };
  }

  async storeEmbeddings(documentId: string, embeddings: EmbeddingData[]): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    for (const embedding of embeddings) {
      await this.database.embeddings.upsert(embedding);
    }
  }

  async getEmbeddings(documentIds: string[]): Promise<EmbeddingData[]> {
    if (!this.database) throw new Error('Database not initialized');

    const results = await this.database.embeddings.find({
      selector: {
        chunkId: {
          $regex: `^(${documentIds.join('|')}):`
        }
      }
    }).exec();

    return results.map(r => r.toJSON() as EmbeddingData);
  }

  async getStats(): Promise<StorageStats> {
    if (!this.database) throw new Error('Database not initialized');

    const docCount = await this.database.documents.count().exec();
    const chunkCount = await this.database.chunks.count().exec();
    const embeddingCount = await this.database.embeddings.count().exec();

    return {
      documentsStored: docCount,
      chunksStored: chunkCount,
      embeddingsStored: embeddingCount,
      totalSizeBytes: 0 // Would need storage inspection for accurate size
    };
  }

  async cleanup(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    // Remove orphaned chunks
    const allChunks = await this.database.chunks.find().exec();
    const allDocs = await this.database.documents.find().exec();
    const docIds = new Set(allDocs.map(d => d.id));

    for (const chunk of allChunks) {
      if (!docIds.has(chunk.documentId)) {
        await chunk.remove();
      }
    }

    // Remove orphaned embeddings
    const allEmbeddings = await this.database.embeddings.find().exec();
    const chunkIds = new Set(allChunks.map(c => c.id));

    for (const embedding of allEmbeddings) {
      if (!chunkIds.has(embedding.chunkId)) {
        await embedding.remove();
      }
    }
  }

  // Partitioning helpers
  private getDocumentPartition(filePath: string): string {
    const filename = filePath.split('/').pop() ?? '';
    return filename.charAt(0).toLowerCase() || 'other';
  }

  private getChunkPartition(chunkId: string): number {
    const hash = BrowserCrypto.md5(chunkId);
    return Number.parseInt(hash.slice(0, 2), 16) % 10;
  }

  async destroy(): Promise<void> {
    if (this.database) {
      await this.database.destroy();
      this.database = null;
    }
  }

  async close(): Promise<void> {
    await this.destroy();
  }
}