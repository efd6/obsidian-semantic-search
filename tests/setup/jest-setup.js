// Jest Setup File
// Sets up global test environment and mocks

// Mock global crypto for browser environment
const crypto = require('crypto');

// Add IndexedDB support for RxDB integration tests
require('fake-indexeddb/auto');

// Add structuredClone polyfill for fake-indexeddb
if (typeof global.structuredClone === 'undefined') {
    global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock global process if not available
if (typeof global.process === 'undefined') {
    global.process = {
        env: {
            NODE_ENV: 'test'
        }
    };
}

// Disable RxDB dev mode during testing to prevent Float32Array freezing issues
global.process.env.NODE_ENV = 'production';

// Mock global fetch for Node.js environment
const mockFetchResponse = { ok: true, json: async () => ({}), text: async () => '' };
if (typeof global.fetch === 'undefined') {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);
} else {
    jest.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse);
}

// Mock TensorFlow.js modules to avoid loading actual models
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

            // Mock the tensor structure - the dispose() needs to be on the tensor returned by embed()
            return {
                data: jest.fn().mockResolvedValue(embeddings),
                dispose: jest.fn()
            };
        })
    })
}));

// Mock Web Crypto API for browser compatibility tests
const mockCrypto = {
    subtle: {
        digest: jest.fn().mockImplementation(async (algorithm, data) => {
            // Better mock hash - create deterministic but unique hash based on input content
            const input = Array.from(new Uint8Array(data));
            const hash = new ArrayBuffer(32);
            const view = new Uint8Array(hash);

            // Simple hash function that produces different outputs for different inputs
            let seed = 0;
            for (let i = 0; i < input.length; i++) {
                seed = ((seed << 5) - seed) + input[i];
                seed = seed & seed; // Convert to 32bit integer
            }

            for (let i = 0; i < 32; i++) {
                view[i] = ((seed + i * 37) ^ (i * 17)) & 0xff;
            }
            return hash;
        })
    }
};

if (typeof global.crypto === 'undefined') {
    global.crypto = mockCrypto;
} else {
    global.crypto.subtle = mockCrypto.subtle;
}

// Also set it on globalThis for consistency
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = mockCrypto;
} else {
    globalThis.crypto.subtle = mockCrypto.subtle;
}

// Mock TextEncoder for browser APIs
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = class TextEncoder {
        encode(str) {
            return new Uint8Array(Buffer.from(str, 'utf8'));
        }
    };
}

// Mock TextDecoder for browser APIs
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = class TextDecoder {
        decode(bytes) {
            return Buffer.from(bytes).toString('utf8');
        }
    };
}

// Console configuration for tests
if (process.env.NODE_ENV === 'test') {
    // Suppress console warnings during tests (but keep errors)
    const originalWarn = console.warn;
    console.warn = (...args) => {
        // Allow RxDB dev-mode warnings to be suppressed
        if (args[0] && args[0].includes('RxDB dev-mode')) {
            return;
        }
        originalWarn(...args);
    };
}

// Clean up between tests
afterEach(() => {
    jest.clearAllMocks();
    // Clear any global state
    if (global.localStorage) {
        global.localStorage.clear();
    }
    if (global.sessionStorage) {
        global.sessionStorage.clear();
    }
});

// Global test timeout
jest.setTimeout(30000);