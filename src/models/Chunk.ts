/**
 * Chunk model for Obsidian semantic search plugin
 * Represents a segment of a document for granular search and memory management
 */

export interface IChunk {
  id: string;                    // composite: documentId + chunkIndex
  documentId: string;           // references parent Document.id
  chunkIndex: number;           // position within document, 0-based
  content: string;              // text segment, typically 512 tokens max
  startOffset: number;          // character position in original document
  endOffset: number;            // character position in original document
  embedding: Float32Array;      // semantic vector representation
  embeddingVersion: string;     // model version used for embedding
}

export class ChunkValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ChunkValidationError';
  }
}

export class Chunk implements IChunk {
  static readonly MAX_CONTENT_LENGTH = 2048;
  static readonly EMBEDDING_DIMENSIONS = 512; // Universal Sentence Encoder model
  static readonly MODEL_VERSION = 'universal-sentence-encoder';

  constructor(
    public id: string,
    public documentId: string,
    public chunkIndex: number,
    public content: string,
    public startOffset: number,
    public endOffset: number,
    public embedding: Float32Array,
    public embeddingVersion: string
  ) {
    this.validate();
  }

  /**
   * Generate chunk ID from document ID and chunk index
   */
  static generateId(documentId: string, chunkIndex: number): string {
    return `${documentId}:chunk:${chunkIndex}`;
  }

  /**
   * Create chunk from text segment with automatic ID generation
   */
  static create(
    documentId: string,
    chunkIndex: number,
    content: string,
    startOffset: number,
    endOffset: number,
    embedding: Float32Array,
    embeddingVersion: string = Chunk.MODEL_VERSION
  ): Chunk {
    const id = Chunk.generateId(documentId, chunkIndex);
    return new Chunk(id, documentId, chunkIndex, content, startOffset, endOffset, embedding, embeddingVersion);
  }

  /**
   * Validate chunk properties according to data model rules
   */
  private validate(): void {
    if (this.chunkIndex < 0) {
      throw new ChunkValidationError('Chunk index must be >= 0', 'chunkIndex');
    }

    if (this.content.length > Chunk.MAX_CONTENT_LENGTH) {
      throw new ChunkValidationError(`Content length must be <= ${Chunk.MAX_CONTENT_LENGTH} characters`, 'content');
    }

    if (this.endOffset <= this.startOffset) {
      throw new ChunkValidationError('End offset must be greater than start offset', 'endOffset');
    }

    if (this.embedding.length !== Chunk.EMBEDDING_DIMENSIONS) {
      throw new ChunkValidationError(`Embedding must have ${Chunk.EMBEDDING_DIMENSIONS} dimensions`, 'embedding');
    }

    if (!this.documentId || this.documentId.trim().length === 0) {
      throw new ChunkValidationError('Document ID must not be empty', 'documentId');
    }

    if (this.id !== Chunk.generateId(this.documentId, this.chunkIndex)) {
      throw new ChunkValidationError('Chunk ID must match expected format', 'id');
    }
  }

  /**
   * Validate embedding vector dimensions and values
   */
  isValidEmbedding(): boolean {
    if (this.embedding.length !== Chunk.EMBEDDING_DIMENSIONS) return false;

    // Check for NaN or infinite values
    for (let i = 0; i < this.embedding.length; i++) {
      if (!Number.isFinite(this.embedding[i])) return false;
    }

    return true;
  }

  /**
   * Get text snippet with context for display
   */
  getSnippet(maxLength: number = 200): string {
    return this.content.length <= maxLength
      ? this.content
      : this.content.slice(0, Math.max(0, maxLength - 3)) + '...';
  }

  /**
   * Check if chunk overlaps with given text range
   */
  overlapsRange(start: number, end: number): boolean {
    return this.startOffset < end && this.endOffset > start;
  }

  /**
   * Calculate cosine similarity with another embedding
   */
  cosineSimilarity(otherEmbedding: Float32Array): number {
    if (otherEmbedding.length !== this.embedding.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < this.embedding.length; i++) {
      dotProduct += this.embedding[i] * otherEmbedding[i];
      normA += this.embedding[i] * this.embedding[i];
      normB += otherEmbedding[i] * otherEmbedding[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): IChunk {
    return {
      id: this.id,
      documentId: this.documentId,
      chunkIndex: this.chunkIndex,
      content: this.content,
      startOffset: this.startOffset,
      endOffset: this.endOffset,
      embedding: this.embedding,
      embeddingVersion: this.embeddingVersion
    };
  }

  /**
   * Create Chunk instance from plain object
   */
  static fromJSON(data: IChunk): Chunk {
    return new Chunk(
      data.id,
      data.documentId,
      data.chunkIndex,
      data.content,
      data.startOffset,
      data.endOffset,
      data.embedding,
      data.embeddingVersion
    );
  }
}