/**
 * IndexingWorker - Background processing for embedding generation and document indexing
 */
import { IChunk } from '../models/Chunk';
import { IDocument } from '../models/Document';
import { EmbeddingEngine } from '../services/EmbeddingEngine';
// TensorFlow.js - no additional configuration needed in worker

// Discriminated union types for worker messages
type ProcessDocumentsPayload = {
  documents: IDocument[];
  chunkSize?: number;
  batchSize?: number;
};

type GenerateEmbeddingsPayload = {
  texts: string[];
  batchSize?: number;
};

type BatchChunksPayload = {
  chunks: Omit<IChunk, 'embedding' | 'embeddingVersion'>[];
  batchSize?: number;
};

export type WorkerMessage =
  | { type: 'INITIALIZE'; payload: { modelUrl?: string; ortBaseUrl?: string }; requestId: string }
  | { type: 'PROCESS_DOCUMENTS'; payload: ProcessDocumentsPayload; requestId: string }
  | { type: 'GENERATE_EMBEDDINGS'; payload: GenerateEmbeddingsPayload; requestId: string }
  | { type: 'BATCH_CHUNKS'; payload: BatchChunksPayload; requestId: string }
  | { type: 'CLEANUP'; payload: null; requestId: string };

export type WorkerResponse =
  | { type: 'PROGRESS'; payload: { completed: number; total: number; stage: string; currentDocument?: string }; requestId: string }
  | { type: 'COMPLETE'; payload: unknown; requestId: string }
  | { type: 'ERROR'; payload: { message: string }; requestId: string }
  | { type: 'INITIALIZED'; payload: null; requestId: string };

class IndexingWorker {
  private embeddingEngine = EmbeddingEngine.getInstance();
  // TensorFlow.js - no configuration service needed
  private isInitialized = false;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Web Worker event handling requires async
    self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      try {
        switch (message.type) {
          case 'INITIALIZE': {
            await this.initialize(message.payload, message.requestId);
            break;
          }
          case 'PROCESS_DOCUMENTS': {
            await this.processDocuments(message.payload, message.requestId);
            break;
          }
          case 'GENERATE_EMBEDDINGS': {
            await this.generateEmbeddings(message.payload, message.requestId);
            break;
          }
          case 'BATCH_CHUNKS': {
            await this.batchProcessChunks(message.payload, message.requestId);
            break;
          }
          case 'CLEANUP': {
            await this.cleanup(message.requestId);
            break;
          }
          default: {
            const unknownMessage = message as { type: string; requestId: string };
            this.send({
              type: 'ERROR',
              payload: { message: `Unknown message type: ${unknownMessage.type}` },
              requestId: unknownMessage.requestId
            });
            break;
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const requestId = 'requestId' in message ? message.requestId : 'unknown';
        this.send({ type: 'ERROR', payload: { message: errorMessage }, requestId });
      }
    });
  }

  private async initialize(payload: object, requestId: string): Promise<void> {
    if (this.isInitialized) {
      this.send({ type: 'INITIALIZED', payload: null, requestId });
      return;
    }

    console.log('IndexingWorker: Initializing TensorFlow.js Universal Sentence Encoder...');
    await this.embeddingEngine.initialize();
    this.isInitialized = true;
    this.send({ type: 'INITIALIZED', payload: null, requestId });
  }

  private async processDocuments(
    payload: { documents: IDocument[]; chunkSize?: number; batchSize?: number },
    requestId: string
  ): Promise<void> {
    const { documents, chunkSize = 512, batchSize = 5 } = payload;
    const chunks: Array<Omit<IChunk, 'embedding' | 'embeddingVersion'>> = [];
    let completed = 0;
    this.sendProgress(requestId, completed, documents.length, 'chunking');

    for (const document of documents) {
      const { content, id } = document;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunkIndex = Math.floor(i / chunkSize);
        chunks.push({
          id: `${id}:chunk:${chunkIndex}`,
          documentId: id,
          chunkIndex,
          content: content.slice(i, Math.min(i + chunkSize, content.length)),
          startOffset: i,
          endOffset: Math.min(i + chunkSize, content.length)
        });
      }
      completed++;
      this.sendProgress(requestId, completed, documents.length, 'chunking', document.title);
    }
    await this.batchProcessChunks({ chunks, batchSize }, requestId);
  }

  private async batchProcessChunks(payload: BatchChunksPayload, requestId: string): Promise<void> {
    const { chunks, batchSize = 5 } = payload;
    const results: IChunk[] = [];
    let completed = 0;
    this.sendProgress(requestId, completed, chunks.length, 'embedding');

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchTexts = batch.map(chunk => chunk.content);
      const embeddingResult = await this.embeddingEngine.generateEmbeddings(batchTexts, batchSize);

      for (const [j, chunk] of batch.entries()) {
        const embedding = new Float32Array(embeddingResult.embeddings[j]);
        results.push({ ...chunk, embedding, embeddingVersion: 'universal-sentence-encoder' });
      }
      completed += batch.length;
      this.sendProgress(requestId, completed, chunks.length, 'embedding');
    }
    this.send({ type: 'COMPLETE', payload: { chunks: results }, requestId });
  }

  private async generateEmbeddings(payload: GenerateEmbeddingsPayload, requestId: string): Promise<void> {
    const { texts } = payload;
    const result = await this.embeddingEngine.generateEmbeddings(texts);
    this.send({ type: 'COMPLETE', payload: result, requestId });
  }

  private async cleanup(requestId: string): Promise<void> {
    await this.embeddingEngine.cleanup();
    this.isInitialized = false;
    this.send({ type: 'COMPLETE', payload: null, requestId });
  }

  private sendProgress(requestId: string, completed: number, total: number, stage: 'chunking' | 'embedding' | 'indexing', currentDocument?: string): void {
    this.send({ type: 'PROGRESS', payload: { completed, total, stage, currentDocument }, requestId });
  }

  private send(response: WorkerResponse): void {
    self.postMessage(response);
  }
}

new IndexingWorker();
