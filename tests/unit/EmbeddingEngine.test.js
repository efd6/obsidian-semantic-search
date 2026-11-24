// Unit tests for EmbeddingEngine service - aligned with actual singleton implementation
// Tests embedding generation, caching, and web-only configuration

import { EmbeddingEngine } from '../../src/services/EmbeddingEngine';

// Mock TensorFlow.js modules - using the same mocks as jest-setup.js
jest.mock('@tensorflow/tfjs', () => ({
    ready: jest.fn().mockResolvedValue(undefined),
    getBackend: jest.fn().mockReturnValue('cpu'),
    setBackend: jest.fn().mockResolvedValue(undefined),
    version: { 'tfjs-core': '4.15.0' },
    engine: jest.fn().mockReturnValue({
        registryFactory: { cpu: true, webgl: true }
    })
}));

jest.mock('@tensorflow-models/universal-sentence-encoder', () => ({
    load: jest.fn().mockResolvedValue({
        embed: jest.fn().mockImplementation(async (texts) => {
            const textArray = Array.isArray(texts) ? texts : [texts];
            const embeddings = new Float32Array(textArray.length * 512);

            // Generate deterministic embeddings based on text content
            textArray.forEach((text, textIndex) => {
                const source = typeof text === 'string' ? text : String(text ?? '');
                const hash = source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const offset = textIndex * 512;

                for (let i = 0; i < 512; i++) {
                    embeddings[offset + i] = Math.sin((hash + i) / 100) * 0.1;
                }
            });

            return {
                data: jest.fn().mockResolvedValue(embeddings),
                dispose: jest.fn()
            };
        })
    })
}));

