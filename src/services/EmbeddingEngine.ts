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

const MODEL_CACHE_KEY = 'indexeddb://use-model-v1';
const VOCAB_DB_NAME = 'semantic-search-cache';
const VOCAB_STORE_NAME = 'vocab';
const VOCAB_ENTRY_KEY = 'use-vocab-v1';
const VOCAB_CDN_URL = 'https://storage.googleapis.com/tfjs-models/savedmodel/universal_sentence_encoder/vocab.json';

export class EmbeddingEngine {
    private static instance: EmbeddingEngine;
    private model: use.UniversalSentenceEncoder | null = null;
    private isLoading = false;
    private loadPromise: Promise<use.UniversalSentenceEncoder> | null = null;
    // embeddingCache maps text to its embedding. It is keyed on the whole text:
    // a shortened key lets texts that share an opening, such as notes made
    // from the same template, get each other's embeddings.
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
            console.log('Loading Universal Sentence Encoder...');
            await tf.ready();
            console.log('TensorFlow.js backend:', tf.getBackend());

            if (!this.canUseCache()) {
                return await use.load();
            }

            const [modelCached, vocabData] = await Promise.all([
                this.isModelCached(),
                this.loadCachedVocab(),
            ]);

            if (modelCached && vocabData) {
                console.log('Loading model from IndexedDB cache');
                const vocabBlobUrl = URL.createObjectURL(
                    new Blob([JSON.stringify(vocabData)], { type: 'application/json' })
                );
                try {
                    const model = await use.load({
                        modelUrl: MODEL_CACHE_KEY,
                        vocabUrl: vocabBlobUrl,
                    });
                    console.log('✓ Model loaded from cache');
                    return model;
                } finally {
                    URL.revokeObjectURL(vocabBlobUrl);
                }
            }

            console.log('Cache miss — downloading model from CDN');
            const fetchedVocab: unknown = await fetch(VOCAB_CDN_URL)
                .then((r): Promise<unknown> => r.json() as Promise<unknown>);
            const vocabBlobUrl = URL.createObjectURL(
                new Blob([JSON.stringify(fetchedVocab)], { type: 'application/json' })
            );
            let model: use.UniversalSentenceEncoder;
            try {
                model = await use.load({ vocabUrl: vocabBlobUrl });
            } finally {
                URL.revokeObjectURL(vocabBlobUrl);
            }

            // Best-effort cache for next load
            type GraphModelHost = { model: { save(loc: string): Promise<void> } };
            await Promise.allSettled([
                (model as unknown as GraphModelHost).model.save(MODEL_CACHE_KEY),
                this.cacheVocab(fetchedVocab),
            ]);
            console.log('✓ Model downloaded and cached');

            return model;
        } catch (error: unknown) {
            console.error('Model loading failed:', error instanceof Error ? error.message : String(error));
            throw new Error(`TensorFlow.js Universal Sentence Encoder initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private canUseCache(): boolean {
        return typeof indexedDB !== 'undefined'
            && typeof URL !== 'undefined'
            && typeof URL.createObjectURL === 'function';
    }

    // ---- IndexedDB model/vocab cache ----

    private async isModelCached(): Promise<boolean> {
        try {
            const models = await tf.io.listModels();
            return MODEL_CACHE_KEY in models;
        } catch {
            return false;
        }
    }

    private async cacheVocab(data: unknown): Promise<void> {
        const db = await this.openVocabDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(VOCAB_STORE_NAME, 'readwrite');
            tx.objectStore(VOCAB_STORE_NAME).put(data, VOCAB_ENTRY_KEY);
            tx.addEventListener('complete', (): void => { db.close(); resolve(); });
            tx.addEventListener('error', (): void => { db.close(); reject(tx.error ?? new Error('Transaction failed')); });
        });
    }

    private async loadCachedVocab(): Promise<unknown> {
        try {
            const db = await this.openVocabDB();
            return await new Promise<unknown>((resolve, reject) => {
                const tx = db.transaction(VOCAB_STORE_NAME, 'readonly');
                const req = tx.objectStore(VOCAB_STORE_NAME).get(VOCAB_ENTRY_KEY);
                req.addEventListener('success', (): void => { db.close(); resolve(req.result ?? null); });
                req.addEventListener('error', (): void => { db.close(); reject(req.error ?? new Error('Request failed')); });
            });
        } catch {
            return null;
        }
    }

    private static async clearVocabCache(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const req = indexedDB.open(VOCAB_DB_NAME, 1);
            req.addEventListener('upgradeneeded', (): void => {
                const db = req.result;
                if (!db.objectStoreNames.contains(VOCAB_STORE_NAME)) {
                    db.createObjectStore(VOCAB_STORE_NAME);
                }
            });
            req.addEventListener('success', (): void => {
                const db = req.result;
                try {
                    const tx = db.transaction(VOCAB_STORE_NAME, 'readwrite');
                    tx.objectStore(VOCAB_STORE_NAME).delete(VOCAB_ENTRY_KEY);
                    tx.addEventListener('complete', (): void => { db.close(); resolve(); });
                    tx.addEventListener('error', (): void => { db.close(); reject(tx.error ?? new Error('Transaction failed')); });
                } catch {
                    db.close();
                    resolve();
                }
            });
            req.addEventListener('error', (): void => resolve());
        });
    }

    private openVocabDB(): Promise<IDBDatabase> {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(VOCAB_DB_NAME, 1);
            req.addEventListener('upgradeneeded', (): void => {
                const db = req.result;
                if (!db.objectStoreNames.contains(VOCAB_STORE_NAME)) {
                    db.createObjectStore(VOCAB_STORE_NAME);
                }
            });
            req.addEventListener('success', (): void => resolve(req.result));
            req.addEventListener('error', (): void => reject(req.error ?? new Error('Failed to open database')));
        });
    }

    public static async clearModelCache(): Promise<void> {
        try { await tf.io.removeModel(MODEL_CACHE_KEY); } catch { /* not cached */ }
        await EmbeddingEngine.clearVocabCache();
    }

    public async generateEmbedding(text: string): Promise<Float32Array> {
        if (!text.trim()) throw new Error('Text cannot be empty');

        const cached = this.embeddingCache.get(text);
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

            this.cacheEmbedding(text, embedding);
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
                    this.cacheEmbedding(batch[j], new Float32Array(embedding));
                }

                // Clean up tensor
                batchEmbeddings.dispose();
            } catch (error) {
                throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return { embeddings, dimensions: 512 };
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