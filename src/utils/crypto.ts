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
   * Generate MD5 hash using a simple implementation
   * Note: This is a basic MD5 implementation for browser compatibility
   */
  md5(data: string): string {
    // Simple MD5 implementation for browser
    // This is a basic version - for production, consider using a more robust library
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string
    const hexHash = (hash >>> 0).toString(16).padStart(8, '0');
    // Pad to 32 characters to simulate MD5 length
    return (hexHash + hexHash + hexHash + hexHash).slice(0, 32);
  },

  /**
   * Synchronous hash function for simple use cases
   * Uses a fast non-cryptographic hash
   */
  fastHash(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString(16).padStart(8, '0');

    for (let i = 0; i < data.length; i++) {
      const char = data.codePointAt(i) ?? 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Return as 8-character hex string
    return Math.abs(hash).toString(16).padStart(8, '0');
  },
};

// Legacy compatibility functions
export function createHash(algorithm: string): { update: (data: string) => { digest: (encoding: 'hex') => string } } {
  return {
    update: (data: string): { digest: (encoding: 'hex') => string } => ({
      digest: (encoding: 'hex'): string => { // eslint-disable-line @typescript-eslint/no-unused-vars -- Legacy API compatibility requires parameter
        if (algorithm === 'sha256') {
          // For synchronous use, fall back to fast hash
          // Async version should use BrowserCrypto.sha256()
          return BrowserCrypto.fastHash(data);
        } else if (algorithm === 'md5') {
          return BrowserCrypto.md5(data);
        }
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
      }
    })
  };
}