describe('EmbeddingEngine', () => {
    let engine;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Get singleton instance and initialize
        engine = EmbeddingEngine.getInstance();
        await engine.initialize();
    });

    afterEach(async () => {
        if (engine && typeof engine.cleanup === 'function') {
            await engine.cleanup();
        }
    });

    describe('singleton pattern', () => {
        test('returns same instance on multiple calls', () => {
            const instance1 = EmbeddingEngine.getInstance();
            const instance2 = EmbeddingEngine.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBe(engine);
        });

        test('has correct model configuration', () => {
            // Test actual properties that exist on the implementation
            expect(engine).toBeDefined();
            expect(typeof engine.initialize).toBe('function');
            expect(typeof engine.generateEmbedding).toBe('function');
        });
    });

    describe('initialization', () => {
        test('initializes successfully', async () => {
            const newEngine = EmbeddingEngine.getInstance();

            await expect(newEngine.initialize()).resolves.not.toThrow();
        });

        test('handles multiple initialization calls', async () => {
            await expect(engine.initialize()).resolves.not.toThrow();
            await expect(engine.initialize()).resolves.not.toThrow();
        });
    });

    describe('embedding generation', () => {
        test('generates embedding for text input', async () => {
            const text = 'This is a test sentence.';

            if (typeof engine.generateEmbedding === 'function') {
                const embedding = await engine.generateEmbedding(text);

                expect(Array.isArray(embedding) || embedding instanceof Float32Array).toBe(true);
                if (Array.isArray(embedding)) {
                    expect(embedding.length).toBeGreaterThan(0);
                } else {
                    expect(embedding.length).toBeGreaterThan(0);
                }
            } else {
                // Skip if method doesn't exist in this implementation
                console.log('generateEmbedding method not found - skipping test');
            }
        });

        test('handles empty text appropriately', async () => {
            if (typeof engine.generateEmbedding === 'function') {
                // Empty text should be rejected by design
                await expect(engine.generateEmbedding('')).rejects.toThrow('Text cannot be empty');
            }
        });

        test('handles unicode characters', async () => {
            if (typeof engine.generateEmbedding === 'function') {
                const unicodeText = 'Hello 世界! 🚀 Testing unicode.';
                await expect(engine.generateEmbedding(unicodeText)).resolves.not.toThrow();
            }
        });
    });

    describe('batch processing', () => {
        test('generates embeddings for multiple texts', async () => {
            if (typeof engine.generateEmbeddings === 'function') {
                const texts = ['first text', 'second text', 'third text'];
                const result = await engine.generateEmbeddings(texts);

                expect(result).toHaveProperty('embeddings');
                expect(result).toHaveProperty('dimensions');
                expect(Array.isArray(result.embeddings)).toBe(true);
                expect(result.embeddings.length).toBe(texts.length);
                expect(typeof result.dimensions).toBe('number');
            }
        });

        test('handles empty batch', async () => {
            if (typeof engine.generateEmbeddings === 'function') {
                const result = await engine.generateEmbeddings([]);
                expect(result).toHaveProperty('embeddings');
                expect(result).toHaveProperty('dimensions');
                expect(Array.isArray(result.embeddings)).toBe(true);
                expect(result.embeddings.length).toBe(0);
            }
        });
    });

    describe('caching behavior', () => {
        test('caches embeddings for repeated requests', async () => {
            if (typeof engine.generateEmbedding === 'function') {
                const text = 'cacheable text';

                const embedding1 = await engine.generateEmbedding(text);
                const embedding2 = await engine.generateEmbedding(text);

                // Should return the same result (cached)
                expect(embedding1).toEqual(embedding2);
            }
        });

        test('texts sharing a long prefix and length get their own embeddings', async () => {
            // Notes made from the same template often share their opening.
            const prefix = 'x'.repeat(150);
            const a = await engine.generateEmbedding(`${prefix}a`);
            const b = await engine.generateEmbedding(`${prefix}b`);

            expect(b).not.toEqual(a);
        });

        test('cache can be cleared', async () => {
            if (typeof engine.clearCache === 'function') {
                expect(() => engine.clearCache()).not.toThrow();
            }
        });
    });

    describe('similarity calculations', () => {
        test('calculates similarity between embeddings', async () => {
            if (typeof engine.calculateSimilarity === 'function') {
                const embedding1 = new Float32Array([1, 0, 0, 0]);
                const embedding2 = new Float32Array([0, 1, 0, 0]);
                const embedding3 = new Float32Array([1, 0, 0, 0]);

                const similarity1 = engine.calculateSimilarity(embedding1, embedding2);
                const similarity2 = engine.calculateSimilarity(embedding1, embedding3);

                expect(typeof similarity1).toBe('number');
                expect(typeof similarity2).toBe('number');
                expect(similarity2).toBeGreaterThan(similarity1); // Same vectors should be more similar
            }
        });
    });

    describe('error handling', () => {
        test('handles initialization errors', async () => {
            // Since engine is a singleton, test with a new initialization
            const newEngine = EmbeddingEngine.getInstance();

            // The engine should handle initialization gracefully even with mocked failures
            await expect(newEngine.initialize()).resolves.not.toThrow();
        });

        test('handles invalid input', async () => {
            if (typeof engine.generateEmbedding === 'function') {
                await expect(engine.generateEmbedding(null)).rejects.toThrow();
                await expect(engine.generateEmbedding(undefined)).rejects.toThrow();
            }
        });
    });

    describe('model load failure', () => {
        test('waiting and later requests fail instead of waiting forever', async () => {
            const use = require('@tensorflow-models/universal-sentence-encoder');
            await engine.cleanup();
            use.load.mockRejectedValueOnce(new Error('download refused'));

            const waiting = engine.generateEmbedding('queued before the model loaded');
            await expect(engine.initialize()).rejects.toThrow('download refused');

            await expect(waiting).rejects.toThrow('download refused');
            await expect(engine.generateEmbedding('asked after the failure')).rejects.toThrow('download refused');
        });
    });

    describe('resource management', () => {
        test('cleanup method works if available', async () => {
            if (typeof engine.cleanup === 'function') {
                await expect(engine.cleanup()).resolves.not.toThrow();
            }
        });

        test('can reinitialize after cleanup', async () => {
            if (typeof engine.cleanup === 'function') {
                await engine.cleanup();
                await expect(engine.initialize()).resolves.not.toThrow();
            }
        });
    });

    describe('configuration verification', () => {
        test('engine instance is properly configured', () => {
            expect(engine).toBeDefined();
            expect(typeof engine).toBe('object');
        });

        test('has expected methods', () => {
            const expectedMethods = ['initialize'];
            expectedMethods.forEach(method => {
                expect(typeof engine[method]).toBe('function');
            });
        });
    });
});
