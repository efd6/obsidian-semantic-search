export class SearchIndexValidationError extends Error {
  constructor(field: string, message: string) {
    super(`SearchIndex validation failed for ${field}: ${message}`);
    this.name = 'SearchIndexValidationError';
  }
}

export class SearchIndexCompatibilityError extends Error {
  constructor(message: string) {
    super(`SearchIndex compatibility error: ${message}`);
    this.name = 'SearchIndexCompatibilityError';
  }
}

export interface ISearchIndex {
  version: string;
  modelName: string;
  modelVersion: string;
  dimensions: number;
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  createdDate: Date;
  lastUpdated: Date;
  isRebuilding: boolean;
}

export class SearchIndex implements ISearchIndex {
  private static instance: SearchIndex | null = null;
  private static readonly SINGLETON_KEY = 'main';
  private static readonly SUPPORTED_VERSIONS = ['1.0.0'];
  private static readonly MODEL_DIMENSIONS: Record<string, number> = {
    'universal-sentence-encoder': 512,
    'text-embedding-ada-002': 1536
  };

  public readonly version: string;
  public readonly modelName: string;
  public readonly modelVersion: string;
  public readonly dimensions: number;
  public documentCount: number;
  public chunkCount: number;
  public totalTokens: number;
  public readonly createdDate: Date;
  public lastUpdated: Date;
  public isRebuilding: boolean;

  private constructor(data: Omit<ISearchIndex, 'lastUpdated'>) {
    this.version = data.version;
    this.modelName = data.modelName;
    this.modelVersion = data.modelVersion;
    this.dimensions = data.dimensions;
    this.documentCount = data.documentCount;
    this.chunkCount = data.chunkCount;
    this.totalTokens = data.totalTokens;
    this.createdDate = data.createdDate;
    this.lastUpdated = new Date();
    this.isRebuilding = data.isRebuilding;

    this.validate();
  }

  public static getInstance(data?: Omit<ISearchIndex, 'lastUpdated'>): SearchIndex {
    if (!SearchIndex.instance && data) {
      SearchIndex.instance = new SearchIndex(data);
    } else if (!SearchIndex.instance) {
      throw new SearchIndexValidationError('instance', 'SearchIndex not initialized');
    }
    return SearchIndex.instance;
  }

  public static createNew(modelName: string, modelVersion: string): SearchIndex {
    const dimensions = SearchIndex.MODEL_DIMENSIONS[modelName];
    if (!dimensions) {
      throw new SearchIndexCompatibilityError(`Unsupported model: ${modelName}`);
    }

    const data = {
      version: '1.0.0',
      modelName,
      modelVersion,
      dimensions,
      documentCount: 0,
      chunkCount: 0,
      totalTokens: 0,
      createdDate: new Date(),
      isRebuilding: false
    };

    SearchIndex.instance = new SearchIndex(data);
    return SearchIndex.instance;
  }

  public static getSingletonKey(): string {
    return SearchIndex.SINGLETON_KEY;
  }

  public static isVersionSupported(version: string): boolean {
    return SearchIndex.SUPPORTED_VERSIONS.includes(version);
  }

  public isModelCompatible(modelName: string, modelVersion: string): boolean {
    return this.modelName === modelName && this.modelVersion === modelVersion;
  }

  public updateStatistics(documentCount: number, chunkCount: number, totalTokens: number): void {
    this.documentCount = Math.max(0, documentCount);
    this.chunkCount = Math.max(0, chunkCount);
    this.totalTokens = Math.max(0, totalTokens);
    this.lastUpdated = new Date();
    this.validate();
  }

  public startRebuild(): void {
    this.isRebuilding = true;
    this.lastUpdated = new Date();
  }

  public finishRebuild(): void {
    this.isRebuilding = false;
    this.lastUpdated = new Date();
  }

  public getIndexAge(): number {
    return Date.now() - this.lastUpdated.getTime();
  }

  public getIndexSizeInfo(): { documents: number; chunks: number; avgChunksPerDoc: number } {
    return {
      documents: this.documentCount,
      chunks: this.chunkCount,
      avgChunksPerDoc: this.documentCount > 0 ? this.chunkCount / this.documentCount : 0
    };
  }

  private validate(): void {
    if (!SearchIndex.isVersionSupported(this.version)) {
      throw new SearchIndexValidationError('version', `unsupported version: ${this.version}`);
    }

    if (this.documentCount < 0 || this.chunkCount < 0) {
      throw new SearchIndexValidationError('counts', 'documentCount and chunkCount must be >= 0');
    }

    if (this.lastUpdated < this.createdDate) {
      throw new SearchIndexValidationError('lastUpdated', 'must be >= createdDate');
    }

    const expectedDimensions = SearchIndex.MODEL_DIMENSIONS[this.modelName];
    if (!expectedDimensions || this.dimensions !== expectedDimensions) {
      throw new SearchIndexValidationError('dimensions', 'must match model specifications');
    }
  }

  public toJSON(): ISearchIndex {
    return {
      version: this.version,
      modelName: this.modelName,
      modelVersion: this.modelVersion,
      dimensions: this.dimensions,
      documentCount: this.documentCount,
      chunkCount: this.chunkCount,
      totalTokens: this.totalTokens,
      createdDate: this.createdDate,
      lastUpdated: this.lastUpdated,
      isRebuilding: this.isRebuilding
    };
  }
}