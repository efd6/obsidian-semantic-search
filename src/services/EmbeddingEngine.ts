import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

export interface EmbeddingResult {
    embeddings: number[][];
    dimensions: number;
}

interface QueuedRequest {
    text: string;
    resolve: (embedding: Float32Array) => void;
    reject: (error: Error) => void;
}

export class EmbeddingEngine {
    private static instance: EmbeddingEngine;
    private model: use.UniversalSentenceEncoder | null = null;
    private isLoading = false;
    private loadPromise: Promise<use.UniversalSentenceEncoder> | null = null;
    private embeddingCache = new Map<string, Float32Array>();
    private readonly maxCacheSize = 1000;
    private requestQueue: QueuedRequest[] = [];
    private isProcessingQueue = false;

    private constructor() {
        // Private constructor for singleton pattern
    }

    public static getInstance(): EmbeddingEngine {
        if (!EmbeddingEngine.instance) {
            EmbeddingEngine.instance = new EmbeddingEngine();
        }
        return EmbeddingEngine.instance;
    }

    public async initialize(): Promise<void> {
        if (this.model) return;
        if (this.isLoading && this.loadPromise) {
            await this.loadPromise;
            return;
        }

        this.isLoading = true;
        this.loadPromise = this.loadModel();
        try {
            this.model = await this.loadPromise;
            // Process any queued requests once model is ready
            void this.processQueue();
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    public isReady(): boolean {
        return this.model !== null && !this.isLoading;
    }

    public getLoadingStatus(): { isLoading: boolean; isReady: boolean; queueSize: number } {
        return {
            isLoading: this.isLoading,
            isReady: this.isReady(),
            queueSize: this.requestQueue.length
        };
    }

    private async loadModel(): Promise<use.UniversalSentenceEncoder> {
        try {
            console.log('Loading Universal Sentence Encoder from TensorFlow.js...');

            // Initialize TensorFlow.js with default backend selection
            // This avoids explicit backend conflicts in Electron environment
            await tf.ready();

            console.log('TensorFlow.js backend:', tf.getBackend());
            console.log('TensorFlow.js version:', tf.version);

            // Load Universal Sentence Encoder model
            // This will download the model from CDN and cache it in browser storage
            const model = await use.load();

            console.log('✓ Universal Sentence Encoder loaded successfully');
            console.log('  Model dimensions: 512');
            console.log('  Backend:', tf.getBackend());

            return model;
        } catch (error: unknown) {
            // Enhanced error logging for debugging
            console.error('=== TENSORFLOW.JS MODEL ERROR DETAILS ===');
            console.error('Error message:', error instanceof Error ? error.message : String(error));
            console.error('Error name:', error instanceof Error ? error.name : typeof error);
            console.error('TensorFlow.js backend:', tf.getBackend());
            console.error('TensorFlow.js version:', tf.version);

            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }

            // Try to serialize error for better visibility
            try {
                console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            } catch (jsonError) {
                console.error('Could not stringify error:', jsonError);
            }
            console.error('=== END ERROR DETAILS ===');

            throw new Error(`TensorFlow.js Universal Sentence Encoder initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async generateEmbedding(text: string): Promise<Float32Array> {
        if (!text.trim()) throw new Error('Text cannot be empty');

        const cacheKey = this.getCacheKey(text);
        const cached = this.embeddingCache.get(cacheKey);
        if (cached) return cached;

        // If model is not ready, queue the request
        if (!this.isReady()) {
            return new Promise<Float32Array>((resolve, reject) => {
                this.requestQueue.push({ text, resolve, reject });
                console.log(`🔄 Queued embedding request (queue size: ${this.requestQueue.length})`);
            });
        }

        return await this.generateEmbeddingInternal(text);
    }

    private async generateEmbeddingInternal(text: string): Promise<Float32Array> {
        if (!this.model) throw new Error('Model not initialized');

        try {
            // Generate embedding using Universal Sentence Encoder
            const embeddings = await this.model.embed([text]);

            // Convert tensor to Float32Array
            const embeddingData = await embeddings.data();
            const embedding = new Float32Array(embeddingData);

            // Clean up tensor to prevent memory leaks
            embeddings.dispose();

            // Verify dimensions (Universal Sentence Encoder produces 512-dimensional embeddings)
            if (embedding.length !== 512) {
                throw new Error(`Expected 512 dimensions, got ${embedding.length}`);
            }

            const cacheKey = this.getCacheKey(text);
            this.cacheEmbedding(cacheKey, embedding);
            return embedding;
        } catch (error) {
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) return;

        this.isProcessingQueue = true;
        console.log(`🚀 Processing embedding queue (${this.requestQueue.length} requests)`);

        // Process queue in batches to avoid overwhelming the system
        const batchSize = 5;
        while (this.requestQueue.length > 0) {
            const batch = this.requestQueue.splice(0, batchSize);

            await Promise.allSettled(
                batch.map(async (request) => {
                    try {
                        const embedding = await this.generateEmbeddingInternal(request.text);
                        request.resolve(embedding);
                    } catch (error) {
                        request.reject(error instanceof Error ? error : new Error(String(error)));
                    }
                })
            );

            // Small delay between batches to prevent blocking
            if (this.requestQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        this.isProcessingQueue = false;
        console.log('✅ Embedding queue processing complete');
    }

    public async generateEmbeddings(texts: string[], batchSize = 10): Promise<EmbeddingResult> {
        if (texts.length === 0) return { embeddings: [], dimensions: 512 };

        await this.initialize();
        if (!this.model) throw new Error('Model not initialized');

        const embeddings: number[][] = [];

        // Process in batches to manage memory
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            try {
                // Generate embeddings for batch
                const batchEmbeddings = await this.model.embed(batch);
                const batchData = await batchEmbeddings.data();

                // Convert to array of arrays
                for (const [j] of batch.entries()) {
                    const start = j * 512;
                    const end = start + 512;
                    const embedding = [...batchData.subarray(start, end)];
                    embeddings.push(embedding);

                    // Cache individual embeddings
                    const cacheKey = this.getCacheKey(batch[j]);
                    this.cacheEmbedding(cacheKey, new Float32Array(embedding));
                }

                // Clean up tensor
                batchEmbeddings.dispose();
            } catch (error) {
                throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return { embeddings, dimensions: 512 };
    }

    private getCacheKey(text: string): string {
        return text.length > 100 ? text.slice(0, 100) + `_${text.length}` : text;
    }

    private cacheEmbedding(key: string, embedding: Float32Array): void {
        if (this.embeddingCache.size >= this.maxCacheSize) {
            const firstKey = this.embeddingCache.keys().next().value as string;
            this.embeddingCache.delete(firstKey);
        }
        this.embeddingCache.set(key, embedding);
    }

    public clearCache(): void {
        this.embeddingCache.clear();
    }

    public getCacheSize(): number {
        return this.embeddingCache.size;
    }

    public isInitialized(): boolean {
        return this.model !== null;
    }

    public async cleanup(): Promise<void> {
        await Promise.resolve(); // Satisfy require-await rule
        this.clearCache();

        // Dispose of model if loaded
        if (this.model) {
            // Universal Sentence Encoder doesn't have a dispose method
            // TensorFlow.js will handle cleanup automatically
            this.model = null;
        }

        this.isLoading = false;
        this.loadPromise = null;
    }
}