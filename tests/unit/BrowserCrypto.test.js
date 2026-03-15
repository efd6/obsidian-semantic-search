// Unit tests for BrowserCrypto utilities
// Tests the browser-compatible crypto functions that replaced Node.js crypto

import { BrowserCrypto } from '../../src/utils/crypto';

describe('BrowserCrypto', () => {
    describe('sha256', () => {
        test('generates consistent SHA256 hash for same input', async () => {
            const input = 'test string';
            const hash1 = await BrowserCrypto.sha256(input);
            const hash2 = await BrowserCrypto.sha256(input);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Should be 64 hex characters
        });

        test('generates different hashes for different inputs', async () => {
            const hash1 = await BrowserCrypto.sha256('string1');
            const hash2 = await BrowserCrypto.sha256('string2');

            expect(hash1).not.toBe(hash2);
        });

        test('handles empty string input', async () => {
            const hash = await BrowserCrypto.sha256('');

            expect(hash).toMatch(/^[a-f0-9]{64}$/);
            // Note: Using mock implementation, so just verify format
            expect(hash).toBeTruthy();
        });

        test('handles unicode characters', async () => {
            const hash = await BrowserCrypto.sha256('hello 世界 🚀');

            expect(hash).toMatch(/^[a-f0-9]{64}$/);
            expect(hash).toBeTruthy();
        });

        test('handles large input strings', async () => {
            const largeString = 'a'.repeat(10000);
            const hash = await BrowserCrypto.sha256(largeString);

            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe('simpleHash', () => {
        test('generates consistent hash for same input', () => {
            const input = 'test string';
            const hash1 = BrowserCrypto.simpleHash(input);
            const hash2 = BrowserCrypto.simpleHash(input);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{32}$/);
        });

        test('generates different hashes for different inputs', () => {
            const hash1 = BrowserCrypto.simpleHash('string1');
            const hash2 = BrowserCrypto.simpleHash('string2');

            expect(hash1).not.toBe(hash2);
        });

        test('handles empty string input', () => {
            const hash = BrowserCrypto.simpleHash('');

            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });

        test('handles unicode characters', () => {
            const hash = BrowserCrypto.simpleHash('hello 世界 🚀');

            expect(hash).toMatch(/^[a-f0-9]{32}$/);
            expect(hash).toBeTruthy();
        });

        test('handles large input strings', () => {
            const largeString = 'a'.repeat(10000);
            const hash = BrowserCrypto.simpleHash(largeString);

            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });
    });

    describe('hash consistency and uniqueness', () => {
        test('SHA256 and simpleHash produce different outputs for same input', async () => {
            const input = 'test';
            const sha256Hash = await BrowserCrypto.sha256(input);
            const simple = BrowserCrypto.simpleHash(input);

            expect(sha256Hash).not.toBe(simple);
            expect(sha256Hash.length).toBe(64);
            expect(simple.length).toBe(32);
        });

        test('hashes have good distribution - no obvious collisions in sample', async () => {
            const inputs = ['test1', 'test2', 'test3', 'hello', 'world', 'crypto', 'hash'];
            const sha256Hashes = new Set();
            const md5Hashes = new Set();

            for (const input of inputs) {
                const sha256Hash = await BrowserCrypto.sha256(input);
                const simple = BrowserCrypto.simpleHash(input);

                sha256Hashes.add(sha256Hash);
                md5Hashes.add(simple);
            }

            // All hashes should be unique
            expect(sha256Hashes.size).toBe(inputs.length);
            expect(md5Hashes.size).toBe(inputs.length);
        });
    });

    describe('browser compatibility', () => {
        test('SHA256 uses Web Crypto API', async () => {
            // Mock crypto.subtle to verify it's being used
            const originalDigest = crypto.subtle.digest;
            const mockDigest = jest.fn().mockResolvedValue(new ArrayBuffer(32));
            crypto.subtle.digest = mockDigest;

            await BrowserCrypto.sha256('test');

            expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));

            // Restore original
            crypto.subtle.digest = originalDigest;
        });

        test('simpleHash works without Node.js crypto', () => {
            const hash = BrowserCrypto.simpleHash('browser test');
            expect(hash).toMatch(/^[a-f0-9]{32}$/);
        });
    });
});