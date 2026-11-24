// Browser-compatible crypto utilities for Obsidian plugin
export const BrowserCrypto = {
  /**
   * Generate SHA-256 hash using Web Crypto API
   */
  async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = [...new Uint8Array(hashBuffer)];
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Synchronous non-cryptographic hash (DJB2 variant), returning 32 hex chars.
   * Not MD5 — the output has only 32 bits of entropy, repeated to fill the width.
   */
  simpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hexHash = (hash >>> 0).toString(16).padStart(8, '0');
    return (hexHash + hexHash + hexHash + hexHash).slice(0, 32);
  },
};

// Synchronous hash wrapper. 'simple' returns a 32-char DJB2 hash, which is not
// cryptographic and must not be used where collisions matter. For SHA-256, use
// BrowserCrypto.sha256() (async).
export function createHash(algorithm: string): { update: (data: string) => { digest: (encoding: 'hex') => string } } {
  return {
    update: (data: string): { digest: (encoding: 'hex') => string } => ({
      digest: (encoding: 'hex'): string => { // eslint-disable-line @typescript-eslint/no-unused-vars -- Legacy API compatibility requires parameter
        if (algorithm === 'simple') {
          return BrowserCrypto.simpleHash(data);
        }
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
      }
    })
  };
}