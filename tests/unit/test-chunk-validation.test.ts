/**
 * Unit Tests for Chunk Validation
 * Tests that chunks created by DocumentIndexer respect the MAX_CONTENT_LENGTH limit
 */

import { Chunk, ChunkValidationError } from '../../src/models/Chunk';

describe('Chunk Validation Tests', () => {
  describe('Character length validation', () => {
    it('should accept chunks within 2048 character limit', () => {
      const content = 'A'.repeat(2048); // Exactly 2048 characters
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, embedding);
      }).not.toThrow();
    });

    it('should reject chunks exceeding 2048 character limit', () => {
      const content = 'A'.repeat(2049); // One character over limit
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, embedding);
      }).toThrow(ChunkValidationError);

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, embedding);
      }).toThrow('Content length must be <= 2048 characters');
    });

    it('should reject empty content with zero-length offset range', () => {
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('doc-1', 0, '', 0, 0, embedding);
      }).toThrow(ChunkValidationError);
    });

    it('should handle content with exactly 1800 characters (default chunk size)', () => {
      const content = 'A'.repeat(1800); // Default DocumentIndexer chunk size
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, embedding);
      }).not.toThrow();
    });
  });

  describe('Character-based chunking simulation', () => {
    it('should simulate DocumentIndexer character-based chunking', () => {
      const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100); // ~5600 characters
      const chunkSize = 1800;
      const overlapSize = 200;
      const chunks: string[] = [];

      // Simulate DocumentIndexer logic
      for (let i = 0; i < longText.length; i += chunkSize - overlapSize) {
        const chunkContent = longText.slice(i, i + chunkSize).trim();
        if (chunkContent) {
          chunks.push(chunkContent);
        }
      }

      // All chunks should be within the 2048 character limit
      chunks.forEach((chunkContent, index) => {
        expect(chunkContent.length).toBeLessThanOrEqual(2048);

        // Create actual Chunk objects to test validation
        const embedding = new Float32Array(512).fill(0.1);
        expect(() => {
          Chunk.create('doc-1', index, chunkContent, 0, chunkContent.length, embedding);
        }).not.toThrow();
      });

      // Should create multiple chunks for long text
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('Other validation rules', () => {
    it('should validate embedding dimensions', () => {
      const content = 'Test content';
      const wrongSizeEmbedding = new Float32Array(256).fill(0.1); // Wrong size

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, wrongSizeEmbedding);
      }).toThrow(ChunkValidationError);

      expect(() => {
        Chunk.create('doc-1', 0, content, 0, content.length, wrongSizeEmbedding);
      }).toThrow('Embedding must have 512 dimensions');
    });

    it('should validate chunk index', () => {
      const content = 'Test content';
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('doc-1', -1, content, 0, content.length, embedding); // Negative index
      }).toThrow(ChunkValidationError);

      expect(() => {
        Chunk.create('doc-1', -1, content, 0, content.length, embedding);
      }).toThrow('Chunk index must be >= 0');
    });

    it('should validate document ID', () => {
      const content = 'Test content';
      const embedding = new Float32Array(512).fill(0.1);

      expect(() => {
        Chunk.create('', 0, content, 0, content.length, embedding); // Empty document ID
      }).toThrow(ChunkValidationError);

      expect(() => {
        Chunk.create('', 0, content, 0, content.length, embedding);
      }).toThrow('Document ID must not be empty');
    });
  });
});